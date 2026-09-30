#!/usr/bin/env bash
# Native Android patches applied after `cap add android` and asset generation,
# and before `./gradlew assembleDebug` (android/ is regenerated every build,
# so anything native has to be applied here).
#
#  1. Stable signing: forces Gradle to sign the debug APK with the committed
#     keystore (ci/debug.keystore.b64, decoded to ~/.android/debug.keystore by
#     an earlier workflow step). Without this, builds were signed with a fresh
#     random key every run, which makes Android reject updates ("conflicts
#     with an existing package").
#  2. Sharp launch screen on Android 12+ (see the second half of this file).
set -euo pipefail

# ---------------------------------------------------------------------------
# 1. Stable signing
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# 2. Android 12+ launch screen
#
# Android 12 and newer ignore the splash image and instead show the app's
# small adaptive-icon layer enlarged about 2x, which is why the logo looked
# small and blurry when opening the app. This points the system launch
# screen at the full-size 1024px logo (resources/icon.png) on the same navy
# as the logo tile, so it is crisp and fills the screen properly.
# The logo is inset 5% so its corners stay inside the circle Android 12
# crops the launch icon to.
# ---------------------------------------------------------------------------
RES=android/app/src/main/res

if [ -f resources/icon.png ]; then
  mkdir -p "$RES/drawable" "$RES/drawable-nodpi" "$RES/values-v31"

  cp resources/icon.png "$RES/drawable-nodpi/splash_logo_src.png"

  cat > "$RES/drawable/splash_logo.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@drawable/splash_logo_src"
    android:insetLeft="5%"
    android:insetTop="5%"
    android:insetRight="5%"
    android:insetBottom="5%" />
XML

  cat > "$RES/values-v31/styles.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
        <item name="android:background">@drawable/splash</item>
        <item name="android:windowSplashScreenBackground">#030C21</item>
        <item name="android:windowSplashScreenAnimatedIcon">@drawable/splash_logo</item>
    </style>
</resources>
XML

  echo "Android 12+ launch screen configured"
else
  echo "resources/icon.png not found - skipping Android 12+ launch screen patch"
fi
