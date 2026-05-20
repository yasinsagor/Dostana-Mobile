// Adds 16KB memory page alignment for Android 15 devices (Samsung S25, Pixel 9, etc.)
// Without this, apps crash immediately on devices that use 16KB pages.
const { withDangerousMod, withAppBuildGradle } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withCMake16KB(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const cmakePath = path.join(
        config.modRequest.projectRoot,
        'android/app/CMakeLists.txt'
      );
      if (fs.existsSync(cmakePath)) {
        let content = fs.readFileSync(cmakePath, 'utf8');
        if (!content.includes('max-page-size=16384')) {
          content += '\ntarget_link_options(${CMAKE_PROJECT_NAME} PRIVATE "-Wl,-z,max-page-size=16384")\n';
          fs.writeFileSync(cmakePath, content);
        }
      }
      return config;
    },
  ]);
}

function withGradle16KB(config) {
  return withAppBuildGradle(config, (config) => {
    const gradle = config.modResults.contents;
    if (!gradle.includes('ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES')) {
      config.modResults.contents = gradle.replace(
        /externalNativeBuild\s*\{([^}]*cmake\s*\{[^}]*)\}/,
        (match) => match
      );
      // Add cmake argument via defaultConfig if cmake block exists
      config.modResults.contents = config.modResults.contents.replace(
        /(cmake\s*\{[^}]*)(path[^\n]*\n)/,
        (match, pre, pathLine) =>
          `${pre}${pathLine}            arguments "-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON"\n`
      );
    }
    return config;
  });
}

module.exports = function with16KBPageSupport(config) {
  config = withCMake16KB(config);
  config = withGradle16KB(config);
  return config;
};
