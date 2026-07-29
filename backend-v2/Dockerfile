# syntax=docker/dockerfile:1.7
FROM golang:1.25-alpine AS builder

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o service . \
 && CGO_ENABLED=0 GOOS=linux go build -o seed-users ./cmd/seed-users

FROM node:22-alpine
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]

ARG REDACTION_PACKAGE_SPEC=/tmp/redaction-package.tgz
ARG REDACTION_PACKAGE_SHA512=19f4f7ca3ac8f0fe10b292bf26e7e6c71a89dd904875f7d892d00e963b7e36788b5925ebed3e598c92063164837fb64b6492c80706d5c167015472ca8def14ff

# hadolint ignore=DL3018
RUN apk add --no-cache ca-certificates tzdata

# hadolint ignore=DL3016
RUN --mount=type=secret,id=redaction_package,target=/tmp/redaction-package.tgz,required=false \
	if [ -n "${REDACTION_PACKAGE_SHA512}" ]; then \
		printf '%s  %s\n' "${REDACTION_PACKAGE_SHA512}" "${REDACTION_PACKAGE_SPEC}" | sha512sum -c -; \
	fi \
	&& npm install --global "${REDACTION_PACKAGE_SPEC}" \
	&& npm cache clean --force \
	&& test "$(node --version | cut -d. -f1 | tr -d v)" -ge 22 \
	&& command -v value-redaction-check >/dev/null \
	&& test "$(value-redaction-check --version | tr -d '\r\n')" = "redaction-rules-v2"

RUN node - <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const checkerPath = fs.realpathSync('/usr/local/bin/value-redaction-check');
let current = path.dirname(checkerPath);
let manifestPath = '';

while (current !== path.dirname(current)) {
  const candidate = path.join(current, 'package.json');
  if (fs.existsSync(candidate)) {
    manifestPath = candidate;
    break;
  }
  current = path.dirname(current);
}

if (!manifestPath) {
  throw new Error('manifest not found');
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const binEntry = manifest.bin && manifest.bin['value-redaction-check'];
const expectedBinPath = binEntry ? fs.realpathSync(path.resolve(path.dirname(manifestPath), binEntry)) : '';
if (
  manifest.name !== '@redaction-control/value-redaction-control' ||
  manifest.version !== '0.1.2' ||
  manifest.engines?.node !== '>=22' ||
  expectedBinPath !== checkerPath
) {
  throw new Error('redaction package receipt mismatch');
}
NODE

WORKDIR /app
COPY --from=builder /build/service .
COPY --from=builder /build/seed-users .

ENV D5_REDACTION_CHECKER_PATH=/usr/local/bin/value-redaction-check
ENV D5_REDACTION_TIMEOUT_MS=2000

EXPOSE 3002

ENTRYPOINT ["./service"]
