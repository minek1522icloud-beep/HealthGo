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
The \`HealthGo Native iOS (Xcode build)\` workflow on GitHub Actions compiles both an iOS Simulator app and a **physical iPhoneOS arm64** build with the local HealthKit Capacitor plugin. It packages the latter as \`HealthGo-iPhone-TEST-unsigned.ipa\` for **local, personal signing and testing**. This is an **unsigned IPA**, not a one-tap iPhone installer, TestFlight build or App Store release. Only the owner can provision/sign it using a permitted Apple development setup and install it on an actual iPhone. Follow \`docs/TEST_IPHONE_WINDOWS.md\`.

For public distribution, sign and distribute through a real TestFlight/App Store channel; add only a verified URL to \`www/healthgo-installer.js\`. A webpage cannot install native HealthKit apps directly.

## Health measurements
The Capacitor iOS shell now includes a **read-only HealthKit plugin** for Apple Health readings plus the Apple Health entitlement and user-facing permission string. The plugin compiles on iPhoneOS and the simulator, but **real-device permissions and any Apple Watch data remain unverified** until signing and a device test. Health Connect and CoreBluetooth integration in the new native shell are still future work; the older \`mobile/\` implementations are not wired into it. Do not display fictitious connected status or claim any model works without testing.

Installation entry: \`https://minek1522icloud-beep.github.io/HealthGo/install.html\`.
