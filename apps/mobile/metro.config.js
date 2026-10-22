const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const mobileModules = path.join(projectRoot, 'node_modules');

const config = getDefaultConfig(projectRoot);

// Watch the linked workspace packages (@attendance/i18n, @attendance/shared).
config.watchFolders = [monorepoRoot];

// Prefer the app's dependencies, then the workspace root.
config.resolver.nodeModulesPaths = [
  mobileModules,
  path.join(monorepoRoot, 'node_modules'),
];

// The linked i18n package lives outside apps/mobile, so Metro would otherwise
// resolve React from the workspace root (React 18) while React Native uses the
// app's React 19. Force every `react` import to the app's single copy.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return {
      type: 'sourceFile',
      filePath: require.resolve(moduleName, { paths: [projectRoot] }),
    };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
