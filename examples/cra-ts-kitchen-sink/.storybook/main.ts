import type { Configuration } from 'webpack';

const path = require('path');

module.exports = {
  stories: ['../src/components', '../src/stories'],
  logLevel: 'debug',
  addons: [
    '@storybook/preset-create-react-app',
    '@storybook/addon-ie11',
    '@storybook/addon-docs',
    '@storybook/addon-actions',
    '@storybook/addon-links',
    '@storybook/addon-a11y',
    './localAddon/manager.tsx',
    './localAddon/preset.ts',
  ],
  webpackFinal: (config: Configuration) => {
    // add monorepo root as a valid directory to import modules from
    config.resolve.plugins.forEach((p) => {
      // @ts-ignore
      if (Array.isArray(p.appSrcs)) {
        // @ts-ignore
        p.appSrcs.push(path.join(__dirname, '..', '..', '..'));
      }
    });
    return config;
  },
  core: {
    builder: 'webpack4',
    channelOptions: { allowFunction: false, maxDepth: 10 },
    disableTelemetry: true,
  },
  staticDirs: ['../public'],
  features: {
    buildStoriesJson: true,
  },
};
