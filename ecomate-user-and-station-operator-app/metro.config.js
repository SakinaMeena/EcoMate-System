const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// IMPORTANT: use the Expo wrapper transformer (keeps TS support)
config.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer/expo"
);

// Treat .svg as source code, not an asset
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== "svg");
config.resolver.sourceExts.push("svg");

module.exports = config;