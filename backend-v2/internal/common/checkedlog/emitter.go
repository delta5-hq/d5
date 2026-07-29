package checkedlog

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"sync"
	"time"
)

const suppressedLine = "redaction unavailable: log suppressed\n"

type Emitter struct {
	output   io.Writer
	redactor Redactor
	timeout  time.Duration
	mu       sync.Mutex
}

func NewEmitter(output io.Writer, redactor Redactor, timeout time.Duration) *Emitter {
	return &Emitter{output: output, redactor: redactor, timeout: timeout}
}

func (e *Emitter) Write(p []byte) (int, error) {
	e.writeString(string(p))
	return len(p), nil
}

func (e *Emitter) Printf(format string, args ...interface{}) {
	var line bytes.Buffer
	log.New(&line, "", log.LstdFlags).Printf(format, args...)
	e.writeString(line.String())
}

func (e *Emitter) writeString(text string) {
	ctx, cancel := context.WithTimeout(context.Background(), e.timeout)
	defer cancel()
	result, err := e.redactor.Redact(ctx, text)
	if err != nil || result.Held {
		e.writeRaw(suppressedLine)
		return
	}
	e.writeRaw(result.Text)
}

func (e *Emitter) writeRaw(text string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	_, _ = io.WriteString(e.output, text)
}

var defaultState = struct {
	sync.RWMutex
	stdout *Emitter
	stderr *Emitter
}{
	stdout: NewEmitter(os.Stdout, unavailableRedactor{}, defaultTimeout),
	stderr: NewEmitter(os.Stderr, unavailableRedactor{}, defaultTimeout),
}

type unavailableRedactor struct{}

func (unavailableRedactor) Version(context.Context) (Version, error) {
	return Version{}, fmt.Errorf("redaction checker unavailable")
}

func (unavailableRedactor) Redact(context.Context, string) (Result, error) {
	return Result{}, fmt.Errorf("redaction checker unavailable")
}

func ConfigureDefault(cfg Config) error {
	redactor, err := NewCommandRedactor(cfg)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), cfg.Timeout)
	defer cancel()
	version, err := redactor.Version(ctx)
	if err != nil {
		return err
	}
	if version.PackageVersion != cfg.PackageVersion || version.RuleSetVersion != cfg.RuleSetVersion {
		return fmt.Errorf("redaction checker version mismatch")
	}
	result, err := redactor.Redact(ctx, "redaction readiness probe")
	if err != nil || result.Held || result.Text == "" {
		return fmt.Errorf("redaction checker readiness failed")
	}
	defaultState.Lock()
	defaultState.stdout = NewEmitter(os.Stdout, redactor, cfg.Timeout)
	defaultState.stderr = NewEmitter(os.Stderr, redactor, cfg.Timeout)
	defaultState.Unlock()
	return nil
}

func ConfigureDefaultFromEnv() error {
	cfg, err := ConfigFromEnv()
	if err != nil {
		return err
	}
	return ConfigureDefault(cfg)
}

func ConfigureDefaultForTest(stdout io.Writer, stderr io.Writer, redactor Redactor, timeout time.Duration) func() {
	defaultState.Lock()
	oldStdout := defaultState.stdout
	oldStderr := defaultState.stderr
	defaultState.stdout = NewEmitter(stdout, redactor, timeout)
	defaultState.stderr = NewEmitter(stderr, redactor, timeout)
	defaultState.Unlock()
	return func() {
		defaultState.Lock()
		defaultState.stdout = oldStdout
		defaultState.stderr = oldStderr
		defaultState.Unlock()
	}
}

func StdoutWriter() io.Writer {
	return stdoutEmitter()
}

func StderrWriter() io.Writer {
	return stderrEmitter()
}

func Infof(format string, args ...interface{}) {
	stdoutEmitter().Printf(format, args...)
}

func Warnf(format string, args ...interface{}) {
	stderrEmitter().Printf(format, args...)
}

func ProjectWarnf(format string, args ...interface{}) {
	stdoutEmitter().Printf(format, args...)
}

func Errorf(format string, args ...interface{}) {
	stderrEmitter().Printf(format, args...)
}

func Fatalf(format string, args ...interface{}) {
	Errorf(format, args...)
	os.Exit(1)
}

func EmitStartupFailure(output io.Writer) {
	_, _ = io.WriteString(output, suppressedLine)
}

func EmitStartupFailureToStderr() {
	EmitStartupFailure(os.Stderr)
}

func stdoutEmitter() *Emitter {
	defaultState.RLock()
	defer defaultState.RUnlock()
	return defaultState.stdout
}

func stderrEmitter() *Emitter {
	defaultState.RLock()
	defer defaultState.RUnlock()
	return defaultState.stderr
}
