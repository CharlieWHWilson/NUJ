#!/bin/sh
set -eu

cd "$CI_WORKSPACE"

if command -v npm >/dev/null 2>&1; then
  npm ci
else
  echo "npm is required for Xcode Cloud builds" >&2
  exit 1
fi

npm run cap:sync
