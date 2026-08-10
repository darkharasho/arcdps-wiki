---
title: axilog buffs & boons
description: The per-(agent, buff) stack simulation behind axilog's boon uptime, average stacks, generation and waste — the two tick models, the stacking logics, the two event-pipeline rules that decide accuracy, and the GW2EI-shape state timelines.
source: community
---

Boon uptime is not a matter of summing durations. It is a state machine
over apply/remove events, per `(agent, buff)` pair, and getting its
stacking rules wrong inflates or deflates every number downstream —
including the buff-gated
[damage modifiers](/axilog/damage-modifiers/#the-residual-is-buff-state-not-modifier-logic).
This page documents the model [axilog](/axilog/) implements, which is
GW2EI's default "NoID" buff simulator
(`GW2EIEvtcParser/EIData/Buffs/BuffSimulators/BuffSimulatorNoID/`).

For the raw-event view of buff apply/remove on the wire, see
[boons, buffs & uptime](/guides/boons-and-buffs/).

## Scope

Twelve boons, squad players only. Enemy-side buff tracking exists but is
narrower — see [enemy conditions](#enemy-side-condition-timelines) below.

| Boon | Id | Stack model | Capacity |
| --- | --- | --- | --- |
| Might | 740 | Intensity (`Stacking`) | 25 |
| Fury | 725 | Duration (`Queue`) | 9 |
| Regeneration | 718 | Duration (`Regeneration`) | 5 |
| Vigor | 726 | Duration (`Queue`) | 5 |
| Swiftness | 719 | Duration (`Queue`) | 9 |
| Protection | 717 | Duration (`Queue`) | 5 |
| Aegis | 743 | Duration (`Queue`) | 9 |
| Resolution | 873 | Duration (`Queue`) | 5 |
| Stability | 1122 | Intensity (`StackingConditionalLoss`) | 25 |
| Quickness | 1187 | Duration (`Queue`) | 5 |
| Resistance | 26980 | Duration (`Queue`) | 5 |
| Alacrity | 30328 | Duration (`Queue`) | 9 |

Capacities are transcribed from GW2EI's `CommonBuffs.Boons`
(`EIData/Buffs/CommonBuffs.cs:14-29`), not guessed at a uniform 5 — and
where the log itself reports a per-buff capacity, the log wins and the
table is only a fallback. Several real capacities sit far above what a
"typically 5" assumption would allow.

## The two tick models

`BuffStackType` (GW2EI's `ArcDPSEnums.BuffStackType`,
`ArcDPSEnums.cs:384-393`) is a property of the **buff**, and it is the key
GW2EI's simulator constructor dispatches on
(`BuffSimulator.cs:24-43`). axilog carries the full enum, not a bool,
because one downstream rule gates on `StackingConditionalLoss` versus
`Stacking` specifically.

| Stack type | Stacking logic | Simulator |
| --- | --- | --- |
| `Queue` | `QueueLogic` | Duration |
| `Regeneration` | `HealingLogic` | Duration |
| `Force` | `ForceOverrideLogic` (capacity effectively 1) | Duration |
| `Stacking` | `OverrideLogic` | Intensity |
| `StackingUniquePerSrc` | `OverrideLogic` | Intensity |
| `StackingConditionalLoss` | `OverrideLogic` | Intensity |

### Duration (queue) boons — only stack 0 ticks

This is the rule a naive implementation gets wrong. For the ten
duration-type boons, `BuffSimulatorDuration.Update` ticks down **only
`BuffStack[0]`**, the active stack. Every queued stack at index > 0 is
**frozen** — its remaining duration does not decrease — until it is
promoted to index 0 when the active stack expires or is removed. Promotion
is free: the stored value already *is* the remaining duration, so the
promoted stack starts ticking correctly from that instant.

Modelling all held stacks as continuously ticking from their own apply
time — which is the obvious implementation — systematically
**under-reports uptime**, because stacks that should have been waiting
their turn expire in parallel instead.

### Intensity boons — every stack ticks

Might and Stability genuinely tick every held stack down concurrently
(`BuffSimulatorIntensity.Update`). This is also why they are the only two
boons for which an *average stack count* is meaningful, and the only two
that carry `avg_stacks` in the native schema.

### Single-stack removal matching

A `BuffRemove.Single` row names the removed stack by its remaining
duration. GW2EI's `BuffSimulator.Remove` resolves it with a **first-match
linear scan in list order** — not a globally-closest search — accepting
the first held stack whose remaining duration is within a strict `< 15 ms`
tolerance. axilog reproduces the scan and the tolerance, which means each
call site has to hand the stacks over in the order GW2EI's own
`BuffStack` list would be in at that instant.

## The two event-pipeline rules

Before MBUFFSIM, axilog's Stability average stacks carried seven
allowlisted cells and the tolerance sat at 0.05 relative. The
isolate-first diagnosis **overturned the premise**: the simulator was
faithful. The defect was upstream, in which events reached it at all. Two
GW2EI rules were missing, both now ported clause-exact.

### 1. Natural expiry is not a strip

`BuffRemoveSingleEvent.OverstackOrNaturalEnd` marks a removal row that is
arcdps *reporting* an expiry the simulator already models. GW2EI never
feeds those to a simulator. axilog was replaying them as real removals,
so a stack was being taken twice.

### 2. The `StackingConditionalLoss` `RemovedDuration` band aid

GW2EI's own comment calls it a *"band aid for the stack type situation
with fake inactive/infinite durations"* (`BuffsContainer.cs:196-252`).
On a `StackingConditionalLoss` strip, arcdps sometimes reports the stack's
**original applied** duration in `value` instead of its **remaining**
duration. The 15 ms matcher above then matches nothing, the stack is never
removed, and Stability sits systematically high. GW2EI detects the case —
the reported value equals the stack's reconstructed total, walked forward
across extensions and stack-active rows — and rewrites the value to the
remaining duration *before* any simulator runs.

The whole clause chain is transcribed, including its preconditions
(`HasStackIDs`, the per-buff qualifying-removal test, the per-`To` and
per-`BuffInstance` grouping, and the `Math.Max(x, 0)` clamp). One
deviation is documented rather than hidden: GW2EI runs this over extension
events whose duration has already been rewritten by
`CombatData.OffsetBuffExtensionEvents`, and axilog consumes the raw value
because that offset is a separately ledgered deferral. It can only matter
for a removal whose reconstruction crosses an extension event — five for
Stability across the whole reference capture — and the calibration below
was measured *with* the deviation in place, so it is bounded rather than
argued.

**Measured:** 181 of Stability's 253 real single removals hit the rewrite;
the mean per-account average-stack error against GW2EI dropped from
`0.04124` to `0.00027`.

**Result:** the Stability allowlist went 7 → **0**, and the average-stack
tolerance was tightened 10× (0.05 → 0.005) with the worst remaining cell
about 9× inside it. The old bound had sat ~90× above the true worst cell,
which is how the defect survived two milestones.

## Era gating

arcdps changed the wire shape of buff apply/remove around build
`20260501` (GW2EI's `BuffAppliesAndRemovesAsStateChanges` /
`ResultEnumRework` threshold).

| Era | Apply / remove arrive as |
| --- | --- |
| Pre-`20260501` | Ordinary `is_statechange == 0` combat events, flagged by `buff` / `is_buffremove` |
| `≥ 20260501` | Dedicated `BUFF_APPLY`, `BUFF_CHANGE`, `BUFF_REMOVE_SINGLE`, `BUFF_REMOVE_ALL` statechanges |

The extractor dispatches on the header build; both branches produce the
identical event shape, so the simulator, uptime and generation passes work
unchanged either way. Each pre-era test has a post-era twin asserting
identical output from the other wire shape.

One field-role subtlety that catches reimplementations: on a **removal**
event the roles are reversed relative to an apply. GW2EI's
`AbstractBuffRemoveEvent` constructor reads the remover from `dst_agent`
and the buff *owner* from `src_agent`.

## Generation attribution

Generation answers "how much of this boon time did *I* put there", and
GW2EI computes three different views of it depending on which JSON array
the number lands in (`Player.ComputeBuffs`):

| Array | Question |
| --- | --- |
| `selfBuffs` | Of the boon time **I held**, how much did I generate for myself. |
| `groupBuffs` | Averaged over every **other player in my subgroup**: how much boon time did I generate for them. |
| `squadBuffs` | The same average over the **whole squad** except me. |

All three reduce to `BuffDistribution.GetGeneration(buffID, srcAgent)`,
populated per `(target, source)` pair by each simulation segment. For a
duration boon only the segment's **active** stack contributes — exactly
the source occupying the ticking slot. For an intensity boon **every**
concurrently-held stack contributes its own held duration to its own
source.

The denominator is the log's absolute `[start, end)` window, never
per-player-active-clamped for these arrays. Scale matches uptime exactly:
duration boons are a genuine 0–100 percentage; intensity boons are a raw
average-concurrent-stack count.

Generation runs the same two tick models over the same events as uptime —
and since MPERF, over one shared buff extraction rather than two, so the
two can never describe different event streams.

## Waste

Waste is boon time a source generated that was **destroyed before the
target could spend it**. Three GW2EI sites produce it, all transcribed:

1. capacity eviction (`FindLowestValue`),
2. `Remove.Single` on the matched stack,
3. `Remove.All` on every held stack.

The credited amount is the victim stack's current remaining duration,
charged against its own source. Waste and generation come out of **one
pass**, and roll up self/group/squad through the identical scaling —
verified, not assumed: `BuffStatistics` treats the two the same way in
both `GetBuffsForPlayers` (`:116-141`) and `GetBuffsForSelf` (`:190-216`).

A scoping measurement shaped the design. The obvious prerequisite was
modelling `BuffStackItem.Extensions`; measured first, extension events are
**0 of 11,359** boon events on the committed fixture and **160 of 68,593
(0.23%)** on the reference capture, while the sites that actually produce
waste need only the per-stack source the segment simulators already track.
So extensions are folded, with a bounded consequence recorded: for a stack
both extended and later wasted, the extension's share lands on the applier
rather than the extender — an attribution split *within* one stack, never
a change to total waste, capped at ≤ 160 stacks.

**Calibration:** 1,022 cells across 44 players and all three scopes, worst
non-Regeneration cell **0.163 pp**, nearly all inside EI's own 0.0005
rounding floor.

### The waste-only source

One adapter bug is worth recording because of how it was found. The
generation arrays were filtered on `generation > 0`, which silently
dropped a **waste-only** source — one whose every stack was overwritten or
stripped before it held any time — despite that source now having a real
number to report. EI emits those rows: `hasGeneration` is bare key
presence on the per-buff distribution dictionary, and `AddWaste` inserts
an entry with `Value == 0, Waste == value` for an unseen source. The
filter is now `generation > 0 || wasted > 0`.

The original calibration missed it because it read the simulation output
directly and was structurally blind to the adapter. The replacement test
joins through the **serialized document** instead. On the committed
fixture the fix emits 9 previously-missing cells (largest: an Aegis
`groupBuffs` waste of 18.247); against the reference export, 428 of 431
non-zero-`wasted` EI rows are now present, up from 419.

## Regeneration and `HealingLogic`

Regeneration is the only buff GW2EI routes to `HealingLogic`
(`BuffSimulator.cs:29-31`), which differs from `QueueLogic` in exactly two
ways:

- **`FindLowestValue`** evicts `stacks.Last()` instead of the
  minimum-total-duration non-active stack. This is the half that does
  work.
- **`Sort`** keeps the list ordered by the source's healing power,
  descending. Implemented — and **provably inert here**: arcdps reports
  healing power `0` for every player agent in both fixtures (74/74 and
  119/119), so all sort keys are equal and a stable sort is a no-op.
  Confirmed end to end: sorting and not sorting give byte-identical
  output. Kept because it is what GW2EI does and a log carrying real
  healing values would need it, but recorded as inert rather than claimed
  as a fix.

`HealingLogic` is implemented in the **generation/waste** segment
simulator. All 75 moved cells were boon 718, all moved *toward* EI, and no
presence or average-stack cell moved at all:

| Error vs the reference export | mean | max |
| --- | --- | --- |
| `selfBuffs` generation | 2.729 → **1.796** | 20.97 → **8.99** |
| `groupBuffs` generation | 3.161 → **2.053** | 11.20 → **7.24** |
| `squadBuffs` generation | 0.614 → **0.495** | 4.81 → **3.67** |
| `selfBuffs` waste | 0.317 → **0.176** | 21.57 → **10.94** |
| `groupBuffs` waste | 0.406 → **0.242** | 13.79 → **9.02** |

The remaining Regeneration waste peak of 10.94 pp is held by an explicit
bound with its cause named rather than a tolerance to quietly widen:
`BuffStackActiveEvent.IsBuffSimulatorCompliant` (`:12-15`) admits
stack-active events in NoID mode for Regeneration **alone**, and
`BuffDictionary.AddRegen` (`:98-119`) threads them into an overridden
regen duration that `HealingLogic.FindLowestValue` prefers over
`stacks.Last()`. Both need per-stack instance ids the pipeline does not
carry. That is a milestone, not a tweak.

Regeneration's **uptime** simulation is still the plain queue model. Its
measured cost is a mean of 0.0060 pp and a per-account max of 0.037 pp
against EI's own `buffUptimes` — 54× inside the tolerance, and ledgered.

## GW2EI-shape state timelines

`buffUptimes[].states` and `.statesPerSource` are GW2EI's transition-point
step function (`JsonBuffsUptimeBuilder.cs:55-76`). All three of its
behaviours are reproduced: the mandatory leading `[0, 0]`,
`StateGraph.FuseSegments`, and **duration boons clamped to 0/1** — GW2EI
reports the single active stack, not the queue depth.

`statesPerSource` needed real per-source stack ownership, so the
generation simulators emit `HeldSegment { source, start, end }` and the
generated-milliseconds map is literally a sum over them. A source's
timeline and its `squadBuffs` number therefore cannot describe different
simulations.

Both ride `--timeseries`, which is GW2EI's own `RawFormatTimelineArrays`
gate. Calibration **samples both step functions on a 1 s grid** rather
than diffing transition lists, because the two simulators legitimately
fuse differently while meaning the same function: **169,614 instants over
486 timelines, 83 differ (0.05%)**, worst 13 stacks instantaneous /
0.052 time-averaged, and **397 of 398 duration-boon timelines are
sample-for-sample exact**.

`boonsStates` — GW2EI's `[[time, number of boons present]]` — is a
reduction of those same timelines, each clamped to presence (a 25-stack
Might counts once) and summed. It is calibrated on the one scalar its
consumer derives from it, `boonsAppliedCount`: **43 of 44 accounts exact**,
worst 4 of 101.

## Enemy-side condition timelines

`targets[].buffs[]` is scoped to the **fourteen conditions** and
`statesPerSource` only. Those conditions come from the same catalog the
damage classifier uses — see
[condition classification](/axilog/methodology/#condition-classification)
— extended with the display name and stack type a simulation needs but a
damage predicate does not. Five are intensity-typed (Bleeding, Burning,
Confusion, Poison, Torment at capacity 1500; Vulnerability at 25) and
eight are queue-typed; none is `StackingConditionalLoss` or
`Regeneration`, so neither special case above arises.

Over **1,299 (enemy, condition, squad-source) keys the two
implementations agree on 0 missing and 0 extra**, with 0.09% of 453,351
sampled instants differing.

## Headline calibration

| Metric | Result |
| --- | --- |
| Boon presence %, duration-type | 0 of 370 cells over tolerance on the committed fixture; the bound is now **0.05 pp**, 100× above EI's own 0.0005 serialization floor |
| Boon presence %, intensity-type | 0 of 74 cells over tolerance; worst 0.000496 pp (Might), 0.000487 pp (Stability) |
| Average stacks (Might, Stability) | **74/74 inside a 0.5% relative bar, no allowlist**; worst cell 0.000558 |
| Generation (self/group/squad) | 148 cells, worst delta 0.097 pp against a 2 pp bar, no allowlist |
| Post-era presence, 44 accounts | mean 0.0002–0.0003 pp for nine of ten duration boons; Regeneration mean 0.0060 pp / max 0.037 pp |

The 0.05 pp presence bound is worth one sentence of explanation, because
it is a *floor*, not a residual: `BuffStatistics` rounds every emitted
number through `Math.Round(x, 3)`, whose maximum representation error is
exactly 0.0005. All 444 cells already agree with EI to the full precision
EI emits. The bound sits at 100× that floor rather than clamped to the
measurement, because presence is a step-function boundary quantity and a
differently-paced log could legitimately land further out.

## See also

- [Calculation methodology](/axilog/methodology/) — the surrounding
  derivations.
- [Damage modifiers](/axilog/damage-modifiers/) — the largest consumer of
  these timelines.
- [Boons, buffs & uptime](/guides/boons-and-buffs/) — the raw-event view.
- [Output schema](/axilog/schema/#players) — `boons[]` and the EI-compat
  `buffUptimes` / `selfBuffs` / `groupBuffs` / `squadBuffs` arrays.
