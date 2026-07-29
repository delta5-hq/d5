package checkedlog

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	ExpectedPackageName    = "@redaction-control/value-redaction-control"
	ExpectedPackageVersion = "0.1.2"
	ExpectedRuleSetVersion = "redaction-rules-v2"
	ExpectedNodeEngine     = ">=22"

	EnvCheckerPath          = "D5_REDACTION_CHECKER_PATH"
	EnvRegisteredValuesPath = "D5_REDACTION_REGISTERED_VALUES_FILE"
	EnvTimeoutMilliseconds  = "D5_REDACTION_TIMEOUT_MS"
)

const defaultTimeout = 2 * time.Second

type Config struct {
	CheckerPath          string
	RegisteredValuesPath string
	Timeout              time.Duration
	PackageVersion       string
	RuleSetVersion       string
}

func ConfigFromEnv() (Config, error) {
	cfg := Config{
		CheckerPath:          strings.TrimSpace(os.Getenv(EnvCheckerPath)),
		RegisteredValuesPath: strings.TrimSpace(os.Getenv(EnvRegisteredValuesPath)),
		Timeout:              defaultTimeout,
		PackageVersion:       ExpectedPackageVersion,
		RuleSetVersion:       ExpectedRuleSetVersion,
	}
	if raw := strings.TrimSpace(os.Getenv(EnvTimeoutMilliseconds)); raw != "" {
		milliseconds, err := strconv.Atoi(raw)
		if err != nil || milliseconds <= 0 {
			return Config{}, fmt.Errorf("invalid redaction timeout")
		}
		cfg.Timeout = time.Duration(milliseconds) * time.Millisecond
	}
	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func (cfg Config) Validate() error {
	if strings.TrimSpace(cfg.CheckerPath) == "" {
		return fmt.Errorf("redaction checker path is required")
	}
	if strings.TrimSpace(cfg.RegisteredValuesPath) == "" {
		return fmt.Errorf("redaction registered-values file path is required")
	}
	if cfg.Timeout <= 0 {
		return fmt.Errorf("redaction timeout must be positive")
	}
	if cfg.PackageVersion != ExpectedPackageVersion {
		return fmt.Errorf("unsupported redaction package version")
	}
	if cfg.RuleSetVersion != ExpectedRuleSetVersion {
		return fmt.Errorf("unsupported redaction rule-set version")
	}
	return nil
}
