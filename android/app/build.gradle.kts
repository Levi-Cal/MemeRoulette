plugins {
    id("com.android.application")
}

android {
    namespace = "com.levi.memeroulette"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.levi.memeroulette"
        minSdk = 29
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    // The meme viewer itself lives in ../../web and is shared with the Windows app
    sourceSets["main"].assets.srcDirs("../../web")

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
