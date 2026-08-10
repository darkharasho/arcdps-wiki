// scripts/build-history.mjs
// Appends (or, for a re-run of the same md5, replaces) the build-history
// entry for the refresh that just ran, then regenerates the machine-owned
// build-history page. Baseline snapshots come from git HEAD, so this must
// run BEFORE the refresh is committed, and ordering against the snapshot
// scripts' file writes does not matter.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { diffSnapshots } from './lib/build-history-diff.mjs';
import { renderBuildHistoryPage } from './lib/render-build-history.mjs';

const read = (url) => JSON.parse(readFileSync(url, 'utf8'));
const gitShow = (repoPath) => {
  try {
    return JSON.parse(execFileSync('git', ['show', `HEAD:${repoPath}`], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    }));
  } catch {
    return null; // bootstrap: not in HEAD yet
  }
};

const build = read(new URL('../data/arcdps-build.json', import.meta.url));
const newExports = read(new URL('../data/arcdps-exports.json', import.meta.url));
const newUi = read(new URL('../data/arcdps-ui-strings.json', import.meta.url));
const oldExports = gitShow('data/arcdps-exports.json') ?? { exports: [] };
const oldUi = gitShow('data/arcdps-ui-strings.json')
  ?? { configKeys: [], elementIds: [], uiText: [] };

const historyUrl = new URL('../data/build-history.json', import.meta.url);
const history = existsSync(fileURLToPath(historyUrl)) ? read(historyUrl) : [];

const entry = {
  dllVersion: build.dllVersion,
  md5: build.md5,
  observedAt: build.updatedAt, // committed data, not the clock (determinism rule)
  ...diffSnapshots({ oldExports, newExports, oldUi, newUi }),
};

const rest = history[0]?.md5 === entry.md5 ? history.slice(1) : history;
const next = [entry, ...rest];

writeFileSync(fileURLToPath(historyUrl), JSON.stringify(next, null, 2) + '\n');
writeFileSync(
  fileURLToPath(new URL('../src/content/docs/reference/build-history.md', import.meta.url)),
  renderBuildHistoryPage(next),
);
console.log(`build-history: ${next.length} entr${next.length === 1 ? 'y' : 'ies'} (head: ${entry.dllVersion || entry.md5})`);
