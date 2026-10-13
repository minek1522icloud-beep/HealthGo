# HealthGo Native Shell

This directory contains the new **Capacitor 8** wrapper, separated from the previously existing \`mobile/android\` and \`mobile/ios\` source code. Do not replace or discard the older health bridges.

## Android (CI)
The \`HealthGo Native Android\` GitHub Actions workflow:
1. Builds the same public web resources, including the AI bundle.
2. Copies \`www/\` into \`native-shell/web/\`.
3. Runs \`npm install\` (Node 22+), \`npx cap add android\`, \`npx cap sync android\` and \`./gradlew assembleDebug\`.
4. Stores a **test APK** as a private-to-Actions artifact. It is not yet a public APK install link.

Only a **manually approved signed release** containing asset \`HealthGo-Android.apk\` appears on \`www/install.html\`. To publish, provision four repository Actions secrets: \`ANDROID_KEYSTORE_BASE64\`, \`ANDROID_KEYSTORE_PASSWORD\`, \`ANDROID_KEY_ALIAS\`, \`ANDROID_KEY_PASSWORD\`. Preserve the private signing key securely for future Android updates. Do not publish it, paste it into chats or commit it.

## iPhone
Prepare the project on a Mac using Xcode and valid Apple signing, then distribute through a valid TestFlight invitation/App Store link. Set that genuine URL in \`www/healthgo-installer.js\` once available. A webpage cannot itself side-load a native HealthKit app.

## Health measurements
The Capacitor app wraps the existing HealthGo interface; **it does not automatically add HealthKit, Health Connect or CoreBluetooth permissions**. These native integrations, entitlement review, per-user consent, background handling, and real-device testing remain separate work. Existing \`mobile/\` native health code is not wired into the new shell automatically. Do not display fictitious connected status or claim any model works without testing.

Installation entry: \`https://minek1522icloud-beep.github.io/HealthGo/install.html\`.
