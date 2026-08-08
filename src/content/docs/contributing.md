---
title: Contributing
description: How to propose changes to the arcdps wiki — workflow, page conventions, and the export-drift contract.
source: community
---

This wiki is a Git-backed, Markdown-driven docs site. There is no in-browser
editor and no live database — every change goes through a GitHub pull
request. This page covers the workflow and the conventions your PR is
expected to follow.

## PR workflow

1. **Fork** the repository and create a **branch** for your change.
2. Edit or add Markdown/MDX pages under `src/content/docs/`.
3. **Open a pull request** against `main`.
4. Cloudflare Pages builds a **preview deploy** for the PR automatically, so
   reviewers (and you) can click through the rendered pages before merge.
5. A maintainer **reviews** the PR — checking content accuracy, frontmatter,
   and (for export-documenting pages) that the export-drift test still
   passes.
6. On approval, the PR is **merged to `main`**, which is the production
   branch — merging triggers the production Cloudflare Pages deploy.

## Page conventions

Every page under `src/content/docs/` documents something about arcdps, so
every page must declare where its information comes from. Set a `source:`
field in frontmatter to exactly one of:

- **`dll-exports`** — the content is verifiable directly against arcdps'
  DLL export table (symbol names, presence/absence of an export). Use this
  for pages primarily describing what the DLL exports, independent of
  whether their *behavior* is documented anywhere.
- **`official-docs`** — the content is sourced from deltaconnected's
  published API notes (e.g. the `README.txt` shipped alongside the DLL, or
  the EVTC docs). Use this when you're transcribing or explaining something
  the official notes actually say.
- **`community`** — the content is community knowledge, reverse-engineered,
  inferred from naming/behavior, or otherwise not backed by an official
  published description. This page and the EVTC stub are both `community`.

Pick the value that matches the *weakest* claim on the page — if a page
mixes official and inferred material, prefer `community` and call out which
parts are official inline, the way the
[addon contract](/reference/extension-api/addon-contract/) page does.

## The `exportSymbols` contract

Pages that document specific DLL exports (functions in arcdps' export
table) must list every symbol they cover in an `exportSymbols:` frontmatter
field, formatted as a YAML **dash-list**:

```yaml
---
title: Example export page
source: dll-exports
exportSymbols:
  - SomeExportedFunction
  - AnotherExportedFunction
---
```

This is not just documentation — it's read by tooling. CI runs an
export-drift test (`tests/export-drift.test.ts`, backed by
`scripts/lib/documented-exports.mjs`) that:

- scans every page under `src/content/docs/reference/` for an
  `exportSymbols:` block,
- asserts every symbol listed anywhere is present in the current DLL
  snapshot (`data/arcdps-exports.json`) — catching stale or typo'd symbol
  names, and
- asserts every export in that snapshot is documented on **at least one**
  page — catching exports nobody has written up yet.

The documented-symbols set is a union across all pages, so the test does
**not** detect the same symbol being listed on two different pages. Avoid
documenting a symbol on more than one page as a project convention, but be
aware CI won't catch a cross-page duplicate for you.

**The frontmatter parser only recognizes the dash-list form shown above.**
An inline array (`exportSymbols: [Foo, Bar]`) will not match the parser's
regex and is silently ignored — the symbols inside it won't count as
documented, and the drift test will fail with those exports reported as
missing. Always use one `- Symbol` line per export.

Because of this contract, adding or removing a documented export is a
two-part change: update the relevant page's `exportSymbols:` list, **and**
keep `data/arcdps-exports.json` in sync by re-running
`npm run snapshot-exports` when the underlying DLL's export table changes.
The two must agree, or `npm test` fails.

## Accuracy rule

Never invent field, enum, or API semantics. If you don't know what a value
means, don't guess and don't fill in a plausible-sounding description.
Where the official notes are silent, say so explicitly — mark the item
**undocumented** rather than omitting the caveat. This is why
`source: community` pages read the way they do: they're explicit about
which parts are confirmed and which are inference.

## Local dev quickref

```bash
npm install
npm run dev      # local dev server
npm run build    # production build — must pass with no broken links
npm test         # vitest suite, including the export-drift test
```

Both `npm run build` and `npm test` should pass before you open a PR; CI
runs both again on the PR itself.
