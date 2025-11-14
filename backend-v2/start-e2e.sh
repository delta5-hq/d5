#!/bin/bash
# Run E2E tests against backend-v2 with mocked external services
# Automatically starts backend-v2, runs tests, then kills backend-v2

set -e

cd "$(dirname "$0")"

BACKEND_PID=""

cleanup() {
    if [ -n "$BACKEND_PID" ]; then
        echo "Stopping backend-v2 (PID $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
    fi
}

trap cleanup EXIT INT TERM

echo "Starting backend-v2 in E2E mode (mocked external services)..."
JWT_SECRET='GrFYK5ftZDtCg7ZGwxZ1JpSxyyJ9bc8uJijvBD1DYiMoS64ZpnBSrFxsNuybN1iO' \
MONGO_URI='mongodb://localhost:27017/delta5' \
PORT=3002 \
MOCK_EXTERNAL_SERVICES=true \
./backend-v2 > logs/backend-e2e.log 2>&1 &

BACKEND_PID=$!
echo "Backend-v2 started (PID $BACKEND_PID)"

sleep 3

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "ERROR: Backend-v2 failed to start"
    tail -20 logs/backend-e2e.log
    exit 1
fi

echo "Running E2E tests..."
cd ../backend
E2E_SERVER_URL=http://localhost:3002 \
E2E_API_BASE_PATH=/api/v1 \
E2E_MONGO_URI=mongodb://localhost:27017/delta5 \
npm run test:e2e -- --maxWorkers=1 --forceExit

TEST_EXIT_CODE=$?

echo "E2E tests completed with exit code: $TEST_EXIT_CODE"
exit $TEST_EXIT_CODE
