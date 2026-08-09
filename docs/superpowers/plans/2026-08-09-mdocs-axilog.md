# MDOCS — axilog docs on arcdps-wiki: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** a first-class axilog documentation section on the arcdps-wiki Starlight site
(axi.link): architecture, calculation methodology, schema reference, SDK/CLI quickstarts, and
the calibration/accuracy story — written from the axilog repo's own docs/module docs, in the
wiki's established voice.

## Global Constraints

- Work in THIS worktree (/var/home/mstephens/Documents/GitHub/arcdps-wiki-mdocs, branch
  feat/mdocs-axilog). The axilog repo (/var/home/mstephens/Documents/GitHub/axilog) is the
  READ-ONLY content source: README.md, docs/BENCHMARKS.md, docs/ROADMAP.md, crates/*/src
  module docs (citation-heavy — distill, don't dump). NEVER copy PII (no real account names;
  fixture numbers/counts are fine).
- Follow the wiki's conventions: Starlight md/mdx under src/content/docs/, frontmatter
  title/description like existing pages, sidebar wired in astro.config.mjs, tone matching the
  existing guides (technical, cited, reader-first). Read 2-3 existing guides first for voice.
- Every factual claim about calculations must carry its grounding (GW2EI arbiter, arcdps
  methodology, calibration numbers) — the axilog module docs already have the citations;
  carry them through in readable form.
- Registries are LIVE: npm `@axiapps/axilog`, PyPI `axilog` (0.1.1) — quickstarts use real
  install commands.
- GATES per task: `npm run build` (astro build) green; `npm test` green (site tests,
  maxForks=2 already configured); internal links resolve (astro build catches broken links);
  no PII.

---

### Task 1: Section scaffold + overview + methodology pages

**Files:** `src/content/docs/axilog/index.md` (overview: what axilog is, architecture —
workspace crates, decode→resolve→analyze→emit pipeline, WvW-first scope, EI-parity philosophy
+ the "closer to arcdps spec" differentiators: down contribution, CC over time, timeline);
`src/content/docs/axilog/methodology.md` (calculation methodology: damage/pet-fold, arcdps
down-contribution family incl. the health-anchored window, CC, boon simulation era handling,
condition catalog + fourth bucket, rotation cast pairing, EI-grid replay polling — each with
its grounding); astro.config.mjs sidebar (new "axilog" group after Guides).

### Task 2: Schema + SDK/CLI reference

**Files:** `src/content/docs/axilog/schema.md` (native JSON shape: always-on vs opt-in gated
blocks with the flag per block + size rationale; EI-compat surface summary + parity-table
distillation); `src/content/docs/axilog/quickstart.md` (CLI install from GitHub Release +
`axilog parse` tour incl. --format/--view/--replay etc.; Node `npm install @axiapps/axilog` +
parseFile/parseFileEi example; Python `pip install axilog` + parse_file example — REAL
commands, runnable).

### Task 3: Accuracy & calibration story + cross-links

**Files:** `src/content/docs/axilog/accuracy.md` (the calibration approach: golden fixtures,
exact-or-documented-exception bar, per-milestone verification numbers distilled from
README/BENCHMARKS — incl. the places axilog SURPASSES EI: true life-leech count vs the GW2EI
counting bug, the not-time-sorted-events finding, perf numbers); update
`src/content/docs/guides/ecosystem.md` axilog row to link the new section; cross-link from
parsing-logs guide where EI/parsers are discussed. Final `npm run build` + `npm test` + link
check.

## Self-Review
Three tasks, all writing + wiring in one repo with a build gate; content sourced from
already-reviewed axilog docs; no code changes. No placeholders.
