const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Force transform supabase and related packages through Babel
// so Hermes can compile them without "invalid expression" errors
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs', 'mjs'];

// Ensure node_modules that use modern syntax get transpiled
const defaultBlockList = config.resolver.blockList || [];
config.transformer.transformIgnorePatterns = [
  'node_modules/(?!(@supabase|@react-native|@react-navigation|expo|react-native|react-clone-referenced-element|@expo|pretty-format)/)',
];

module.exports = config;
