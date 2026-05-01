#!/bin/bash
trap '' SIGHUP

NODE_ENV=development npx tsx server/index.ts &
CHILD_PID=$!

trap 'kill $CHILD_PID 2>/dev/null; exit' SIGTERM SIGINT

wait $CHILD_PID
