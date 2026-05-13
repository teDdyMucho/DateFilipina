const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver = config.resolver || {};
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-reanimated': path.resolve(__dirname, 'reanimated-mock.js'),
};

// Prefer compiled JS over TypeScript source for node_modules packages.
// Fixes react-native-agora which ships a broken "source": "src/index" pointer
// that Metro can't fully resolve (some src/*.ts files have missing siblings).
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = withNativeWind(config, { input: './global.css' });
