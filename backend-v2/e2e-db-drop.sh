#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MONGO_HOST=${MONGO_HOST:-localhost}
MONGO_PORT=${MONGO_PORT:-27017}
MONGO_DB=${MONGO_DB:-""}
if [ -z "$MONGO_DB" ]; then
  if [ "$MONGO_PORT" = "27017" ]; then
    MONGO_DB="delta5-dev"
  else
    MONGO_DB="delta5-e2e"
  fi
fi
MONGO_URI="mongodb://${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}"

if [ ! -f "$SCRIPT_DIR/seed-users" ]; then
  cd "$SCRIPT_DIR" && go build -o seed-users ./cmd/seed-users/main.go
fi

"$SCRIPT_DIR/seed-users" -uri="$MONGO_URI" -drop
