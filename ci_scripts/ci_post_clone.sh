#!/bin/sh
set -eu

cd "$CI_WORKSPACE"

if command -v npm >/dev/null 2>&1; then
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install --no-audit --no-fund
  fi
else
  echo "npm is required for Xcode Cloud builds" >&2
  exit 1
fi

npm run cap:sync

# cap sync regenerates CapApp-SPM/Package.swift with node_modules paths.
# Xcode Cloud can fail to resolve those paths, so keep references inside ios/.
CAP_SPM_FILE="ios/App/CapApp-SPM/Package.swift"
if [ -f "$CAP_SPM_FILE" ]; then
  perl -0777 -i -pe 's#path:\s*"\.\./\.\./\.\./node_modules/@capacitor/local-notifications"#path: "../../CapacitorPlugins/local-notifications"#g; s#path:\s*"\.\./\.\./\.\./node_modules/@capacitor/push-notifications"#path: "../../CapacitorPlugins/push-notifications"#g' "$CAP_SPM_FILE"
fi
