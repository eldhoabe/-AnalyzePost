#!/usr/bin/env bash
# Cross-stack smoke test (spec section 14 / issue #12).
#
# Starts the real backend with a scripted (non-LLM) client, waits for it
# to come up, builds the extension, and runs the Playwright suite that
# drives the real popup -> background -> content script -> backend chain
# for the Post A / Post B worked examples.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Starting scripted backend on :8000"
# `exec` replaces the subshell with the python process itself, so $! is
# the real server PID rather than a shell wrapper kill can't reach.
(cd backend && exec python3 -m tests.smoke_server) &
BACKEND_PID=$!
cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> Waiting for backend readiness"
ready=0
for _ in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.5
done
if [ "$ready" -ne 1 ]; then
  echo "Backend did not become ready in time" >&2
  exit 1
fi

echo "==> Running cross-stack smoke tests"
(cd extension && npm run test:smoke)

echo "==> Smoke test passed"
