# Auto-Update Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A daily GitHub Actions job that detects new arcdps builds via the published md5sum, refreshes the DLL-derived data snapshots plus a generated build-history page, and lands the result via an auto-merging PR (spec: `docs/superpowers/specs/2026-08-10-auto-update-pipeline-design.md`).

**Architecture:** Pure logic lives in `scripts/lib/*.mjs` with vitest coverage; thin entry scripts (`check-build.mjs`, `build-history.mjs`, `auto-update.mjs`) wire them to fetch/fs/git; a workflow calls the same npm scripts a human can run locally. Change detection polls the ~50-byte `d3d11.dll.md5sum`; the full DLL downloads only on change.

**Tech Stack:** Node 24 (global `fetch`, `node:crypto`), binutils (`objdump`, `strings` — present on ubuntu runners and this machine), vitest 2, Astro/Starlight, GitHub CLI (`gh`) in the workflow.

## Global Constraints

- Test command is always `npm test` (already pinned to `vitest run --pool=forks --poolOptions.forks.maxForks=2`); never raise worker counts.
- Scripts are ESM `.mjs` (repo is `"type": "module"`); tests are TypeScript in `tests/*.test.ts`.
- Generated files are machine-owned: `data/arcdps-build.json`, `data/build-history.json`, `src/content/docs/reference/build-history.md`. No hand-written page is modified by any script.
- Endpoints: `https://www.deltaconnected.com/arcdps/x64/d3d11.dll.md5sum` (poll), `https://www.deltaconnected.com/arcdps/x64/d3d11.dll` (download on change only; HEAD requests hang — never HEAD it).
- Determinism rule (matches `build-api.mjs` precedent): rendered output derives dates from committed data, not the clock. Only `check-build.mjs` may read the clock (for `updatedAt`, on change only).
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` when Claude authors them.

---

### Task 1: check-build core helpers

**Files:**
- Create: `scripts/lib/check-build-core.mjs`
- Test: `tests/check-build-core.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions).
- Produces: `parseMd5Sum(text: string): string` (lowercase 32-hex md5; throws on garbage) and `extractDllVersion(lines: string[]): string` (VS_VERSION-style `1.2026.718.905` or `''`), used by Task 2.

- [ ] **Step 1: Write the failing test**

```ts
// tests/check-build-core.test.ts
import { describe, it, expect } from 'vitest';
import { parseMd5Sum, extractDllVersion } from '../scripts/lib/check-build-core.mjs';

describe('parseMd5Sum', () => {
  it('parses the deltaconnected md5sum format', () => {
    expect(parseMd5Sum('753f00b01829bb9088c00dcc32d19077  d3d11.dll\n'))
      .toBe('753f00b01829bb9088c00dcc32d19077');
  });
  it('throws on HTML/garbage (e.g. a Cloudflare challenge page)', () => {
    expect(() => parseMd5Sum('<!DOCTYPE html><html>...')).toThrow(/unparseable/i);
  });
  it('throws on empty input', () => {
    expect(() => parseMd5Sum('')).toThrow(/unparseable/i);
  });
});

describe('extractDllVersion', () => {
  it('finds the VS_VERSION-style string among noise', () => {
    expect(extractDllVersion(['junk', ' 1.2026.718.905 ', 'more'])).toBe('1.2026.718.905');
  });
  it('returns empty string when absent', () => {
    expect(extractDllVersion(['no', 'version', 'here'])).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/check-build-core.test.ts --pool=forks --poolOptions.forks.maxForks=2`
Expected: FAIL — cannot resolve `../scripts/lib/check-build-core.mjs`.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/lib/check-build-core.mjs
// Pure helpers for the auto-update change detector. Kept fetch/fs-free so
// they are unit-testable without network.

export const parseMd5Sum = (text) => {
  const m = text.trim().match(/^([0-9a-f]{32})\s+\S+/);
  if (!m) throw new Error(`unparseable md5sum content: ${JSON.stringify(text.slice(0, 80))}`);
  return m[1];
};

// Same VS_VERSION_INFO pattern snapshot-ui-strings.mjs already relies on.
export const extractDllVersion = (lines) => {
  const hit = lines.find((l) => /^\d+\.\d{4}\.\d{2,4}\.\d{2,4}$/.test(l.trim()));
  return hit ? hit.trim() : '';
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/check-build-core.test.ts --pool=forks --poolOptions.forks.maxForks=2`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/check-build-core.mjs tests/check-build-core.test.ts
git commit -m "feat(auto-update): md5sum and version parsing helpers"
```

---

### Task 2: check-build entry script

**Files:**
- Create: `scripts/check-build.mjs`
- Modify: `package.json` (add script `"check-build": "node scripts/check-build.mjs"`)

**Interfaces:**
- Consumes: `parseMd5Sum`, `extractDllVersion` from `scripts/lib/check-build-core.mjs` (Task 1).
- Produces: `data/arcdps-build.json` = `{ "md5": string, "dllVersion": string, "updatedAt": "YYYY-MM-DD" }`; stdout/`$GITHUB_OUTPUT` keys `changed` (`true`/`false`), and when changed `dll_path` (absolute temp path) and `dll_version`. Task 6's orchestrator and Task 7's workflow read exactly these keys. `--dry-run` skips writing `arcdps-build.json`.

- [ ] **Step 1: Write the script**

```js
// scripts/check-build.mjs
// Change detector for the auto-update pipeline. Polls the ~50-byte md5sum
// file; downloads the DLL only when the md5 differs from the committed
// data/arcdps-build.json (missing file = bootstrap = treated as changed).
// Never HEAD the DLL URL — the server hangs on HEAD requests.
//
// Outputs (stdout always; $GITHUB_OUTPUT when set):
//   changed=true|false
//   dll_path=<tmp path>      (only when changed)
//   dll_version=<VS version> (only when changed)

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMd5Sum, extractDllVersion } from './lib/check-build-core.mjs';

const MD5_URL = 'https://www.deltaconnected.com/arcdps/x64/d3d11.dll.md5sum';
const DLL_URL = 'https://www.deltaconnected.com/arcdps/x64/d3d11.dll';
const BUILD_FILE = fileURLToPath(new URL('../data/arcdps-build.json', import.meta.url));
const dryRun = process.argv.includes('--dry-run');

const setOutput = (key, value) => {
  console.log(`${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
};

const md5Res = await fetch(MD5_URL);
if (!md5Res.ok) throw new Error(`md5sum fetch failed: HTTP ${md5Res.status}`);
const advertised = parseMd5Sum(await md5Res.text());

const known = existsSync(BUILD_FILE)
  ? JSON.parse(readFileSync(BUILD_FILE, 'utf8')).md5
  : null;

if (advertised === known) {
  console.log(`up to date (${advertised})`);
  setOutput('changed', 'false');
  process.exit(0);
}

const dllRes = await fetch(DLL_URL);
if (!dllRes.ok) throw new Error(`DLL fetch failed: HTTP ${dllRes.status}`);
const buf = Buffer.from(await dllRes.arrayBuffer());
const actual = createHash('md5').update(buf).digest('hex');
if (actual !== advertised) {
  throw new Error(`md5 mismatch: advertised ${advertised}, downloaded ${actual} — torn download or stale md5sum, aborting`);
}

const dllPath = join(tmpdir(), 'arcdps-d3d11.dll');
writeFileSync(dllPath, buf);

const wide = execFileSync('strings', ['-a', '-el', '-n', '3', dllPath], {
  encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
}).split('\n');
const dllVersion = extractDllVersion(wide);

if (!dryRun) {
  const record = { md5: advertised, dllVersion, updatedAt: new Date().toISOString().slice(0, 10) };
  writeFileSync(BUILD_FILE, JSON.stringify(record, null, 2) + '\n');
}

console.log(`new build ${dllVersion || '(no version string)'} md5 ${advertised}${dryRun ? ' [dry-run: not recorded]' : ''}`);
setOutput('changed', 'true');
setOutput('dll_path', dllPath);
setOutput('dll_version', dllVersion);
```

- [ ] **Step 2: Add the npm script**

In `package.json` `"scripts"`, after `"snapshot-ui-strings"`, add:

```json
"check-build": "node scripts/check-build.mjs",
```

- [ ] **Step 3: Verify with a real dry run**

Run: `npm run check-build -- --dry-run`
Expected: since `data/arcdps-build.json` does not exist yet, the bootstrap path runs — DLL downloads, output shows `changed=true`, a plausible `dll_version=1.2026.…`, and a `dll_path` under `/tmp`. Confirm `data/arcdps-build.json` was NOT created (`test ! -f data/arcdps-build.json && echo ok`).

- [ ] **Step 4: Verify the up-to-date path**

Run: `npm run check-build` (no dry-run; writes the file), then `npm run check-build` again.
Expected: first run prints `changed=true` and creates `data/arcdps-build.json`; second run prints `up to date (<md5>)` and `changed=false`. Then `git checkout -- data/ 2>/dev/null; rm -f data/arcdps-build.json` to leave the tree clean (Task 6 seeds it for real).

- [ ] **Step 5: Run the full test suite and commit**

Run: `npm test`
Expected: PASS (no regressions).

```bash
git add scripts/check-build.mjs package.json
git commit -m "feat(auto-update): change detector polling the published md5sum"
```

---

### Task 3: build-history diff logic

**Files:**
- Create: `scripts/lib/build-history-diff.mjs`
- Test: `tests/build-history-diff.test.ts`
- Modify: `docs/superpowers/specs/2026-08-10-auto-update-pipeline-design.md` (§4.3: drop `uiStringsChanged[]` — strings are set members, present or absent; a "change" is an add+remove pair, so the field is meaningless)

**Interfaces:**
- Consumes: snapshot shapes as committed today — `arcdps-exports.json` has `exports: string[]`; `arcdps-ui-strings.json` has `configKeys: string[]`, `elementIds: string[]`, `uiText: string[]`.
- Produces: `diffSnapshots({ oldExports, newExports, oldUi, newUi }): { exportsAdded: string[], exportsRemoved: string[], uiStringsAdded: string[], uiStringsRemoved: string[] }` — consumed by Task 5.

- [ ] **Step 1: Write the failing test**

```ts
// tests/build-history-diff.test.ts
import { describe, it, expect } from 'vitest';
import { diffSnapshots } from '../scripts/lib/build-history-diff.mjs';

const ui = (over: Partial<Record<'configKeys' | 'elementIds' | 'uiText', string[]>> = {}) => ({
  configKeys: [], elementIds: [], uiText: [], ...over,
});

describe('diffSnapshots', () => {
  it('reports added and removed exports', () => {
    const d = diffSnapshots({
      oldExports: { exports: ['A', 'B'] },
      newExports: { exports: ['B', 'C'] },
      oldUi: ui(), newUi: ui(),
    });
    expect(d.exportsAdded).toEqual(['C']);
    expect(d.exportsRemoved).toEqual(['A']);
  });

  it('flattens the three UI pools into one string diff', () => {
    const d = diffSnapshots({
      oldExports: { exports: [] }, newExports: { exports: [] },
      oldUi: ui({ configKeys: ['boon_table'], uiText: ['old tooltip'] }),
      newUi: ui({ configKeys: ['boon_table'], elementIds: ['##newpanel'], uiText: [] }),
    });
    expect(d.uiStringsAdded).toEqual(['##newpanel']);
    expect(d.uiStringsRemoved).toEqual(['old tooltip']);
  });

  it('returns four empty arrays for identical snapshots', () => {
    const d = diffSnapshots({
      oldExports: { exports: ['A'] }, newExports: { exports: ['A'] },
      oldUi: ui({ uiText: ['x'] }), newUi: ui({ uiText: ['x'] }),
    });
    expect(d).toEqual({ exportsAdded: [], exportsRemoved: [], uiStringsAdded: [], uiStringsRemoved: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/build-history-diff.test.ts --pool=forks --poolOptions.forks.maxForks=2`
Expected: FAIL — cannot resolve `../scripts/lib/build-history-diff.mjs`.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/lib/build-history-diff.mjs
// Pure diff between two snapshot generations. UI pools are flattened into a
// single string set: history readers care that a string appeared or vanished,
// not which pool it was classified into.

const diffLists = (before, after) => {
  const b = new Set(before);
  const a = new Set(after);
  return {
    added: after.filter((x) => !b.has(x)),
    removed: before.filter((x) => !a.has(x)),
  };
};

export function diffSnapshots({ oldExports, newExports, oldUi, newUi }) {
  const flat = (ui) => [...ui.configKeys, ...ui.elementIds, ...ui.uiText];
  const exp = diffLists(oldExports.exports, newExports.exports);
  const ui = diffLists(flat(oldUi), flat(newUi));
  return {
    exportsAdded: exp.added,
    exportsRemoved: exp.removed,
    uiStringsAdded: ui.added,
    uiStringsRemoved: ui.removed,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/build-history-diff.test.ts --pool=forks --poolOptions.forks.maxForks=2`
Expected: PASS (3 tests).

- [ ] **Step 5: Amend the spec and commit**

In the spec §4.3, change `exportsAdded[], exportsRemoved[], uiStringsAdded[], uiStringsRemoved[], uiStringsChanged[]` to drop `uiStringsChanged[]` (strings are set members; a change is an add+remove pair).

```bash
git add scripts/lib/build-history-diff.mjs tests/build-history-diff.test.ts docs/superpowers/specs/2026-08-10-auto-update-pipeline-design.md
git commit -m "feat(auto-update): snapshot diff logic for build history"
```

---

### Task 4: build-history page renderer

**Files:**
- Create: `scripts/lib/render-build-history.mjs`
- Test: `tests/render-build-history.test.ts`

**Interfaces:**
- Consumes: history entries shaped `{ dllVersion: string, md5: string, observedAt: "YYYY-MM-DD", exportsAdded: string[], exportsRemoved: string[], uiStringsAdded: string[], uiStringsRemoved: string[] }` (Task 3's diff fields plus identity fields).
- Produces: `renderBuildHistoryPage(history: entry[]): string` — full Markdown document with Starlight frontmatter (`source: generated`), consumed by Task 5.

- [ ] **Step 1: Write the failing test**

```ts
// tests/render-build-history.test.ts
import { describe, it, expect } from 'vitest';
import { renderBuildHistoryPage } from '../scripts/lib/render-build-history.mjs';

const entry = (over = {}) => ({
  dllVersion: '1.2026.718.905',
  md5: '753f00b01829bb9088c00dcc32d19077',
  observedAt: '2026-08-10',
  exportsAdded: [], exportsRemoved: [], uiStringsAdded: [], uiStringsRemoved: [],
  ...over,
});

describe('renderBuildHistoryPage', () => {
  it('emits frontmatter with source: generated and the overwrite warning', () => {
    const page = renderBuildHistoryPage([entry()]);
    expect(page.startsWith('---\n')).toBe(true);
    expect(page).toContain('source: generated');
    expect(page).toContain('machine-written');
  });

  it('renders one section per build, version and date in the heading', () => {
    const page = renderBuildHistoryPage([
      entry({ dllVersion: '1.2026.800.1', observedAt: '2026-09-01' }),
      entry(),
    ]);
    expect(page).toContain('## 1.2026.800.1 (2026-09-01)');
    expect(page).toContain('## 1.2026.718.905 (2026-08-10)');
    expect(page.indexOf('1.2026.800.1')).toBeLessThan(page.indexOf('1.2026.718.905'));
  });

  it('lists diff items and marks no-change builds', () => {
    const page = renderBuildHistoryPage([
      entry({ exportsAdded: ['e10'], uiStringsRemoved: ['old label'] }),
      entry(),
    ]);
    expect(page).toContain('`e10`');
    expect(page).toContain('`old label`');
    expect(page).toContain('binary-only update');
  });

  it('falls back to an md5 prefix heading when the version string is missing', () => {
    const page = renderBuildHistoryPage([entry({ dllVersion: '' })]);
    expect(page).toContain('## 753f00b01829 (2026-08-10)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render-build-history.test.ts --pool=forks --poolOptions.forks.maxForks=2`
Expected: FAIL — cannot resolve `../scripts/lib/render-build-history.mjs`.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/lib/render-build-history.mjs
// Renders the whole build-history page from data/build-history.json. The
// page is machine-owned: full regeneration every run, no prose fencing.

export function renderBuildHistoryPage(history) {
  const lines = [
    '---',
    'title: Build history',
    'description: Auto-generated record of what changed in each arcdps build, as observed by the update pipeline.',
    'source: generated',
    '---',
    '',
    ':::note',
    'This page is machine-written by the auto-update pipeline. Manual edits will be overwritten on the next build refresh.',
    ':::',
    '',
  ];

  for (const e of history) {
    lines.push(`## ${e.dllVersion || e.md5.slice(0, 12)} (${e.observedAt})`, '');
    lines.push(`- md5: \`${e.md5}\``);
    const section = (label, items) => {
      if (!items.length) return;
      lines.push(`- ${label}:`);
      for (const item of items) lines.push(`  - \`${item}\``);
    };
    section('Exports added', e.exportsAdded);
    section('Exports removed', e.exportsRemoved);
    section('UI strings added', e.uiStringsAdded);
    section('UI strings removed', e.uiStringsRemoved);
    const changes = e.exportsAdded.length + e.exportsRemoved.length
      + e.uiStringsAdded.length + e.uiStringsRemoved.length;
    if (changes === 0) lines.push('- No export or UI-string changes (binary-only update).');
    lines.push('');
  }

  return lines.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render-build-history.test.ts --pool=forks --poolOptions.forks.maxForks=2`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/render-build-history.mjs tests/render-build-history.test.ts
git commit -m "feat(auto-update): build-history page renderer"
```

---

### Task 5: build-history entry script + content schema

**Files:**
- Create: `scripts/build-history.mjs`
- Modify: `src/content.config.ts` (add `'generated'` to the `source` enum)
- Modify: `package.json` (add script `"build-history": "node scripts/build-history.mjs"`)

**Interfaces:**
- Consumes: `diffSnapshots` (Task 3), `renderBuildHistoryPage` (Task 4), `data/arcdps-build.json` (Task 2's shape), the two snapshot JSONs, and `git show HEAD:<path>` for the pre-refresh baseline.
- Produces: `data/build-history.json` (newest-first entry array, Task 4's shape) and `src/content/docs/reference/build-history.md`. Idempotent per md5: re-running for the same build replaces the head entry instead of stacking duplicates.

- [ ] **Step 1: Extend the content schema**

In `src/content.config.ts` change:

```ts
source: z.enum(['dll-exports', 'official-docs', 'community']).optional(),
```

to:

```ts
source: z.enum(['dll-exports', 'official-docs', 'community', 'generated']).optional(),
```

- [ ] **Step 2: Write the script**

```js
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
```

- [ ] **Step 3: Add the npm script**

In `package.json` `"scripts"`, after `"check-build"`, add:

```json
"build-history": "node scripts/build-history.mjs",
```

- [ ] **Step 4: Verify against a synthetic build file**

`data/arcdps-build.json` does not exist yet (Task 6 seeds it). Create a throwaway one, run, inspect, then clean up:

```bash
printf '{\n  "md5": "753f00b01829bb9088c00dcc32d19077",\n  "dllVersion": "1.2026.718.905",\n  "updatedAt": "2026-08-10"\n}\n' > data/arcdps-build.json
npm run build-history
```

Expected: prints `build-history: 1 entry (head: 1.2026.718.905)`; since the snapshots on disk equal HEAD, the entry has four empty arrays; `src/content/docs/reference/build-history.md` exists with the "binary-only update" line. Run again → still 1 entry (same-md5 replacement proves idempotence). Then verify the site accepts the page: `npm run build` → completes with 41 pages, no schema error. Clean up: `rm data/arcdps-build.json data/build-history.json src/content/docs/reference/build-history.md`.

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test`
Expected: PASS.

```bash
git add scripts/build-history.mjs src/content.config.ts package.json
git commit -m "feat(auto-update): build-history generator and generated page schema"
```

---

### Task 6: orchestrator + real bootstrap

**Files:**
- Create: `scripts/auto-update.mjs`
- Modify: `package.json` (add script `"update": "node scripts/auto-update.mjs"`)
- Create (by running, not by hand): `data/arcdps-build.json`, `data/build-history.json`, `src/content/docs/reference/build-history.md`, refreshed `data/arcdps-exports.json` + `data/arcdps-ui-strings.json`

**Interfaces:**
- Consumes: Task 2's stdout contract (`changed=`, `dll_path=` lines) and the existing `snapshot-exports` / `snapshot-ui-strings` scripts' `ARCDPS_DLL` env var.
- Produces: `npm run update` — the single local/venus entry point performing check → refresh → history, exactly what the workflow does in CI.

- [ ] **Step 1: Write the orchestrator**

```js
// scripts/auto-update.mjs
// Local/venus entry point mirroring the auto-update workflow: detect a new
// build, refresh both snapshots from the downloaded DLL, record history.
// Leaves changes uncommitted for a human (or the workflow) to commit.

import { execFileSync } from 'node:child_process';

const run = (args, env = {}) =>
  execFileSync('node', args, { stdio: 'inherit', env: { ...process.env, ...env } });

const checkOut = execFileSync('node', ['scripts/check-build.mjs'], { encoding: 'utf8' });
process.stdout.write(checkOut);

if (!/^changed=true$/m.test(checkOut)) process.exit(0);

const dllPath = checkOut.match(/^dll_path=(.+)$/m)?.[1];
if (!dllPath) throw new Error('check-build reported a change but no dll_path');

run(['scripts/snapshot-exports.mjs'], { ARCDPS_DLL: dllPath });
run(['scripts/snapshot-ui-strings.mjs'], { ARCDPS_DLL: dllPath });
run(['scripts/build-history.mjs']);
console.log('auto-update: snapshots and history refreshed; review `git status` and commit.');
```

- [ ] **Step 2: Add the npm script**

In `package.json` `"scripts"`, after `"build-history"`, add:

```json
"update": "node scripts/auto-update.mjs",
```

- [ ] **Step 3: Bootstrap for real**

Run: `npm run update`
Expected: bootstrap path — downloads the live DLL, seeds `data/arcdps-build.json`, refreshes both snapshots, writes a 1-entry history and the page. Inspect `git diff --stat data/`: if the live DLL matches the local Steam one, snapshots are unchanged and the history entry is "binary-only" relative to HEAD; either way is fine — whatever the diff is, it is now truth from the live DLL.

- [ ] **Step 4: Verify the whole repo still stands**

Run: `npm test && npm run build`
Expected: all tests pass (the export-drift test in particular — if it fails, the live DLL genuinely differs from the docs and that failure is the pipeline working; STOP and surface it to the user rather than committing) and the Astro build succeeds including the new build-history page.

- [ ] **Step 5: Commit the bootstrap**

```bash
git add scripts/auto-update.mjs package.json data/arcdps-build.json data/build-history.json data/arcdps-exports.json data/arcdps-ui-strings.json src/content/docs/reference/build-history.md
git commit -m "feat(auto-update): orchestrator script and bootstrap from live DLL"
```

---

### Task 7: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/auto-update.yml`

**Interfaces:**
- Consumes: Task 2's `$GITHUB_OUTPUT` keys (`changed`, `dll_path`, `dll_version`), npm scripts from Tasks 2/5, repo secret `AUTO_UPDATE_TOKEN` and label `auto-update` (created in Task 8).
- Produces: daily scheduled run that opens an auto-merge PR on new builds; skips when up-to-date or when an `auto-update` PR is already open.

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/auto-update.yml
# Daily arcdps build check. On a new build: refresh snapshots + history and
# open an auto-merging PR. Uses AUTO_UPDATE_TOKEN (fine-grained PAT), not
# GITHUB_TOKEN, because PRs created with GITHUB_TOKEN never trigger CI and
# auto-merge would wait forever.
name: Auto-update
on:
  schedule:
    - cron: '17 6 * * *'
  workflow_dispatch:

jobs:
  auto-update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.AUTO_UPDATE_TOKEN }}

      - name: Skip if an auto-update PR is already open
        id: guard
        env:
          GH_TOKEN: ${{ secrets.AUTO_UPDATE_TOKEN }}
        run: |
          open=$(gh pr list --state open --label auto-update --json number --jq 'length')
          echo "open=$open" >> "$GITHUB_OUTPUT"
          [ "$open" != "0" ] && echo "auto-update PR already open; skipping" || true

      - uses: actions/setup-node@v4
        if: steps.guard.outputs.open == '0'
        with:
          node-version: '24'
          cache: 'npm'

      - run: npm ci
        if: steps.guard.outputs.open == '0'

      - name: Check for a new build
        id: check
        if: steps.guard.outputs.open == '0'
        run: npm run check-build

      - name: Refresh snapshots and build history
        if: steps.guard.outputs.open == '0' && steps.check.outputs.changed == 'true'
        env:
          ARCDPS_DLL: ${{ steps.check.outputs.dll_path }}
        run: |
          npm run snapshot-exports
          npm run snapshot-ui-strings
          npm run build-history

      - name: Open auto-merging PR
        if: steps.guard.outputs.open == '0' && steps.check.outputs.changed == 'true'
        env:
          GH_TOKEN: ${{ secrets.AUTO_UPDATE_TOKEN }}
          VERSION: ${{ steps.check.outputs.dll_version }}
        run: |
          set -euo pipefail
          slug="${VERSION:-$(date +%Y%m%d)}"
          branch="auto-update/${slug}"
          git config user.name "arcdps-wiki auto-update"
          git config user.email "project96@users.noreply.github.com"
          git checkout -b "$branch"
          git add data/ src/content/docs/reference/build-history.md
          git commit -m "chore: refresh DLL snapshots for arcdps ${VERSION:-new build}"
          git push -u origin "$branch"
          gh pr create --label auto-update \
            --title "Auto-update: arcdps ${VERSION:-new build}" \
            --body "Automated snapshot + build-history refresh. Green CI: merges itself. Red CI: the export-drift output below names the documented entries a human needs to fix; this PR is the work item."
          gh pr merge --auto --squash "$branch"
```

- [ ] **Step 2: Validate the workflow file**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/auto-update.yml')); print('yaml ok')"`
Expected: `yaml ok` (python3 + pyyaml is present on this machine; if pyyaml is missing, `gh workflow view` after pushing serves as the syntax check instead).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/auto-update.yml
git commit -m "feat(auto-update): scheduled workflow with auto-merge PR"
```

---

### Task 8: repo settings, label, secret, first live run

**Files:** none (GitHub-side state). Requires `gh` authenticated as darkharasho.

**Interfaces:**
- Consumes: the merged workflow (Task 7 must be on `main` — push before this task).
- Produces: repo accepting auto-merge, `main` protected with `build-and-test` required, `auto-update` label, `AUTO_UPDATE_TOKEN` secret, and one verified `workflow_dispatch` run.

- [ ] **Step 1: Push main and create the label**

```bash
git push
gh label create auto-update --description "Automated DLL snapshot refresh" --color 0e8a16
```

- [ ] **Step 2: Enable auto-merge on the repo**

```bash
gh api -X PATCH repos/darkharasho/arcdps-wiki -f allow_auto_merge=true --jq .allow_auto_merge
```

Expected output: `true`.

- [ ] **Step 3: Protect main with the CI check required**

```bash
gh api -X PUT repos/darkharasho/arcdps-wiki/branches/main/protection \
  --input - <<'EOF'
{
  "required_status_checks": { "strict": false, "contexts": ["build-and-test"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
EOF
```

Expected: JSON response echoing `"contexts": ["build-and-test"]`. Note `required_pull_request_reviews: null` — review-count requirements would defeat the zero-review goal.

- [ ] **Step 4: PAT (user action) and secret**

This step needs the user: create a fine-grained PAT at github.com/settings/personal-access-tokens — repository access: only `darkharasho/arcdps-wiki`; permissions: Contents read/write, Pull requests read/write; expiry per their preference (calendar-reminder the renewal). Then:

```bash
gh secret set AUTO_UPDATE_TOKEN --repo darkharasho/arcdps-wiki
# paste the token when prompted
```

- [ ] **Step 5: Fire a manual run and verify the skip path**

```bash
gh workflow run auto-update.yml
```

Watch the run (sai_watch_github_run card). Expected, since Task 6 already bootstrapped to the current live build: the guard finds no open PR, `check-build` prints `up to date`, `changed=false`, and every later step skips. That exercises checkout-with-PAT, the guard, and the detector against production reality. The PR path gets its first genuine test on the next real arcdps release; no way to force it without faking data, which would publish a lie to the build-history page — don't.

- [ ] **Step 6: Record completion**

Update the spec's Status line to `implemented 2026-08-10 (PR path pending first real arcdps release)` and commit:

```bash
git add docs/superpowers/specs/2026-08-10-auto-update-pipeline-design.md
git commit -m "docs: mark auto-update pipeline implemented"
git push
```
