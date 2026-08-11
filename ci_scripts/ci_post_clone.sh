#!/bin/sh
set -eu

cd "$CI_WORKSPACE"

# Ensure each Xcode Cloud archive has a strictly increasing iOS build number.
# Prefer CI_BUILD_NUMBER (monotonic in Xcode Cloud), with epoch fallback.
IOS_BUILD_NUMBER="${CI_BUILD_NUMBER:-$(date +%s)}"
PBXPROJ_FILE="ios/App/App.xcodeproj/project.pbxproj"
if [ -f "$PBXPROJ_FILE" ]; then
  echo "Setting CURRENT_PROJECT_VERSION to ${IOS_BUILD_NUMBER}"
  perl -i -pe "s/CURRENT_PROJECT_VERSION = \d+;/CURRENT_PROJECT_VERSION = ${IOS_BUILD_NUMBER};/g" "$PBXPROJ_FILE"
  grep -n "CURRENT_PROJECT_VERSION = " "$PBXPROJ_FILE" | head -n 4
fi

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
  # Replace fragile node_modules package paths with repository-local plugin paths.
  perl -i -pe 's#\.\./\.\./\.\./node_modules/\@capacitor/local-notifications#../../CapacitorPlugins/local-notifications#g; s#\.\./\.\./\.\./node_modules/\@capacitor/push-notifications#../../CapacitorPlugins/push-notifications#g' "$CAP_SPM_FILE"

  if grep -q "node_modules/@capacitor" "$CAP_SPM_FILE"; then
    echo "Failed to rewrite Capacitor plugin paths in ${CAP_SPM_FILE}" >&2
    exit 1
  fi
fi
