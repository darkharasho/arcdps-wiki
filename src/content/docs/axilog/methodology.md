---
title: axilog calculation methodology
description: How axilog derives each metric from the raw EVTC stream — damage and pet folding, the orphaned-instid repair, arcdps down contribution, CC, condition classification, rotation and cast tracking — and what each rule is grounded in.
source: community
---

This page documents how [axilog](/axilog/) turns a raw EVTC event stream
into numbers, and — more importantly — *why each rule is the right one*.
It is a distillation; the crate module docs in the
[axilog repository](https://github.com/darkharasho/axilog) carry the
line-level citations.

Three subsystems are large enough to have their own pages, and this one
only summarises them:

- [Damage modifiers](/axilog/damage-modifiers/) — the 205-definition
  catalog and the attribution engine.
- [Buffs & boons](/axilog/buffs/) — the stack simulation, generation and
  waste.
- [Combat replay](/axilog/combat-replay/) — both engines, the polling grid
  and the map geometry.

## What the rules are grounded in

Three sources, in a deliberate order of authority:

| Source | Used for |
| --- | --- |
| Methodology relayed directly from the arcdps developer | The contribution family, and any place the wire format's intent isn't recoverable from the bytes. Authoritative where it applies. |
| [GW2 Elite Insights](https://github.com/baaron4/GW2-Elite-Insights-Parser) source | The arbiter for ambiguous field roles and for every algorithm that has to match EI's output. Read at a pinned commit, cited by file and method. |
| The arcdps EVTC reference, hand-counted | Enum ordinals and payload layouts. |

That last row is not pedantry. The published EVTC README is known to
contain errors — its `CBTS_HEALTHPCTUPDATE` note says
"percent \* 10000 eg. 99.5% will be 9950", which is self-contradictory
(the real scale is percent × 100, as its own worked example shows and as
EI's `HealthUpdateEvent` confirms). So enum ordinals are hand-counted from
the live reference rather than taken from memory or a third-party
writeup, and cross-checked against EI's `ArcDPSEnums` values.

## Decode: the orphaned-instid repair

Before any analysis runs, one repair pass rewrites the event stream.

arcdps sometimes emits combat rows whose `src_agent`/`dst_agent` is `0`
while the matching instid field still names a live agent — observed on the
reference capture on an enemy ranger pet's rows. Every address-keyed pass
in axilog (damage, hit stats, defenses, skill damage, contribution) would
silently drop those rows. GW2EI does not: it rewrites the address from the
instid inside the parser, before analysis. axilog performs the same
repair, transcribed from `EvtcParser.CompleteAgents` and run as a decode
post-pass, so every consumer — metrics, the standalone replay/missile
builders, the SDKs, the EI exporter — reads one repaired stream.

Two honesty notes travel with it:

- **The `±300 ms` bound is two probe points, not a widened window.** GW2EI
  accepts a candidate agent when
  `InAwareTimes(t − 300) || InAwareTimes(t + 300)`, so an agent whose
  entire aware window lies strictly inside `(t−300, t+300)` — one alive
  for under 600 ms around the orphaned row — fails *both* probes and is
  rejected. axilog reproduces that literally rather than "fixing" it, and
  has a unit test that a widened-window implementation would fail.
- **Roughly a third of orphans stay unrepaired, and that is correct.** On
  the real 583k-event capture, 725 of 1,091 orphaned rows are repaired;
  the bulk of the remainder are `CBTS_DESPAWN` rows whose instid names no
  agent that was aware anywhere near them. A row with no qualifying
  candidate keeps its zero address and is dropped downstream, exactly as
  GW2EI leaves it.

On the committed fixture the repair rewrites 43 rows and moves **no**
output value; on the post-rework capture it moves one account's always-on
damage and hit-stat scalars onto GW2EI's values exactly. Cost: one extra
bounded scan, +9.4% on that stage and +4.2% end to end on the fixture.

## Damage accumulation and pet folding

The filter itself is the standard one — strike damage from `value` where
`buff == 0` and `result` ∈ {`NORMAL`, `CRIT`, `GLANCE`}, buff damage from
`buff_dmg` where `buff == 1`, with `CROWD_CONTROL` (12) and
`DEFIANCE_DAMAGENORMAL` (10) rows excluded because they reuse the damage
fields to carry a CC duration or defiance-bar damage. See
[reading damage](/guides/reading-damage/) for the raw-event view.

The interesting part is **ownership**. Minion, pet and turret damage
belongs to the master, which means resolving `src_master_instid` to an
agent — and arcdps *recycles instids* after an agent despawns. A single
log-wide last-write-wins map is wrong: if instid 42 is player A's pet
early in the fight and player B's pet later, that map credits every
instid-42 event to B, including the ones that happened while A owned it.

axilog instead keeps an **instid registry**: every `(time, addr)`
registration observed for each instid, in event order, resolved at the
querying event's own timestamp to whichever registration was in effect
then. Where no registration exists at or before that time, resolution
fails and the event is left uncredited rather than guessed. The same
registry backs damage, CC, boon-event attribution, healing-extension rows,
contribution and the exported `instanceID` fields, so all of them agree
with each other.

Two details worth knowing: arcdps extension rows
(`CBTS_EXTENSION`/`CBTS_EXTENSIONCOMBAT`) do **not** contribute
registrations — their `src_agent`/`dst_agent` fields are not trustworthy —
but they are still *resolvable* against ordinary registrations, which is
exactly what the healing extension needs. And the registry is built once
per log and threaded by reference through every consumer; it used to be
rebuilt 11 times per parse, and fixing that was the single largest
performance win in the project.

Not every surface folds minions. GW2EI is inconsistent here on purpose,
and axilog reproduces the inconsistency rather than normalising it:
`statsAll[0]` and the player damage distributions are **actor-only**,
while `statsTargets[i][0].killed`/`downed`/`interrupts` and an enemy's own
`dpsAll[0]` are **minion-inclusive** — GW2EI's `HasInterrupted`/`HasKilled`/
`HasDowned` branches sit *outside* its actor guard over a minion-inclusive
event list, so a pet's finishing blow counts for its owner. Ownership is
resolved as an agent-level fact rather than per row, because arcdps emits
many minion rows with `src_master_instid == 0`.

## The arcdps down-contribution family

This is axilog's founding differentiator, and the one place it is
deliberately *not* calibrated against EI: EI's own `downContribution` uses
a different algorithm by design, so there is no golden to match. The
implementation follows the dev-relayed arcdps methodology, verified by
unit tests per documented nuance plus real-log sanity checks.

### The window

On a downing blow against a player (an ordinary combat event with
`result == DOWNED`), contribution is credited over:

```text
[ max( anchor(target) − 2000ms,
       log_start,
       previous_reset(target) ),
  down_time ]
```

- `anchor(target)` is the last time that target was at or above 99%
  health, decoded from `CBTS_HEALTHPCTUPDATE` into a per-agent step
  series. Health-anchoring is the point: the window covers *the burst that
  actually took them down*, not a fixed lookback that either misses a long
  grind or over-credits a fresh arrival.
- If the target was never seen at ≥99%, the anchor is treated as log
  start.
- After a down is processed, `previous_reset(target)` becomes
  `down_time + 2100ms`. That is the downstate-invulnerability guard: a
  second down of the same target cannot attribute back into the prior
  burst or the invulnerability window.
- **Both bounds are inclusive.** The upper bound must be — the downing
  blow's own damage has to be creditable. The lower bound is inclusive so
  that the very first event of a log is creditable when a window's floor
  lands exactly on log start.

Downs are processed in time order over the whole log with one global reset
map keyed by target, which correctly serialises same-target dependencies
while leaving different targets independent. Since MPERF the window is
binary-searched out of one sorted index rather than rescanning the whole
event list per down.

### Credit resolution

Every credit resolves its contributor through the same time-aware instid
registry as damage, plus an **id-consistency guard** unique to this
engine: the event's `*_instid` must resolve, at the event's own time, to
the same raw address the event's `*_agent` field already claims. If the
registry has no registration yet, or resolves to a different address
(instid reuse racing a still-in-flight event), the credit is dropped
rather than guessed. Only then does the contributor fold to its ultimate
master, and only a contributor **not on the target's own side** is
credited.

### The four stats

| Stat | Rule |
| --- | --- |
| `damage` | Sum of health damage into the target in the window — CC rows and defiance-bar rows both excluded, the same predicate ordinary damage accumulation uses. |
| `cc` | +1 per CC application on the target, reusing the era-gated CC predicate rather than re-deriving it. |
| `strips` | +1 per hostile `BUFFREMOVE_ALL` of a boon-category buff off the target, with a carve-out for multi-stack Stability. |
| `movement_impairing` | Impairment amount credited to the impairer, read from a packed instid in a pre-era single-removal row's `overstack` field. |

The defiance-bar exclusion in the first row is recent, and the reasoning is
worth stating because it is *not* a parity argument — there is no EI
golden here. It is causality: this family measures damage that led to a
down, and breakbar damage does not reduce health, so it cannot contribute
to one. Enumerated exposure of the change: zero changed values on the
committed fixture, and exactly two cells on the reference capture (both
`downs_contribution.damage`, both moving down). See
[parity](/axilog/parity/#breakbar-damage-cannot-contribute-to-a-down) for
the sibling site where the same question resolved the *other* way.

Both directions are computed in the same pass: `downs_contribution` (what
a squad player did toward downing an enemy) and `downed_by` (the mirror —
what was done to a squad player before their own down, aggregated onto the
victim's row). The damage half is additionally split per skill id at the
one site that assigns the scalar, so the split sums back to the scalar
exactly.

## CC and stun breaks

A CC application is a non-statechange combat event whose `result` is
`CROWD_CONTROL` (12); `value` carries the CC duration in milliseconds,
unaffected by the buff flag. Counts and durations both roll into
per-player totals and into the per-second timeline.

The subtlety is era gating, and it cuts both ways:

- **Pre-`20260501`, the `buff == 0` check is load-bearing.** On those
  builds, buff rows decode their result byte through the retired
  `ConditionResult` enum, which has no value 12 at all — byte 12 there
  means "unknown", not CC. Without the guard, ordinary boon-stack
  applications (Might, Stability, Fury, Vulnerability, Resolution) collide
  with `CROWD_CONTROL` and produce nonsensical multi-minute "CC
  durations". This was caught against a real fixture, not hypothesised.
- **Post-`20260501`, the check must be dropped.** The post-rework branch
  decodes buff rows through the same shared `DamageResult` enum as direct
  rows, so `buff == 1` rows genuinely can carry CC.

Incoming CC is **not** the outgoing rule mirrored. GW2EI applies two
asymmetries (`SingleActor.cs:935-943`): no source filter, and no minion
fold. Incoming strips likewise apply the credited-by master fold *before*
both the unknown and self tests. Both are reproduced verbatim, and all
four resulting fields are exact on 44/44 post-rework and 37/37 pre-rework
accounts.

Stun breaks come from `CBTS_STUNBREAK`, keyed on `src_agent` — the agent
whose stun broke early — with `value` as the remaining stun duration
removed. Both the count and the removed-stun milliseconds are reported.

Defiance-bar damage dealt is decoded separately, minion-inclusive and
foe-filtered, and converted at the adapter boundary by GW2EI's own rule
(`Math.Round(value / 10.0, 1)`) — which is why the core carries a raw
integer sum.

## Boon simulation, in one paragraph

Boon uptime is a per-`(agent, buff)` stack-count state machine over
apply/remove events, reproducing EI's default "NoID" buff simulator. Two
tick models: intensity boons (Might, Stability) genuinely tick every held
stack down concurrently; duration boons tick **only the active stack at
index 0**, with every queued stack frozen until promoted. Modelling all
stacks as continuously ticking systematically under-reports uptime. Stack
capacity is read from the log's own reported per-buff capacity where the
log carries one, falling back to a transcribed table otherwise. Generation
and waste attribution run the same two models over the same events,
crediting the applying source.

The full treatment — the stacking logics, the two event-pipeline rules
that took the Stability allowlist to zero, the era split, `HealingLogic`,
and the GW2EI-shape state timelines — is on the
[buffs & boons](/axilog/buffs/) page.

## Condition classification

"Which damage rows are condition damage?" is the question behind EI's
`conditionDamageTaken`, `connectedConditionCount` and their power-damage
complements. The obvious answer — *every `buff == 1` hit is a condition* —
is wrong, and measurably so.

EI's actual predicate is `SkillEvent.ConditionDamageBased(log)`, which is a
**pure per-skill-id lookup**: is this row's skill id registered as a
`BuffClassification.Condition` buff? It never consults the row's `buff`
byte, `result` byte, era, or actor.

An exhaustive scan of the EI tree for `BuffClassification.Condition` at a
*construction* site (as opposed to a comparison site) finds exactly one
group: 14 contiguous entries in `CommonBuffs.Conditions`. Notably, the
15th entry in that same list — "Number of Conditions" — is tagged `Other`,
and is excluded. No profession or elite-spec helper registers a
Condition-classified buff. And membership cannot grow at runtime: none of
the 14 carries a build gate, and EI's synthesised unknown-consumable buffs
can only ever be `Nourishment` or `Enhancement`. Two further guarantees
make the set exact rather than approximate — EI's own id grouping *throws*
on a duplicate id, so no other list can shadow a Condition id, and the
debug-only reclassification never touches `Condition`.

The catalog, in ascending id order:

| Ids | Conditions |
| --- | --- |
| 720, 721, 722, 723, 727 | Blind, Crippled, Chilled, Poison, Immobile |
| 736, 737, 738, 742, 791 | Bleeding, Burning, Vulnerability, Weakness, Fear |
| 861, 19426, 26766, 27705 | Confusion, Torment, Slow, Taunt |

So axilog classifies each damage row into **four** buckets rather than
three:

1. direct/power (`buff == 0`),
2. condition (`buff == 1`, skill id in the catalog),
3. life leech (`buff == 1`, a life-leech skill id),
4. **`buff == 1`, uncatalogued, not life leech** — the bucket the naive
   rule silently folded into "condition".

That fourth bucket is not academic. Before the catalog landed, the
approximation diverged from EI by up to **51.4% relative** on
`powerDamageTakenCount` on a real post-era capture, affecting 33 of 44
accounts on the incoming side. It was pure reclassification — total events
conserved, none dropped or added — which is exactly why it went unnoticed
against squad totals. With the catalog, every condition, power and
life-leech field is exact on all 44 joined accounts.

The same fourteen ids, extended with GW2EI's display name and stack type,
drive the enemy-side condition timelines in `targets[].buffs[]`.

## Rotation and cast tracking

Casts are reconstructed from start/end animation rows, again era-split:

- **Pre-era:** ordinary combat events whose `is_activation` is
  `ACTV_START_DEFUNC` (1) or `ACTV_QUICKNESS_DEFUNC` (2) for a start;
  `ACTV_MINIMUM` (3), `ACTV_CANCEL` (4), `ACTV_RESET` (5) or
  `ACTV_NODATA` (6) for an end.
- **Post-era:** the dedicated `ANIMATION_START` (67) / `ANIMATION_STOP`
  (68) statechanges. The end row's `is_activation` byte keeps its ordinary
  meaning here — it is not overloaded away.

Pairing is a per-caster, per-skill, time-ordered state machine mirroring
EI's `CreateAnimatedCastEvent`:

| Situation | Result |
| --- | --- |
| START while a previous START is pending | Flush the pending one as a start-only ("dangling") cast; this becomes the new pending START. |
| END with a START pending | The two pair into one cast. |
| END with no pending START | An end-only cast, backdated to `end − actual_duration`, kept only if that lands before log start (a genuine pre-log cast, whose cast time is negative). |

Field semantics: on a start row, `value` is the duration until the minimum
trigger point and `buff_dmg` the duration until control returns to the
agent; on an end row, `value` is the animation time **scaled for speed**
and `buff_dmg` the unscaled time. From those, `quickness` is the
acceleration ratio between the scaled and unscaled animation times, and
`timeGained` is `max(scaled_expected − actual, 0)` for a normal cast but
`−actual` for a cancelled one (an interrupt loses time rather than gaining
it). Together they are what make cast-time comparisons meaningful across
players running different boon coverage.

Two rounding rules had to be exactly .NET's to make the aggregates exact,
and both were found by measurement rather than reading:

- `(int)Math.Round(ExpectedDuration / ratio)` is .NET's single-argument
  `Math.Round`, which is **ties-to-even**. axilog originally used
  ties-away and documented the divergence as negligible with zero measured
  occurrences — true, but measured only on the smaller fixture. On the
  10,878-cast reference capture midpoints do occur, and `timeSaved` came
  out 1 ms high for 2 of 44 players. With a real ties-to-even round, the
  per-cast `timeGained` delta against EI is **exactly 0** across all
  10,878 local casts and all 1,222 fixture casts.
- `quickness`'s own 3-decimal rounding is deliberately left on ties-away:
  it measures a 0.000000 maximum delta over the same casts, so no midpoint
  is reached, and changing it would be an unmeasured edit to an exact
  surface.

The whole-player aftercast aggregate EI calls `saved` / `timeSaved` /
`wasted` / `timeWasted` is a switch over each cast's status accumulating
its saved duration — both of which this pipeline already had and was
discarding. It does **not** need the instant-cast pipeline, contrary to
the assumption that parked it for two milestones. One filter matters:
GW2EI iterates casts with `Time >= start`, which excludes backdated
pre-log casts; without it, `saved` was exactly +1 for 11 of 44 players.

Cast bucketing is by raw caster address, then folded to the account
representative. The scope gap is documented rather than papered over: this
reproduces the *animated*-cast pipeline only. EI's separate instant-cast
pipeline (weapon swaps, procs, instant-cast mechanics) accounts for
roughly 29% of a real log's cast entries and is not decoded.

## Combat replay, in one paragraph

axilog runs two replay engines over the same events, because the two
output shapes genuinely differ in grid bounds, units, interval semantics
and rounding. The **native** engine emits raw world-unit samples on a
300 ms grid, only where real bracketing position data exists. The
**EI-shape** engine reproduces EI's exported `combatReplayData` in map
pixels on EI's own grid, down to the serialized decimal text — 100%
bit-exact on 50,999 samples once both sides are narrowed to the `f32` EI
writes.

The full treatment — the event filters, the polling grid, the
`PlayerActor` trim override, awareness widening from both sides, the two
`HandlePosition` subtleties, the five-map geometry table and the float
discipline — is on the [combat replay](/axilog/combat-replay/) page.

## Known gaps

Documented rather than faked — where axilog doesn't compute a field, the
`ei-json` output omits it instead of emitting a plausible zero. The full
list, with the intentional divergences alongside, is on the
[parity page](/axilog/parity/); the short version:

- **`wvWMapData` objectives** — only the three team-id fields. EI's
  per-objective capture-ownership timelines are a whole event family
  axilog does not decode yet, and the last whole EI feature surface still
  missing.
- **Instant casts** — ~29% of a real log's cast entries.
- **Skill names and icons** — the log's own skill table is a genuinely
  narrower data source than EI's bundled, API-backed database.
- **Six damage-modifier ids**, each needing an engine feature axilog does
  not have.
- **Shield damage** is not decoded anywhere.

## See also

- [axilog overview](/axilog/) — what it is, architecture, scope.
- [Damage modifiers](/axilog/damage-modifiers/),
  [buffs & boons](/axilog/buffs/), [combat replay](/axilog/combat-replay/)
  — the three deep dives.
- [Reading damage from logs](/guides/reading-damage/)
- [Boons, buffs & uptime](/guides/boons-and-buffs/)
- [WvW downs & deaths](/guides/wvw-downs-deaths/)
- [Movement & effects](/guides/movement-and-effects/)
