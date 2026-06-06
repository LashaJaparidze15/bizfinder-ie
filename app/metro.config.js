// Expo Metro config tuned for an npm-workspaces monorepo so it can resolve
// the @bizfinder/shared package and the hoisted root node_modules.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// App is isolated (not a workspace), but @bizfinder/shared lives outside app/.
// Watch it so Metro transpiles its TS, and alias the import to its real path.
config.watchFolders = [path.resolve(workspaceRoot, "packages/shared")];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
config.resolver.extraNodeModules = {
  "@bizfinder/shared": path.resolve(workspaceRoot, "packages/shared"),
};

module.exports = config;
