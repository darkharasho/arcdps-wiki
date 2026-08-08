# arcdps-wiki Docs Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a beautiful, modern, technical-reference-first documentation site for arcdps, built on Astro + Starlight and deployable to Cloudflare Pages, seeded from the DLL's public export surface plus deltaconnected's published API notes.

**Architecture:** Static Astro + Starlight site. Content is Markdown/MDX under `src/content/docs/`, with a custom `source` frontmatter field marking provenance (`dll-exports` / `official-docs` / `community`). A Node script snapshots the DLL export table into a checked-in JSON file; a Vitest test asserts the documented exports match that snapshot so content can't silently drift. GitHub Actions builds the site (build failure on broken links/MDX) and runs the drift test. Cloudflare Pages builds prod on `main` and previews on PRs.

**Tech Stack:** Astro, Starlight (`@astrojs/starlight`), Node 24 / npm 11, Vitest, GitHub Actions, Cloudflare Pages.

## Global Constraints

- **Runtime/toolchain:** Node 24.x, npm 11.x. Static build only — no runtime backend.
- **Test parallelism (machine constraint from CLAUDE.md):** run Vitest as `vitest --pool=forks --poolOptions.forks.maxForks=2`.
- **Content provenance:** every page under `src/content/docs/reference/` MUST set frontmatter `source:` to one of `dll-exports` | `official-docs` | `community`.
- **Accuracy rule:** never invent field/enum semantics. Where deltaconnected's published notes are silent, the page states that explicitly (e.g. "purpose undocumented").
- **Audience:** technical-reference-first for downstream/addon devs; every struct/enum page includes FFI layout mappings (Rust `#[repr(C)]`, Python `ctypes`, node koffi) — not just C.
- **Official source of truth for API prose:** https://www.deltaconnected.com/arcdps/x64/
- **DLL location (local, read-only, never committed):** `/var/mnt/data/SteamLibrary/steamapps/common/Guild Wars 2/addons/ArcDPS.dll`
- **Commit style:** frequent, one deliverable per commit, Conventional Commits prefixes.

---

## File Structure

```
package.json                      → deps + scripts (dev/build/test/snapshot-exports)
astro.config.mjs                  → Astro + Starlight integration, sidebar, site URL
tsconfig.json                     → Astro strict TS base
vitest.config.ts                  → forks pool, maxForks=2
src/content.config.ts             → Starlight docs collection + custom `source` frontmatter
src/styles/theme.css              → custom palette / typography (visual pass)
src/content/docs/
  index.mdx                       → Home / Overview (splash)
  getting-started.md              → building an extension: skeleton addon
  reference/
    extension-api/
      addon-contract.md           → GetAddonDef, gw2addon_*, init/release
      combat-callback.md          → combat callback signature + params
      arcdps-exports.md           → e0, e3–e10
      extension-registry.md       → addextension2/removeextension2/listextension/*_export
    data-structures/
      cbtevent.md                 → field-by-field + FFI mappings
      agent.md                    → ag struct + FFI mappings
    enums/
      index.md                    → cbtstateevent, cbtresult, iff, activation, buffremove …
    exports/
      index.md                    → grouped-by-function export reference
      directx-proxy.md            → why arcdps proxies d3d11.dll
      raw-table.md                → raw export table appendix (generated from snapshot)
    evtc-format.md                → STUB: planned follow-on
  contributing.md                 → PR flow, page conventions, frontmatter contract
scripts/
  snapshot-exports.mjs            → read DLL export table → data/arcdps-exports.json
  lib/parse-exports.mjs           → pure: objdump text → sorted string[] (unit-tested)
  lib/documented-exports.mjs      → pure: scan reference MDX → documented export names
data/
  arcdps-exports.json             → checked-in export snapshot (source of truth for drift test)
tests/
  parse-exports.test.ts           → unit tests for parse-exports
  export-drift.test.ts            → documented exports ⊆ snapshot; snapshot groups covered
.github/workflows/ci.yml          → build + test on push/PR
README.md                         → update: local dev, build, deploy, snapshot refresh
```

---

### Task 1: Scaffold Astro + Starlight, first build passes

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/content.config.ts`, `src/content/docs/index.mdx`
- Modify: `.gitignore` (add `node_modules/`, `dist/`, `.astro/`)

**Interfaces:**
- Consumes: nothing.
- Produces: an installable, buildable Starlight site; `npm run build` emits `dist/`. Sidebar groups referenced by later content tasks: `Getting Started`, `Extension API`, `Data Structures`, `Enums`, `Exports`, `Reference`, `Contributing`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "arcdps-wiki",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "snapshot-exports": "node scripts/snapshot-exports.mjs",
    "test": "vitest run --pool=forks --poolOptions.forks.maxForks=2"
  },
  "dependencies": {
    "astro": "^5.0.0",
    "@astrojs/starlight": "^0.30.0",
    "sharp": "^0.33.5"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: completes, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

- [ ] **Step 4: Create `astro.config.mjs`** (sidebar declares the full IA up front; pages fill in later)

```js
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://arcdps.axi.link', // final subdomain confirmed at Cloudflare setup
  integrations: [
    starlight({
      title: 'arcdps wiki',
      description: 'Community technical reference for the arcdps Guild Wars 2 addon.',
      customCss: ['./src/styles/theme.css'],
      social: {
        github: 'https://github.com/darkharasho/arcdps-wiki',
      },
      sidebar: [
        { label: 'Overview', link: '/' },
        { label: 'Getting Started', link: '/getting-started/' },
        {
          label: 'Extension API',
          items: [
            { label: 'Addon contract', link: '/reference/extension-api/addon-contract/' },
            { label: 'Combat callback', link: '/reference/extension-api/combat-callback/' },
            { label: 'arcdps exports', link: '/reference/extension-api/arcdps-exports/' },
            { label: 'Extension registry', link: '/reference/extension-api/extension-registry/' },
          ],
        },
        {
          label: 'Data Structures',
          items: [
            { label: 'cbtevent', link: '/reference/data-structures/cbtevent/' },
            { label: 'agent (ag)', link: '/reference/data-structures/agent/' },
          ],
        },
        { label: 'Enums', link: '/reference/enums/' },
        {
          label: 'Exports',
          items: [
            { label: 'Export reference', link: '/reference/exports/' },
            { label: 'DirectX proxy', link: '/reference/exports/directx-proxy/' },
            { label: 'Raw export table', link: '/reference/exports/raw-table/' },
          ],
        },
        { label: 'EVTC log format', link: '/reference/evtc-format/' },
        { label: 'Contributing', link: '/contributing/' },
      ],
    }),
  ],
});
```

- [ ] **Step 5: Create `src/content.config.ts`** (extend Starlight schema with the `source` field)

```ts
import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        source: z.enum(['dll-exports', 'official-docs', 'community']).optional(),
      }),
    }),
  }),
};
```

- [ ] **Step 6: Create placeholder `src/styles/theme.css`** (real design in Task 6)

```css
/* Custom theme — expanded in the visual pass (Task 6). */
:root { --sl-font: system-ui, sans-serif; }
```

- [ ] **Step 7: Create `src/content/docs/index.mdx`** (splash so the build has a home page)

```mdx
---
title: arcdps wiki
description: Community technical reference for the arcdps Guild Wars 2 addon.
template: splash
hero:
  tagline: A community technical reference for arcdps extension developers.
  actions:
    - text: Getting Started
      link: /getting-started/
      icon: right-arrow
      variant: primary
    - text: Extension API
      link: /reference/extension-api/addon-contract/
      icon: external
---

This is the seed of the arcdps developer wiki. Content is filled in by later tasks.
```

- [ ] **Step 8: Update `.gitignore`**

Ensure these lines exist:
```
node_modules/
dist/
.astro/
```

- [ ] **Step 9: Build to verify**

Run: `npm run build`
Expected: build succeeds, emits `dist/`. (Sidebar links to not-yet-created pages are allowed; Starlight only fails on broken *inline* links inside rendered content, which we have none of yet.)

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json src .gitignore
git commit -m "feat: scaffold Astro + Starlight site with full sidebar IA"
```

---

### Task 2: Export snapshot + parser (TDD)

**Files:**
- Create: `scripts/lib/parse-exports.mjs`, `scripts/snapshot-exports.mjs`, `tests/parse-exports.test.ts`, `vitest.config.ts`, `data/arcdps-exports.json`

**Interfaces:**
- Consumes: nothing (reads the local DLL at snapshot time only).
- Produces:
  - `parseExports(objdumpText: string): string[]` — sorted, de-duplicated export names, in `scripts/lib/parse-exports.mjs`.
  - `data/arcdps-exports.json` shape: `{ "dllVersion": string, "generatedFrom": "objdump -p", "exports": string[] }` (91 names, sorted). Consumed by Task 3's drift test and Task 5c's raw-table page.

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: { forks: { maxForks: 2 } },
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Write the failing test** `tests/parse-exports.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { parseExports } from '../scripts/lib/parse-exports.mjs';

const SAMPLE = `
	[Ordinal/Name Pointer] Table
	[  19] +base[  20]  0000 ApplyCompatResolutionQuirking
	[   5] +base[   6]  0048 addextension2
	[   8] +base[   9]  004d e0
	[   5] +base[   6]  0048 addextension2
`;

describe('parseExports', () => {
  it('extracts the trailing symbol name from each table row', () => {
    expect(parseExports(SAMPLE)).toEqual(['ApplyCompatResolutionQuirking', 'addextension2', 'e0']);
  });

  it('sorts and de-duplicates', () => {
    const out = parseExports(SAMPLE);
    expect(out).toEqual([...out].sort());
    expect(new Set(out).size).toBe(out.length);
  });

  it('ignores non-row lines', () => {
    expect(parseExports('Export Address Table\nrandom noise\n')).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `parse-exports.mjs` not found / `parseExports` undefined.

- [ ] **Step 4: Implement `scripts/lib/parse-exports.mjs`**

```js
// Parse `objdump -p` Ordinal/Name Pointer table text into sorted, unique export names.
export function parseExports(objdumpText) {
  const names = new Set();
  for (const line of objdumpText.split('\n')) {
    // Rows look like: "\t[  19] +base[  20]  0000 SymbolName"
    const m = line.match(/^\s*\[\s*\d+\]\s*\+base\[\s*\d+\]\s+[0-9a-fA-F]+\s+(\S+)\s*$/);
    if (m) names.add(m[1]);
  }
  return [...names].sort();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (3 tests).

- [ ] **Step 6: Implement `scripts/snapshot-exports.mjs`** (regenerates the checked-in snapshot from the local DLL)

```js
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { parseExports } from './lib/parse-exports.mjs';

const DLL = process.env.ARCDPS_DLL
  ?? '/var/mnt/data/SteamLibrary/steamapps/common/Guild Wars 2/addons/ArcDPS.dll';

const objdump = execFileSync('objdump', ['-p', DLL], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const exports = parseExports(objdump);

// Version string from the DLL, best-effort; empty if strings/grep unavailable.
let dllVersion = '';
try {
  const strings = execFileSync('strings', [DLL], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const hit = strings.split('\n').find((l) => /^EVTC\d{8}$/.test(l));
  if (hit) dllVersion = hit;
} catch { /* strings optional */ }

const snapshot = { dllVersion, generatedFrom: 'objdump -p', exports };
writeFileSync(new URL('../data/arcdps-exports.json', import.meta.url), JSON.stringify(snapshot, null, 2) + '\n');
console.log(`Wrote ${exports.length} exports (version: ${dllVersion || 'unknown'}).`);
```

- [ ] **Step 7: Generate the snapshot**

Run: `npm run snapshot-exports`
Expected: prints `Wrote 91 exports`, creates `data/arcdps-exports.json`.

- [ ] **Step 8: Sanity-check the snapshot**

Run: `node -e "const j=require('./data/arcdps-exports.json'); console.log(j.exports.length, j.exports.includes('addextension2'), j.exports.includes('e10'))"`
Expected: `91 true true`

- [ ] **Step 9: Commit**

```bash
git add scripts vitest.config.ts tests/parse-exports.test.ts data/arcdps-exports.json
git commit -m "feat: snapshot DLL export table with unit-tested parser"
```

---

### Task 3: Export-drift test (TDD)

**Files:**
- Create: `scripts/lib/documented-exports.mjs`, `tests/export-drift.test.ts`

**Interfaces:**
- Consumes: `data/arcdps-exports.json` (Task 2). Reference MDX/MD under `src/content/docs/reference/` (written in Tasks 5/7/8/9 — test is written now but its content assertions are designed to pass once those pages exist; see Step 5 note).
- Produces: `collectDocumentedExports(dir: string): Set<string>` — every export symbol mentioned inside a fenced `export-symbols` frontmatter list across reference pages.

**Design note:** Pages that document exports declare which symbols they cover via a frontmatter array `exportSymbols: [ ... ]`. The drift test asserts (a) every symbol any page claims to document exists in the snapshot, and (b) every snapshot symbol is covered by exactly one page. This keeps prose and the DLL in lockstep without parsing free text.

- [ ] **Step 1: Write the failing test** `tests/export-drift.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectDocumentedExports } from '../scripts/lib/documented-exports.mjs';

const snapshot = JSON.parse(
  readFileSync(fileURLToPath(new URL('../data/arcdps-exports.json', import.meta.url)), 'utf8'),
);
const refDir = fileURLToPath(new URL('../src/content/docs/reference/', import.meta.url));
const documented = collectDocumentedExports(refDir);
const snap = new Set(snapshot.exports);

describe('export drift', () => {
  it('every documented symbol exists in the DLL snapshot', () => {
    const unknown = [...documented].filter((s) => !snap.has(s));
    expect(unknown).toEqual([]);
  });

  it('every DLL export is documented on some page', () => {
    const missing = [...snap].filter((s) => !documented.has(s));
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- export-drift`
Expected: FAIL — `collectDocumentedExports` not found.

- [ ] **Step 3: Implement `scripts/lib/documented-exports.mjs`**

```js
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.mdx?$/.test(p)) out.push(p);
  }
  return out;
}

// Collect symbols from each page's `exportSymbols:` frontmatter array.
export function collectDocumentedExports(dir) {
  const symbols = new Set();
  for (const file of walk(dir)) {
    const text = readFileSync(file, 'utf8');
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) continue;
    const block = fm[1].match(/exportSymbols:\s*\n((?:\s*-\s*\S+\n?)+)/);
    if (!block) continue;
    for (const m of block[1].matchAll(/-\s*(\S+)/g)) symbols.add(m[1]);
  }
  return symbols;
}
```

- [ ] **Step 4: Run test to verify it fails on the coverage assertion**

Run: `npm test -- export-drift`
Expected: first assertion PASSES (no documented symbols yet, so none are unknown), second assertion FAILS (91 undocumented). This is expected — the drift test is a living gate.

- [ ] **Step 5: Mark the coverage assertion pending until content exists**

Change the second test to `it.todo('every DLL export is documented on some page')` **temporarily**, leaving a comment:
```ts
// TODO(Task 9): flip back to `it(...)` once exports/*.md cover all 91 symbols via exportSymbols frontmatter.
```
Run: `npm test -- export-drift`
Expected: PASS (1 pass, 1 todo).

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/documented-exports.mjs tests/export-drift.test.ts
git commit -m "feat: add export-drift test gating docs against DLL snapshot"
```

---

### Task 4: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm run build`, `npm test` (Tasks 1–3).
- Produces: CI that fails on build errors or test failures for every push and PR.

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Validate the workflow locally (syntax)**

Run: `node -e "require('fs').readFileSync('.github/workflows/ci.yml','utf8')" && npx --yes js-yaml .github/workflows/ci.yml >/dev/null && echo OK`
Expected: `OK` (valid YAML).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: build and test on push and PR"
```

---

### Task 5: Overview + Getting Started content

**Files:**
- Modify: `src/content/docs/index.mdx`
- Create: `src/content/docs/getting-started.md`

**Interfaces:**
- Consumes: sidebar from Task 1.
- Produces: two authored pages. No `exportSymbols` here (conceptual pages).

- [ ] **Step 1: Fetch official source for accuracy**

Use WebFetch on `https://www.deltaconnected.com/arcdps/x64/` and read the linked API notes. Extract: the addon export model, the mod struct fields, callback ordering. Do not proceed to prose without reading it. Where a claim isn't supported by that page, mark it per the accuracy rule.

- [ ] **Step 2: Rewrite `src/content/docs/index.mdx`** — keep the splash hero from Task 1, add a `<CardGrid>` below it linking the four pillars (Extension API, Data Structures, Enums, Exports) using Starlight's `Card` component. Add a one-paragraph "What is arcdps?" at a developer's altitude (proxy DLL that loads into GW2, exposes a combat callback + helper exports to addons).

- [ ] **Step 3: Write `src/content/docs/getting-started.md`** with frontmatter:
```md
---
title: Getting Started (extension developers)
description: Build a minimal arcdps extension — the export contract and a skeleton addon.
source: official-docs
---
```
Body: the minimal addon lifecycle (`get_init_addr` → arcdps calls your init → you return a `arcdps_exports`/mod struct; `get_release_addr` for teardown), a compilable C skeleton, and a short "consuming from other languages" note pointing to the FFI mappings on the struct pages. Source every factual claim from Step 1; mark anything the official notes don't cover as "undocumented — verify against the reference implementation."

- [ ] **Step 4: Build to verify links/MDX**

Run: `npm run build`
Expected: PASS, no broken-link warnings for these pages.

- [ ] **Step 5: Commit**

```bash
git add src/content/docs/index.mdx src/content/docs/getting-started.md
git commit -m "docs: overview and getting-started for extension developers"
```

---

### Task 6: Visual design pass

**Files:**
- Modify: `src/styles/theme.css`, optionally `astro.config.mjs` (fonts, logo)
- Create: `src/assets/` logo/wordmark if produced

**Interfaces:**
- Consumes: Starlight CSS custom properties.
- Produces: a distinctive dark-first theme so the site doesn't read as default Starlight.

**Sub-skill:** invoke `frontend-design` for aesthetic direction before writing CSS.

- [ ] **Step 1: Define palette + type** in `src/styles/theme.css` — override Starlight accent + gray scales (`--sl-color-accent-*`, `--sl-color-gray-*`), set a real display/body/mono font stack, tune code-block theme. Dark-first, GW2/arcdps-flavored, high contrast (WCAG AA for body text).

- [ ] **Step 2: Verify contrast + both color modes**

Run: `npm run build && npm run preview` and visually confirm light+dark. (If in-app render tooling is available, render the home + a reference page to screenshot.)
Expected: legible in both modes; accent passes AA on background.

- [ ] **Step 3: Commit**

```bash
git add src/styles/theme.css astro.config.mjs src/assets
git commit -m "style: custom dark-first arcdps theme"
```

---

### Task 7: Extension API reference pages

**Files:**
- Create: `src/content/docs/reference/extension-api/{addon-contract,combat-callback,arcdps-exports,extension-registry}.md`

**Interfaces:**
- Consumes: official notes (WebFetch), snapshot (Task 2).
- Produces: four pages whose `exportSymbols` frontmatter collectively covers the arcdps-specific exports. Symbol assignment:
  - `addon-contract.md` → `GetAddonDef`, `gw2addon_get_description`, `gw2addon_load`, `gw2addon_unload`, `arcdps_identifier_export`, `arcdps_imguiversion_export`
  - `combat-callback.md` → (no direct exports; documents the callback the addon *provides* — no `exportSymbols`)
  - `arcdps-exports.md` → `e0`, `e3`, `e4`, `e5`, `e6`, `e7`, `e8`, `e9`, `e10`
  - `extension-registry.md` → `addextension2`, `removeextension2`, `listextension`, `c_closeandupdate`, `c_exceptionerrormsg`

- [ ] **Step 1: Fetch official notes** (WebFetch `https://www.deltaconnected.com/arcdps/x64/` + linked API text). Record which of the above symbols the notes actually describe.

- [ ] **Step 2: Write `addon-contract.md`** — frontmatter:
```md
---
title: Addon contract
description: How arcdps discovers, loads, and unloads an extension.
source: dll-exports
exportSymbols:
  - GetAddonDef
  - gw2addon_get_description
  - gw2addon_load
  - gw2addon_unload
  - arcdps_identifier_export
  - arcdps_imguiversion_export
---
```
Body: for each symbol, a table row with signature (from official notes), purpose, and "undocumented" where notes are silent. Explain the load/unload lifecycle and the addon-manager (`gw2addon_*`) vs native (`GetAddonDef`) discovery paths.

- [ ] **Step 3: Write `arcdps-exports.md`** — frontmatter `source: dll-exports` + the `exportSymbols` list `e0,e3,e4,e5,e6,e7,e8,e9,e10`. Body: one section per `eN` with its documented purpose (log target, ini path, modifier keys, add-event, ui, etc.) sourced from Step 1; explicitly note `e1`/`e2` are absent (historical) and any `eN` whose purpose the notes don't give.

- [ ] **Step 4: Write `extension-registry.md`** — frontmatter `source: dll-exports` + `exportSymbols: addextension2, removeextension2, listextension, c_closeandupdate, c_exceptionerrormsg`. Body: the sub-extension registration API and the chainload/updater exports, each with signature/purpose or "undocumented".

- [ ] **Step 5: Write `combat-callback.md`** — frontmatter `source: official-docs` (no `exportSymbols`). Body: the combat callback signature the addon exposes (`cbtevent* ev, ag* src, ag* dst, char* skillname, uint64 id, uint64 revision`), the local vs area callback distinction, and calling-order notes. Link forward to `cbtevent` and `agent` pages.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/content/docs/reference/extension-api
git commit -m "docs: extension API reference (contract, callback, exports, registry)"
```

---

### Task 8: Data structures + enums (with FFI mappings)

**Files:**
- Create: `src/content/docs/reference/data-structures/{cbtevent,agent}.md`, `src/content/docs/reference/enums/index.md`

**Interfaces:**
- Consumes: official notes.
- Produces: struct/enum reference. No `exportSymbols` (not exports). Each struct page carries the FFI-mapping block required by Global Constraints.

- [ ] **Step 1: Fetch official notes** for `cbtevent`, `ag`, and the enums. Capture exact field order/types — layout must be correct for the FFI mappings to be usable.

- [ ] **Step 2: Write `data-structures/cbtevent.md`** — frontmatter `source: official-docs`. Body: a field-by-field table (offset, C type, name, meaning). Then three fenced blocks giving the equivalent layout in Rust `#[repr(C)] struct cbtevent { ... }`, Python `class cbtevent(ctypes.Structure): _fields_ = [...]`, and node `koffi.struct('cbtevent', { ... })`. Mark any field whose meaning the notes omit as "undocumented".

- [ ] **Step 3: Write `data-structures/agent.md`** — same pattern for the `ag` struct (`name, id, prof, elite, self, team, ...`) with the three FFI mappings.

- [ ] **Step 4: Write `enums/index.md`** — frontmatter `source: official-docs`. One reference table per enum: `cbtstateevent`, `cbtresult`, `iff`, `cbtactivation`, `cbtbuffremove`, `cbtcustomskill`, `cbtstateevent` extras. Values from official notes; note gaps explicitly.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/content/docs/reference/data-structures src/content/docs/reference/enums
git commit -m "docs: cbtevent/agent structs with FFI mappings, and enum reference"
```

---

### Task 9: Exports reference + raw table + DirectX proxy, and close the drift gate

**Files:**
- Create: `src/content/docs/reference/exports/{index,directx-proxy,raw-table}.md`
- Modify: `tests/export-drift.test.ts` (flip `it.todo` back to `it`)

**Interfaces:**
- Consumes: `data/arcdps-exports.json` (Task 2), all export-documenting pages (Task 7).
- Produces: full export coverage so every one of the 91 symbols has an `exportSymbols` home, and the drift gate goes live.

- [ ] **Step 1: Write `exports/directx-proxy.md`** — frontmatter `source: dll-exports` + `exportSymbols` listing the entire DirectX/DXGI/D3DKMT/PIX/compat proxy group (`CreateDXGIFactory`, `CreateDXGIFactory1`, `CreateDXGIFactory2`, `CreateDirect3D11DeviceFromDXGIDevice`, `CreateDirect3D11SurfaceFromDXGISurface`, `D3D11CoreCreateDevice`, `D3D11CoreCreateLayeredDevice`, `D3D11CoreGetLayeredDeviceSize`, `D3D11CoreRegisterLayers`, `D3D11CreateDevice`, `D3D11CreateDeviceAndSwapChain`, `D3D11CreateDeviceForD3D12`, `D3D11On12CreateDevice`, all `D3DKMT*`, `D3DPerformance_*`, all `DXGI*`, `OpenAdapter10`, `OpenAdapter10_2`, `PIXBeginCapture`, `PIXEndCapture`, `PIXGetCaptureState`, `ApplyCompatResolutionQuirking`, `CompatString`, `CompatValue`, `SetAppCompatStringPointer`, `EnableFeatureLevelUpgrade`, `UpdateHMDEmulationStatus`). Get the exact list from the snapshot:

Run: `node -e "console.log(require('./data/arcdps-exports.json').exports.join('\n'))"`
Body: explain arcdps ships as `d3d11.dll`, proxying/forwarding these to the real system DLL so it loads into the game — these aren't part of the addon API.

- [ ] **Step 2: Write `exports/index.md`** — frontmatter `source: dll-exports` (no `exportSymbols`; it links to the grouped pages). Body: the grouped-by-function overview table linking each group to its documenting page (Extension API pages + DirectX proxy page).

- [ ] **Step 3: Write `exports/raw-table.md`** — frontmatter `source: dll-exports`. Body: intro paragraph + the full sorted list of all 91 symbols as the raw appendix. Paste from:

Run: `node -e "const e=require('./data/arcdps-exports.json').exports; console.log(e.map(s=>'- \`'+s+'\`').join('\n'))"`

- [ ] **Step 4: Reconcile coverage** — ensure the union of every page's `exportSymbols` equals all 91 snapshot symbols, with no symbol in two pages. Verify:

Run: `npm test -- export-drift` (with the todo still in place)
Then flip `it.todo(...)` back to `it(...)` in `tests/export-drift.test.ts` and re-run.
Expected: after flip, BOTH assertions PASS. If "every DLL export is documented" fails, the printed `missing` array names the uncovered symbols — add each to the appropriate page's `exportSymbols`.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/content/docs/reference/exports tests/export-drift.test.ts
git commit -m "docs: full export reference + raw table; enable export-drift gate"
```

---

### Task 10: EVTC stub + Contributing page

**Files:**
- Create: `src/content/docs/reference/evtc-format.md`, `src/content/docs/contributing.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: the EVTC placeholder (so the follow-on has a home) and the contribution contract.

- [ ] **Step 1: Write `reference/evtc-format.md`** — frontmatter `source: community`. Body: a short "Planned" callout — explain most Node/Python/Rust consumers parse `.evtc`/`.zevtc` logs (as Elite Insights does), that a full binary-format spec is a planned follow-on, and link the deferred-work note. No fabricated format details.

- [ ] **Step 2: Write `contributing.md`** — frontmatter `source: community`. Body: PR workflow (fork → branch → PR → preview deploy → review → merge), page conventions, the **required `source:` frontmatter** and its three values, the `exportSymbols` contract for export pages and that CI's drift test enforces it, and the accuracy rule (no invented semantics).

- [ ] **Step 3: Build + full test**

Run: `npm run build && npm test`
Expected: build PASS; all tests PASS (including both drift assertions).

- [ ] **Step 4: Commit**

```bash
git add src/content/docs/reference/evtc-format.md src/content/docs/contributing.md
git commit -m "docs: EVTC format stub and contributing guide"
```

---

### Task 11: Deployment config + README

**Files:**
- Create: `wrangler.toml` OR document Cloudflare Pages dashboard settings in README (Pages Git integration needs no wrangler for static builds — prefer README docs).
- Modify: `README.md`

**Interfaces:**
- Consumes: build output `dist/`.
- Produces: reproducible deploy instructions + local dev docs.

- [ ] **Step 1: Update `README.md`** with: project summary; local dev (`npm install`, `npm run dev`, `npm run build`, `npm test`); how to refresh the export snapshot (`ARCDPS_DLL=... npm run snapshot-exports`, requires local DLL + `objdump`); Cloudflare Pages setup (framework preset: Astro; build command `npm run build`; output dir `dist`; Node 24; production branch `main`; PR preview deploys on); note the final `axi.link` subdomain and that Cloudflare account authorization is done interactively (`/mcp` or `claude mcp`), not in this session.

- [ ] **Step 2: Verify a clean build from scratch**

Run: `rm -rf node_modules dist .astro && npm ci && npm run build && npm test`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: local dev, snapshot refresh, and Cloudflare Pages deploy instructions"
```

---

## Self-Review

**Spec coverage:**
- §4 Architecture (Astro+Starlight, Pages, generated boundary) → Tasks 1, 6, 11; frontmatter boundary → Task 1 (schema) + enforced Tasks 7–10.
- §5 Content architecture (every IA node) → sidebar Task 1; pages Tasks 5, 7, 8, 9, 10. All IA nodes have a task.
- §6 Source-of-truth contract (`source` frontmatter, accuracy rule) → schema Task 1; applied every content task; documented Task 10.
- §7 Modern-language accessibility (FFI mappings) → Task 8 Steps 2–3 (Rust/Python/node blocks); EVTC stub Task 10.
- §8 Seed data source (export groups) → Tasks 2, 7, 9.
- §9 Accuracy & testing (build gate, export-drift, citations) → build every content task; drift Tasks 3+9; CI Task 4.
- §10 Deployment & workflow → Tasks 4, 11.
- §11 Open items (subdomain, CI export source, CF auth) → subdomain noted Tasks 1/11; CI uses checked-in snapshot (Task 2) resolving the "how CI gets exports" question; CF auth noted Task 11.
- §12 Deferred (pipeline, full EVTC, end-user docs) → correctly out of plan; EVTC stub only (Task 10).

**Placeholder scan:** No "TBD/implement later" in executable steps. The one `it.todo` (Task 3 Step 5) is deliberate, tracked, and flipped in Task 9 Step 4 — not a lazy placeholder. Content pages that source live prose (Tasks 5/7/8) specify the exact WebFetch source, exact frontmatter, exact symbol assignments, and the accuracy rule — the honest treatment given the "no invented semantics" constraint; they are not free-form "write something here" steps.

**Type consistency:** `parseExports` (Task 2) and `collectDocumentedExports` (Task 3) names match their call sites. Snapshot shape `{dllVersion, generatedFrom, exports}` consistent across Tasks 2/3/9. `exportSymbols` frontmatter key consistent across the schema-free drift parser (Task 3) and all producing pages (Tasks 7/9). The 91-symbol union is reconciled in Task 9 Step 4 before the gate is enabled.
