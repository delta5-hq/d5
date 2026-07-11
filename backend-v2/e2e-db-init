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
    MONGO_DB="delta5"
  fi
fi
MONGO_URI="mongodb://${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}"

if [ ! -f "$SCRIPT_DIR/seed-users" ]; then
  echo "→ Building seed-users tool..."
  cd "$SCRIPT_DIR" && go build -o seed-users ./cmd/seed-users/main.go
fi

DROP_FLAG=""
if [ "$DROP_DB" = "true" ]; then
  DROP_FLAG="-drop"
fi

"$SCRIPT_DIR/seed-users" -uri="$MONGO_URI" $DROP_FLAG
