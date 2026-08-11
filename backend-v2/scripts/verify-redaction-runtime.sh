#!/bin/sh
set -eu

checker_path="${D5_REDACTION_CHECKER_PATH:-}"
values_path="${D5_REDACTION_REGISTERED_VALUES_FILE:-}"

if [ -z "$checker_path" ]; then
  echo "redaction runtime probe failed: checker path is required" >&2
  exit 1
fi

if [ -z "$values_path" ]; then
  echo "redaction runtime probe failed: registered-values file path is required" >&2
  exit 1
fi

node "$checker_path" --version >/dev/null 2>&1 || {
  echo "redaction runtime probe failed: checker is not a Node executable" >&2
  exit 1
}

node - "$checker_path" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const checkerPath = fs.realpathSync(process.argv[2]);
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
  manifest.version !== '0.1.4' ||
  manifest.engines?.node !== '>=22' ||
  !binEntry ||
  expectedBinPath !== checkerPath
) {
  throw new Error('manifest contract mismatch');
}
NODE

rule_set_version="$("$checker_path" --version | tr -d '\r\n')"
if [ "$rule_set_version" != "redaction-rules-v3" ]; then
  echo "redaction runtime probe failed: checker version mismatch" >&2
  exit 1
fi

input='ordinary before syntheticRuntimeCanary12345 after Bearer abcdefghijklmnopqrstu12345'
output="$(printf '%s' "$input" | "$checker_path" --values-file "$values_path")"

case "$output" in
  *"ordinary before"*"after"*) ;;
  *)
    echo "redaction runtime probe failed: ordinary text changed" >&2
    exit 1
    ;;
esac

case "$output" in
  *"syntheticRuntimeCanary12345"*|*"abcdefghijklmnopqrstu12345"*)
    echo "redaction runtime probe failed: synthetic secret leaked" >&2
    exit 1
    ;;
esac

echo "redaction runtime probe passed"
