package logger

import (
	"fmt"
	"log"
	"os"
	"strings"
)

/* Logger provides prefixed logging for pair debugging */
type Logger struct {
	prefix string
}

var (
	infoLogger  = log.New(os.Stdout, "", log.LstdFlags)
	errorLogger = log.New(os.Stderr, "", log.LstdFlags)
	debugLogger = log.New(os.Stdout, "", log.LstdFlags)
)

/* New creates logger with feature-level prefix */
func New(prefix string) *Logger {
	return &Logger{prefix: strings.ToUpper(prefix)}
}

/* Info logs informational message with prefix */
func (l *Logger) Info(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	infoLogger.Printf("[%s] %s", l.prefix, msg)
}

/* Error logs error message with prefix */
func (l *Logger) Error(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	errorLogger.Printf("[%s] ERROR: %s", l.prefix, msg)
}

/* Debug logs debug message with prefix (only if DEBUG=true) */
func (l *Logger) Debug(format string, args ...interface{}) {
	if os.Getenv("DEBUG") == "true" {
		msg := fmt.Sprintf(format, args...)
		debugLogger.Printf("[%s] DEBUG: %s", l.prefix, msg)
	}
}

/* Warn logs warning message with prefix */
func (l *Logger) Warn(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	infoLogger.Printf("[%s] WARN: %s", l.prefix, msg)
}
