#!/usr/bin/env bash
# Forces Gradle to sign the debug APK with the committed keystore
# (ci/debug.keystore.b64, decoded to ~/.android/debug.keystore by an earlier
# workflow step). Without this, builds were signed with a fresh random key
# every run, which makes Android reject updates ("conflicts with an existing
# package"). Run after `cap add android` and before `./gradlew assembleDebug`.
set -euo pipefail

cp ~/.android/debug.keystore android/app/debug-stable.keystore

cat >> android/app/build.gradle <<'EOF'

android {
    signingConfigs {
        debug {
            storeFile file('debug-stable.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
            storeType 'pkcs12'
        }
    }
}
EOF

echo "Stable signing config appended to android/app/build.gradle"
