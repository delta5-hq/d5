#!/bin/bash
# Legacy start script - redirects to start-dev.sh for E2E testing compatibility

cd "$(dirname "$0")"
bash start-dev.sh

