# Auto-update pipeline design

**Date:** 2026-08-10
**Status:** approved design, pending implementation plan
**Predecessor:** deferred sub-project from `2026-08-08-arcdps-wiki-docs-site-design.md` §12.

## 1. Purpose

Keep the wiki's DLL-derived data (`data/arcdps-exports.json`,
`data/arcdps-ui-strings.json`) in sync with new arcdps builds
automatically, and publish a generated build-history page, with zero
human review on routine builds and a self-documenting work item when a
build changes something the hand-written docs cover.

## 2. Authorization

The original spec gated this pipeline on arc-dev sign-off for
extracting/redistributing DLL-derived material. Sign-off was obtained
2026-08-10 (Discord): *"Ya that's fine it's all behind CloudFlare
anyway. Even decompiled snippets don't bother me."* The pipeline
nevertheless stays at string-level extraction (`objdump` exports,
`strings` output); disassembly-informed prose remains human-written.

## 3. Decisions taken

- **Output mode:** snapshot refresh **plus** generated build-history
  page (option B of the scoping discussion).
- **Review model:** auto-merge when CI is green; when CI is red the PR
  stays open as the work item (option A). Main never goes red because
  of this pipeline.
- **Runner:** GitHub Actions scheduled workflow (option 1). Every step
  is a plain npm script, so a manual local run (venus.local or
  anywhere) is the free fallback if Cloudflare ever blocks runner IPs.

## 4. Components

### 4.1 Change detection — `scripts/check-build.mjs`

- Fetch `https://www.deltaconnected.com/arcdps/x64/d3d11.dll.md5sum`
  (~50 bytes; verified reachable). Parse the md5.
- Compare against committed `data/arcdps-build.json`:
  `{ md5, dllVersion, updatedAt }`.
- Match → print "up to date", exit 0 with a flag the workflow reads to
  stop early. No DLL download.
- Mismatch → download the DLL to a temp path, verify its computed md5
  equals the advertised sum (torn-download guard; mismatch = hard
  fail), update `arcdps-build.json`, emit the DLL path for the next
  steps (GitHub Actions output; stdout locally).
- Bootstrap: first run (no `arcdps-build.json`) treats the live DLL as
  changed and proceeds, seeding the file.
- Note: HEAD requests against the DLL itself hang; only the md5sum
  file is polled.

### 4.2 Snapshot refresh — existing scripts, unchanged

`scripts/snapshot-exports.mjs` and `scripts/snapshot-ui-strings.mjs`
run against the downloaded DLL via the `ARCDPS_DLL` env var they
already support, rewriting `data/arcdps-exports.json` and
`data/arcdps-ui-strings.json`. `objdump`/`strings` (binutils) are
present on ubuntu runners.

### 4.3 Build history — `scripts/build-history.mjs`

- Machine-owned data file `data/build-history.json`: newest-first
  array of `{ dllVersion, md5, observedAt, exportsAdded[],
  exportsRemoved[], uiStringsAdded[], uiStringsRemoved[],
  uiStringsChanged[] }`.
- The script diffs the pre-refresh snapshots against the post-refresh
  ones and prepends one entry per run. The pre-refresh state is read
  from git (`git show HEAD:data/arcdps-exports.json`, same for UI
  strings), so script ordering relative to the overwrite does not
  matter and local dry runs see the same baseline CI does.
- `src/content/docs/reference/build-history.md` (`source: generated`)
  is fully regenerated from the JSON every run: intro note stating the
  page is machine-written and edits will be overwritten, then one
  section per build, newest first. Whole-page generation avoids any
  prose-fencing; the "automation never clobbers community prose" rule
  is honored because no community prose lives on this page.
- Diff logic is a pure function with vitest coverage over fixture
  snapshots (respecting the repo's `--maxForks=2` config).

### 4.4 Workflow — `.github/workflows/auto-update.yml`

- Triggers: daily cron + `workflow_dispatch`.
- Steps: checkout → setup-node → `npm ci` → check-build (early exit if
  unchanged or if an auto-update PR is already open) → snapshot
  scripts → build-history → commit `data/arcdps-build.json`,
  `data/arcdps-exports.json`, `data/arcdps-ui-strings.json`,
  `data/build-history.json`, and the regenerated page to branch
  `auto-update/<dllVersion or md5-prefix>` → open PR → enable native
  auto-merge.
- Token: PRs created with the default `GITHUB_TOKEN` do not trigger
  CI, which would leave auto-merge waiting forever. A fine-grained PAT
  (contents: write, pull-requests: write, this repo only) is stored as
  secret `AUTO_UPDATE_TOKEN` and used for push + PR creation.
- Duplicate guard: skip the run if an open PR with the `auto-update`
  label/branch prefix exists.

### 4.5 Repo settings (one-time, part of the deliverable)

1. Enable "Allow auto-merge" on the repository.
2. Branch protection on `main` requiring the CI `build-and-test`
   check.
3. Create the fine-grained PAT and store it as `AUTO_UPDATE_TOKEN`.

## 5. Data flow

```
md5sum poll ──unchanged──▶ exit
     │changed
     ▼
download DLL ─▶ verify md5 ─▶ snapshot scripts ─▶ diff vs git state
                                                        │
                              build-history.json ◀──────┘
                              build-history.md (regenerated)
                                                        │
                              branch + PR + auto-merge ◀┘
                                    │
                     CI green ─▶ merges itself ─▶ Pages deploy
                     CI red   ─▶ PR stays open = human work item
```

## 6. Failure handling

- **Fetch failure / Cloudflare challenge:** workflow run fails,
  GitHub's default failure notification fires, next cron retries. No
  retry loops in-run.
- **md5 verify failure:** hard fail, nothing committed.
- **Drift-test failure on the PR:** intended behavior; the test output
  names the stale documented entries. Auto-merge does not fire.
- **Manual fallback:** `npm run update` locally performs the identical
  check → refresh → history steps and leaves a branch ready to push.

## 7. Testing

- Unit: build-history diff function (fixtures for added/removed/
  changed/empty cases); check-build md5 parsing and compare logic
  (fetch mocked).
- Integration: a dry-run mode (`--dry-run`) that runs against a local
  DLL and writes nowhere, used to validate on this machine before the
  first scheduled run.
- The existing export-drift and parser tests continue to serve as the
  PR gate.

## 8. Out of scope

- Auto-editing any hand-written page (option C fencing).
- Decompilation beyond string-level extraction, despite the broader
  permission, until a concrete need exists.
- Retry/backoff sophistication, multi-DLL variants (d3d9, etc.),
  notifications beyond GitHub defaults.
