---
title: axilog accuracy & calibration
description: How axilog is held to Elite Insights' numbers at v0.3.2 — the golden fixtures, the exact-or-documented-exception bar, the current headline results across every calibrated surface, the head-to-head performance comparison, and the honest gaps.
source: community
---

Every number [axilog](/axilog/) prints is either **exactly** what Elite
Insights prints for the same log, or a documented, ruled exception with a
traced cause. This page is the evidence: how that bar is enforced, what
the results are at **v0.3.2**, and where the gaps still are.

The places axilog deliberately differs are on their own page —
[parity & divergences](/axilog/parity/).

## How it is verified

Two references, deliberately different in what they can prove:

- **A committed anonymized golden.** `fixtures/wvw-small.anon.zevtc` (a
  real WvW fight, 42 resolved players, 49.3 s, run through
  [`axilog anonymize`](/axilog/quickstart/#anonymize-before-sharing))
  plus `fixtures/wvw-small.ei.json`, a real dps.report EI export of the
  *same* log. Both are in the repository, and the golden test suites
  assert against them in CI **on every run** — not spot-checked once and
  left to drift. Three denominators show up below and they are all the
  same fixture: axilog resolves **42** players, EI's export carries **41**
  player rows (the extra is a known relog straggler with a blank account
  that contributes 0 to every metric), and the two are joined by
  agent-table index → account name. Healing joins all **41**; the boon-,
  hit-quality- and defense-augmented comparisons join **37**, which is the
  denominator behind most pre-era numbers below.
- **Local real-log calibration, both eras.** Raw `.zevtc` files are never
  committed, so a second, larger post-rework capture (48 players, 583k
  events, Blue Alpine Borderlands, 348,362 ms) and its EI export live
  gitignored under `fixtures/local/`. The test hooks pick them up
  automatically when present and skip when not, which is how the
  post-`20260501` wire shape got real numbers instead of only synthetic
  ones. **44 accounts and 56 enemy-player targets join there.**

The bar, stated in the project's own roadmap: *calibrated numbers stay
EI-exact or get a documented and ruled exception*. An exception is a
written trace of the divergence's root cause, an explicitly authorized
bound set at the *measured* residual plus a small margin, and a named
allowlist in the test file — never a loosened tolerance. The current list
is [three entries long](/axilog/parity/#ruled-exceptions), and one
long-standing entry (seven Stability average-stack cells) was **retired**
rather than settled.

Three sources settle disputes, in order of authority: methodology relayed
directly from the arcdps developer; the
[GW2 Elite Insights](https://github.com/baaron4/GW2-Elite-Insights-Parser)
source, read at a pinned commit and cited by file and method, as the
arbiter for every algorithm that has to match EI's output; and the arcdps
EVTC reference, hand-counted, for enum ordinals — hand-counted because the
published reference
[contains errors](/axilog/methodology/#what-the-rules-are-grounded-in).

Process matters as much as the fixtures. Each milestone runs
spec → plan → subagent-driven execution in an isolated worktree, with an
**adversarial review per task** and a final whole-branch review before
merge; reviewers reproduce the numbers independently rather than reading
the implementer's summary. That is how the condition-classification gap
below was found — not by a failing test, but by a reviewer re-deriving a
count — and how the waste-only-source adapter bug was found, by a reviewer
noticing that the calibration read the simulator instead of the serialized
document.

## Headline results

Pre-era rows are against the committed golden (37 joined accounts);
post-era rows are against the local post-rework capture (44 joined
accounts, 56 joined targets). "Exact" means bit-identical wherever a
bit-exact assertion backs the row; rows gated by a tolerance say so and
state their bar.

### Fight, squad and support

| Metric | Result |
| --- | --- |
| Fight duration, map, team ids/colors | Exact |
| Squad total damage | Exact vs EI's `squadTotalDamage` |
| Professions incl. elite specs | Exact, EI-style naming (elite-spec name wins when active) |
| CC applied (count / duration) | Exact — 34 events / 50,460 ms |
| Stun breaks (count / duration) | Exact — 20 / 16,907 ms |
| Condi cleanses (squad / self) | Exact — 801 / 97, and per-player |
| Boon strips (squad) | Exact — 437, and per-player |
| Resurrect casts (squad) | Exact — 6, and per-player |
| Incoming CC, incoming strips (`defenses[0]`) | **Exact on 44/44 post-era and 37/37 pre-era accounts** |
| `activeTimes` | Exact — 0.0000% max error (gate: ≤ 0.5%) |
| `guildID` | Exact on 44/44, decoded from `CBTS_GUILD`'s mixed-endian GUID packing — no GW2-API lookup involved |
| `instanceID`, players and targets | **44/44 players, 56/56 targets exact** |

### Boons and generation

Full derivations on the [buffs & boons](/axilog/buffs/) page.

| Metric | Result |
| --- | --- |
| Boon uptime, presence % | Exact — 444/444 cells; the tolerance is now **0.05 pp**, tightened 40× from 2 pp and sitting 100× above EI's own 0.0005 serialization floor |
| Boon average stacks (Might, Stability) | **74/74 inside a 0.5% relative bar, no allowlist** — worst cell 0.000558. The bound was tightened 10× and the 7-cell Stability allowlist retired. |
| Boon generation (self/group/squad) | 148 cells, worst delta 0.097 pp against a 2 pp bar, no allowlist |
| Generation `wasted` | 1,022 cells across 44 players and three scopes; worst non-Regeneration **0.163 pp** |
| Post-era presence, 44 accounts | mean 0.0002–0.0003 pp for nine of ten duration boons; Regeneration mean 0.0060 pp / max 0.037 pp |
| `buffUptimes[].states` / `.statesPerSource` | 169,614 sampled instants over 486 timelines, **83 differ (0.05%)**; 397 of 398 duration-boon timelines sample-for-sample exact |
| `boonsStates` → `boonsAppliedCount` | **43 of 44 accounts exact**, worst 4 of 101 |

### Damage, hits and defenses

| Metric | Result |
| --- | --- |
| `statsAll[0]` hit quality | Exact — all 20 fields, **both eras** |
| `statsAll[0].saved` / `timeSaved` / `wasted` / `timeWasted` | **Exact on all 44 accounts**, asserted rather than toleranced |
| `defenses[0]` | Exact — all 18 fields, both eras, except `lifeLeechDamageTakenCount` where [EI is wrong](/axilog/parity/#lifeleechdamagetakencount-is-never-incremented) |
| Condition / power / life-leech splits, post-era | **Hard-exact on 44/44 accounts** since the condition catalog landed |
| `totalDamageDist` per-skill entries | Exact on every shared skill id, 37/37 |
| Distribution outcome columns, incoming | **18,000 of 18,000 cells exact**, 0 reference rows missing |
| Distribution outcome columns, outgoing | Six non-count columns and `indirectDamage` exact; `hits`/`connectedHits` differ on 8 of 5,340 joined cells (worst 17), inheriting the documented pet/minion fold |
| `damage1S` cumulative series | Exact — `damage1S[0].last()` matches the whole-fight scalar, 37/37 |
| `powerDamageTaken1S` split | **0 buckets where the split itself diverges**, asserted as a per-bucket identity rather than a tolerance |
| `targetPowerDamage1S` | 662,200 buckets exact |
| `statsTargets[i][0]` per-target split | **9,460 of 9,460 cells exact** (44 accounts × 43 targets × 5 fields) |
| `targets[].damage1S` / `.powerDamage1S` | 30,100 buckets exact |
| `targets[].totalDamageDist` | 1,890 cells exact with identical row sets in both directions; 180 skill ids exact against the pre-era golden |
| `targets[].dpsAll[0]` | 53 of 56 instid-joined targets exact (49 nonzero); the 3 are allowlisted and diagnosed |
| `dpsAll[0].breakbarDamage` | **44 of 44 accounts exact**, 27 nonzero |
| `healthPercents` | **All 44 accounts identical, array for array** |
| `rotation[]` per-player cast count | Exact, 37/37; per-cast `timeGained` **exactly 0 delta** across all 10,878 local casts and all 1,222 fixture casts |

### Replay

| Metric | Result |
| --- | --- |
| `positions` / `orientations` | **100% f32-text-exact** — 6,074 samples (37/37) pre-era, 50,999 samples (44/44) post-era |
| `start` / `end` / `dc` / `down` / `dead` | Exact on every joined player |
| `combatReplayMetaData` | Text-exact, including `inchToPixel: 0.009` |

### Healing and minions

| Metric | Result |
| --- | --- |
| Healing out — self, downed-ally | Exact, 41/41 accounts |
| Healing out — total, allies | Within 0.68% / 0.71% squad-wide |
| Barrier out | **7.60% squad-wide residual, ruled exception** |
| Ally matrices / dists / `healing1S` | **1,936 ally cells, 328 healing-dist rows (1,732 cells), 23 barrier-dist rows and 15,400 `healing1S` buckets all exact**, 0 missing / 0 extra rows |
| `minions[].totalDamageTakenDist` | **544 of 554 (account, skill) rows exact on every column**, 0 rows emitted the reference lacks |

### Damage modifiers

Full treatment on the [damage modifiers](/axilog/damage-modifiers/) page.

| Metric | Result |
| --- | --- |
| Coverage | **69 of the reference export's 75 ids** |
| Ids exact on every field of every account | **38** |
| Whole-fight rows exact | **792 of 958** |
| Per-target rows | **3,963 / 3,963 text-identical** across all 56 joined targets |
| `damageModMap` | **69 / 69 character-for-character identical**, every field |
| Aggregate `totalHitCount` / `totalDamage` residual | **0.0 on every id, every account** |

Two clarifications the tables cannot carry. "f32-text-exact" for replay
means the emitted decimal *text* matches: EI serializes C# `float`s, so
matching the value to `f64` precision would still print different
characters. And the modifier residual is **not** a modifier-logic defect —
it is buff-state fidelity in `hitCount`/`damageGain`, which is why closing
two buff-simulation gaps moved it and closing a denominator gap pinned
every aggregate at zero.

## What each milestone actually closed

The parity surface moved a great deal after v0.1.1, and the shape of the
movement is more informative than the totals.

| Milestone | What it closed |
| --- | --- |
| **M15** | EI-shape replay: positions/orientations/`dc`/`start`/`end`, 100% f32-text-exact both eras; the five-map geometry table and 45-icon table, machine-diffed against GW2EI |
| **MCONDCAT** | The condition-skill-id catalog. Replaced "`buff == 1` and not life leech" with EI's real per-skill-id predicate; every previously report-only or toleranced check went hard-exact on 44/44 accounts |
| **MBUFFSIM** | Two missing GW2EI **event-pipeline** rules (not simulator defects). Stability allowlist 7 → 0, average-stack bound tightened 10×, modifier rows 682 → 779 exact |
| **M16** | Damage-modifier attribution: 205-definition catalog, 10 gain computers, the `g/(100+g)` share formula, 69/75 ids |
| **MATTRIB** | GW2EI's `CompleteAgents` orphaned-instid repair, transcribed exactly; plus root-causing the M16 deficit to a self-damage filter EI does not have — modifier rows 792/958, all denominator residuals 0.0 |
| **MEIGAP** | 19 of the cutover audit's 23 cited-scope rows: generation arrays, incoming CC/strips, per-target offensive split, healing/minion/guild detail |
| **MEIGAP2** | The six open-cheap rows: distribution outcome columns, `healthPercents`, `instanceID`, `boonsStates`, `targets[].dpsAll`, `breakbarDamage` |
| **MSTREAM** | Streaming ei-json serializer — peak RSS −95% (20×), output byte-identical across 96 flag/output combinations |
| **MROSTER** | `targets[]` curated to GW2EI's WvW roster rule. The mitigation `avg` multiplier went exact on all 206 shared skill ids with no restriction for the consumer to apply |
| **MINSTID** | Enemy-player instid regroup. Roster set-equal to EI's 56; the mitigation min-mean residual 16/206 → **0/206** |
| **MSMALL** | `HealingLogic`, generation `wasted`, `statsAll[0].saved` exact, presence tolerance 2.0 → 0.05, and the breakbar carve-out resolved in both directions |

Against the axibridge cutover audit's own gap-row list: **19 of its 23
cited-scope rows are closed, 1 is half-closed, 1 remains open** and 2 need
no action. The one still open is `statsAll[0].saved` — which MSMALL then
closed, having established it does *not* need the instant-cast pipeline
after all: EI's `saved` is a switch over each cast's status accumulating
`SavedDuration`, both of which axilog's animated-cast data already carried
and was simply discarding.

## Findings the calibration surfaced

Things that were true about arcdps logs, or about the documentation, and
that only showed up because something was being held to an exact number.

- **Real arcdps captures are not globally time-sorted.** A performance
  optimization was written on the assumption they were. Instrumented on
  the real 583k-event capture, the fast path *never fired*: the log is
  genuinely not globally sorted. Any tool that assumes wire order is time
  order on a real WvW log is assuming something false.
- **The EVTC reference contradicts itself on `CBTS_HEALTHPCTUPDATE`.**
  Its note says "percent \* 10000 eg. 99.5% will be 9950" — the two halves
  disagree, and the worked example is the correct one. This is why
  ordinals are hand-counted and cross-checked against EI's `ArcDPSEnums`
  rather than trusted.
- **A misclassification can conserve totals and still be badly wrong.**
  Treating every `buff == 1` hit as condition damage kept every squad
  total correct while diverging from EI by up to **51.4% relative** on
  `powerDamageTakenCount`, affecting 33 of 44 accounts. Pure
  reclassification between buckets, which is exactly why squad-level
  checks never caught it.
- **arcdps emits rows whose `src_agent`/`dst_agent` is `0` while the
  instid still names a live agent.** Every address-keyed pass would
  silently drop them. GW2EI rewrites the address from the instid inside
  the parser; axilog transcribed the same repair as a decode post-pass.
  Two honesty notes came with it: GW2EI's `±300 ms` is **two probe
  points**, not a widened window (an agent alive for under 600 ms around
  the orphaned row fails both probes and is rejected — reproduced
  literally, with a unit test a "fixed" version would fail), and roughly a
  third of orphans stay unrepaired, which is the correct outcome: 725 of
  1,091 rows repaired on the real capture, the bulk of the remainder
  `CBTS_DESPAWN` rows naming no nearby-aware agent.
- **A wide tolerance hides the regression it was sized for.** The
  average-stack bound sat ~90× above the true worst cell, which is how a
  real two-rule event-pipeline defect survived two milestones. Every
  tolerance in the project now records the floor it is measured against.
- **An adapter can be exact and still wrong.** The boon-generation
  calibration read the simulator's output directly, so it was
  structurally blind to a filter in the serializer that dropped
  waste-only sources. The replacement test joins through the serialized
  document.

## Performance

Measured end to end (decode → resolve → analyze → build the native
report), release build, single-threaded, on an AMD Ryzen 9 7900X3D:

| Log | Events | `analyze` | Full pipeline |
| --- | --- | --- | --- |
| Committed fixture | 120,435 | 18.9 ms | **28.9 ms** |
| Real WvW zerg log (48 players, 5:48) | 583,194 | 93.7 ms | **174 ms** |

MPERF made `analysis::analyze` 2.12× faster on the fixture and 2.63×
faster on the real log (1.75× / 1.87× end to end). The wins were
structural, not micro-optimization: the time-aware instid registry was
being rebuilt 11 times per log and is now built once and threaded by
reference; boon extraction is shared between the uptime and generation
simulations instead of run twice; `contribution` binary-searches each
down's window out of one sorted index instead of rescanning the whole
event list per down (53 downs × 583k events ≈ 31M iterations, previously
the single most expensive pass); and the registry's backing store became a
flat `Vec` instead of a `BTreeMap`.

Every step was verified **byte-identical** to pre-MPERF output across all
30 output surfaces before it was kept — a perf change that alters a number
is a correctness regression, not a speedup.

### Against the Elite Insights CLI

Head-to-head against Elite Insights CLI v3.27 plus its bundled .NET 8
runtime, measured 2026-08-10, same machine, medians of 3 runs after a
warmup. "Matched" is axibridge's production EI configuration (detailed
WvW, damage modifiers, combat replay, raw timeline arrays, phases) against
axilog's equivalent
`--format ei-json --replay --skill-damage --timeseries --rotation --modifiers`
— the closest honest apples-to-apples. EI additionally computes phases and
its full skill-DB surface; axilog emits its documented WvW parity surface.

| | Real 5:48 zerg (583k events, 48 players) | 49 s skirmish (120k events, 42 players) |
| --- | --- | --- |
| Elite Insights CLI | 7.25 s · 857 MiB peak | 2.43 s · 373 MiB peak |
| **axilog, matched surface** | **2.49 s (2.9×) · 117 MiB (7.3× less)** | **0.25 s (9.7×) · 24 MiB (15× less)** |
| axilog, matched + gzip output | 2.86 s · 117 MiB | — |
| **axilog, default native JSON** | **0.36 s (20×) · 86 MiB (10× less)** | **0.06 s (40×) · 20 MiB (18× less)** |

Two structural notes behind those numbers. EI pays roughly 2 s of .NET
startup and JIT **per spawned parse**, so the small-log column is the
realistic per-upload ratio; axilog's fixed cost is effectively zero. And
the memory column used to be EI's one win — axilog peaked at 2.4 GiB
building the full ei-json document in RAM — until MSTREAM's streaming
serializer removed it entirely (−95% peak, output verified byte-identical
across 96 flag/output combinations). axilog now leads every cell.

MROSTER, which landed after that rerun, cut the matched-surface run on the
real log further still — 2.60 s → **1.70 s** and 117 → 92 MiB in its own
back-to-back measurement — because nine per-player arrays are positionally
joined to `targets[]` and shrinking the roster 8.8× shrinks all of them by
the same factor. `--timeseries` alone went 1.33 s → **0.56 s**.

The full record — the harness, the raw criterion samples, the payload
tables, and every optimization that was *declined* along with why — is in
[`docs/BENCHMARKS.md`](https://github.com/darkharasho/axilog/blob/main/docs/BENCHMARKS.md).

## Honest gaps

Where axilog does not compute something, `ei-json` omits the key rather
than emitting a plausible zero. The current list:

- **Instant casts are computed but not merged.** The instant-cast finders
  now run — 565 of GW2EI's 649 `InstantCastFinder` definitions are
  transcribed — but their output is not yet folded into `rotation`, which
  remains animated-cast only. So the calibrated rotation number is still
  the animated-cast count rather than a total, and the gap is a merge that
  has not happened rather than a pipeline that does not exist. The 6
  `UsingNoAnimatedCastChecker` finders are blocked on the same merge,
  because they need the cast window it would establish.
- **Skill names.** `skillMap` names come from the log's own skill table, a
  genuinely different data source from EI's bundled, API-backed database,
  so names are spot-checked rather than calibrated. `autoAttack` is still
  omitted — it needs the live API and was refused rather than guessed. The
  five proc/instant/accuracy flags are *not* in that category any more:
  `isInstantCast`, `isTraitProc`, `isGearProc`, `isUnconditionalProc` and
  `isNotAccurate` are emitted, derived from the finders' own availability
  predicates rather than from API data.
- **Skill icons, in `ei-json` only.** The native container carries them at
  `catalogs.skills[].icon` — 372 of 456 catalogued skills on the fixture,
  boons and conditions included via the GW2EI buff-table fallback. EI's
  `skillMap`/`buffMap` shape has no icon field, so the EI-compat layer
  cannot expose them. A consumer that needs art should read the native
  catalog.
- **Six damage-modifier ids**, each needing an engine feature axilog does
  not have.
- **Shield damage** is not decoded, so damage-modifier gains and
  denominators use unadjusted damage — consistent everywhere, and a known
  divergence on barrier-heavy targets.
- **Down contribution has no golden.** EI's `downContribution` uses a
  different algorithm by design, so there is nothing to match it against.
  axilog's
  [contribution family](/axilog/methodology/#the-arcdps-down-contribution-family)
  follows the dev-relayed arcdps methodology and is verified by unit tests
  per documented nuance plus real-log sanity checks — a weaker guarantee
  than everything else on this page, and stated as such.

## See also

- [Parity & divergences](/axilog/parity/) — where axilog intentionally
  differs, and why.
- [axilog overview](/axilog/) — what it is, architecture, scope.
- [Calculation methodology](/axilog/methodology/) — the derivations these
  numbers are testing.
- [Output schema](/axilog/schema/) — the fields, and the EI-compat
  surface.
- The full field-by-field parity table, with every calibration number,
  lives in the
  [axilog README](https://github.com/darkharasho/axilog#ei-json-parity).
