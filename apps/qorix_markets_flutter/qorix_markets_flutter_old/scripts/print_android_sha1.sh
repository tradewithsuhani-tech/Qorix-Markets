#!/usr/bin/env bash
# Print SHA-1 fingerprints for Google Cloud Console → Android OAuth client.
# Package: com.qorixmarkets.app (must match android/app/build.gradle.kts).
#
# IMPORTANT: Old Play APK (Qorix Markets.apk) uses a RELEASE cert (META-INF/MY-KEY-A).
# `flutter run` / debug APK uses ~/.android/debug.keystore — different SHA-1.
# Add BOTH SHA-1 values in Google Cloud if you test debug + release builds.
set -euo pipefail
cd "$(dirname "$0")/../android"

echo "Package: com.qorixmarkets.app"
echo ""
echo "Debug keystore SHA-1 (flutter run / app-debug.apk):"
if command -v keytool >/dev/null 2>&1; then
  keytool -list -v -keystore "${HOME}/.android/debug.keystore" -alias androiddebugkey \
    -storepass android -keypass android 2>/dev/null | grep "SHA1:" || echo "  (keytool failed — install JDK)"
else
  echo "  Install JDK (keytool) to print debug SHA-1."
fi
echo ""
echo "Release / Play APK SHA-1:"
echo "  From your upload keystore (same cert as old working APK):"
echo "  keytool -list -v -keystore /path/to/upload.keystore -alias YOUR_ALIAS"
echo ""
echo "Or Google Play Console → App signing → App signing key certificate → SHA-1"
echo ""
echo "Web client ID (serverClientId):"
echo "  905039735320-lc7nauggottuubm9v03k8f64dvqpl57k.apps.googleusercontent.com"
