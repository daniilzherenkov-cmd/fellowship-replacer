#!/usr/bin/env bash
#
# build-app.sh — Path A hand-off build.
#
# Produces a Release, AD-HOC–signed "Fellow 2.app" that runs on ANY Mac after the
# recipient clicks "Open Anyway" (no Apple Developer Program, $0). Zips it into dist/.
#
# Ad-hoc ("Sign to Run Locally") is deliberate: a free Personal-Team *development*
# signature is tied to registered devices and expires in ~7 days, so it is unreliable
# on someone else's Mac. Ad-hoc has no such limits — Gatekeeper just needs one manual
# "Open Anyway" the first time.
#
# Requirements: FULL Xcode (not just Command Line Tools — SwiftData macros ship inside
# Xcode). Run from anywhere; the script cd's to the repo root.
#
# Usage:  ./scripts/build-app.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="Fellow 2"
SCHEME="Fellow2"
PROJECT="Fellow2.xcodeproj"
BUILD_DIR="build"
DIST_DIR="dist"
STAMP="$(date +%Y%m%d)"

# --- Guard: full Xcode must be selected (CommandLineTools can't build SwiftData macros) ---
DEVDIR="$(xcode-select -p 2>/dev/null || true)"
if [[ "$DEVDIR" != *"Xcode.app"* ]]; then
  echo "✗ Full Xcode is required, but xcode-select points at: ${DEVDIR:-<none>}"
  echo "  Fix:  sudo xcode-select -s /Applications/Xcode.app"
  exit 1
fi

# --- Keep the generated project in sync with project.yml (optional but recommended) ---
if command -v xcodegen >/dev/null 2>&1; then
  echo "▸ xcodegen generate…"
  xcodegen generate
else
  echo "▸ (xcodegen not found — using existing $PROJECT; install with: brew install xcodegen)"
fi

# --- Build Release, ad-hoc signed (identity '-'), no team / no provisioning profile ---
echo "▸ Building Release (ad-hoc signed)… this can take a minute."
rm -rf "$BUILD_DIR"
xcodebuild \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration Release \
  -derivedDataPath "$BUILD_DIR" \
  -destination 'platform=macOS' \
  CODE_SIGN_IDENTITY="-" \
  CODE_SIGN_STYLE=Manual \
  DEVELOPMENT_TEAM="" \
  PROVISIONING_PROFILE_SPECIFIER="" \
  clean build

APP_PATH="$BUILD_DIR/Build/Products/Release/$APP_NAME.app"
if [[ ! -d "$APP_PATH" ]]; then
  echo "✗ Build succeeded but app not found at: $APP_PATH"
  echo "  Look under $BUILD_DIR/Build/Products/Release/ and adjust APP_NAME if needed."
  exit 1
fi

# --- Belt & suspenders: ensure a clean ad-hoc signature with hardened runtime ---
# CRITICAL: pass --entitlements. A bare `codesign --sign -` STRIPS the entitlements
# xcodebuild applied, including com.apple.security.personal-information.calendars — and
# under the hardened runtime, losing that entitlement silently breaks Calendar access
# (requestFullAccessToEvents returns granted=false, no prompt). See docs/07.
echo "▸ Ad-hoc re-sign (hardened runtime + entitlements)…"
codesign --force --deep --sign - --options runtime \
  --entitlements Fellow2/Fellow2.entitlements "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH" || {
  echo "✗ Signature verification failed — the app may not launch elsewhere."; exit 1; }

# --- Zip with ditto (preserves bundle structure + signature; plain 'zip' can corrupt it) ---
echo "▸ Zipping for hand-off…"
mkdir -p "$DIST_DIR"
ZIP_PATH="$DIST_DIR/Fellow2-$STAMP.zip"
rm -f "$ZIP_PATH"
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$ZIP_PATH"

echo ""
echo "✓ Done → $ZIP_PATH"
echo "  Send this zip to Milena together with docs/FOR-MILENA.md"
echo "  TIP: test it first on another Mac or macOS user account before sending."
