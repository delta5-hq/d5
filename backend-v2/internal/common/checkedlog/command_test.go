package checkedlog

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestCommandRedactorContract(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell script probe is unix-only")
	}
	redactor := newCommandRedactorFixture(t, "redact")
	t.Run("version agrees with package and rule set", func(t *testing.T) {
		version, err := redactor.Version(context.Background())
		if err != nil {
			t.Fatalf("Version: %v", err)
		}
		if version.PackageVersion != ExpectedPackageVersion || version.RuleSetVersion != ExpectedRuleSetVersion {
			t.Fatalf("version = %#v", version)
		}
	})
	for _, tt := range []struct {
		name     string
		mode     string
		input    string
		wantText string
		wantErr  bool
	}{
		{
			name:     "redacted text preserves ordinary text",
			mode:     "redact",
			input:    "ordinary " + syntheticRegisteredValue + " text",
			wantText: "ordinary [REDACTED] text",
		},
		{
			name:     "checker output is returned byte for byte",
			mode:     "passthrough",
			input:    "ordinary/path remains\nunicode строка stays\tpunctuation=kept",
			wantText: "ordinary/path remains\nunicode строка stays\tpunctuation=kept",
		},
		{
			name:     "empty input returns empty output",
			mode:     "empty",
			input:    "",
			wantText: "",
		},
		{
			name:    "checker hold is rejected",
			mode:    "hold",
			input:   "ordinary " + syntheticRegisteredValue + " text",
			wantErr: true,
		},
		{
			name:    "checker rejection is rejected",
			mode:    "reject",
			input:   "ordinary " + syntheticRegisteredValue + " text",
			wantErr: true,
		},
		{
			name:    "missing values file is rejected",
			mode:    "missing-values",
			input:   "ordinary " + syntheticRegisteredValue + " text",
			wantErr: true,
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			redactor := newCommandRedactorFixture(t, tt.mode)

			result, err := redactor.Redact(context.Background(), tt.input)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected redaction error")
				}
				return
			}
			if err != nil {
				t.Fatalf("Redact: %v", err)
			}
			if result.Held {
				t.Fatalf("Held = true, want false")
			}
			if result.Text != tt.wantText {
				t.Fatalf("redacted text = %q, want %q", result.Text, tt.wantText)
			}
			if strings.Contains(result.Text, syntheticRegisteredValue) {
				t.Fatalf("redacted output leaked secret: %q", result.Text)
			}
		})
	}
}

func TestCommandRedactorRealCheckerPreservesOrdinaryText(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("real checker probe is unix-only")
	}
	redactor := newRealCommandRedactorFromEnv(t)

	for _, tt := range []realCheckerPreservationCase{
		{
			name:  "multilingual prose with punctuation",
			input: "ordinary multilingual prose stays byte-identical: Привет мир مرحبا こんにちは punctuation - _",
		},
		{
			name:  "ordinary prose containing token as a word",
			input: "ordinary prose may contain the word Token without a credential candidate",
		},
		{
			name:  "path query syntax and separators",
			input: "GET /api/v2/items?kind=ordinary_value&locale=en-US completed",
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			assertRealCheckerPreservesText(t, redactor, tt.input)
		})
	}
}

func TestCommandRedactorRealCheckerRedactsSecretMaterialLengthPreserving(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("real checker probe is unix-only")
	}
	redactor := newRealCommandRedactorFromEnv(t)

	for _, tt := range []lengthPreservingRedactionCase{
		{
			name:           "registered value",
			input:          "ordinary before syntheticRuntimeCanary12345 after",
			secret:         "syntheticRuntimeCanary12345",
			preservedParts: []string{"ordinary before", "after"},
		},
		{
			name:           "structural bearer value",
			input:          "ordinary before Bearer abcdefghijklmnopqrstu12345 after",
			secret:         "abcdefghijklmnopqrstu12345",
			preservedParts: []string{"ordinary before", "after"},
		},
		{
			name:           "donor-service token in request path",
			input:          "GET /api/v2/qa/token/ghp_abcdefghij completed",
			secret:         "ghp_abcdefghij",
			preservedParts: []string{"GET /api/v2/qa/token/", "completed"},
		},
		{
			name:           "AWS access key in prose",
			input:          "ordinary before key AKIAIOSFODNN7EXAMPLE after",
			secret:         "AKIAIOSFODNN7EXAMPLE",
			preservedParts: []string{"ordinary before key", "after"},
		},
		{
			name:           "donor-service token in query",
			input:          "GET /api/v2/health?token=ghp_abcdefghij completed",
			secret:         "ghp_abcdefghij",
			preservedParts: []string{"GET /api/v2/health?token=", "completed"},
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			assertRealCheckerRedactsLengthPreserving(t, redactor, tt.input, tt.secret, tt.preservedParts...)
		})
	}
}

func TestCommandRedactorRealCheckerSuppressesHeldCandidates(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("real checker probe is unix-only")
	}
	redactor := newRealCommandRedactorFromEnv(t)

	for _, tt := range []heldCandidateCase{
		{
			name:      "no digit high entropy candidate with dash and underscore separators",
			input:     "ordinary before AbCdEfGhIjKlMnOpQrStUvWxYz_-AbCdEfGhIjKlMnOpQrStUvWxYz after",
			candidate: "AbCdEfGhIjKlMnOpQrStUvWxYz_-AbCdEfGhIjKlMnOpQrStUvWxYz",
		},
		{
			name:      "credential candidate introduced by token prose",
			input:     "ordinary prose says Token AbCdEfGhIjKlMnOpQrStUvWxYzabcdefghijklmno before continuing",
			candidate: "AbCdEfGhIjKlMnOpQrStUvWxYzabcdefghijklmno",
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			assertRealCheckerSuppressesText(t, redactor, tt.input, tt.candidate)
		})
	}
}

type realCheckerPreservationCase struct {
	name  string
	input string
}

type lengthPreservingRedactionCase struct {
	name           string
	input          string
	secret         string
	preservedParts []string
}

type heldCandidateCase struct {
	name      string
	input     string
	candidate string
}

func newRealCommandRedactorFromEnv(t *testing.T) *CommandRedactor {
	t.Helper()
	checkerPath := strings.TrimSpace(os.Getenv(EnvCheckerPath))
	valuesPath := strings.TrimSpace(os.Getenv(EnvRegisteredValuesPath))
	if checkerPath == "" || valuesPath == "" {
		t.Skip("real redaction checker environment is not configured")
	}
	redactor, err := NewCommandRedactor(Config{
		CheckerPath:          checkerPath,
		RegisteredValuesPath: valuesPath,
		Timeout:              2 * time.Second,
		PackageVersion:       ExpectedPackageVersion,
		RuleSetVersion:       ExpectedRuleSetVersion,
	})
	if err != nil {
		t.Fatalf("NewCommandRedactor: %v", err)
	}
	version, err := redactor.Version(context.Background())
	if err != nil {
		t.Fatalf("Version: %v", err)
	}
	if version.PackageVersion != ExpectedPackageVersion || version.RuleSetVersion != ExpectedRuleSetVersion {
		t.Fatalf("version = %#v", version)
	}
	return redactor
}

func assertRealCheckerPreservesText(t *testing.T, redactor *CommandRedactor, text string) {
	t.Helper()
	result, err := redactor.Redact(context.Background(), text)
	if err != nil {
		t.Fatalf("Redact: %v", err)
	}
	if result.Text != text {
		t.Fatalf("redacted text = %q, want %q", result.Text, text)
	}
}

func assertRealCheckerRedactsLengthPreserving(t *testing.T, redactor *CommandRedactor, text string, forbidden string, preservedParts ...string) {
	t.Helper()
	result, err := redactor.Redact(context.Background(), text)
	if err != nil {
		t.Fatalf("Redact: %v", err)
	}
	if len(result.Text) != len(text) {
		t.Fatalf("redacted length = %d, want %d in %q", len(result.Text), len(text), result.Text)
	}
	if strings.Contains(result.Text, forbidden) {
		t.Fatalf("redacted output leaked %q in %q", forbidden, result.Text)
	}
	for _, part := range preservedParts {
		if !strings.Contains(result.Text, part) {
			t.Fatalf("redacted output did not preserve %q in %q", part, result.Text)
		}
	}
}

func assertRealCheckerSuppressesText(t *testing.T, redactor *CommandRedactor, attempted string, forbidden string) {
	t.Helper()
	var out bytes.Buffer
	emitter := NewEmitter(&out, redactor, 2*time.Second)

	emitter.Printf("%s", attempted)

	got := out.String()
	if got != suppressedLine {
		t.Fatalf("real checker gate output = %q, want suppression", got)
	}
	if strings.Contains(got, forbidden) {
		t.Fatalf("real checker gate leaked held candidate: %q", got)
	}
}

func TestCommandRedactorInvokesCheckerWithRawContract(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell script probe is unix-only")
	}
	dir := t.TempDir()
	checker := filepath.Join(dir, "bin", "value-redaction-check")
	values := filepath.Join(dir, "values.json")
	if err := os.MkdirAll(filepath.Dir(checker), 0o700); err != nil {
		t.Fatalf("create checker bin dir: %v", err)
	}
	writePackageManifest(t, dir, canonicalPackageManifest())
	argsLog := filepath.Join(dir, "args.log")
	versionEnvLog := filepath.Join(dir, "version-env.log")
	redactEnvLog := filepath.Join(dir, "redact-env.log")
	stdinLog := filepath.Join(dir, "stdin.log")
	input := "path/with/slash " + syntheticRegisteredValue + " unicode строка"
	t.Setenv("JWT_SECRET", "jwtLeak")
	t.Setenv("OPENAI_API_KEY", "providerLeak")
	t.Setenv("MONGO_URI", "mongodb://user:pass@example.test/db")
	t.Setenv(EnvCheckerPath, checker)
	t.Setenv(EnvRegisteredValuesPath, values)

	if err := os.WriteFile(values, []byte("[]"), 0o600); err != nil {
		t.Fatalf("write values file: %v", err)
	}
	script := `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === '--version') {
  fs.writeFileSync("` + argsLog + `", args.join(' ') + "\n");
  fs.writeFileSync("` + versionEnvLog + `", Object.entries(process.env).sort().map(([k,v]) => k + '=' + v).join("\n"));
  process.stdout.write('redaction-rules-v3\n');
  process.exit(0);
}
fs.writeFileSync("` + argsLog + `", args.join(' ') + "\n");
fs.writeFileSync("` + redactEnvLog + `", Object.entries(process.env).sort().map(([k,v]) => k + '=' + v).join("\n"));
const input = fs.readFileSync(0, 'utf8');
fs.writeFileSync("` + stdinLog + `", input);
process.stdout.write(input.replaceAll('syntheticRegisteredCanary12345', '[REDACTED]'));
`
	if err := os.WriteFile(checker, []byte(script), 0o700); err != nil {
		t.Fatalf("write checker: %v", err)
	}
	redactor, err := NewCommandRedactor(Config{
		CheckerPath:          checker,
		RegisteredValuesPath: values,
		Timeout:              time.Second,
		PackageVersion:       ExpectedPackageVersion,
		RuleSetVersion:       ExpectedRuleSetVersion,
	})
	if err != nil {
		t.Fatalf("NewCommandRedactor: %v", err)
	}

	if _, err := redactor.Version(context.Background()); err != nil {
		t.Fatalf("Version: %v", err)
	}
	if got := readTrimmed(t, argsLog); got != "--version" {
		t.Fatalf("version args = %q, want --version", got)
	}

	result, err := redactor.Redact(context.Background(), input)
	if err != nil {
		t.Fatalf("Redact: %v", err)
	}

	if got := readTrimmed(t, argsLog); got != "--values-file "+values {
		t.Fatalf("redact args = %q, want --values-file %s", got, values)
	}
	if got := readTrimmed(t, stdinLog); got != input {
		t.Fatalf("stdin = %q, want %q", got, input)
	}
	assertMinimalCheckerEnv(t, versionEnvLog)
	assertMinimalCheckerEnv(t, redactEnvLog)
	if strings.Contains(result.Text, syntheticRegisteredValue) {
		t.Fatalf("redacted output leaked secret: %q", result.Text)
	}
	if !strings.Contains(result.Text, "path/with/slash") || !strings.Contains(result.Text, "unicode строка") {
		t.Fatalf("redacted output did not preserve ordinary text: %q", result.Text)
	}
}

func TestCommandRedactorRejectsNonCanonicalPackageManifest(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell script probe is unix-only")
	}
	tests := []struct {
		name     string
		manifest map[string]any
	}{
		{
			name: "wrong package name",
			manifest: map[string]any{
				"name":    "local-redaction-fixture",
				"version": ExpectedPackageVersion,
				"engines": map[string]string{"node": ExpectedNodeEngine},
				"bin":     map[string]string{"value-redaction-check": "bin/value-redaction-check"},
			},
		},
		{
			name: "wrong package version",
			manifest: map[string]any{
				"name":    ExpectedPackageName,
				"version": "0.1.1",
				"engines": map[string]string{"node": ExpectedNodeEngine},
				"bin":     map[string]string{"value-redaction-check": "bin/value-redaction-check"},
			},
		},
		{
			name: "wrong node engine",
			manifest: map[string]any{
				"name":    ExpectedPackageName,
				"version": ExpectedPackageVersion,
				"engines": map[string]string{"node": ">=20"},
				"bin":     map[string]string{"value-redaction-check": "bin/value-redaction-check"},
			},
		},
		{
			name: "missing checker bin",
			manifest: map[string]any{
				"name":    ExpectedPackageName,
				"version": ExpectedPackageVersion,
				"engines": map[string]string{"node": ExpectedNodeEngine},
				"bin":     map[string]string{"other-checker": "bin/value-redaction-check"},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			checker, values := writeCheckerFixtureWithManifest(t, "redact", tt.manifest)
			redactor, err := NewCommandRedactor(Config{
				CheckerPath:          checker,
				RegisteredValuesPath: values,
				Timeout:              time.Second,
				PackageVersion:       ExpectedPackageVersion,
				RuleSetVersion:       ExpectedRuleSetVersion,
			})
			if err != nil {
				t.Fatalf("NewCommandRedactor: %v", err)
			}

			if _, err := redactor.Version(context.Background()); err == nil {
				t.Fatal("expected package manifest rejection")
			}
		})
	}
}

func TestCommandRedactorLimitsConcurrentCheckerProcesses(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell script probe is unix-only")
	}
	dir := t.TempDir()
	checker := filepath.Join(dir, "bin", "value-redaction-check")
	values := filepath.Join(dir, "values.json")
	activePath := filepath.Join(dir, "active")
	maxPath := filepath.Join(dir, "max")
	lockPath := filepath.Join(dir, "lock")
	if err := os.MkdirAll(filepath.Dir(checker), 0o700); err != nil {
		t.Fatalf("create checker bin dir: %v", err)
	}
	writePackageManifest(t, dir, canonicalPackageManifest())
	if err := os.WriteFile(values, []byte("[]"), 0o600); err != nil {
		t.Fatalf("write values file: %v", err)
	}
	if err := os.WriteFile(activePath, []byte("0\n"), 0o600); err != nil {
		t.Fatalf("write active counter: %v", err)
	}
	if err := os.WriteFile(maxPath, []byte("0\n"), 0o600); err != nil {
		t.Fatalf("write max counter: %v", err)
	}
	script := fmt.Sprintf(`#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === '--version') {
  process.stdout.write('redaction-rules-v3\n');
  process.exit(0);
}
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function withLock(fn) {
  while (true) {
    try {
      fs.mkdirSync(%[1]q);
      break;
    } catch {
      sleep(1);
    }
  }
  try {
    fn();
  } finally {
    fs.rmdirSync(%[1]q);
  }
}
withLock(() => {
  const active = Number(fs.readFileSync(%[2]q, 'utf8').trim()) + 1;
  fs.writeFileSync(%[2]q, active + '\n');
  const max = Number(fs.readFileSync(%[3]q, 'utf8').trim());
  if (active > max) fs.writeFileSync(%[3]q, active + '\n');
});
sleep(50);
withLock(() => {
  const active = Number(fs.readFileSync(%[2]q, 'utf8').trim()) - 1;
  fs.writeFileSync(%[2]q, active + '\n');
});
process.stdout.write(fs.readFileSync(0, 'utf8'));
`, lockPath, activePath, maxPath)
	if err := os.WriteFile(checker, []byte(script), 0o700); err != nil {
		t.Fatalf("write checker: %v", err)
	}
	redactor, err := NewCommandRedactor(Config{
		CheckerPath:          checker,
		RegisteredValuesPath: values,
		Timeout:              2 * time.Second,
		PackageVersion:       ExpectedPackageVersion,
		RuleSetVersion:       ExpectedRuleSetVersion,
	})
	if err != nil {
		t.Fatalf("NewCommandRedactor: %v", err)
	}

	var wg sync.WaitGroup
	for i := 0; i < maxConcurrentCheckerProcesses*3; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := redactor.Redact(context.Background(), "ordinary text"); err != nil {
				t.Errorf("Redact: %v", err)
			}
		}()
	}
	wg.Wait()

	maxObserved := readTrimmed(t, maxPath)
	maxObservedProcesses, err := strconv.Atoi(maxObserved)
	if err != nil {
		t.Fatalf("max concurrent checker processes = %q, want integer", maxObserved)
	}
	if maxObservedProcesses > maxConcurrentCheckerProcesses {
		t.Fatalf("max concurrent checker processes = %d, want at most %d", maxObservedProcesses, maxConcurrentCheckerProcesses)
	}
	if maxObservedProcesses < 2 {
		t.Fatalf("max concurrent checker processes = %d, want concurrent checker execution", maxObservedProcesses)
	}
}

func TestCommandRedactorVersionOutput(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell script probe is unix-only")
	}
	for _, tt := range []struct {
		name        string
		mode        string
		wantVersion string
		wantErr     bool
	}{
		{name: "raw rule-set version may include a trailing newline", mode: "version-whitespace", wantVersion: ExpectedRuleSetVersion},
		{name: "wrong raw rule-set version is observable to caller", mode: "version-mismatch", wantVersion: "redaction-rules-v1"},
		{name: "empty raw rule-set version is rejected", mode: "version-empty", wantErr: true},
		{name: "invalid version invocation is rejected", mode: "reject-version", wantErr: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			redactor := newCommandRedactorFixture(t, tt.mode)

			version, err := redactor.Version(context.Background())

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected version error")
				}
				return
			}
			if err != nil {
				t.Fatalf("Version: %v", err)
			}
			if version.PackageVersion != ExpectedPackageVersion || version.RuleSetVersion != tt.wantVersion {
				t.Fatalf("version = %#v", version)
			}
		})
	}
}

func TestCommandRedactorHonorsContextCancellation(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell script probe is unix-only")
	}
	redactor := newCommandRedactorFixture(t, "slow-redact")
	ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond)
	defer cancel()

	_, err := redactor.Redact(ctx, "ordinary text")

	if err == nil {
		t.Fatal("expected redaction error after context deadline")
	}
}

func TestNodeVersionSatisfiesExpectedEngine(t *testing.T) {
	tests := []struct {
		raw  string
		want bool
	}{
		{raw: "v22.0.0", want: true},
		{raw: "22.19.0", want: true},
		{raw: "v23.1.0", want: true},
		{raw: "v21.9.0", want: false},
		{raw: "not-a-version", want: false},
		{raw: "", want: false},
	}
	for _, tt := range tests {
		t.Run(tt.raw, func(t *testing.T) {
			if got := nodeVersionSatisfiesExpectedEngine(tt.raw); got != tt.want {
				t.Fatalf("nodeVersionSatisfiesExpectedEngine(%q) = %v, want %v", tt.raw, got, tt.want)
			}
		})
	}
}

func assertMinimalCheckerEnv(t *testing.T, path string) {
	t.Helper()
	got := readTrimmed(t, path)
	for _, forbidden := range []string{"JWT_SECRET=", "OPENAI_API_KEY=", "MONGO_URI=", "D5_REDACTION_CHECKER_PATH=", "D5_REDACTION_REGISTERED_VALUES_FILE="} {
		if strings.Contains(got, forbidden) {
			t.Fatalf("checker env includes forbidden %s in %q", forbidden, got)
		}
	}
	if !strings.Contains(got, "PATH=") {
		t.Fatalf("checker env = %q, missing PATH", got)
	}
}

func readTrimmed(t *testing.T, path string) string {
	t.Helper()
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return strings.TrimSpace(string(content))
}

func newCommandRedactorFixture(t *testing.T, mode string) *CommandRedactor {
	t.Helper()
	checker, values := writeCheckerFixture(t, mode)
	redactor, err := NewCommandRedactor(Config{
		CheckerPath:          checker,
		RegisteredValuesPath: values,
		Timeout:              time.Second,
		PackageVersion:       ExpectedPackageVersion,
		RuleSetVersion:       ExpectedRuleSetVersion,
	})
	if err != nil {
		t.Fatalf("NewCommandRedactor: %v", err)
	}
	return redactor
}

func writeCheckerFixture(t *testing.T, mode string) (string, string) {
	t.Helper()
	return writeCheckerFixtureWithManifest(t, mode, canonicalPackageManifest())
}

func writeCheckerFixtureWithManifest(t *testing.T, mode string, manifest map[string]any) (string, string) {
	t.Helper()
	dir := t.TempDir()
	checker := filepath.Join(dir, "bin", "value-redaction-check")
	values := filepath.Join(dir, "values.json")
	if err := os.MkdirAll(filepath.Dir(checker), 0o700); err != nil {
		t.Fatalf("create checker bin dir: %v", err)
	}
	writePackageManifest(t, dir, manifest)
	if err := os.WriteFile(values, []byte("[]"), 0o600); err != nil {
		t.Fatalf("write values file: %v", err)
	}
	script := `#!/usr/bin/env node
const fs = require('node:fs');
const mode = "` + mode + `";
const args = process.argv.slice(2);
if (args[0] === '--version') {
  if (mode === 'reject-version') process.exit(2);
  if (mode === 'version-empty') { process.stdout.write('\n'); process.exit(0); }
  if (mode === 'version-mismatch') { process.stdout.write('redaction-rules-v1\n'); process.exit(0); }
  if (mode === 'version-whitespace') { process.stdout.write('  redaction-rules-v3\r\n'); process.exit(0); }
  process.stdout.write('redaction-rules-v3\n');
  process.exit(0);
}
if (args[0] !== '--values-file' || !args[1] || args[2]) {
  process.stderr.write('{"code":"CHECKER_ARGUMENT_INVALID"}\n');
  process.exit(2);
}
if (mode === 'missing-values' || !fs.existsSync(args[1])) {
  process.stderr.write('{"code":"CHECKER_VALUES_FILE_UNREADABLE"}\n');
  process.exit(3);
}
if (mode === 'slow-redact') {
  setTimeout(() => {}, 1000);
}
const input = fs.readFileSync(0, 'utf8');
if (mode === 'reject') process.exit(2);
if (mode === 'hold') {
  process.stderr.write('{"code":"REDACTION_HOLD"}\n');
  process.exit(1);
}
if (mode === 'empty') process.exit(0);
if (mode === 'passthrough') process.stdout.write(input);
else process.stdout.write(input.replaceAll('syntheticRegisteredCanary12345', '[REDACTED]'));
`
	if err := os.WriteFile(checker, []byte(script), 0o700); err != nil {
		t.Fatalf("write checker: %v", err)
	}
	return checker, values
}

func canonicalPackageManifest() map[string]any {
	return map[string]any{
		"name":    ExpectedPackageName,
		"version": ExpectedPackageVersion,
		"engines": map[string]string{"node": ExpectedNodeEngine},
		"bin":     map[string]string{"value-redaction-check": "bin/value-redaction-check"},
	}
}

func writePackageManifest(t *testing.T, root string, manifest map[string]any) {
	t.Helper()
	manifestJSON, err := json.Marshal(manifest)
	if err != nil {
		t.Fatalf("marshal package manifest: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "package.json"), manifestJSON, 0o600); err != nil {
		t.Fatalf("write package manifest: %v", err)
	}
}
