package main

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"backend-v2/internal/common/checkedlog"

	"github.com/gofiber/fiber/v2"
)

type requestRedactingChecker struct{}

const structuralRequestCredentialValue = "ghp_abcdefghij"

func (requestRedactingChecker) Version(context.Context) (checkedlog.Version, error) {
	return checkedlog.Version{PackageVersion: checkedlog.ExpectedPackageVersion, RuleSetVersion: checkedlog.ExpectedRuleSetVersion}, nil
}

func (requestRedactingChecker) Redact(_ context.Context, text string) (checkedlog.Result, error) {
	replacer := strings.NewReplacer(
		"syntheticRequestCanary12345", "[REDACTED]",
		structuralRequestCredentialValue, strings.Repeat("[", len(structuralRequestCredentialValue)),
	)
	return checkedlog.Result{Text: replacer.Replace(text)}, nil
}

func TestHTTPRequestLoggerPassesThroughCheckedBoundary(t *testing.T) {
	tests := []struct {
		name          string
		path          string
		method        string
		registerRoute bool
		wantStatus    int
		wantParts     []string
		forbidParts   []string
	}{
		{
			name:          "ordinary request path reaches stdout when no query is present",
			path:          "/ordinary/request",
			method:        "GET",
			registerRoute: true,
			wantStatus:    200,
			wantParts:     []string{"GET", "/ordinary/request"},
		},
		{
			name:          "registered path value is removed when no query is present",
			path:          "/request/syntheticRequestCanary12345",
			method:        "GET",
			registerRoute: true,
			wantStatus:    200,
			wantParts:     []string{"GET", "/request/", "[REDACTED]"},
			forbidParts:   []string{"syntheticRequestCanary12345"},
		},
		{
			name:          "structural path credential is removed when checker returns redacted text",
			path:          "/api/v2/qa/token/" + structuralRequestCredentialValue,
			method:        "GET",
			registerRoute: true,
			wantStatus:    200,
			wantParts:     []string{"GET", "/api/v2/qa/token/", strings.Repeat("[", len(structuralRequestCredentialValue))},
			forbidParts:   []string{structuralRequestCredentialValue},
		},
		{
			name:          "structural query credential is removed when checker returns redacted text",
			path:          "/api/v2/qa/token-query?token=" + structuralRequestCredentialValue + "&note=visible",
			method:        "GET",
			registerRoute: true,
			wantStatus:    200,
			wantParts:     []string{"GET", "/api/v2/qa/token-query", "token=" + strings.Repeat("[", len(structuralRequestCredentialValue)) + "&note=visible"},
			forbidParts:   []string{structuralRequestCredentialValue},
		},
		{
			name:       "ordinary unmatched query remains observable without route-shaped target",
			path:       "/api/v2/redaction/query?message=ordinary&note=visible",
			method:     "GET",
			wantStatus: 404,
			wantParts:  []string{"GET", "/api/v2/redaction/query", "message=ordinary&note=visible"},
		},
		{
			name:          "ordinary matched query remains observable without route-shaped target",
			path:          "/api/v2/redaction/query?message=ordinary&note=visible",
			method:        "GET",
			registerRoute: true,
			wantStatus:    200,
			wantParts:     []string{"GET", "/api/v2/redaction/query", "message=ordinary&note=visible"},
		},
		{
			name:       "ordinary bearer prose query remains observable without route-shaped target",
			path:       "/api/v2/redaction/query?message=Bearer%20a&note=ordinary",
			method:     "GET",
			wantStatus: 404,
			wantParts:  []string{"GET", "/api/v2/redaction/query", "message=Bearer%20a&note=ordinary"},
		},
		{
			name:          "registered query value is removed while query remains observable",
			path:          "/api/v2/redaction/query?message=syntheticRequestCanary12345&note=visible",
			method:        "POST",
			registerRoute: true,
			wantStatus:    200,
			wantParts:     []string{"POST", "/api/v2/redaction/query", "message=[REDACTED]&note=visible"},
			forbidParts:   []string{"syntheticRequestCanary12345"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var stdout bytes.Buffer
			var stderr bytes.Buffer
			defer checkedlog.ConfigureDefaultForTest(&stdout, &stderr, requestRedactingChecker{}, time.Second)()
			app := fiber.New()
			app.Use(checkedlog.RequestLogger())
			if tt.registerRoute {
				app.All("/*", func(c *fiber.Ctx) error { return c.SendString("ok") })
			}

			_, err := app.Test(httptest.NewRequest(tt.method, tt.path, nil), -1)
			if err != nil {
				t.Fatalf("request probe failed: %v", err)
			}
			got := stdout.String()
			fields := strings.Split(strings.TrimSpace(got), " | ")
			if len(fields) != 7 {
				t.Fatalf("HTTP request log fields = %v, want 7 telemetry fields in %q", fields, got)
			}
			if _, err := time.Parse("15:04:05", fields[0]); err != nil {
				t.Fatalf("HTTP request log time field = %q: %v", fields[0], err)
			}
			if status, err := strconv.Atoi(fields[1]); err != nil || status != tt.wantStatus {
				t.Fatalf("HTTP request log status field = %q, want %d", fields[1], tt.wantStatus)
			}
			if _, err := time.ParseDuration(fields[2]); err != nil {
				t.Fatalf("HTTP request log latency field = %q: %v", fields[2], err)
			}
			if fields[3] == "" || fields[4] != tt.method || fields[5] == "" || fields[6] == "" {
				t.Fatalf("HTTP request log telemetry fields invalid: %v", fields)
			}
			for _, part := range tt.wantParts {
				if !strings.Contains(got, part) {
					t.Fatalf("HTTP request log = %q, missing %q", got, part)
				}
			}
			for _, part := range tt.forbidParts {
				if strings.Contains(got, part) {
					t.Fatalf("HTTP request log = %q, contains forbidden %q", got, part)
				}
			}
			if stderr.Len() != 0 {
				t.Fatalf("HTTP request logger wrote stderr: %q", stderr.String())
			}
		})
	}
}

func TestHTTPRequestLoggerEmitsOnlySuppressionWhenCheckerRejectsQueryLog(t *testing.T) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	rejectingChecker := requestRedactingCheckerFunc(func(context.Context, string) (checkedlog.Result, error) {
		return checkedlog.Result{}, errors.New("checker rejected request log")
	})
	defer checkedlog.ConfigureDefaultForTest(&stdout, &stderr, rejectingChecker, time.Second)()
	app := fiber.New()
	app.Use(checkedlog.RequestLogger())

	_, err := app.Test(httptest.NewRequest("GET", "/api/v2/redaction/query?message=syntheticRequestCanary12345", nil), -1)
	if err != nil {
		t.Fatalf("request probe failed: %v", err)
	}

	if got := stdout.String(); got != "redaction unavailable: log suppressed\n" {
		t.Fatalf("HTTP request logger output = %q, want fixed suppression", got)
	}
	if strings.Contains(stdout.String()+stderr.String(), "syntheticRequestCanary12345") {
		t.Fatalf("HTTP request logger leaked rejected query: stdout=%q stderr=%q", stdout.String(), stderr.String())
	}
	if stderr.Len() != 0 {
		t.Fatalf("HTTP request logger wrote stderr: %q", stderr.String())
	}
}

func TestHTTPRequestLoggerRecordsHandledErrorStatusOnce(t *testing.T) {
	tests := []struct {
		name             string
		routeErr         error
		errorHandler     fiber.ErrorHandler
		wantStatus       int
		wantErrorField   string
		wantResponseBody string
	}{
		{
			name:             "default handler preserves Fiber error status",
			routeErr:         fiber.ErrTeapot,
			wantStatus:       fiber.StatusTeapot,
			wantErrorField:   fiber.ErrTeapot.Error(),
			wantResponseBody: fiber.ErrTeapot.Error(),
		},
		{
			name:             "default handler maps ordinary errors to internal server error",
			routeErr:         errors.New("ordinary handler failure"),
			wantStatus:       fiber.StatusInternalServerError,
			wantErrorField:   "ordinary handler failure",
			wantResponseBody: "ordinary handler failure",
		},
		{
			name:     "configured handler status is logged after handling",
			routeErr: errors.New("custom handled error"),
			errorHandler: func(c *fiber.Ctx, err error) error {
				return c.Status(fiber.StatusUnavailableForLegalReasons).SendString("custom handled")
			},
			wantStatus:       fiber.StatusUnavailableForLegalReasons,
			wantErrorField:   "custom handled error",
			wantResponseBody: "custom handled",
		},
		{
			name:     "failing configured handler falls back to internal server error",
			routeErr: errors.New("route failure"),
			errorHandler: func(c *fiber.Ctx, err error) error {
				return errors.New("error handler failure")
			},
			wantStatus:       fiber.StatusInternalServerError,
			wantErrorField:   "error handler failure",
			wantResponseBody: "Internal Server Error",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var stdout bytes.Buffer
			var stderr bytes.Buffer
			defer checkedlog.ConfigureDefaultForTest(&stdout, &stderr, requestRedactingChecker{}, time.Second)()
			handlerCalls := 0
			handler := tt.errorHandler
			if handler == nil {
				handler = fiber.DefaultErrorHandler
			}
			app := fiber.New(fiber.Config{
				ErrorHandler: func(c *fiber.Ctx, err error) error {
					handlerCalls++
					return handler(c, err)
				},
			})
			app.Use(checkedlog.RequestLogger())
			app.Get("/handled-error", func(c *fiber.Ctx) error { return tt.routeErr })

			res, err := app.Test(httptest.NewRequest("GET", "/handled-error?ordinary=visible", nil), -1)
			if err != nil {
				t.Fatalf("request probe failed: %v", err)
			}

			if res.StatusCode != tt.wantStatus {
				t.Fatalf("HTTP response status = %d, want %d", res.StatusCode, tt.wantStatus)
			}
			if handlerCalls != 1 {
				t.Fatalf("Fiber error handler calls = %d, want 1", handlerCalls)
			}
			body := readResponseBody(t, res)
			if body != tt.wantResponseBody {
				t.Fatalf("HTTP response body = %q, want %q", body, tt.wantResponseBody)
			}
			fields := requestLogFields(t, stdout.String())
			if fields[1] != strconv.Itoa(tt.wantStatus) {
				t.Fatalf("HTTP request log status field = %q, want %d in %q", fields[1], tt.wantStatus, stdout.String())
			}
			if fields[5] != "/handled-error?ordinary=visible" {
				t.Fatalf("HTTP request log path field = %q, want raw query path", fields[5])
			}
			if fields[6] != tt.wantErrorField {
				t.Fatalf("HTTP request log error field = %q, want %q", fields[6], tt.wantErrorField)
			}
			if stderr.Len() != 0 {
				t.Fatalf("HTTP request logger wrote stderr: %q", stderr.String())
			}
		})
	}
}

func requestLogFields(t *testing.T, got string) []string {
	t.Helper()
	fields := strings.Split(strings.TrimSpace(got), " | ")
	if len(fields) != 7 {
		t.Fatalf("HTTP request log fields = %v, want 7 telemetry fields in %q", fields, got)
	}
	return fields
}

func readResponseBody(t *testing.T, res *http.Response) string {
	t.Helper()
	content, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatalf("read response body: %v", err)
	}
	return string(content)
}

type requestRedactingCheckerFunc func(context.Context, string) (checkedlog.Result, error)

func (f requestRedactingCheckerFunc) Version(context.Context) (checkedlog.Version, error) {
	return checkedlog.Version{PackageVersion: checkedlog.ExpectedPackageVersion, RuleSetVersion: checkedlog.ExpectedRuleSetVersion}, nil
}

func (f requestRedactingCheckerFunc) Redact(ctx context.Context, text string) (checkedlog.Result, error) {
	return f(ctx, text)
}
