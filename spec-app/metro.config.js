const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs', 'mjs'];

// Transform all packages that use modern syntax through Babel
// so Hermes can compile them (fixes dynamic import() from @opentelemetry)
config.transformer.transformIgnorePatterns = [
  'node_modules/(?!(@supabase|@opentelemetry|@react-native|@react-navigation|expo|react-native|@expo|@unimodules|unimodules)/)',
];

module.exports = config;
