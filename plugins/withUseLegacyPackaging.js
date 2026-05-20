// Forces native libraries to be extracted to disk before loading.
// On Android 15 devices with 16KB page sizes (Samsung S25 Ultra etc.),
// libraries loaded directly from APK must be 16KB-aligned within the zip.
// Extracting them first bypasses this requirement and fixes the crash.
const { withGradleProperties } = require('@expo/config-plugins');

module.exports = function withUseLegacyPackaging(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;
    const key = 'expo.useLegacyPackaging';
    const idx = props.findIndex((p) => p.type === 'property' && p.key === key);
    if (idx >= 0) {
      props[idx].value = 'true';
    } else {
      props.push({ type: 'property', key, value: 'true' });
    }
    return config;
  });
};
