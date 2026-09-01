package main

import (
	"backend-v2/internal/common/checkedlog"

	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

const runtimeRegisteredCanary = "syntheticRuntimeCanary12345"

func TestBackendProcessUsesConfiguredCheckerForStartupLogs(t *testing.T) {
	harness := newRuntimeHarness(t)

	result := harness.runBackend(t, map[string]string{
		"D5_REDACTION_CHECKER_PATH":           harness.checkerPath,
		"D5_REDACTION_REGISTERED_VALUES_FILE": harness.valuesPath,
		"MONGO_USERNAME":                      runtimeRegisteredCanary,
		"PORT":                                "39996",
	})

	if strings.Contains(result.stdout+result.stderr, runtimeRegisteredCanary) {
		t.Fatalf("backend emitted registered value:\nstdout=%s\nstderr=%s", result.stdout, result.stderr)
	}
	for _, part := range []string{"PORT=39996", "[REDACTED]"} {
		if !strings.Contains(result.stdout, part) {
			t.Fatalf("startup stdout missing %q:\n%s", part, result.stdout)
		}
	}
}

func TestBackendProcessDoesNotListenBeforeDependencySetup(t *testing.T) {
	harness := newRuntimeHarness(t)

	result := harness.runBackend(t, map[string]string{
		"D5_REDACTION_CHECKER_PATH":           harness.checkerPath,
		"D5_REDACTION_REGISTERED_VALUES_FILE": harness.valuesPath,
		"MONGO_USERNAME":                      runtimeRegisteredCanary,
		"MONGO_URI":                           "://invalid-mongo-uri",
		"PORT":                                "39996",
	})

	combined := result.stdout + result.stderr
	if result.exitCode == 0 {
		t.Fatal("backend exit code = 0, want dependency setup failure before listen")
	}
	if strings.Contains(combined, "Fiber v") || strings.Contains(combined, "GET |") {
		t.Fatalf("backend listened before dependency setup completed:\nstdout=%s\nstderr=%s", result.stdout, result.stderr)
	}
	if strings.Contains(combined, runtimeRegisteredCanary) {
		t.Fatalf("backend emitted registered value:\nstdout=%s\nstderr=%s", result.stdout, result.stderr)
	}
	for _, part := range []string{"PORT=39996", "[REDACTED]", "Mongo connection error"} {
		if !strings.Contains(combined, part) {
			t.Fatalf("backend output missing %q:\nstdout=%s\nstderr=%s", part, result.stdout, result.stderr)
		}
	}
}

func TestBackendProcessFailsClosedWhenCheckerCannotApproveLogs(t *testing.T) {
	tests := []struct {
		name        string
		checkerMode string
		env         map[string]string
	}{
		{
			name: "missing checker",
			env: map[string]string{
				"D5_REDACTION_CHECKER_PATH": "/missing/value-redaction-check",
			},
		},
		{
			name:        "wrong version",
			checkerMode: "mismatch-version",
		},
		{
			name:        "timeout",
			checkerMode: "slow-version",
			env: map[string]string{
				"D5_REDACTION_TIMEOUT_MS": "50",
			},
		},
		{
			name:        "rejecting checker",
			checkerMode: "reject-redact",
		},
		{
			name: "unreadable registered values",
			env: map[string]string{
				"D5_REDACTION_REGISTERED_VALUES_FILE": "/missing/registered-values.json",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			harness := newRuntimeHarnessWithMode(t, tt.checkerMode)
			env := map[string]string{
				"D5_REDACTION_CHECKER_PATH":           harness.checkerPath,
				"D5_REDACTION_REGISTERED_VALUES_FILE": harness.valuesPath,
				"MONGO_USERNAME":                      runtimeRegisteredCanary,
			}
			for key, value := range tt.env {
				env[key] = value
			}

			result := harness.runBackend(t, env)

			if result.exitCode == 0 {
				t.Fatalf("backend exit code = 0, want fail-closed nonzero")
			}
			if result.stdout != "" {
				t.Fatalf("fail-closed stdout = %q, want empty", result.stdout)
			}
			if result.stderr != "redaction unavailable: log suppressed\n" {
				t.Fatalf("fail-closed stderr = %q", result.stderr)
			}
			if strings.Contains(result.stdout+result.stderr, runtimeRegisteredCanary) {
				t.Fatalf("fail-closed output leaked registered value:\nstdout=%s\nstderr=%s", result.stdout, result.stderr)
			}
		})
	}
}

func TestEntrypointProcessesFailClosedBeforeUncheckedOutput(t *testing.T) {
	tests := []struct {
		name      string
		buildPath string
		args      []string
	}{
		{name: "service missing checker", buildPath: "."},
		{name: "seed command missing checker", buildPath: "./cmd/seed-users", args: []string{"-uri", "mongodb://127.0.0.1:1/delta5"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			harness := newEntrypointHarness(t, tt.buildPath)

			result := harness.runCommand(t, tt.args, map[string]string{
				"D5_REDACTION_CHECKER_PATH":           "/missing/value-redaction-check",
				"D5_REDACTION_REGISTERED_VALUES_FILE": harness.valuesPath,
				"MONGO_USERNAME":                      runtimeRegisteredCanary,
			})

			if result.exitCode == 0 {
				t.Fatalf("entrypoint exit code = 0, want fail-closed nonzero")
			}
			if result.stdout != "" {
				t.Fatalf("fail-closed stdout = %q, want empty", result.stdout)
			}
			if result.stderr != "redaction unavailable: log suppressed\n" {
				t.Fatalf("fail-closed stderr = %q", result.stderr)
			}
		})
	}
}

func TestSeedCommandParseFailuresEmitOnlyFixedSuppression(t *testing.T) {
	tests := []struct {
		name string
		args []string
	}{
		{name: "malformed boolean", args: []string{"-drop=" + runtimeRegisteredCanary}},
		{name: "unknown argument", args: []string{"-unknown=" + runtimeRegisteredCanary}},
		{name: "malformed uri flag", args: []string{"-uri", "mongodb://127.0.0.1:1/delta5", "-unknown=" + runtimeRegisteredCanary}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			harness := newEntrypointHarness(t, "./cmd/seed-users")

			result := harness.runCommand(t, tt.args, map[string]string{
				"D5_REDACTION_CHECKER_PATH":           harness.checkerPath,
				"D5_REDACTION_REGISTERED_VALUES_FILE": harness.valuesPath,
			})

			if result.exitCode == 0 {
				t.Fatal("seed command exit code = 0, want parse failure")
			}
			if result.stdout != "" {
				t.Fatalf("parse failure stdout = %q, want empty", result.stdout)
			}
			if result.stderr != "redaction unavailable: log suppressed\n" {
				t.Fatalf("parse failure stderr = %q", result.stderr)
			}
			if strings.Contains(result.stderr, runtimeRegisteredCanary) {
				t.Fatalf("parse failure leaked registered value: %q", result.stderr)
			}
		})
	}
}

type runtimeHarness struct {
	backendPath string
	checkerPath string
	valuesPath  string
}

type backendRunResult struct {
	stdout   string
	stderr   string
	exitCode int
}

func newRuntimeHarness(t *testing.T) runtimeHarness {
	t.Helper()
	return newRuntimeHarnessWithMode(t, "")
}

func newRuntimeHarnessWithMode(t *testing.T, checkerMode string) runtimeHarness {
	t.Helper()
	return newEntrypointHarnessWithMode(t, ".", checkerMode)
}

func newEntrypointHarness(t *testing.T, packagePath string) runtimeHarness {
	t.Helper()
	return newEntrypointHarnessWithMode(t, packagePath, "")
}

func newEntrypointHarnessWithMode(t *testing.T, packagePath string, checkerMode string) runtimeHarness {
	t.Helper()
	dir := t.TempDir()
	backendPath := filepath.Join(dir, "backend-v2")
	checkerPath := filepath.Join(dir, "bin", "value-redaction-check")
	valuesPath := filepath.Join(dir, "registered-values.json")

	if err := os.MkdirAll(filepath.Dir(checkerPath), 0o700); err != nil {
		t.Fatalf("create checker bin dir: %v", err)
	}
	writeRuntimePackageManifest(t, dir)

	if err := os.WriteFile(valuesPath, []byte(`["`+runtimeRegisteredCanary+`"]`), 0o600); err != nil {
		t.Fatalf("write values file: %v", err)
	}
	buildGoProgram(t, backendPath, packagePath)
	writeRuntimeChecker(t, checkerPath, checkerMode)

	return runtimeHarness{
		backendPath: backendPath,
		checkerPath: checkerPath,
		valuesPath:  valuesPath,
	}
}

func (h runtimeHarness) runBackend(t *testing.T, overrides map[string]string) backendRunResult {
	t.Helper()
	return h.runCommand(t, nil, overrides)
}

func (h runtimeHarness) runCommand(t *testing.T, args []string, overrides map[string]string) backendRunResult {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 1500*time.Millisecond)
	defer cancel()
	cmd := exec.CommandContext(ctx, h.backendPath, args...)
	cmd.Env = h.environment(overrides)
	output, err := cmd.Output()
	stderr := ""
	if exitErr, ok := err.(*exec.ExitError); ok {
		stderr = string(exitErr.Stderr)
		return backendRunResult{stdout: string(output), stderr: stderr, exitCode: exitErr.ExitCode()}
	}
	if err != nil {
		t.Fatalf("run command: %v", err)
	}
	return backendRunResult{stdout: string(output), exitCode: 0}
}

func (h runtimeHarness) environment(overrides map[string]string) []string {
	env := append(os.Environ(),
		"D5_REDACTION_CHECKER_PATH="+h.checkerPath,
		"D5_REDACTION_REGISTERED_VALUES_FILE="+h.valuesPath,
		"D5_REDACTION_TIMEOUT_MS=1000",
		"MOCK_EXTERNAL_SERVICES=true",
		"MONGO_URI=mongodb://127.0.0.1:1/delta5",
		"MONGO_USERNAME=delta5",
		"API_ROOT=/api/v2",
		"PORT=39995",
	)
	for key, value := range overrides {
		env = append(env, key+"="+value)
	}
	return env
}

func buildGoProgram(t *testing.T, output string, packagePath string) {
	t.Helper()
	cmd := exec.Command("go", "build", "-buildvcs=false", "-o", output, packagePath)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("build %s: %v\n%s", packagePath, err, out)
	}
}

func writeRuntimeChecker(t *testing.T, checkerPath string, checkerMode string) {
	t.Helper()
	source := `#!/usr/bin/env node
const fs = require('node:fs');
const mode = "` + checkerMode + `";
const args = process.argv.slice(2);
if (args[0] === '--version') {
  if (mode === 'slow-version') {
    setTimeout(() => process.stdout.write('redaction-rules-v3\n'), 1000);
  } else {
    process.stdout.write((mode === 'mismatch-version' ? 'redaction-rules-v1' : 'redaction-rules-v3') + '\n');
  }
} else {
  if (mode === 'reject-redact') process.exit(2);
  const valuesPath = args[args.indexOf('--values-file') + 1] || '';
  if (!fs.existsSync(valuesPath)) process.exit(3);
  const input = fs.readFileSync(0, 'utf8');
  process.stdout.write(
    input
      .replaceAll('` + runtimeRegisteredCanary + `', '[REDACTED]')
      .replaceAll('Bearer abcdefghijklmnopqrstu12345', 'Bearer [REDACTED]')
  );
}
`
	if err := os.WriteFile(checkerPath, []byte(source), 0o700); err != nil {
		t.Fatalf("write checker source: %v", err)
	}
}

func writeRuntimePackageManifest(t *testing.T, root string) {
	t.Helper()
	manifestJSON, err := json.Marshal(map[string]any{
		"name":    checkedlog.ExpectedPackageName,
		"version": checkedlog.ExpectedPackageVersion,
		"engines": map[string]string{"node": checkedlog.ExpectedNodeEngine},
		"bin":     map[string]string{"value-redaction-check": "bin/value-redaction-check"},
	})
	if err != nil {
		t.Fatalf("marshal runtime package manifest: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "package.json"), manifestJSON, 0o600); err != nil {
		t.Fatalf("write runtime package manifest: %v", err)
	}
}
