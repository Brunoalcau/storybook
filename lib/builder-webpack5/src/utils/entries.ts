import path from 'path';

import { handlebars, interpolate, normalizeStories, readTemplate } from '@storybook/core-common';
import { toRequireContextString, toImportFn } from '@storybook/core-webpack';
import { BuilderOptions } from '../types';

export const getStorybookPaths = (): Record<string, string> => ({
  global: path.dirname(require.resolve(`global/package.json`)),
  ...[
    'addons',
    'api',
    'store',
    'channels',
    'channel-postmessage',
    'channel-websocket',
    'components',
    'core-events',
    'router',
    'theming',
    'semver',
    'preview-web',
    'client-api',
    'client-logger',
  ].reduce(
    (acc, sbPackage) => ({
      ...acc,
      [`@storybook/${sbPackage}`]: path.dirname(
        require.resolve(`@storybook/${sbPackage}/package.json`)
      ),
    }),
    {}
  ),
});

export async function getModernVirtualEntries({
  configDir,
  builderOptions,
  isProd,
  stories,
  configs,
  entries: originalEntries,
}: {
  configDir: string;
  builderOptions: BuilderOptions;
  isProd: boolean;
  stories: ReturnType<typeof normalizeStories>;
  configs: (string | undefined)[];
  entries: string[];
}) {
  const entries = [...originalEntries];
  const mapping: Record<string, string> = {};
  const r = (p: string) => path.resolve(path.join(configDir, p));

  const storiesFileName = 'storybook-stories.js';
  const storiesPath = r(storiesFileName);

  const configEntryFilename = 'storybook-config-entry.js';
  const configEntryPath = r(configEntryFilename);
  const data = {
    storiesFilename: storiesFileName,
    configs,
  };
  const template = await readTemplate(
    require.resolve('@storybook/builder-webpack5/templates/virtualModuleModernEntry.js.handlebars')
  );

  const needPipelinedImport = !!builderOptions.lazyCompilation && !isProd;
  mapping[storiesPath] = toImportFn(stories, { needPipelinedImport });
  // We need to double escape `\` for webpack. We may have some in windows paths
  mapping[configEntryPath] = handlebars(template, data).replace(/\\/g, '\\\\');

  entries.push(configEntryPath);

  return { mapping, entries };
}

export async function getLegacyVirtualEntries({
  configDir,
  stories,
  configs,
  entries: originalEntries,
  frameworkName,
}: {
  configDir: string;
  stories: ReturnType<typeof normalizeStories>;
  configs: (string | undefined)[];
  entries: string[];
  frameworkName: string;
}) {
  const entries = [...originalEntries];
  const mapping: Record<string, string> = {};
  const r = (p: string) => path.resolve(path.join(configDir, p));
  const storybookPaths = getStorybookPaths();

  const frameworkInitEntry = r('storybook-init-framework-entry.mjs');
  mapping[frameworkInitEntry] = `import '${frameworkName}';`;
  entries.push(frameworkInitEntry);

  const template = await readTemplate(
    require.resolve('@storybook/builder-webpack5/templates/virtualModuleEntry.template.mjs')
  );

  configs.forEach((configFilename: any) => {
    const clientApi = storybookPaths['@storybook/client-api'];
    const clientLogger = storybookPaths['@storybook/client-logger'];

    const data = {
      configFilename,
      clientApi,
      clientLogger,
    };
    const fileName = `${configFilename}-generated-config-entry.js`;
    // NOTE: although this file is also from the `dist/cjs` directory, it is actually a ESM
    // file, see https://github.com/storybookjs/storybook/pull/16727#issuecomment-986485173
    mapping[fileName] = interpolate(template, data);
    entries.push(fileName);
  });

  if (stories.length > 0) {
    const storyTemplate = await readTemplate(
      require.resolve('@storybook/builder-webpack5/templates/virtualModuleStory.template.js')
    );
    // NOTE: this file has a `.cjs` extension as it is a CJS file (from `dist/cjs`) and runs
    // in the user's webpack mode, which may be strict about the use of require/import.
    // See https://github.com/storybookjs/storybook/issues/14877
    const fileName = r(`generated-stories-entry.cjs`);
    const data = {
      frameworkName,
    };
    mapping[fileName] = interpolate(storyTemplate, data).replace(
      // Make sure we also replace quotes for this one
      "'{{stories}}'",
      stories.map(toRequireContextString).join(',')
    );
    entries.push(fileName);
  }

  return { mapping, entries };
}
