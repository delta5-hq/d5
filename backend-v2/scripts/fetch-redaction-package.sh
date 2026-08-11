#!/bin/sh
set -eu

package_url='https://gitlab.solid-branch-software.com/api/v4/projects/63/packages/npm/@redaction-control/value-redaction-control/-/@redaction-control/value-redaction-control-0.1.4.tgz'
package_sha512='b24d54070ebbeeaff4c6791c721ba34971b467164bfcdec8ae9ae5056efa320172fb4e95c5e045c6bc674e31357b68001aca0cad0dcb88f93fc12a5aab3a33f7'
output_path="${1:-}"
token="${REDACTION_NPM_TOKEN:-}"
token_type="${REDACTION_NPM_TOKEN_TYPE:-PRIVATE-TOKEN}"

if [ -z "$output_path" ]; then
  echo 'redaction package fetch failed: output path is required' >&2
  exit 1
fi
if [ -z "$token" ]; then
  echo 'redaction package fetch failed: REDACTION_NPM_TOKEN is required' >&2
  exit 1
fi
token_without_controls="$(printf '%s' "$token" | LC_ALL=C tr -d '[:cntrl:]')"
if [ "$token_without_controls" != "$token" ]; then
  echo 'redaction package fetch failed: REDACTION_NPM_TOKEN contains control characters' >&2
  exit 1
fi
case "$token_type" in
  PRIVATE-TOKEN|JOB-TOKEN) ;;
  *)
    echo 'redaction package fetch failed: REDACTION_NPM_TOKEN_TYPE must be PRIVATE-TOKEN or JOB-TOKEN' >&2
    exit 1
    ;;
esac

umask 077
temporary_path="${output_path}.partial.$$"
curl_header_path="${output_path}.curl-header.$$"
trap 'rm -f "$temporary_path" "$curl_header_path"' EXIT HUP INT TERM

printf '%s: %s\n' "$token_type" "$token" >"$curl_header_path"
curl --header "@$curl_header_path" \
  --fail --silent --show-error \
  --output "$temporary_path" \
  "$package_url"
printf '%s  %s\n' "$package_sha512" "$temporary_path" | sha512sum -c - >/dev/null
mv "$temporary_path" "$output_path"
rm -f "$curl_header_path"
trap - EXIT HUP INT TERM
