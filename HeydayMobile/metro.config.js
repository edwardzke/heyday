const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.resolver.assetExts.push(
  // Adds support for `.db` files for SQLite databases
  'db',
  'mp3',
  'ttf',
  'otf',
  'png',
  'jpg'
);

module.exports = defaultConfig;