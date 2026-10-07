plugins {
    id("com.android.application")
}
android {
    namespace = "com.healthgo.mobile"
    compileSdk = 36
    defaultConfig { applicationId = "com.healthgo.mobile"; minSdk = 28; targetSdk = 36; versionCode = 1; versionName = "0.1.0" }
}
dependencies {
    implementation("androidx.activity:activity-ktx:1.12.4")
    implementation("androidx.fragment:fragment-ktx:1.9.1")
    implementation("androidx.health.connect:connect-client:1.1.0")
}
