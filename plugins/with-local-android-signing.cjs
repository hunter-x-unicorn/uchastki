const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withLocalAndroidSigning(config) {
  if (process.env.UCHASTKI_LOCAL_SIGNING !== '1') return config;
  return withAppBuildGradle(config, (result) => {
    let gradle = result.modResults.contents;
    // CMake hashes long object paths before Ninja reaches Windows' path limit.
    if (!gradle.includes('CMAKE_OBJECT_PATH_MAX')) {
      if (!gradle.includes('defaultConfig {'))
        throw new Error('Expected Android defaultConfig block.');
      gradle = gradle.replace(
        'defaultConfig {',
        `defaultConfig {
        externalNativeBuild {
            cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=180" }
        }`,
      );
    }
    if (!gradle.includes('UCHASTKI_KEYSTORE_PATH')) {
      if (!gradle.includes('signingConfigs {'))
        throw new Error('Expected Android signingConfigs block.');
      gradle = gradle.replace(
        'signingConfigs {',
        `signingConfigs {
        uchastki {
            storeFile file(System.getenv("UCHASTKI_KEYSTORE_PATH"))
            storePassword System.getenv("UCHASTKI_KEYSTORE_PASSWORD")
            keyAlias System.getenv("UCHASTKI_KEY_ALIAS")
            keyPassword System.getenv("UCHASTKI_KEYSTORE_PASSWORD")
        }`,
      );
    }
    const release = /(release\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.(?:debug|uchastki)/;
    if (!release.test(gradle)) throw new Error('Expected Android release signing block.');
    gradle = gradle.replace(release, '$1signingConfigs.uchastki');
    // Development builds retain the standard debug identity.
    gradle = gradle.replace(
      /(buildTypes\s*\{\s*debug\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.uchastki/,
      '$1signingConfigs.debug',
    );
    result.modResults.contents = gradle;
    return result;
  });
};
