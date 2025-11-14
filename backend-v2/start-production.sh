#!/bin/bash
# Start backend-v2 in production mode (real external services)

cd "$(dirname "$0")"

# Ensure logs directory exists and is git-ignored
mkdir -p logs
if [ ! -f logs/.gitignore ]; then
    echo "*" > logs/.gitignore
    echo "!.gitignore" >> logs/.gitignore
fi

JWT_SECRET='GrFYK5ftZDtCg7ZGwxZ1JpSxyyJ9bc8uJijvBD1DYiMoS64ZpnBSrFxsNuybN1iO' \
MONGO_URI='mongodb://localhost:27017/delta5' \
PORT=3002 \
nohup ./backend-v2 > logs/backend-production.log 2>&1 &

echo "Backend started with PID $! (PRODUCTION MODE - Real external services)"
echo "Logs: logs/backend-production.log"
