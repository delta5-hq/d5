# D5 backend-v2 redaction runtime

D5 first-party logs must pass through the private `@redaction-control/value-redaction-control` standalone checker before stdout or stderr receives them.

Required runtime values:

- `D5_REDACTION_CHECKER_PATH`: executable checker path for `@redaction-control/value-redaction-control` version `0.1.2`.
- `D5_REDACTION_REGISTERED_VALUES_FILE`: runtime-mounted registered-values file path. The file schema is a JSON array of strings.
- `D5_REDACTION_TIMEOUT_MS`: optional timeout in milliseconds; default is `2000`.

The D5 runtime verifies the installed package manifest name, package version `0.1.2`, Node engine `>=22`, bin path, and rule-set version `redaction-rules-v2` before it listens. A missing checker path, missing values-file path, unreadable checker, wrong version, timeout, rejected log, or held log emits only:

```text
redaction unavailable: log suppressed
```

The suppressed signal never includes the attempted log text.

Provisioning shape:

```bash
REDACTION_PACKAGE_TARBALL="./third_party/redaction/redaction-control-value-redaction-control-0.1.2.tgz"
REDACTION_PACKAGE_SHA512="19f4f7ca3ac8f0fe10b292bf26e7e6c71a89dd904875f7d892d00e963b7e36788b5925ebed3e598c92063164837fb64b6492c80706d5c167015472ca8def14ff"
printf '%s  %s\n' "$REDACTION_PACKAGE_SHA512" "$REDACTION_PACKAGE_TARBALL" | sha512sum -c -
npm install --global "$REDACTION_PACKAGE_TARBALL"
export D5_REDACTION_CHECKER_PATH="$(command -v value-redaction-check)"
export D5_REDACTION_REGISTERED_VALUES_FILE="/run/secrets/d5-redaction-registered-values.json"
export D5_REDACTION_TIMEOUT_MS=2000
```

Container provisioning with the canonical in-repository packed artefact:

```bash
make package-backend-v2
```

Docker Buildx is required because the image build consumes the canonical packed artefact through a BuildKit secret mount. The build must stop before `docker build` if the artefact secret or checksum is missing for the canonical tarball path.

The canonical packed artefact lives at `backend-v2/third_party/redaction/redaction-control-value-redaction-control-0.1.2.tgz`. Its byte size is `11215`, and its SHA-512 is `19f4f7ca3ac8f0fe10b292bf26e7e6c71a89dd904875f7d892d00e963b7e36788b5925ebed3e598c92063164837fb64b6492c80706d5c167015472ca8def14ff`. The Dockerfile verifies the checksum before `npm install` and then verifies the installed package manifest, bin path, Node engine, package version, and rule-set version.

Mount the registered-values file at runtime. Its content must be a JSON array of strings. Do not bake secret values into source, image layers, command arguments, logs, or diagnostics.

Run the image with the values file mounted read-only:

```bash
docker run \
  -e D5_REDACTION_REGISTERED_VALUES_FILE=/run/secrets/d5-redaction-registered-values.json \
  -v /secure/runtime/d5-redaction-registered-values.json:/run/secrets/d5-redaction-registered-values.json:ro \
  d5-backend-v2:latest
```

Synthetic verification:

1. Put only a synthetic canary in the mounted values file.
2. Start `backend-v2` with the three environment variables above.
3. Trigger an application log and an HTTP request path containing the synthetic canary.
4. Confirm ordinary log text remains present and the synthetic canary is absent.
5. Temporarily point `D5_REDACTION_CHECKER_PATH` at a missing executable and confirm only the suppressed signal appears.

Run `make redaction-runtime-probe` before promoting a runtime image or host. The probe executes the checker with `--version` and with log text on stdin plus `--values-file PATH`; no JSON subcommand or local rule adapter is accepted.
