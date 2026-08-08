# arcdps-wiki

A community-managed wiki and technical reference for arcdps (the Guild Wars 2
combat-analysis addon). The site is built with [Astro](https://astro.build)
and [Starlight](https://starlight.astro.build), edited entirely through
GitHub pull requests (no in-browser editor, no live database), and deployed
to Cloudflare Pages under the `axi.link` domain.

This repo currently covers the docs site itself plus a hand-seeded technical
reference for arcdps' extension API, data structures, enums, and exports.
See [Project scope](#project-scope) below for what's deliberately out of
scope.

## Local development

Requires Node 24 and npm 11.

```bash
npm install
npm run dev      # local dev server
npm run build    # production build (astro build) -> dist/
npm test         # vitest suite, including the export-drift test
```

`npm run build` must succeed with no broken links, and `npm test` must pass,
before opening a PR — CI runs both again on the PR.

## Refreshing the export snapshot

Several reference pages describe arcdps' DLL export table. That table is
captured as a checked-in snapshot at `data/arcdps-exports.json`, generated
from a real copy of `ArcDPS.dll` via `objdump`. The DLL itself is **never**
committed to this repo.

To regenerate the snapshot, point `ARCDPS_DLL` at a local copy of the DLL
and run the snapshot script:

```bash
ARCDPS_DLL=/path/to/ArcDPS.dll npm run snapshot-exports
```

If `ARCDPS_DLL` is unset, the script falls back to a hardcoded local path
(`scripts/snapshot-exports.mjs`) that only makes sense on the maintainer's
machine — always set it explicitly. `objdump` must be on `PATH`; `strings`
is used opportunistically to detect the DLL's `EVTC` version string and is
optional.

The export-drift test (`tests/export-drift.test.ts`) fails the build if the
snapshot and the `exportSymbols:` frontmatter across `src/content/docs/reference/`
disagree — either a documented symbol is missing from the snapshot, or a
snapshot export isn't documented anywhere. So when the DLL's export table
changes, refresh the snapshot **and** update the affected export pages in
the same change; `npm test` will not pass otherwise.

## Content model quick reference

- Every page under `src/content/docs/` sets a `source:` frontmatter field to
  exactly one of `dll-exports`, `official-docs`, or `community`, describing
  where its information comes from.
- Pages that document specific DLL exports list every covered symbol in an
  `exportSymbols:` frontmatter field, as a YAML dash-list (`- SymbolName`
  per line — inline arrays are not recognized).

See the [Contributing page](src/content/docs/contributing.md) for the full
contract, including the accuracy rule and PR workflow.

## Cloudflare Pages setup

The site deploys to Cloudflare Pages. A maintainer connects the project to
this GitHub repo once, from the Cloudflare dashboard (Workers & Pages ->
Create application -> Pages -> Connect to Git), or via authenticated
Cloudflare tooling, using these settings:

- **Framework preset:** Astro
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node version:** 24
- **Production branch:** `main`
- **PR preview deploys:** enabled (every PR gets a preview URL)

The final `axi.link` subdomain is still TBD (e.g. `arcdps.axi.link`). Once
chosen, it needs to be set in two places: as the custom domain on the
Cloudflare Pages project, and as the `site` value in `astro.config.mjs`
(currently `https://arcdps.axi.link` as a placeholder).

## Project scope

This repo is the docs site plus a hand-seeded technical reference. Two
things described in the original project vision are deliberately **not**
part of this repo yet:

- An automated pipeline that decompiles the arcdps DLL on a cadence and
  regenerates reference pages.
- A full EVTC binary-format specification (the current EVTC page is a stub).

Both are planned follow-ons.
