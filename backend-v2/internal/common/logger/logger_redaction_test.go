package logger

import (
	"bytes"
	"context"
	"strings"
	"testing"
	"time"

	"backend-v2/internal/common/checkedlog"
)

type redactingTestChecker struct{}

func (redactingTestChecker) Version(context.Context) (checkedlog.Version, error) {
	return checkedlog.Version{PackageVersion: checkedlog.ExpectedPackageVersion, RuleSetVersion: checkedlog.ExpectedRuleSetVersion}, nil
}

func (redactingTestChecker) Redact(_ context.Context, text string) (checkedlog.Result, error) {
	return checkedlog.Result{Text: strings.ReplaceAll(text, "syntheticRegisteredCanary12345", "[REDACTED]")}, nil
}

func TestFirstPartyLoggerMethodsPassThroughCheckedBoundary(t *testing.T) {
	tests := []struct {
		name       string
		debug      string
		emit       func(*Logger)
		wantStdout []string
		wantStderr []string
	}{
		{
			name:       "info uses checked stdout",
			emit:       func(log *Logger) { log.Info("ordinary before %s ordinary after", "syntheticRegisteredCanary12345") },
			wantStdout: []string{"[OP27]", "ordinary before", "[REDACTED]", "ordinary after"},
		},
		{
			name:       "warn uses checked stdout",
			emit:       func(log *Logger) { log.Warn("ordinary %s", "syntheticRegisteredCanary12345") },
			wantStdout: []string{"[OP27] WARN:", "ordinary", "[REDACTED]"},
		},
		{
			name:       "error uses checked stderr",
			emit:       func(log *Logger) { log.Error("ordinary %s", "syntheticRegisteredCanary12345") },
			wantStderr: []string{"[OP27] ERROR:", "ordinary", "[REDACTED]"},
		},
		{
			name:       "debug enabled uses checked stdout",
			debug:      "true",
			emit:       func(log *Logger) { log.Debug("ordinary %s", "syntheticRegisteredCanary12345") },
			wantStdout: []string{"[OP27] DEBUG:", "ordinary", "[REDACTED]"},
		},
		{
			name: "debug disabled emits nothing",
			emit: func(log *Logger) { log.Debug("ordinary %s", "syntheticRegisteredCanary12345") },
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("DEBUG", tt.debug)
			var stdout bytes.Buffer
			var stderr bytes.Buffer
			defer checkedlog.ConfigureDefaultForTest(&stdout, &stderr, redactingTestChecker{}, time.Second)()

			tt.emit(New("op27"))

			assertLogOutput(t, stdout.String(), tt.wantStdout)
			assertLogOutput(t, stderr.String(), tt.wantStderr)
		})
	}
}

func TestMigratedStandardWarningsUseCheckedStderr(t *testing.T) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	defer checkedlog.ConfigureDefaultForTest(&stdout, &stderr, redactingTestChecker{}, time.Second)()

	checkedlog.Warnf("ordinary %s", "syntheticRegisteredCanary12345")

	if stdout.Len() != 0 {
		t.Fatalf("migrated warning stdout = %q, want empty", stdout.String())
	}
	assertLogOutput(t, stderr.String(), []string{"ordinary", "[REDACTED]"})
}

func TestProjectWarnMethodKeepsCheckedStdout(t *testing.T) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	defer checkedlog.ConfigureDefaultForTest(&stdout, &stderr, redactingTestChecker{}, time.Second)()

	New("op27").Warn("ordinary %s", "syntheticRegisteredCanary12345")

	assertLogOutput(t, stdout.String(), []string{"[OP27] WARN:", "ordinary", "[REDACTED]"})
	if stderr.Len() != 0 {
		t.Fatalf("project warning stderr = %q, want empty", stderr.String())
	}
}

func assertLogOutput(t *testing.T, got string, wantParts []string) {
	t.Helper()
	if strings.Contains(got, "syntheticRegisteredCanary12345") {
		t.Fatalf("log output leaked secret: %q", got)
	}
	for _, part := range wantParts {
		if !strings.Contains(got, part) {
			t.Fatalf("log output = %q, missing %q", got, part)
		}
	}
	if len(wantParts) == 0 && got != "" {
		t.Fatalf("log output = %q, want empty", got)
	}
}
