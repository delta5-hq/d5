package logger

import (
	"fmt"
	"os"
	"strings"

	"backend-v2/internal/common/checkedlog"
)

/* Logger provides prefixed logging for pair debugging */
type Logger struct {
	prefix string
}

/* New creates logger with feature-level prefix */
func New(prefix string) *Logger {
	return &Logger{prefix: strings.ToUpper(prefix)}
}

/* Info logs informational message with prefix */
func (l *Logger) Info(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	checkedlog.Infof("[%s] %s", l.prefix, msg)
}

/* Error logs error message with prefix */
func (l *Logger) Error(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	checkedlog.Errorf("[%s] ERROR: %s", l.prefix, msg)
}

/* Debug logs debug message with prefix (only if DEBUG=true) */
func (l *Logger) Debug(format string, args ...interface{}) {
	if os.Getenv("DEBUG") == "true" {
		msg := fmt.Sprintf(format, args...)
		checkedlog.Infof("[%s] DEBUG: %s", l.prefix, msg)
	}
}

/* Warn logs warning message with prefix */
func (l *Logger) Warn(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	checkedlog.ProjectWarnf("[%s] WARN: %s", l.prefix, msg)
}
