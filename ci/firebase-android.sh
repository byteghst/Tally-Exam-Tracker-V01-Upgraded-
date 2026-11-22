#!/usr/bin/env bash
# Firebase Cloud Messaging for the generated android/ project (daily quote notification).
# Called from ci/harden-android.sh, after `cap add android` and before the Gradle build.
#
# The Capacitor Android template already contains the google-services Gradle plugin and applies
# it whenever android/app/google-services.json exists, so placing the file is the whole wiring.
# ci/google-services.json is the client config of the Firebase project (project id, app id and a
# public client key). It is not the service-account key, which only lives in Supabase.
set -euo pipefail

SRC=ci/google-services.json
DEST=android/app/google-services.json
MANIFEST=android/app/src/main/AndroidManifest.xml
APP_GRADLE=android/app/build.gradle

[ -s "$SRC" ] || { echo "ci/google-services.json is missing"; exit 1; }
cp "$SRC" "$DEST"

grep -q "com.google.gms:google-services" android/build.gradle \
  || { echo "google-services classpath missing from android/build.gradle"; exit 1; }
grep -q "com.google.gms.google-services" "$APP_GRADLE" \
  || { echo "google-services plugin is not applied in android/app/build.gradle"; exit 1; }

# Fallback look for notifications Firebase shows by itself (the server message names these too).
if ! grep -q "default_notification_channel_id" "$MANIFEST"; then
  python3 - "$MANIFEST" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
meta = (
    '        <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="tally-quote" />\n'
    '        <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_tally" />\n'
)
if "</application>" not in text:
    raise SystemExit("no </application> in manifest")
open(path, "w", encoding="utf-8").write(text.replace("</application>", meta + "    </application>", 1))
PY
fi

grep -q "default_notification_channel_id" "$MANIFEST" || { echo "Firebase manifest patch failed"; exit 1; }
echo "Firebase configured: google-services.json in place, default notification channel and icon set"
