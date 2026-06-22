package unauth_test

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"

	"backend-v2/internal/config"
	"backend-v2/internal/modules/unauth"

	"github.com/gofiber/fiber/v2"
)

func newApp() *fiber.App {
	app := fiber.New()
	unauth.RegisterRoutes(app, unauth.NewController())
	return app
}

func parseRevisionResponse(t *testing.T, app *fiber.App) map[string]string {
	t.Helper()
	req := httptest.NewRequest("GET", "/revision", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("GET /revision failed: %v", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var result map[string]string
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("response is not valid JSON: %v — body: %s", err, body)
	}
	return result
}

func TestVersionStatus_AlwaysRespondsWith200(t *testing.T) {
	req := httptest.NewRequest("GET", "/revision", nil)
	resp, err := newApp().Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("status: want 200, got %d", resp.StatusCode)
	}
}

func TestVersionStatus_RevisionFieldPassesThrough(t *testing.T) {
	cases := []struct {
		name     string
		revision string
	}{
		{"git short sha", "a1b2c3d"},
		{"full 40-char sha", "4b825dc642cb6eb9a060e54bf8d69288fbee4904"},
		{"semver tag", "v2.3.1-rc.4"},
		{"branch-qualified ref", "refs/heads/feature/360-validate"},
		{"numeric build stamp", "20260620001"},
		{"dev sentinel", "dev"},
		{"commit+tree composite format", "4b825dc642cb6eb9a060e54bf8d69288fbee4904+abc123def456abc123def456abc123def456abc1"},
		{"commit+tree composite with dirty marker", "4b825dc642cb6eb9a060e54bf8d69288fbee4904+abc123def456abc123def456abc123def456abc1[dirty]"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			original := config.BuildRevision
			t.Cleanup(func() { config.BuildRevision = original })
			config.BuildRevision = tc.revision

			result := parseRevisionResponse(t, newApp())
			if result["revision"] != tc.revision {
				t.Errorf("revision: want %q, got %q", tc.revision, result["revision"])
			}
		})
	}
}

func TestVersionStatus_ResponseContainsExactlyRevisionKey(t *testing.T) {
	original := config.BuildRevision
	t.Cleanup(func() { config.BuildRevision = original })
	config.BuildRevision = "shape-test"

	result := parseRevisionResponse(t, newApp())
	if len(result) != 1 {
		t.Errorf("response has %d key(s), want exactly 1: %v", len(result), result)
	}
	if _, ok := result["revision"]; !ok {
		t.Errorf("response missing 'revision' key: %v", result)
	}
}

func TestRegisterRoutes_AllUnauthRoutes(t *testing.T) {
	expected := map[string]bool{
		"/health":   false,
		"/healthz":  false,
		"/metrics":  false,
		"/revision": false,
	}

	app := fiber.New()
	unauth.RegisterRoutes(app, unauth.NewController())

	for _, stack := range app.Stack() {
		for _, route := range stack {
			if _, ok := expected[route.Path]; ok && route.Method == "GET" {
				expected[route.Path] = true
			}
		}
	}

	for path, found := range expected {
		if !found {
			t.Errorf("GET %s not registered", path)
		}
	}
}

func TestVersionStatus_ContentTypeIsApplicationJSON(t *testing.T) {
	req := httptest.NewRequest("GET", "/revision", nil)
	resp, err := newApp().Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	ct := resp.Header.Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("Content-Type: want %q, got %q", "application/json", ct)
	}
}

func TestVersionStatus_NonGetMethodsAreNotHandled(t *testing.T) {
	methods := []string{"POST", "PUT", "DELETE", "PATCH"}
	app := newApp()

	for _, method := range methods {
		t.Run(method, func(t *testing.T) {
			req := httptest.NewRequest(method, "/revision", nil)
			resp, err := app.Test(req)
			if err != nil {
				t.Fatalf("%s /revision failed: %v", method, err)
			}
			defer resp.Body.Close()

			if resp.StatusCode == 200 {
				t.Errorf("%s /revision: got 200, want a non-2xx status (route is GET-only)", method)
			}
		})
	}
}
