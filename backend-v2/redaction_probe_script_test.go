package main

import (
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

const (
	canonicalRedactionPackageName         = "@redaction-control/value-redaction-control"
	canonicalRedactionPackageVersion      = "0.1.2"
	canonicalRedactionRuleSetVersion      = "redaction-rules-v2"
	canonicalRedactionPackageRelativePath = "third_party/redaction/redaction-control-value-redaction-control-0.1.2.tgz"
	canonicalRedactionPackageBuildPath    = "/tmp/redaction-package.tgz"
	canonicalRedactionPackageChecksum     = "19f4f7ca3ac8f0fe10b292bf26e7e6c71a89dd904875f7d892d00e963b7e36788b5925ebed3e598c92063164837fb64b6492c80706d5c167015472ca8def14ff"
	canonicalRedactionPackageSize         = 11215
)

func TestRedactionRuntimeProbeAcceptsManifestBackedChecker(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell probe is unix-only")
	}
	checkerPath, valuesPath := writeProbePackage(t, probeManifest{
		Name:       canonicalRedactionPackageName,
		Version:    canonicalRedactionPackageVersion,
		NodeEngine: ">=22",
		BinName:    "value-redaction-check",
		BinTarget:  "bin/value-redaction-check.js",
	})

	result := runRedactionRuntimeProbe(t, checkerPath, valuesPath)

	if result.exitCode != 0 {
		t.Fatalf("probe exit code = %d\nstdout=%s\nstderr=%s", result.exitCode, result.stdout, result.stderr)
	}
	if !strings.Contains(result.stdout, "redaction runtime probe passed") {
		t.Fatalf("probe stdout missing success signal: %q", result.stdout)
	}
}

func TestRedactionRuntimeProbeRejectsNonCanonicalCheckerReceipts(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell probe is unix-only")
	}
	tests := []struct {
		name     string
		manifest probeManifest
	}{
		{
			name: "wrong package name",
			manifest: probeManifest{
				Name:       "local-fixture",
				Version:    "0.1.2",
				NodeEngine: ">=22",
				BinName:    "value-redaction-check",
				BinTarget:  "bin/value-redaction-check.js",
			},
		},
		{
			name: "wrong package version",
			manifest: probeManifest{
				Name:       canonicalRedactionPackageName,
				Version:    "0.1.1",
				NodeEngine: ">=22",
				BinName:    "value-redaction-check",
				BinTarget:  "bin/value-redaction-check.js",
			},
		},
		{
			name: "wrong node engine",
			manifest: probeManifest{
				Name:       canonicalRedactionPackageName,
				Version:    canonicalRedactionPackageVersion,
				NodeEngine: ">=20",
				BinName:    "value-redaction-check",
				BinTarget:  "bin/value-redaction-check.js",
			},
		},
		{
			name: "wrong bin name",
			manifest: probeManifest{
				Name:       canonicalRedactionPackageName,
				Version:    canonicalRedactionPackageVersion,
				NodeEngine: ">=22",
				BinName:    "other-checker",
				BinTarget:  "bin/value-redaction-check.js",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			checkerPath, valuesPath := writeProbePackage(t, tt.manifest)

			result := runRedactionRuntimeProbe(t, checkerPath, valuesPath)

			if result.exitCode == 0 {
				t.Fatalf("probe unexpectedly passed\nstdout=%s\nstderr=%s", result.stdout, result.stderr)
			}
			if strings.Contains(result.stdout+result.stderr, runtimeRegisteredCanary) ||
				strings.Contains(result.stdout+result.stderr, "abcdefghijklmnopqrstu12345") {
				t.Fatalf("probe failure leaked synthetic secret\nstdout=%s\nstderr=%s", result.stdout, result.stderr)
			}
		})
	}
}

func TestCanonicalRedactionPackageArtifactMatchesPinnedReceipt(t *testing.T) {
	content, err := os.ReadFile(canonicalRedactionPackageRelativePath)
	if err != nil {
		t.Fatalf("read canonical redaction package: %v", err)
	}
	if len(content) != canonicalRedactionPackageSize {
		t.Fatalf("canonical redaction package size = %d, want %d", len(content), canonicalRedactionPackageSize)
	}

	sum := sha512.Sum512(content)
	if got := hex.EncodeToString(sum[:]); got != canonicalRedactionPackageChecksum {
		t.Fatalf("canonical redaction package sha512 = %s, want %s", got, canonicalRedactionPackageChecksum)
	}
}

func TestRedactionProvisioningUsesCanonicalPackageSpecAndShipsEntrypoints(t *testing.T) {
	publicRegistrySpec := canonicalRedactionPackageName + "@" + canonicalRedactionPackageVersion
	legacySpecWithoutPort := "git+ssh://git@gitlab.solid-branch-software.com/solidbranch/internal/redaction.git#v0.1.2"
	files := []string{
		"Makefile",
		filepath.Join("docs", "redaction-runtime.md"),
	}
	for _, file := range files {
		t.Run(file, func(t *testing.T) {
			content := readRepositoryFile(t, file)
			if !strings.Contains(content, canonicalRedactionPackageRelativePath) {
				t.Fatalf("%s does not reference canonical package spec", file)
			}
			if !strings.Contains(content, canonicalRedactionPackageChecksum) {
				t.Fatalf("%s does not reference canonical package checksum", file)
			}
			if strings.Contains(content, legacySpecWithoutPort) {
				t.Fatalf("%s references non-canonical package spec without SSH port", file)
			}
		})
	}

	dockerfileContent := readRepositoryFile(t, "Dockerfile")
	if !strings.Contains(dockerfileContent, canonicalRedactionPackageBuildPath) {
		t.Fatalf("Dockerfile does not install from canonical build-secret path %s", canonicalRedactionPackageBuildPath)
	}
	if !strings.Contains(dockerfileContent, canonicalRedactionPackageChecksum) {
		t.Fatal("Dockerfile does not enforce canonical package checksum")
	}

	for _, file := range []string{
		filepath.Join("..", ".github", "workflows", "ci.yml"),
		filepath.Join("..", ".gitlab-ci.yml"),
		filepath.Join("..", "Makefile"),
		"Makefile",
		filepath.Join("docs", "redaction-runtime.md"),
		filepath.Join("scripts", "verify-docker-build-prerequisites.sh"),
	} {
		t.Run("canonical surface "+file, func(t *testing.T) {
			content := readRepositoryFile(t, file)
			if strings.Contains(content, "${REDACTION_PACKAGE_SPEC:-"+publicRegistrySpec+"}") {
				t.Fatalf("%s still defaults to public registry package spec", file)
			}
		})
	}

	if _, err := os.Stat(filepath.Join("..", "backend-v2", "Dockerfile.redaction")); err == nil {
		t.Fatal("Dockerfile.redaction exists; backend-v2 must have one authoritative Dockerfile")
	}

	ci := readRepositoryFile(t, filepath.Join("..", ".gitlab-ci.yml"))
	if !strings.Contains(ci, "package-backend-v2:") || !strings.Contains(ci, "docker build $REDACTION_SECRET") {
		t.Fatal("GitLab backend-v2 package job does not build the canonical Dockerfile with redaction provisioning")
	}

	compose := readRepositoryFile(t, filepath.Join("..", "docker-compose.yml"))
	for _, line := range []string{
		"D5_REDACTION_CHECKER_PATH",
		"D5_REDACTION_REGISTERED_VALUES_FILE",
		"/run/secrets/d5-redaction-registered-values.json:ro",
	} {
		if !strings.Contains(compose, line) {
			t.Fatalf("docker-compose.yml missing %q", line)
		}
	}

	dockerfile := readRepositoryFile(t, "Dockerfile")
	for _, line := range []string{
		"FROM node:22-alpine",
		"--mount=type=secret,id=redaction_package,target=" + canonicalRedactionPackageBuildPath + ",required=false",
		"sha512sum -c -",
		"command -v value-redaction-check >/dev/null",
		"value-redaction-check --version",
		"COPY --from=builder /build/service .",
		"COPY --from=builder /build/seed-users .",
		"ENV D5_REDACTION_CHECKER_PATH=/usr/local/bin/value-redaction-check",
	} {
		if !strings.Contains(dockerfile, line) {
			t.Fatalf("Dockerfile missing %q", line)
		}
	}
}

func TestCanonicalInstallSurfacesVerifyPackageBeforeInstall(t *testing.T) {
	surfaces := map[string]string{
		"github backend e2e": readRepositoryFile(t, filepath.Join("..", ".github", "workflows", "ci.yml")),
		"gitlab e2e/package": readRepositoryFile(t, filepath.Join("..", ".gitlab-ci.yml")),
		"operator docs":      readRepositoryFile(t, filepath.Join("docs", "redaction-runtime.md")),
	}

	for name, content := range surfaces {
		t.Run(name, func(t *testing.T) {
			packageIndex := strings.Index(content, "REDACTION_PACKAGE_TARBALL")
			if packageIndex == -1 {
				t.Fatalf("%s missing redaction package tarball variable", name)
			}
			redactionProvisioning := content[packageIndex:]
			checksumIndex := strings.Index(redactionProvisioning, canonicalRedactionPackageChecksum)
			installIndex := strings.Index(redactionProvisioning, "npm install")
			if checksumIndex == -1 {
				t.Fatalf("%s missing checksum", name)
			}
			if installIndex == -1 {
				t.Fatalf("%s missing npm install step", name)
			}
			if checksumIndex > installIndex {
				t.Fatalf("%s installs the redaction package before verifying checksum", name)
			}
		})
	}
}

func TestCanonicalPackagingEntrypointsFailBeforeUnsafeRegistryFallback(t *testing.T) {
	rootMakefile := readRepositoryFile(t, filepath.Join("..", "Makefile"))
	for _, required := range []string{
		"package-backend-v2:",
		"REDACTION_PACKAGE_SPEC ?= " + canonicalRedactionPackageBuildPath,
		"REDACTION_PACKAGE_TARBALL_FILE ?= $(CURDIR)/backend-v2/" + canonicalRedactionPackageRelativePath,
		"REDACTION_PACKAGE_SHA512 ?= " + canonicalRedactionPackageChecksum,
		"REDACTION_PACKAGE_TARBALL_FILE must be readable",
		"REDACTION_PACKAGE_SHA512 is required",
		"$(MAKE) -C backend-v2 build-docker",
		"--secret id=redaction_package,src=$(REDACTION_PACKAGE_TARBALL_FILE)",
	} {
		if !strings.Contains(rootMakefile, required) {
			t.Fatalf("root Makefile missing %q", required)
		}
	}

	backendMakefile := readRepositoryFile(t, "Makefile")
	for _, required := range []string{
		"scripts/verify-docker-build-prerequisites.sh",
		"REDACTION_PACKAGE_SPEC ?= " + canonicalRedactionPackageBuildPath,
		"REDACTION_PACKAGE_TARBALL_FILE ?= $(CURDIR)/" + canonicalRedactionPackageRelativePath,
		"REDACTION_PACKAGE_SHA512 ?= " + canonicalRedactionPackageChecksum,
		"--secret id=redaction_package,src=$(REDACTION_PACKAGE_TARBALL_FILE)",
	} {
		if !strings.Contains(backendMakefile, required) {
			t.Fatalf("backend-v2 Makefile missing %q", required)
		}
	}

	script := readRepositoryFile(t, filepath.Join("scripts", "verify-docker-build-prerequisites.sh"))
	for _, required := range []string{
		"docker buildx version",
		"Docker Buildx is required for BuildKit secret mounts",
		"no BuildKit package secret was supplied",
		"REDACTION_PACKAGE_SHA512 is required for the checksum-pinned tarball path",
		"REDACTION_PACKAGE_SPEC must be the checksum-pinned canonical tarball path",
	} {
		if !strings.Contains(script, required) {
			t.Fatalf("Docker prerequisite gate missing %q", required)
		}
	}
}

func TestRootBackendV2E2EStartupHelperRequiresReachableHealth(t *testing.T) {
	rootMakefile := readRepositoryFile(t, filepath.Join("..", "Makefile"))
	target := makeTargetBody(t, rootMakefile, "start-backend-v2-e2e")

	required := []string{
		"E2E_BACKEND_V2_READY_TIMEOUT",
		"curl -s http://localhost:$(E2E_BACKEND_V2_PORT)$(API_ROOT)/health",
		"failed before health became reachable",
		"did not become healthy within $(E2E_BACKEND_V2_READY_TIMEOUT)s",
	}
	for _, snippet := range required {
		if !strings.Contains(target, snippet) {
			t.Fatalf("start-backend-v2-e2e target missing readiness contract snippet %q", snippet)
		}
	}

	healthProbeIndex := strings.Index(target, "curl -s http://localhost:$(E2E_BACKEND_V2_PORT)$(API_ROOT)/health")
	successIndex := strings.Index(target, "✓ Backend-v2 e2e running")
	if healthProbeIndex == -1 || successIndex == -1 || successIndex < healthProbeIndex {
		t.Fatal("start-backend-v2-e2e must print success only after the health probe can pass")
	}

	if strings.Contains(target, "until curl -s http://localhost:$(E2E_BACKEND_V2_PORT)$(API_ROOT)/health") {
		t.Fatal("start-backend-v2-e2e must not use an unbounded health wait")
	}
}

func TestDockerPrerequisiteGate(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell probe is unix-only")
	}

	tests := []struct {
		name         string
		buildxWorks  bool
		env          []string
		wantExitCode int
		wantStderr   string
		forbidStderr string
	}{
		{
			name:         "missing Buildx fails before package validation",
			buildxWorks:  false,
			env:          []string{"REDACTION_PACKAGE_SPEC=" + canonicalRedactionPackageBuildPath},
			wantExitCode: 1,
			wantStderr:   "Docker Buildx is required for BuildKit secret mounts",
		},
		{
			name:         "canonical package requires package secret",
			buildxWorks:  true,
			env:          []string{"REDACTION_PACKAGE_SPEC=" + canonicalRedactionPackageBuildPath, "REDACTION_PACKAGE_SHA512=abc123"},
			wantExitCode: 1,
			wantStderr:   "no BuildKit package secret was supplied",
			forbidStderr: "Docker Buildx is required",
		},
		{
			name:         "canonical package with package secret and checksum passes prerequisites",
			buildxWorks:  true,
			env:          []string{"REDACTION_PACKAGE_SPEC=" + canonicalRedactionPackageBuildPath, "REDACTION_PACKAGE_SHA512=abc123", "DOCKER_BUILD_SECRETS=--secret id=redaction_package,src=/tmp/value-redaction-control-0.1.2.tgz"},
			wantExitCode: 0,
		},
		{
			name:         "checksum-pinned package source requires checksum",
			buildxWorks:  true,
			env:          []string{"REDACTION_PACKAGE_SPEC=" + canonicalRedactionPackageBuildPath, "DOCKER_BUILD_SECRETS=--secret id=redaction_package,src=/tmp/value-redaction-control-0.1.2.tgz"},
			wantExitCode: 1,
			wantStderr:   "REDACTION_PACKAGE_SHA512 is required",
		},
		{
			name:         "unsupported package source is rejected before docker build",
			buildxWorks:  true,
			env:          []string{"REDACTION_PACKAGE_SPEC=/tmp/other-package.tgz", "DOCKER_BUILD_SECRETS=--secret id=redaction_package,src=/tmp/other-package.tgz", "REDACTION_PACKAGE_SHA512=abc123"},
			wantExitCode: 1,
			wantStderr:   "REDACTION_PACKAGE_SPEC must be the checksum-pinned canonical tarball path",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := runDockerPrerequisiteGate(t, tt.buildxWorks, tt.env...)
			if result.exitCode != tt.wantExitCode {
				t.Fatalf("exit code = %d, want %d\nstdout=%s\nstderr=%s", result.exitCode, tt.wantExitCode, result.stdout, result.stderr)
			}
			if tt.wantStderr != "" && !strings.Contains(result.stderr, tt.wantStderr) {
				t.Fatalf("stderr missing %q: %q", tt.wantStderr, result.stderr)
			}
			if tt.forbidStderr != "" && strings.Contains(result.stderr, tt.forbidStderr) {
				t.Fatalf("stderr contains forbidden %q: %q", tt.forbidStderr, result.stderr)
			}
		})
	}
}

func TestRootDevelopmentTargetsPropagateRedactionRuntime(t *testing.T) {
	rootMakefile := readRepositoryFile(t, filepath.Join("..", "Makefile"))
	for _, targetName := range []string{"dev-db-drop", "dev-backend-v2", "dev"} {
		t.Run(targetName, func(t *testing.T) {
			target := makeTargetBodyByPrefix(t, rootMakefile, targetName)
			for _, required := range []string{
				"D5_REDACTION_CHECKER_PATH='$(REDACTION_CHECKER_PATH)'",
				"D5_REDACTION_REGISTERED_VALUES_FILE='$(REDACTION_REGISTERED_VALUES_FILE)'",
				"D5_REDACTION_TIMEOUT_MS='$(REDACTION_TIMEOUT_MS)'",
			} {
				if !strings.Contains(target, required) {
					t.Fatalf("%s target missing %q", targetName, required)
				}
			}
		})
	}
}

func makeTargetBodyByPrefix(t *testing.T, makefile string, targetName string) string {
	t.Helper()
	lines := strings.SplitAfter(makefile, "\n")
	start := -1
	for index, line := range lines {
		if strings.HasPrefix(line, targetName+":") {
			start = index + 1
			break
		}
	}
	if start == -1 {
		t.Fatalf("Makefile missing target %s", targetName)
	}
	var body strings.Builder
	for _, line := range lines[start:] {
		if strings.TrimSpace(line) != "" && !strings.HasPrefix(line, "\t") && !strings.HasPrefix(line, " ") {
			break
		}
		body.WriteString(line)
	}
	return body.String()
}

func TestGitLabCleanupPropagatesRedactionRuntime(t *testing.T) {
	gitlab := readRepositoryFile(t, filepath.Join("..", ".gitlab-ci.yml"))
	afterScripts := strings.Split(gitlab, "after_script:")
	if len(afterScripts) < 3 {
		t.Fatalf("GitLab CI should contain backend and frontend after_script cleanup blocks")
	}
	for index, block := range afterScripts[1:] {
		cleanup := strings.Join(strings.Split(block, "\n")[:3], "\n")
		for _, required := range []string{
			"D5_REDACTION_CHECKER_PATH=",
			"D5_REDACTION_REGISTERED_VALUES_FILE=",
			"D5_REDACTION_TIMEOUT_MS=",
			"bash e2e-db-drop.sh",
		} {
			if !strings.Contains(cleanup, required) {
				t.Fatalf("after_script block %d missing %q in %q", index+1, required, cleanup)
			}
		}
	}
}

func TestBuildGoNetworkSelectionAndInitialization(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell helper probe is unix-only")
	}

	tests := []struct {
		name                 string
		buildNetwork         string
		managedNetworkExists bool
		expectedOrderedCalls []string
		forbiddenCalls       []string
	}{
		{
			name: "default managed network is created before build when missing",
			expectedOrderedCalls: []string{
				"network inspect d5-dev-network",
				"network create d5-dev-network",
				"build --network d5-dev-network --target builder -t service-builder .",
			},
		},
		{
			name:                 "default managed network is reused when present",
			managedNetworkExists: true,
			expectedOrderedCalls: []string{
				"network inspect d5-dev-network",
				"build --network d5-dev-network --target builder -t service-builder .",
			},
			forbiddenCalls: []string{"network create"},
		},
		{
			name:         "explicit Buildx default bypasses managed network initialization",
			buildNetwork: "default",
			expectedOrderedCalls: []string{
				"build --network default --target builder -t service-builder .",
			},
			forbiddenCalls: []string{"network inspect", "network create"},
		},
		{
			name:         "explicit custom network bypasses managed network initialization",
			buildNetwork: "ci-build-network",
			expectedOrderedCalls: []string{
				"build --network ci-build-network --target builder -t service-builder .",
			},
			forbiddenCalls: []string{"network inspect", "network create"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := runBuildGoWithDockerStub(t, buildGoProbe{
				buildNetwork:         tt.buildNetwork,
				managedNetworkExists: tt.managedNetworkExists,
			})
			if result.exitCode != 0 {
				t.Fatalf("build_go failed\nstdout=%s\nstderr=%s", result.stdout, result.stderr)
			}
			assertDockerCallsInOrder(t, result.stdout, tt.expectedOrderedCalls)
			assertDockerCallsAbsent(t, result.stdout, tt.forbiddenCalls)
		})
	}
}

func TestBackendV2MakeBuildEntrypointsUseExplicitDefaultNetwork(t *testing.T) {
	rootMakefile := readRepositoryFile(t, filepath.Join("..", "Makefile"))
	backendMakefile := readRepositoryFile(t, "Makefile")

	tests := []struct {
		name       string
		makefile   string
		targetName string
		required   []string
	}{
		{
			name:       "root direct backend-v2 build",
			makefile:   rootMakefile,
			targetName: "build-backend-v2",
			required: []string{
				"DOCKER_BUILD_NETWORK=default",
				"bash scripts/ci-helpers.sh build_go backend-v2 backend-v2",
			},
		},
		{
			name:       "root backend-v2 e2e delegated build",
			makefile:   rootMakefile,
			targetName: "start-backend-v2-e2e",
			required: []string{
				"DOCKER_BUILD_NETWORK=default",
				"$(MAKE) build",
			},
		},
		{
			name:       "backend-v2 local build",
			makefile:   backendMakefile,
			targetName: "build",
			required: []string{
				"DOCKER_BUILD_NETWORK=default",
				"bash ../scripts/ci-helpers.sh build_go . $(BINARY_NAME)",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			target := makeTargetBody(t, tt.makefile, tt.targetName)
			assertTargetContains(t, target, tt.required)
		})
	}
}

type buildGoProbe struct {
	buildNetwork         string
	managedNetworkExists bool
}

func runBuildGoWithDockerStub(t *testing.T, probe buildGoProbe) probeResult {
	t.Helper()
	root := t.TempDir()
	binDir := filepath.Join(root, "bin")
	moduleDir := filepath.Join(root, "module")
	if err := os.MkdirAll(binDir, 0o700); err != nil {
		t.Fatalf("create docker stub dir: %v", err)
	}
	if err := os.MkdirAll(moduleDir, 0o700); err != nil {
		t.Fatalf("create module dir: %v", err)
	}
	dockerCalls := filepath.Join(root, "docker-calls.log")
	networkReceipt := filepath.Join(root, "network-created")
	dockerPath := filepath.Join(binDir, "docker")
	dockerScript := `#!/usr/bin/env sh
echo "$*" >> "$DOCKER_CALLS"
case "$1 $2" in
  "network inspect")
    if [ "$MANAGED_NETWORK_EXISTS" = "true" ] || [ -f "$NETWORK_RECEIPT" ]; then
      exit 0
    fi
    exit 1
    ;;
  "network create")
    touch "$NETWORK_RECEIPT"
    exit 0
    ;;
  "build --network")
    if [ "$3" = "d5-dev-network" ] && [ "$MANAGED_NETWORK_EXISTS" != "true" ] && [ ! -f "$NETWORK_RECEIPT" ]; then
      echo "mock docker: network d5-dev-network does not exist" >&2
      exit 42
    fi
    exit 0
    ;;
  "rm -f")
    exit 0
    ;;
  "create --name")
    exit 0
    ;;
  "cp temp-service:/build/service")
    touch ./service
    exit 0
    ;;
esac
exit 0
`
	if err := os.WriteFile(dockerPath, []byte(dockerScript), 0o700); err != nil {
		t.Fatalf("write docker stub: %v", err)
	}

	cmd := exec.Command("bash", "-c", `source ../scripts/ci-helpers.sh ""; build_go "$MODULE_DIR" service; status=$?; printf '\nDOCKER_CALLS:\n'; cat "$DOCKER_CALLS"; exit "$status"`)
	cmd.Env = append(os.Environ(),
		"PATH="+binDir+string(os.PathListSeparator)+os.Getenv("PATH"),
		"DOCKER_NETWORK=d5-dev-network",
		"DOCKER_CALLS="+dockerCalls,
		"NETWORK_RECEIPT="+networkReceipt,
		"MODULE_DIR="+moduleDir,
		"MANAGED_NETWORK_EXISTS="+shellBool(probe.managedNetworkExists),
	)
	if probe.buildNetwork != "" {
		cmd.Env = append(cmd.Env, "DOCKER_BUILD_NETWORK="+probe.buildNetwork)
	}
	output, err := cmd.Output()
	if exitErr, ok := err.(*exec.ExitError); ok {
		return probeResult{stdout: string(output), stderr: string(exitErr.Stderr), exitCode: exitErr.ExitCode()}
	}
	if err != nil {
		t.Fatalf("run build_go docker stub: %v", err)
	}
	return probeResult{stdout: string(output)}
}

func shellBool(value bool) string {
	if value {
		return "true"
	}
	return "false"
}

func assertDockerCallsInOrder(t *testing.T, calls string, ordered []string) {
	t.Helper()
	cursor := 0
	for _, call := range ordered {
		index := strings.Index(calls[cursor:], call)
		if index == -1 {
			t.Fatalf("docker calls missing %q in order:\n%s", call, calls)
		}
		cursor += index + len(call)
	}
}

func assertDockerCallsAbsent(t *testing.T, calls string, forbidden []string) {
	t.Helper()
	for _, call := range forbidden {
		if strings.Contains(calls, call) {
			t.Fatalf("docker calls must not contain %q:\n%s", call, calls)
		}
	}
}

func assertTargetContains(t *testing.T, target string, required []string) {
	t.Helper()
	for _, snippet := range required {
		if !strings.Contains(target, snippet) {
			t.Fatalf("Make target missing %q:\n%s", snippet, target)
		}
	}
}

func TestOperatorDocsStateRegisteredValuesSchema(t *testing.T) {
	docs := readRepositoryFile(t, filepath.Join("docs", "redaction-runtime.md"))
	if !strings.Contains(docs, "JSON array of strings") {
		t.Fatal("operator docs must state registered-values schema as JSON array of strings")
	}
}

func runDockerPrerequisiteGate(t *testing.T, buildxWorks bool, env ...string) probeResult {
	t.Helper()
	dir := t.TempDir()
	docker := filepath.Join(dir, "docker")
	exit := "1"
	if buildxWorks {
		exit = "0"
	}
	script := "#!/usr/bin/env sh\nif [ \"$1\" = buildx ] && [ \"$2\" = version ]; then exit " + exit + "; fi\nexit 1\n"
	if err := os.WriteFile(docker, []byte(script), 0o700); err != nil {
		t.Fatalf("write docker stub: %v", err)
	}

	cmd := exec.Command("sh", "scripts/verify-docker-build-prerequisites.sh")
	cmd.Env = append([]string{
		"PATH=" + dir + string(os.PathListSeparator) + os.Getenv("PATH"),
	}, env...)
	output, err := cmd.Output()
	if exitErr, ok := err.(*exec.ExitError); ok {
		return probeResult{stdout: string(output), stderr: string(exitErr.Stderr), exitCode: exitErr.ExitCode()}
	}
	if err != nil {
		t.Fatalf("run Docker prerequisite gate: %v", err)
	}
	return probeResult{stdout: string(output)}
}

func makeTargetBody(t *testing.T, makefile string, targetName string) string {
	t.Helper()
	startMarker := "\n" + targetName + ":\n"
	start := strings.Index(makefile, startMarker)
	if start == -1 {
		t.Fatalf("Makefile missing target %s", targetName)
	}
	bodyStart := start + len(startMarker)
	remaining := makefile[bodyStart:]
	end := len(remaining)
	offset := 0
	for _, line := range strings.SplitAfter(remaining, "\n") {
		if strings.TrimSpace(line) != "" && !strings.HasPrefix(line, "\t") && !strings.HasPrefix(line, " ") {
			end = offset
			break
		}
		offset += len(line)
	}
	return remaining[:end]
}

func readRepositoryFile(t *testing.T, path string) string {
	t.Helper()
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(content)
}

type probeManifest struct {
	Name       string
	Version    string
	NodeEngine string
	BinName    string
	BinTarget  string
}

type probeResult struct {
	stdout   string
	stderr   string
	exitCode int
}

func runRedactionRuntimeProbe(t *testing.T, checkerPath string, valuesPath string) probeResult {
	t.Helper()
	cmd := exec.Command("sh", "scripts/verify-redaction-runtime.sh")
	cmd.Env = append(os.Environ(),
		"D5_REDACTION_CHECKER_PATH="+checkerPath,
		"D5_REDACTION_REGISTERED_VALUES_FILE="+valuesPath,
	)
	output, err := cmd.Output()
	if exitErr, ok := err.(*exec.ExitError); ok {
		return probeResult{stdout: string(output), stderr: string(exitErr.Stderr), exitCode: exitErr.ExitCode()}
	}
	if err != nil {
		t.Fatalf("run redaction runtime probe: %v", err)
	}
	return probeResult{stdout: string(output)}
}

func writeProbePackage(t *testing.T, manifest probeManifest) (string, string) {
	t.Helper()
	root := t.TempDir()
	binPath := filepath.Join(root, filepath.FromSlash(manifest.BinTarget))
	valuesPath := filepath.Join(root, "values.json")
	if err := os.MkdirAll(filepath.Dir(binPath), 0o700); err != nil {
		t.Fatalf("create bin dir: %v", err)
	}
	valuesJSON, err := json.Marshal([]string{runtimeRegisteredCanary})
	if err != nil {
		t.Fatalf("marshal values file: %v", err)
	}
	if err := os.WriteFile(valuesPath, valuesJSON, 0o600); err != nil {
		t.Fatalf("write values file: %v", err)
	}
	manifestJSON, err := json.Marshal(map[string]any{
		"name":    manifest.Name,
		"version": manifest.Version,
		"engines": map[string]string{"node": manifest.NodeEngine},
		"bin":     map[string]string{manifest.BinName: manifest.BinTarget},
	})
	if err != nil {
		t.Fatalf("marshal package manifest: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "package.json"), manifestJSON, 0o600); err != nil {
		t.Fatalf("write package manifest: %v", err)
	}
	script := `#!/usr/bin/env node
import fs from 'node:fs';

if (process.argv[2] === '--version') {
  process.stdout.write('redaction-rules-v2\n');
  process.exit(0);
}

const valuesIndex = process.argv.indexOf('--values-file');
if (valuesIndex === -1 || valuesIndex + 1 >= process.argv.length) {
  process.exit(2);
}
fs.readFileSync(process.argv[valuesIndex + 1], 'utf8');
const input = fs.readFileSync(0, 'utf8');
process.stdout.write(
  input
    .replaceAll('` + runtimeRegisteredCanary + `', '[REDACTED]')
    .replaceAll('abcdefghijklmnopqrstu12345', '[REDACTED]')
);
`
	if err := os.WriteFile(binPath, []byte(script), 0o700); err != nil {
		t.Fatalf("write checker bin: %v", err)
	}
	return binPath, valuesPath
}
