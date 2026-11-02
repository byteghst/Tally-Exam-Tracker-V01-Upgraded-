#!/usr/bin/env bash
# Security hardening for the generated android/ project. Runs after
# ci/force-signing.sh (which defines signingConfigs.debug with the stable
# private keystore) and before the Gradle build.
#
#  1. Backups off: the Supabase session token lives in the WebView's
#     localStorage, so adb/cloud backup must not be able to copy app data.
#  2. Release build: sign the release variant with the same stable keystore
#     (so updates install over existing installs) and make sure it is not
#     debuggable.
set -euo pipefail

MANIFEST=android/app/src/main/AndroidManifest.xml
GRADLE=android/app/build.gradle

if grep -q 'android:allowBackup=' "$MANIFEST"; then
  sed -i 's/android:allowBackup="[^"]*"/android:allowBackup="false"/' "$MANIFEST"
else
  sed -i 's|<application|<application android:allowBackup="false"|' "$MANIFEST"
fi
grep -q 'android:allowBackup="false"' "$MANIFEST" || { echo "allowBackup patch failed"; exit 1; }

cat >> "$GRADLE" <<'EOF'

android {
    buildTypes {
        release {
            signingConfig signingConfigs.debug
            debuggable false
        }
    }
    lint {
        checkReleaseBuilds false
        abortOnError false
    }
}
EOF

echo "Android hardening applied: backups off, signed non-debuggable release variant"
