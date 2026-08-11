#!/usr/bin/env sh
set -eu

canonical_package='/tmp/redaction-package.tgz'
canonical_sha512='b24d54070ebbeeaff4c6791c721ba34971b467164bfcdec8ae9ae5056efa320172fb4e95c5e045c6bc674e31357b68001aca0cad0dcb88f93fc12a5aab3a33f7'
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
Fetch the verified 0.1.4 registry package outside the repository, then set REDACTION_PACKAGE_TARBALL_FILE to that path.
MESSAGE
        exit 1
        ;;
    esac
    if [ "$package_sha512" != "$canonical_sha512" ]; then
      cat >&2 <<'MESSAGE'
redaction docker build prerequisite failed: REDACTION_PACKAGE_SHA512 must equal the canonical release receipt.
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
