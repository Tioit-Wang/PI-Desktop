#!/usr/bin/env bash
# Release build for macOS arm64: signed + notarized DMG.
#
# Local default (`pnpm --filter @pi-desktop/desktop dist`) stays unsigned
# (identity: null in package.json). This script injects a real signing
# identity and enables notarization, both from environment variables:
#
#   MAC_SIGNING_IDENTITY   e.g. "Developer ID Application: Your Name (TEAMID)"
#   APPLE_ID               Apple ID email for notarization
#   APPLE_APP_SPECIFIC_PASSWORD  app-specific password for the Apple ID
#   APPLE_TEAM_ID          Apple Developer Team ID
#
# See docs/spec/06-delivery/06-release-runbook.md for the full runbook.

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -z "${MAC_SIGNING_IDENTITY:-}" ]]; then
  echo "error: MAC_SIGNING_IDENTITY is not set." >&2
  echo "For an unsigned local build use: pnpm --filter @pi-desktop/desktop dist" >&2
  exit 1
fi

NOTARIZE_ARGS=()
if [[ -n "${APPLE_ID:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]]; then
  echo "==> Notarization credentials found; notarization enabled."
  NOTARIZE_ARGS=(-c.mac.notarize=true)
else
  echo "==> Notarization credentials missing (APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID)." >&2
  echo "    Building signed but NOT notarized DMG." >&2
fi

echo "==> Building host-core (release)"
cargo build -p host-core --release

echo "==> Building workspace packages"
pnpm -r --filter '!@pi-desktop/desktop' build

echo "==> Building + packaging desktop (signed)"
pnpm --filter @pi-desktop/desktop exec electron-vite build
pnpm --filter @pi-desktop/desktop exec electron-builder --mac --arm64 \
  -c.mac.identity="${MAC_SIGNING_IDENTITY}" \
  "${NOTARIZE_ARGS[@]}"

echo "==> Done. Artifacts in apps/desktop/release/"
