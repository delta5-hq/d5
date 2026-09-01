# D5 backend-v2 redaction runtime

D5 first-party logs must pass through the private `@redaction-control/value-redaction-control` standalone checker before stdout or stderr receives them.

Required runtime values:

- `D5_REDACTION_CHECKER_PATH`: executable checker path for `@redaction-control/value-redaction-control` version `0.1.4`.
- `D5_REDACTION_REGISTERED_VALUES_FILE`: runtime-mounted registered-values file path. The file schema is a JSON array of strings.
- `D5_REDACTION_TIMEOUT_MS`: optional timeout in milliseconds; default is `2000`.

The D5 runtime verifies the installed package manifest name, package version `0.1.4`, Node engine `>=22`, bin path, and rule-set version `redaction-rules-v3` before it listens. A missing checker path, missing values-file path, unreadable checker, wrong version, timeout, rejected log, or held log emits only:

```text
redaction unavailable: log suppressed
```

The suppressed signal never includes the attempted log text.

Provisioning shape:

```bash
export REDACTION_NPM_TOKEN='<private registry read token>'
REDACTION_PACKAGE_DIR="$(mktemp -d)"
REDACTION_PACKAGE_TARBALL="$REDACTION_PACKAGE_DIR/value-redaction-control-0.1.4.tgz"
bash scripts/fetch-redaction-package.sh "$REDACTION_PACKAGE_TARBALL"
npm install --global "$REDACTION_PACKAGE_TARBALL"
export D5_REDACTION_CHECKER_PATH="$(command -v value-redaction-check)"
export D5_REDACTION_REGISTERED_VALUES_FILE="/run/secrets/d5-redaction-registered-values.json"
export D5_REDACTION_TIMEOUT_MS=2000
```

Container provisioning with the receipt-verified package kept outside the repository:

```bash
make package-backend-v2 REDACTION_PACKAGE_TARBALL_FILE="$REDACTION_PACKAGE_TARBALL"
```

Docker Buildx is required because the image build consumes the canonical package through a BuildKit secret mount. The build must stop before `docker build` if the external artefact path, secret mount, or receipt checksum is missing.

The D5 project-local mirror receipt is project `63`, version `0.1.4`, byte size `11127`, SHA-256 `5161d15a1ac71a9a7b145a59dcfb6e41bca15ffc21af04ee6e8e0b81d93bc7d6`, and SHA-512 `b24d54070ebbeeaff4c6791c721ba34971b467164bfcdec8ae9ae5056efa320172fb4e95c5e045c6bc674e31357b68001aca0cad0dcb88f93fc12a5aab3a33f7`. Project `63` is transport, while the verified release receipt remains authority. The fetcher verifies the SHA-512 before publishing the external file; the Dockerfile verifies it again before `npm install`, then checks the installed manifest, bin path, Node engine, package version, and rule-set identity. No package tarball or registry credential is committed or copied into the image.

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
