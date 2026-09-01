package checkedlog

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"
)

const syntheticRegisteredValue = "syntheticRegisteredCanary12345"

type fakeRedactor struct {
	version Version
	redact  func(string) (Result, error)
}

func (f fakeRedactor) Version(context.Context) (Version, error) {
	return f.version, nil
}

func (f fakeRedactor) Redact(_ context.Context, text string) (Result, error) {
	return f.redact(text)
}

func TestEmitterWritesOnlyCheckerApprovedText(t *testing.T) {
	tests := []struct {
		name       string
		redact     func(string) (Result, error)
		want       string
		wantSecret bool
	}{
		{
			name: "ordinary text passes through unchanged",
			redact: func(text string) (Result, error) {
				return Result{Text: text}, nil
			},
			want: "ordinary message\n",
		},
		{
			name: "redacted text preserves surrounding text",
			redact: func(text string) (Result, error) {
				return Result{Text: strings.ReplaceAll(text, syntheticRegisteredValue, "[REDACTED]")}, nil
			},
			want: "before [REDACTED] after\n",
		},
		{
			name: "held text emits only safe signal",
			redact: func(string) (Result, error) {
				return Result{Held: true}, nil
			},
			want: suppressedLine,
		},
		{
			name: "checker error emits only safe signal",
			redact: func(string) (Result, error) {
				return Result{}, errors.New("reject")
			},
			want: suppressedLine,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var out bytes.Buffer
			emitter := NewEmitter(&out, fakeRedactor{redact: tt.redact}, time.Second)

			emitter.Printf("%s", inputForExpectation(tt.want))

			got := out.String()
			gotComparable := got
			if tt.want != suppressedLine {
				if !standardLogPrefixPattern().MatchString(got) {
					t.Fatalf("approved Printf output = %q, missing standard-library timestamp prefix", got)
				}
				gotComparable = stripStandardLogPrefix(got)
			} else if standardLogPrefixPattern().MatchString(got) {
				t.Fatalf("suppressed output = %q, must not be timestamped", got)
			}
			if gotComparable != tt.want {
				t.Fatalf("output = %q, comparable = %q, want %q", got, gotComparable, tt.want)
			}
			if !tt.wantSecret && strings.Contains(got, syntheticRegisteredValue) {
				t.Fatalf("output leaked attempted text: %q", got)
			}
		})
	}
}

func TestEmitterWriteReturnsInputLengthWhenLogIsSuppressed(t *testing.T) {
	var out bytes.Buffer
	emitter := NewEmitter(&out, fakeRedactor{redact: func(string) (Result, error) {
		return Result{Held: true}, nil
	}}, time.Second)
	attempt := []byte("attempt " + syntheticRegisteredValue)

	written, err := emitter.Write(attempt)

	if err != nil {
		t.Fatalf("Write error = %v", err)
	}
	if written != len(attempt) {
		t.Fatalf("Write length = %d, want %d", written, len(attempt))
	}
	if got := out.String(); got != suppressedLine {
		t.Fatalf("suppressed output = %q", got)
	}
}

func TestEmitterSerializesConcurrentApprovedWrites(t *testing.T) {
	var out bytes.Buffer
	emitter := NewEmitter(&out, fakeRedactor{redact: func(text string) (Result, error) {
		return Result{Text: strings.ReplaceAll(text, syntheticRegisteredValue, "[REDACTED]")}, nil
	}}, time.Second)

	var wg sync.WaitGroup
	for i := 0; i < 25; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			emitter.Printf("line-%02d %s", index, syntheticRegisteredValue)
		}(i)
	}
	wg.Wait()

	lines := strings.Split(strings.TrimSuffix(out.String(), "\n"), "\n")
	if len(lines) != 25 {
		t.Fatalf("emitted line count = %d, want 25; output=%q", len(lines), out.String())
	}
	seen := make(map[string]bool)
	for _, line := range lines {
		comparableLine := stripStandardLogPrefix(line + "\n")
		if strings.Contains(line, syntheticRegisteredValue) {
			t.Fatalf("concurrent output leaked secret: %q", line)
		}
		if !strings.HasSuffix(comparableLine, " [REDACTED]\n") {
			t.Fatalf("concurrent output line = %q, want redacted complete line", line)
		}
		seen[strings.TrimSuffix(comparableLine, "\n")] = true
	}
	for i := 0; i < 25; i++ {
		want := fmt.Sprintf("line-%02d [REDACTED]", i)
		if !seen[want] {
			t.Fatalf("concurrent output missing %q; output=%q", want, out.String())
		}
	}
}

func stripStandardLogPrefix(line string) string {
	return standardLogPrefixPattern().ReplaceAllString(line, "")
}

func standardLogPrefixPattern() *regexp.Regexp {
	return regexp.MustCompile(`^\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2} `)
}

func inputForExpectation(want string) string {
	if strings.Contains(want, "[REDACTED]") || want == suppressedLine {
		return "before " + syntheticRegisteredValue + " after"
	}
	return strings.TrimSuffix(want, "\n")
}
