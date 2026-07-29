#!/usr/bin/env sh
set -eu

canonical_package='/tmp/redaction-package.tgz'
package_spec="${REDACTION_PACKAGE_SPEC:-$canonical_package}"
secret_args="${DOCKER_BUILD_SECRETS:-}"
package_sha512="${REDACTION_PACKAGE_SHA512:-}"

if ! docker buildx version >/dev/null 2>&1; then
  cat >&2 <<'MESSAGE'
redaction docker build prerequisite failed: Docker Buildx is required for BuildKit secret mounts.
Install the Docker Buildx component before running the canonical backend-v2 image build.
MESSAGE
  exit 1
fi

case "$package_spec" in
  "$canonical_package")
    case "$secret_args" in
      *"id=redaction_package"*) ;;
      *)
        cat >&2 <<'MESSAGE'
redaction docker build prerequisite failed: REDACTION_PACKAGE_SPEC uses the checksum-pinned tarball path, but no BuildKit package secret was supplied.
Set DOCKER_BUILD_SECRETS='--secret id=redaction_package,src=backend-v2/third_party/redaction/redaction-control-value-redaction-control-0.1.2.tgz'.
MESSAGE
        exit 1
        ;;
    esac
    if [ -z "$package_sha512" ]; then
      cat >&2 <<'MESSAGE'
redaction docker build prerequisite failed: REDACTION_PACKAGE_SHA512 is required for the checksum-pinned tarball path.
MESSAGE
      exit 1
    fi
    ;;
  *)
    cat >&2 <<'MESSAGE'
redaction docker build prerequisite failed: REDACTION_PACKAGE_SPEC must be the checksum-pinned canonical tarball path.
MESSAGE
    exit 1
    ;;
esac
