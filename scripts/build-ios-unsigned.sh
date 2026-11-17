#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo 'Run this script on macOS: GitHub Actions or Codemagic provide cloud Macs.' >&2
  exit 1
fi
WORKSPACE="$(find ios -maxdepth 1 -name '*.xcworkspace' -type d -print -quit)"
if [[ -z "$WORKSPACE" ]]; then
  echo 'No workspace found. Run expo prebuild --platform ios and pod install first.' >&2
  exit 1
fi
SCHEME="$(basename "$WORKSPACE" .xcworkspace)"
xcodebuild -version
xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath build/ios \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build

APP="$(find build/ios/Build/Products/Release-iphoneos -maxdepth 1 -name '*.app' -type d -print -quit)"
if [[ -z "$APP" ]]; then
  echo 'Xcode did not produce an iPhone .app.' >&2
  exit 1
fi
mkdir -p artifacts/Payload
cp -R "$APP" artifacts/Payload/
(cd artifacts && zip -qry uchastki-unsigned.ipa Payload)
echo 'Created artifacts/uchastki-unsigned.ipa; sign and install it with Sideloadly.'
