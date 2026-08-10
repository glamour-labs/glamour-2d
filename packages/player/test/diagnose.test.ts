import { expect, test } from 'vitest';
import { classifyInstall } from '../src/diagnose.js';

// The paths below are verbatim from real runs, not invented. Two separate
// releases printed the wrong playwright install command because this
// classification was wrong, and both escaped review because the failing case
// only appears when the CLI is run from a directory ABOVE its install root.

test('a global install is global even when the global root sits under $HOME', () => {
  // nvm puts the global node_modules under $HOME, so running from $HOME made
  // the old "does the module path start with cwd?" test answer 'project'.
  // This shipped in 0.1.1 and told a global user to run `pnpm add -D playwright`,
  // which installs into a tree their CLI cannot see.
  const self =
    '/Users/khavu/.nvm/versions/node/v24.10.0/lib/node_modules/@glamour-labs/cli'
    + '/node_modules/@glamour-labs/player/dist/node.js';

  expect(classifyInstall(self, '/Users/khavu')).toBe('global-install');
  expect(classifyInstall(self, '/Users/khavu/Project/some-app')).toBe('global-install');
  expect(classifyInstall(self, '/')).toBe('global-install');
});

test('a project dependency is project-local from the root and from any subdirectory', () => {
  const self = '/Users/khavu/Project/app/node_modules/@glamour-labs/player/dist/node.js';

  expect(classifyInstall(self, '/Users/khavu/Project/app')).toBe('project-dependency');
  expect(classifyInstall(self, '/Users/khavu/Project/app/src/deep')).toBe('project-dependency');
});

test('a project dependency is NOT claimed when cwd is merely a sibling or parent', () => {
  const self = '/Users/khavu/Project/app/node_modules/@glamour-labs/player/dist/node.js';

  // The install root does not cover these, so the CLI would resolve playwright
  // from somewhere the user's `pnpm add -D` cannot reach.
  expect(classifyInstall(self, '/Users/khavu/Project/other-app')).toBe('global-install');
  expect(classifyInstall(self, '/Users/khavu/Project')).toBe('global-install');
});

test('a source checkout has no node_modules on its path, whatever the cwd', () => {
  // Regression for 0.1.0: this was reported as "project-local install" whenever
  // the global wrapper invoked it from $HOME.
  const self = '/Users/khavu/Project/glamour-2d/packages/player/dist/node.js';

  expect(classifyInstall(self, '/Users/khavu')).toBe('source-checkout');
  expect(classifyInstall(self, '/Users/khavu/Project/glamour-2d')).toBe('source-checkout');
  expect(classifyInstall(self, '/tmp')).toBe('source-checkout');
});

test('the outermost node_modules decides, not the innermost', () => {
  // A global CLI nests its own deps, so the path contains node_modules twice.
  // Keying off the LAST one would make the install root
  // `.../global/node_modules/@glamour-labs/cli`, which covers no plausible cwd
  // and would accidentally give the right answer here but the wrong one for a
  // project dependency with nested deps.
  const nested =
    '/opt/app/node_modules/@glamour-labs/cli/node_modules/@glamour-labs/player/dist/node.js';

  expect(classifyInstall(nested, '/opt/app')).toBe('project-dependency');
  expect(classifyInstall(nested, '/opt/other')).toBe('global-install');
});
