#!/bin/bash
# Stop backend-v2 gracefully

cd "$(dirname "$0")"

PID=$(lsof -i :3002 -t 2>/dev/null)

if [ -z "$PID" ]; then
    echo "Backend not running on port 3002"
    exit 0
fi

echo "Stopping backend (PID: $PID)..."
kill -TERM $PID 2>/dev/null

# Wait for graceful shutdown (max 5 seconds)
for i in {1..5}; do
    if ! kill -0 $PID 2>/dev/null; then
        echo "Backend stopped successfully"
        exit 0
    fi
    sleep 1
done

# Force kill if still running
if kill -0 $PID 2>/dev/null; then
    echo "Forcing backend shutdown..."
    kill -9 $PID 2>/dev/null
    echo "Backend force stopped"
fi
