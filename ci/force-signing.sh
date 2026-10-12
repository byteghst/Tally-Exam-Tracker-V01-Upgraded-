#!/usr/bin/env bash
# Native Android patches applied after `cap add android` and asset generation,
# and before `./gradlew assembleDebug` (android/ is regenerated every build,
# so anything native has to be applied here).
#
#  1. Stable signing: forces Gradle to sign the APK with the private release
#     keystore, which the workflow decodes from the TALLY_KEYSTORE_B64 secret
#     to ~/.android/debug.keystore. Its password and alias come from the
#     TALLY_KEYSTORE_PASSWORD / TALLY_KEY_ALIAS secrets. Without a stable key,
#     builds were signed with a fresh random key every run, which makes Android
#     reject updates ("conflicts with an existing package").
#  2. Sharp launch screen on Android 12+.
#  3. Reliable reminders: the permissions Android needs to show notifications
#     and fire them on time, plus a proper Tally status-bar icon.
set -euo pipefail

# ---------------------------------------------------------------------------
# 1. Stable signing
# ---------------------------------------------------------------------------
: "${TALLY_KEYSTORE_PASSWORD:?TALLY_KEYSTORE_PASSWORD secret is missing}"
: "${TALLY_KEY_ALIAS:?TALLY_KEY_ALIAS secret is missing}"

cp ~/.android/debug.keystore android/app/debug-stable.keystore

# Unquoted heredoc on purpose: the shell fills in the two values below. The
# android/ folder is generated fresh on the runner each build and never
# committed, so the password is not written anywhere in the repository.
cat >> android/app/build.gradle <<EOF

android {
    signingConfigs {
        debug {
            storeFile file('debug-stable.keystore')
            storePassword '${TALLY_KEYSTORE_PASSWORD}'
            keyAlias '${TALLY_KEY_ALIAS}'
            keyPassword '${TALLY_KEYSTORE_PASSWORD}'
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
# screen at the full-size 1024px logo (resources/icon.png) on the same pure
# black as the logo tile, so it is crisp and fills the screen properly.
# No inset: the artwork is a square black tile on a black background, so the
# tile's edges are invisible, and the mark is already sized (see
# scripts/build-icons.mjs) to sit inside the circle Android 12 crops the
# launch icon to.
# ---------------------------------------------------------------------------
RES=android/app/src/main/res

if [ -f resources/icon.png ]; then
  mkdir -p "$RES/drawable" "$RES/drawable-nodpi" "$RES/values-v31"

  cp resources/icon.png "$RES/drawable-nodpi/splash_logo_src.png"

  cat > "$RES/drawable/splash_logo.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@drawable/splash_logo_src"
    android:insetLeft="0%"
    android:insetTop="0%"
    android:insetRight="0%"
    android:insetBottom="0%" />
XML

  cat > "$RES/values-v31/styles.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
        <item name="android:background">@drawable/splash</item>
        <item name="android:windowSplashScreenBackground">#000000</item>
        <item name="android:windowSplashScreenAnimatedIcon">@drawable/splash_logo</item>
    </style>
</resources>
XML

  echo "Android 12+ launch screen configured"
else
  echo "resources/icon.png not found - skipping Android 12+ launch screen patch"
fi

# ---------------------------------------------------------------------------
# 3. Reliable reminders
#
#  - POST_NOTIFICATIONS: without it Android 13+ never shows the "allow
#    notifications?" prompt, so every reminder is silently blocked.
#  - USE_EXACT_ALARM (Android 13+) / SCHEDULE_EXACT_ALARM (Android 12): without
#    one of them Android may deliver reminders minutes late. On Android 13+
#    USE_EXACT_ALARM is granted automatically at install.
#  - ic_stat_tally: the white Tally glyph shown in the status bar and on the
#    notification (Android requires a single-colour icon there; without one it
#    falls back to a generic "i" bubble).
# ---------------------------------------------------------------------------
MANIFEST=android/app/src/main/AndroidManifest.xml

add_permission() {
  local name="$1"
  local attrs="${2:-}"
  if ! grep -q "android:name=\"$name\"" "$MANIFEST"; then
    sed -i "s|<application|<uses-permission android:name=\"$name\"$attrs />\n    <application|" "$MANIFEST"
    echo "Added permission $name"
  fi
}

add_permission "android.permission.POST_NOTIFICATIONS"
add_permission "android.permission.USE_EXACT_ALARM"
add_permission "android.permission.SCHEDULE_EXACT_ALARM" " android:maxSdkVersion=\"32\""

mkdir -p "$RES/drawable"
cat > "$RES/drawable/ic_stat_tally.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M5.26,4.1 L7.68,4.1 L7.68,10.57 L5.26,11.61 Z M5.26,16.49 L7.68,15.45 L7.68,19.93 L5.26,19.93 Z M8.97,4.1 L11.33,4.1 L11.33,9.0 L8.97,10.01 Z M8.97,14.9 L11.33,13.88 L11.33,19.93 L8.97,19.93 Z M12.62,4.1 L15.0,4.1 L15.0,7.41 L12.62,8.44 Z M12.62,13.33 L15.0,12.3 L15.0,19.93 L12.62,19.93 Z M16.27,4.1 L18.65,4.1 L18.65,5.84 L16.27,6.87 Z M16.27,11.75 L18.65,10.73 L18.65,19.93 L16.27,19.93 Z M2.0,14.11 L2.0,16.8 L22.0,8.19 L22.0,5.5 Z" />
</vector>
XML

echo "Reminder permissions and notification icon configured"
