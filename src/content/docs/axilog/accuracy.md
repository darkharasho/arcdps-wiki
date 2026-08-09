---
title: axilog accuracy & calibration
description: How axilog is held to Elite Insights' numbers — the golden fixture, the exact-or-documented-exception bar, the headline calibration results, the two places axilog is deliberately more correct than EI, performance, and the honest gaps.
source: community
---

Every number [axilog](/axilog/) prints is either **exactly** what Elite
Insights prints for the same log, or a documented, ruled exception with a
traced cause. This page is the evidence: how that bar is enforced, what
the current results are, and where the gaps still are.

## How it is verified

Two references, deliberately different in what they can prove:

- **A committed anonymized golden.** `fixtures/wvw-small.anon.zevtc` (a
  real WvW fight, 42 resolved players, 49.3 s, run through
  [`axilog anonymize`](/axilog/quickstart/#anonymize-before-sharing))
  plus `fixtures/wvw-small.ei.json`, a real dps.report EI export of the
  *same* log. Both are in the repository, and
  `crates/axilog-core/tests/golden.rs` and its siblings assert against
  them in CI **on every run** — not spot-checked once and left to drift.
  37 accounts join cleanly between the two exports; that is the
  denominator behind most pre-era numbers below.
- **Local real-log calibration, both eras.** Raw `.zevtc` files are never
  committed, so a second, larger post-rework capture (48 players, 583k
  events) and its EI export live gitignored under `fixtures/local/`. The
  test hooks pick them up automatically when present and skip when not,
  which is how the post-`20260501` wire shape got real numbers instead of
  only synthetic ones. 44 accounts join there.

The bar, stated in the project's own roadmap: *calibrated numbers stay
EI-exact or get a documented and ruled exception*. An exception is not a
loosened tolerance — it is a written trace of the divergence's root cause,
an explicitly authorized bound set at the *measured* residual plus a small
margin, and a named allowlist in the test file. There are exactly two in
the whole project, and both are below.

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
count.

## Headline results

Pre-era rows are against the committed golden (37 joined accounts);
post-era rows are against the local post-rework capture (44 joined
accounts). "Exact" means bit-identical, not within a tolerance.

| Metric | Result |
| --- | --- |
| Fight duration, map, team ids/colors | Exact |
| Squad total damage | Exact vs EI's `squadTotalDamage` |
| CC applied (count / duration) | Exact — 34 events / 50,460 ms |
| Stun breaks (count / duration) | Exact — 20 / 16,907 ms |
| Condi cleanses (squad / self) | Exact — 801 / 97, and per-player |
| Boon strips (squad) | Exact — 437, and per-player |
| Resurrect casts (squad) | Exact — 6, and per-player |
| Boon uptime, presence % | Exact — 444/444 cells (370 duration-type + 74 intensity-type), none over the 2 pp tolerance |
| Boon average stacks (Might, Stability) | 67/74 cells exact; **7 Stability cells allowlisted** — see below |
| Boon generation (self/group/squad) | Exact — 148 cells, worst delta 0.097 pp |
| `statsAll[0]` hit quality | Exact — all **20** fields, both eras |
| `defenses[0]` | Exact — all 18 fields, both eras, except one field where [EI is wrong](#where-axilog-is-more-correct-than-ei) |
| Condition / power / life-leech splits, post-era | **Hard-exact** on 44/44 accounts since the condition catalog landed |
| `activeTimes` | Exact — 0.0000 % max error (gate: ≤0.5 %) |
| `totalDamageDist` per-skill entries | Exact on every shared skill id, 37/37 |
| `damage1S` cumulative series | Exact — `damage1S[0].last()` matches the whole-fight scalar, 37/37 |
| `rotation[]` per-player cast count | Exact, 37/37 |
| Replay `positions` / `orientations` | **100 % f32-text-exact** — 6,074 samples (37/37) pre-era, 50,999 samples (44/44) post-era |
| Replay `start` / `end` / `dc` / `down` / `dead` | Exact on every joined player |
| `combatReplayMetaData` | Text-exact, including `inchToPixel: 0.009` |
| Healing out — self, downed-ally | Exact, 41/41 accounts |
| Healing out — total, allies | Within 0.68 % / 0.71 % squad-wide |
| Barrier out | **7.60 % squad-wide residual, ruled exception** — see below |

Two clarifications the table can't carry. "f32-text-exact" for replay
means the emitted decimal *text* matches: EI serializes C# `float`s, so
matching the value to `f64` precision would still print different
characters. And the post-era rows are exact for hit quality, defenses,
condition splits and replay; boon, generation and support extraction is
implemented and era-gated for post-rework logs and verified by
construction against GW2EI source plus synthetic era-equivalence tests,
but has not yet been calibrated against a real post-rework *EI export*.

### The two ruled exceptions

**Seven Stability average-stack cells.** EI types Stability as
`BuffStackType.StackingConditionalLoss` (it loses a stack instead of
being CC'd) while Might is plain `Stacking` — but EI's own current
simulator source has no branch that distinguishes the two. The affected
players show legitimate multi-stack Stability grants with zero
`CROWD_CONTROL` events, so the divergence is a GW2EI-internal nuance that
is not reverse-engineerable from the raw EVTC stream with confidence. The
cells are named in `INTENSITY_STACK_ALLOWLIST` with the trace attached,
rather than guessed at.

**Barrier out, 7.60 %.** GW2EI's `SanitizeForSrc` deduplicates
healing-extension rows per healer, and one repeating skill — same id,
same fixed amount, several peer-relayed copies within a tick — straddles
its all-or-nothing rule. Reproducing it byte-for-byte would also require
reproducing GW2EI's internal per-agent-lifetime identity tracking. The
measured residual is 7.5993 %; the authorized bound was set at 8.0 %, the
measurement plus a margin, not a round number chosen for comfort. Every
other healing field is exact or within 0.71 %.

## Where axilog is more correct than EI

Parity is the goal right up to the point where EI is verifiably wrong.
Two places it is, and neither bug is reproduced:

**`lifeLeechDamageTakenCount` is never incremented.** EI's defenses
constructor increments `LifeLeechDamageTaken` twice in the life-leech
branch — once correctly by the damage, and once by one, which was plainly
meant to be `LifeLeechDamageTakenCount++`. The sibling count field is
therefore never touched at all. Confirmed against the golden two ways:
the field reads `0` for all 41 players, including several with a
substantial nonzero `lifeLeechDamageTaken`; and the reported sum is
consistently `[true sum] + [true count]`, exactly the double-increment's
algebraic signature, cross-checked against the
`powerDamageTaken − strikeDamageTaken` gap. axilog emits the true derived
count. This is the **one** field in `ei-json` that intentionally differs
from EI.

**The trailing default replay sample when `logDuration % 300 == 0`.** EI
pre-sizes its polled-position array at `(logDuration − startOffset) / rate + 1`,
but the polling loop's own `t < logDuration` bound excludes the
exact-multiple endpoint — so on any log whose duration is a whole
multiple of the 300 ms polling rate, the last slot is never written and
keeps C#'s default zero `Vector3`. For an actor whose first-aware is `0`,
that stray `(0, 0, 0)`-at-`t=0` point survives `Trim` (which clamps by
index, not by re-validating values) and can push the exported track's
last real timestamp past the actor's own `end`. axilog's loop pushes one
real sample per iteration and has no pre-sized slot to leave stale; a
regression test asserts no zero sample is ever emitted and no sample runs
past the bound.

## Findings the calibration surfaced

Things that were true about arcdps logs, or about the documentation, and
that only showed up because something was being held to an exact number:

- **Real arcdps captures are not globally time-sorted.** A performance
  optimization was written on the assumption they were — check whether
  the event list is non-decreasing in `time`, and take a narrow subslice
  if so. Instrumented on the real 583k-event post-rework capture, the
  fast path *never fired*: the log is genuinely not globally sorted. The
  optimization was reverted and replaced by one that always builds its
  own sorted index. Any tool that assumes wire order is time order on a
  real WvW log is assuming something false.
- **The EVTC reference contradicts itself on `CBTS_HEALTHPCTUPDATE`.**
  Its note says "percent \* 10000 eg. 99.5% will be 9950" — the two
  halves disagree, and the worked example is the correct one (the scale
  is percent × 100, as EI's `HealthUpdateEvent` confirms). This is why
  ordinals are hand-counted from the live reference and cross-checked
  against EI's `ArcDPSEnums` rather than trusted.
- **A misclassification can conserve totals and still be badly wrong.**
  Treating every `buff == 1` hit as condition damage kept every squad
  total correct while diverging from EI by up to **51.4 % relative** on
  `powerDamageTakenCount`, affecting 33 of 44 accounts. It was pure
  reclassification between buckets, which is exactly why squad-level
  checks never caught it. The fix was to reproduce EI's actual
  per-skill-id predicate — see
  [condition classification](/axilog/methodology/#condition-classification).

## Performance

Measured end to end (decode → resolve → analyze → build the native
report), release build, single-threaded, on an AMD Ryzen 9 7900X3D:

| Log | Events | `analyze` | Full pipeline |
| --- | --- | --- | --- |
| Committed fixture | 120,435 | 18.9 ms | **28.9 ms** |
| Real WvW zerg log (48 players, 5:48) | 583,194 | 93.7 ms | **174 ms** |

That is a whole real WvW log — damage, downs and CC,
arcdps-methodology down contribution, boons and generation, support,
healing, per-skill damage, per-second series, hit quality, defenses and
rotation — in under a fifth of a second, with no `unsafe`.

The MPERF milestone made `analysis::analyze` 2.12× faster on the fixture
and 2.63× faster on the real log (1.75× / 1.87× end to end). The wins
were structural, not micro-optimization: the time-aware instid registry
was being rebuilt 11 times per log and is now built once and threaded by
reference; boon extraction is shared between the uptime and generation
simulations instead of run twice; `contribution` binary-searches each
down's window out of one sorted index instead of rescanning the whole
event list per down (53 downs × 583k events ≈ 31M iterations, previously
the single most expensive pass); and the registry's backing store became
a flat `Vec` instead of a `BTreeMap`.

Every step was verified **byte-identical** to pre-MPERF output across all
30 output surfaces before it was kept — a perf change that alters a
number is a correctness regression, not a speedup. The full record,
including the optimizations that were *declined* and why, is in
[`docs/BENCHMARKS.md`](https://github.com/darkharasho/axilog/blob/main/docs/BENCHMARKS.md).

## Honest gaps

Where axilog does not compute something, `ei-json` omits the key rather
than emitting a plausible zero. The current list:

- **Damage modifiers.** Trait/sigil/food/rune attribution
  (`damageModifiers`, `incomingDamageModifiers`) is not implemented. It
  is the next planned milestone, and the largest remaining one.
- **`wvWMapData` objectives.** Only the three team-id fields are emitted.
  EI additionally carries `{red,blue,green}ShardID` and `objectiveData[]`
  — per-objective capture-ownership timelines for every Camp, Tower and
  Keep. That is a whole event family axilog does not decode yet: parked,
  not faked.
- **Skill names and icons.** `skillMap` names come from the log's *own*
  skill table. EI supplements that with a bundled, GW2-API-backed skill
  database supplying disambiguated names, icon URLs and classifier flags
  (`isInstantCast`, `isTraitProc`, …). Different data source, so names
  are spot-checked rather than calibrated and the API-dependent flags are
  omitted. `canCrit` and a narrower `isSwap` are computed from the id
  alone and match EI on every overlapping id.
- **Instant casts.** The rotation pipeline reproduces EI's *animated*-cast
  path only. EI's separate instant-cast pipeline (weapon swaps, procs,
  instant-cast mechanics) accounts for roughly **29 %** of a real log's
  cast entries and is not decoded — which is why the calibrated rotation
  number above is the animated-cast count, not a total.
- **Post-era boon/support calibration.** Implemented, era-gated, verified
  by construction and by synthetic era-equivalence tests; not yet
  calibrated against a real post-rework dps.report export.
- **Down contribution has no golden.** EI's `downContribution` uses a
  different algorithm by design, so there is nothing to match it against.
  axilog's [contribution family](/axilog/methodology/#the-arcdps-down-contribution-family)
  follows the dev-relayed arcdps methodology and is verified by unit
  tests per documented nuance plus real-log sanity checks — which is a
  weaker guarantee than everything else on this page, and is stated as
  such.

## See also

- [axilog overview](/axilog/) — what it is, architecture, scope.
- [Calculation methodology](/axilog/methodology/) — the derivations these
  numbers are testing.
- [Output schema](/axilog/schema/) — the fields, and the EI-compat
  surface.
- The full field-by-field parity table, with every calibration number,
  lives in the
  [axilog README](https://github.com/darkharasho/axilog#ei-json-parity).
