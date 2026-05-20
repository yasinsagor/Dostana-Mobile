// Disables edge-to-edge mode which crashes on Samsung One UI 7 (S25 Ultra etc.)
// Expo SDK 54 enables it by default for apps targeting Android 15, but
// Samsung's implementation of WindowInsetsController has a bug that causes
// the app to crash before any JavaScript runs.
const { withGradleProperties } = require('@expo/config-plugins');

module.exports = function withDisableEdgeToEdge(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;

    const setOrAdd = (key, value) => {
      const idx = props.findIndex((p) => p.type === 'property' && p.key === key);
      if (idx >= 0) {
        props[idx].value = value;
      } else {
        props.push({ type: 'property', key, value });
      }
    };

    setOrAdd('edgeToEdgeEnabled', 'false');
    setOrAdd('expo.edgeToEdgeEnabled', 'false');
    setOrAdd('react.edgeToEdgeEnabled', 'false');

    return config;
  });
};
