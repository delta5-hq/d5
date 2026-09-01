package checkedlog

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

const (
	maxConcurrentCheckerProcesses = 4
)

type Version struct {
	PackageVersion string
	RuleSetVersion string
}

type Result struct {
	Text string
	Held bool
}

type Redactor interface {
	Version(ctx context.Context) (Version, error)
	Redact(ctx context.Context, text string) (Result, error)
}

type CommandRedactor struct {
	cfg             Config
	checkerRealPath string
	nodePath        string
	childEnv        []string
	semaphore       chan struct{}
}

func NewCommandRedactor(cfg Config) (*CommandRedactor, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	checkerRealPath, err := resolveCheckerPath(cfg.CheckerPath)
	if err != nil {
		return nil, err
	}
	nodePath, err := resolveNodePath()
	if err != nil {
		return nil, err
	}
	redactor := &CommandRedactor{
		cfg:             cfg,
		checkerRealPath: checkerRealPath,
		nodePath:        nodePath,
		childEnv:        []string{"PATH=" + filepath.Dir(nodePath)},
		semaphore:       make(chan struct{}, maxConcurrentCheckerProcesses),
	}
	if err := redactor.validateNodeVersion(context.Background()); err != nil {
		return nil, err
	}
	return redactor, nil
}

func (r *CommandRedactor) Version(ctx context.Context) (Version, error) {
	packageVersion, err := readInstalledPackageVersion(r.checkerRealPath)
	if err != nil {
		return Version{}, fmt.Errorf("redaction checker package unavailable")
	}
	cmd := r.command(ctx, "--version")
	out, err := r.output(ctx, cmd)
	if err != nil {
		return Version{}, fmt.Errorf("redaction checker version unavailable")
	}
	version := Version{
		PackageVersion: packageVersion,
		RuleSetVersion: strings.TrimSpace(string(out)),
	}
	if version.RuleSetVersion == "" {
		return Version{}, fmt.Errorf("redaction checker version incomplete")
	}
	return version, nil
}

func (r *CommandRedactor) Redact(ctx context.Context, text string) (Result, error) {
	cmd := r.command(ctx, "--values-file", r.cfg.RegisteredValuesPath)
	cmd.Stdin = strings.NewReader(text)
	var stdout bytes.Buffer
	cmd.Stdout = &stdout
	if err := r.run(ctx, cmd); err != nil {
		return Result{}, fmt.Errorf("redaction checker rejected log text")
	}
	return Result{Text: stdout.String()}, nil
}

func (r *CommandRedactor) command(ctx context.Context, args ...string) *exec.Cmd {
	cmdArgs := append([]string{r.checkerRealPath}, args...)
	cmd := exec.CommandContext(ctx, r.nodePath, cmdArgs...)
	cmd.Env = r.childEnv
	return cmd
}

func (r *CommandRedactor) validateNodeVersion(ctx context.Context) error {
	cmd := exec.CommandContext(ctx, r.nodePath, "--version")
	cmd.Env = r.childEnv
	out, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("redaction checker node unavailable")
	}
	if !nodeVersionSatisfiesExpectedEngine(strings.TrimSpace(string(out))) {
		return fmt.Errorf("redaction checker node version unsupported")
	}
	return nil
}

func (r *CommandRedactor) output(ctx context.Context, cmd *exec.Cmd) ([]byte, error) {
	release, err := r.acquire(ctx)
	if err != nil {
		return nil, err
	}
	defer release()
	return cmd.Output()
}

func (r *CommandRedactor) run(ctx context.Context, cmd *exec.Cmd) error {
	release, err := r.acquire(ctx)
	if err != nil {
		return err
	}
	defer release()
	return cmd.Run()
}

func (r *CommandRedactor) acquire(ctx context.Context) (func(), error) {
	select {
	case r.semaphore <- struct{}{}:
		return func() { <-r.semaphore }, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

type packageManifest struct {
	Name    string            `json:"name"`
	Version string            `json:"version"`
	Engines map[string]string `json:"engines"`
	Bin     map[string]string `json:"bin"`
}

func resolveCheckerPath(checkerPath string) (string, error) {
	checkerRealPath, err := filepath.EvalSymlinks(checkerPath)
	if err != nil {
		return "", err
	}
	if !filepath.IsAbs(checkerRealPath) {
		return "", fmt.Errorf("redaction checker path must resolve absolutely")
	}
	return checkerRealPath, nil
}

func resolveNodePath() (string, error) {
	nodePath, err := exec.LookPath("node")
	if err != nil {
		return "", fmt.Errorf("redaction checker node unavailable")
	}
	nodeRealPath, err := filepath.EvalSymlinks(nodePath)
	if err != nil {
		return "", err
	}
	if !filepath.IsAbs(nodeRealPath) {
		return "", fmt.Errorf("redaction checker node path must resolve absolutely")
	}
	return nodeRealPath, nil
}

func readInstalledPackageVersion(checkerRealPath string) (string, error) {
	manifestPath, err := findPackageManifest(filepath.Dir(checkerRealPath))
	if err != nil {
		return "", err
	}
	content, err := os.ReadFile(manifestPath)
	if err != nil {
		return "", err
	}
	var manifest packageManifest
	if err := json.Unmarshal(content, &manifest); err != nil {
		return "", err
	}
	if err := validatePackageManifest(manifestPath, checkerRealPath, manifest); err != nil {
		return "", err
	}
	return manifest.Version, nil
}

func findPackageManifest(start string) (string, error) {
	for current := start; ; current = filepath.Dir(current) {
		candidate := filepath.Join(current, "package.json")
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
		parent := filepath.Dir(current)
		if parent == current {
			return "", fmt.Errorf("redaction checker package manifest not found")
		}
	}
}

func validatePackageManifest(manifestPath string, checkerRealPath string, manifest packageManifest) error {
	binEntry := manifest.Bin["value-redaction-check"]
	if manifest.Name != ExpectedPackageName || manifest.Version != ExpectedPackageVersion || manifest.Engines["node"] != ExpectedNodeEngine || binEntry == "" {
		return fmt.Errorf("redaction checker package manifest mismatch")
	}
	expectedBinPath, err := filepath.EvalSymlinks(filepath.Join(filepath.Dir(manifestPath), filepath.FromSlash(binEntry)))
	if err != nil {
		return err
	}
	if expectedBinPath != checkerRealPath {
		return fmt.Errorf("redaction checker bin path mismatch")
	}
	return nil
}

func nodeVersionSatisfiesExpectedEngine(raw string) bool {
	version := strings.TrimPrefix(strings.TrimSpace(raw), "v")
	major, _, ok := strings.Cut(version, ".")
	if !ok {
		major = version
	}
	majorNumber, err := strconv.Atoi(major)
	return err == nil && majorNumber >= 22
}
