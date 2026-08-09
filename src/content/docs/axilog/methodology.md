---
title: axilog calculation methodology
description: How axilog derives each metric from the raw EVTC stream — damage and pet folding, arcdps down contribution, CC, boon simulation, condition classification, rotation, and combat replay — and what each rule is grounded in.
source: community
---

This page documents how [axilog](/axilog/) turns a raw EVTC event stream
into numbers, and — more importantly — *why each rule is the right one*.
It is a distillation; the crate module docs in the
[axilog repository](https://github.com/darkharasho/axilog) carry the
line-level citations.

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
EI's `HealthUpdateEvent` confirms). So enum ordinals are hand-counted
from the live reference rather than taken from memory or a third-party
writeup, and cross-checked against EI's `ArcDPSEnums` values.

## Damage accumulation and pet folding

The filter itself is the standard one — strike damage from `value` where
`buff == 0` and `result` ∈ {`NORMAL`, `CRIT`, `GLANCE`}, buff damage from
`buff_dmg` where `buff == 1`, with `CROWD_CONTROL` (12) and
`DEFIANCE_DAMAGENORMAL` (10) rows excluded because they reuse the damage
fields to carry a CC duration. See
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
registry backs damage, CC, boon-event attribution, healing-extension
rows and contribution, so all of them agree with each other.

Two details worth knowing: arcdps extension rows
(`CBTS_EXTENSION`/`CBTS_EXTENSIONCOMBAT`) do **not** contribute
registrations — their `src_agent`/`dst_agent` fields are not trustworthy
— but they are still *resolvable* against ordinary registrations, which
is exactly what the healing extension needs. And the registry is built
once per log and threaded through every consumer.

## The arcdps down-contribution family

This is axilog's founding differentiator, and the one place it is
deliberately *not* calibrated against EI: EI's own `downContribution`
uses a different algorithm by design, so there is no golden to match.
The implementation follows the dev-relayed arcdps methodology, verified
by unit tests per documented nuance plus real-log sanity checks.

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
  series. Health-anchoring is the point: the window covers *the burst
  that actually took them down*, not a fixed lookback that either misses
  a long grind or over-credits a fresh arrival.
- If the target was never seen at ≥99%, the anchor is treated as log
  start.
- After a down is processed, `previous_reset(target)` becomes
  `down_time + 2100ms`. That is the downstate-invulnerability guard: a
  second down of the same target cannot attribute back into the prior
  burst or the invulnerability window.
- **Both bounds are inclusive.** The upper bound must be — the downing
  blow's own damage has to be creditable. The lower bound is inclusive
  so that the very first event of a log is creditable when a window's
  floor lands exactly on log start.

Downs are processed in time order over the whole log with one global
reset map keyed by target, which correctly serialises same-target
dependencies while leaving different targets independent.

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
| `damage` | Sum of damage into the target in the window, CC rows excluded — the same predicate ordinary damage accumulation uses. |
| `cc` | +1 per CC application on the target, reusing the era-gated CC predicate rather than re-deriving it. |
| `strips` | +1 per hostile `BUFFREMOVE_ALL` of a boon-category buff off the target, with a carve-out for multi-stack Stability. |
| `movement_impairing` | Impairment amount credited to the impairer, read from a packed instid in a pre-era single-removal row's `overstack` field. |

Both directions are computed in the same pass: `downs_contribution`
(what a squad player did toward downing an enemy) and `downed_by` (the
mirror — what was done to a squad player before their own down,
aggregated onto the victim's row).

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
  applications (Might, Stability, Fury, Vulnerability, Resolution)
  collide with `CROWD_CONTROL` and produce nonsensical multi-minute "CC
  durations". This was caught against a real fixture, not hypothesised.
- **Post-`20260501`, the check must be dropped.** The post-rework branch
  decodes buff rows through the same shared `DamageResult` enum as direct
  rows, so `buff == 1` rows genuinely can carry CC.

Stun breaks come from `CBTS_STUNBREAK`, keyed on `src_agent` — the agent
whose stun broke early — with `value` as the remaining stun duration
removed. Both the count and the removed-stun milliseconds are reported.

## Boon simulation

Boon uptime is not a matter of summing durations; it is a per-(agent,
buff) stack-count state machine over apply/remove events, reproducing
EI's default "NoID" buff simulator. Two tick models, and getting this
wrong is the classic source of inflated uptimes:

- **Intensity-type** boons (Might, Stability — `BuffStackType.Stacking`
  and `StackingConditionalLoss`) genuinely tick every held stack down
  concurrently.
- **Duration-type / queue** boons (the other ten) do not. Only the active
  stack at index 0 ticks; every queued stack is **frozen** — its
  remaining duration does not decrease — until it is promoted to index 0
  when the active stack expires or is removed. Modelling all stacks as
  continuously ticking, as a naive implementation does, systematically
  under-reports uptime.

**Stack capacity** is read from the log's own reported per-buff capacity
where the log carries one, falling back to a hardcoded table only when
it doesn't. This matters for buffs whose real capacity is far above the
5–9 the table assumes.

**Era gating.** Pre-rework logs carry apply/remove as ordinary combat
events; post-rework logs carry them as `BUFF_APPLY`, `BUFF_CHANGE`,
`BUFF_REMOVE_SINGLE` and `BUFF_REMOVE_ALL` statechanges. The extractor
dispatches on the header build; each pre-era test has a post-era twin
producing identical output from the other wire shape.

Generation attribution (self/group/squad) runs the same two tick models
over the same events, crediting the applying agent.

One honest caveat: EI types Stability as `StackingConditionalLoss` (it
loses a stack instead of being CC'd) while Might is plain `Stacking`, but
EI's own current simulator source has no branch that distinguishes them.
A small number of Stability average-stack cells diverge; they are
allowlisted with the trace rather than guessed at.

## Condition classification

"Which damage rows are condition damage?" is the question behind EI's
`conditionDamageTaken`, `connectedConditionCount` and their power-damage
complements. The obvious answer — *every `buff == 1` hit is a condition*
— is wrong, and measurably so.

EI's actual predicate is `SkillEvent.ConditionDamageBased(log)`, which is
a **pure per-skill-id lookup**: is this row's skill id registered as a
`BuffClassification.Condition` buff? It never consults the row's `buff`
byte, `result` byte, era, or actor.

An exhaustive scan of the EI tree for `BuffClassification.Condition` at a
*construction* site (as opposed to a comparison site) finds exactly one
group: 14 contiguous entries in `CommonBuffs.Conditions`. Notably, the
15th entry in that same list — "Number of Conditions" — is tagged
`Other`, and is excluded. No profession or elite-spec helper registers a
Condition-classified buff. And membership can't grow at runtime: none of
the 14 carries a build gate, and EI's synthesised unknown-consumable
buffs can only ever be `Nourishment` or `Enhancement`.

So axilog carries the exact 14-id catalog, and classifies each damage row
into **four** buckets rather than three:

1. direct/power (`buff == 0`),
2. condition (`buff == 1`, skill id in the catalog),
3. life leech (`buff == 1`, a life-leech skill id),
4. **`buff == 1`, uncatalogued, not life leech** — the bucket the naive
   rule silently folded into "condition".

That fourth bucket is not academic. Before the catalog landed, the
approximation diverged from EI by up to **51.4% relative** on
`powerDamageTakenCount` on a real post-era capture, affecting 33 of 44
accounts on the incoming side. It was pure reclassification — total
events conserved, none dropped or added — which is exactly why it went
unnoticed against squad totals. With the catalog, every condition, power
and life-leech field is exact on all 44 joined accounts.

## Rotation and cast tracking

Casts are reconstructed from start/end animation rows, again era-split:

- **Pre-era:** ordinary combat events whose `is_activation` is
  `ACTV_START_DEFUNC` (1) or `ACTV_QUICKNESS_DEFUNC` (2) for a start;
  `ACTV_MINIMUM` (3), `ACTV_CANCEL` (4), `ACTV_RESET` (5) or
  `ACTV_NODATA` (6) for an end.
- **Post-era:** the dedicated `ANIMATION_START` (67) / `ANIMATION_STOP`
  (68) statechanges. The end row's `is_activation` byte keeps its
  ordinary meaning here — it is not overloaded away.

Pairing is a per-caster, per-skill, time-ordered state machine mirroring
EI's `CreateAnimatedCastEvent`:

| Situation | Result |
| --- | --- |
| START while a previous START is pending | Flush the pending one as a start-only ("dangling") cast; this becomes the new pending START. |
| END with a START pending | The two pair into one cast. |
| END with no pending START | An end-only cast, backdated to `end − actual_duration`, kept only if that lands before log start (a genuine pre-log cast, whose cast time is negative). |

Field semantics: on a start row, `value` is the duration until the
minimum trigger point and `buff_dmg` the duration until control returns
to the agent; on an end row, `value` is the animation time **scaled for
speed** and `buff_dmg` the unscaled time. From those, `quickness` is the
acceleration ratio between the scaled and unscaled animation times, and
`timeGained` is `max(scaled_expected − actual, 0)` for a normal cast but
`−actual` for a cancelled one (an interrupt loses time rather than
gaining it). Together they are what make cast-time comparisons
meaningful across players running different boon coverage.

Cast bucketing is by raw caster address, then folded to the account
representative. The scope gap is documented rather than papered over:
this reproduces the *animated*-cast pipeline only. EI's separate
instant-cast pipeline (weapon swaps, procs, instant-cast mechanics)
accounts for roughly 29% of a real log's cast entries and is not decoded.

## Combat replay

axilog has two replay engines over the same events, because the two
output shapes genuinely differ in grid bounds, units, interval semantics
and rounding — reshaping one into the other would be wrong.

**Native replay** emits raw world-unit samples on a 300 ms grid, only
where real bracketing position data exists, with half-open down/dead
intervals. It drives the HTML report's animated replay tab.

**EI-shape replay** reproduces EI's exported `combatReplayData` exactly.
The pieces:

- **Which events feed it.** Position points are dropped when all three
  components are exactly zero, when any is NaN/infinite, or when the XY
  length exceeds 40,000 (outside any real map). Facing and velocity
  points are dropped only on NaN/infinity — a *zero velocity is kept*,
  and is load-bearing below.
- **The grid.** EI polls at a compile-time constant 300 ms over the whole
  log, then trims per actor. For players the trim window spans down and
  dead time, not just active segments — otherwise a player downed at *D*
  and never revived would have their track truncated at *D*.
- **Awareness.** First/last-aware are widened from **both** the source
  and destination side of every combat item, so a player who is damaged
  before their own first outgoing event has a correspondingly wider
  window. Keying off `src_agent` alone understates it.
- **The two subtleties that decide accuracy.** First, at each grid point
  EI interpolates from the **previously polled point** when that is later
  than the current raw sample — not from the raw sample itself. While a
  bracketing segment is unchanged the two are algebraically identical,
  but after a hold they are not: the track eases out of where it was
  frozen instead of snapping back onto the raw segment. Second, the
  **velocity-gated hold branch**: when the next raw position is more than
  600 ms away *and* the most recent velocity sample is ~zero, EI refuses
  to interpolate and freezes the actor in place. That is the "player
  stood still, arcdps stopped emitting positions" case; interpolating
  across it drags the icon smoothly toward somewhere it actually
  teleported to. Getting both right is the entire difference between
  99.77% and 100% agreement with EI's export.
- **World → map pixel.** Positions are normalised into the map's
  rectangle, scaled to an image whose maximum dimension is 750 px, with
  the Y axis flipped, and rounded to 3 decimals — specifically C#'s
  round-half-to-even, then narrowed to `f32`, because EI serialises
  single-precision floats and the emitted decimal *text* has to match.
- **Orientations** are `−round(degrees(atan2(y, x)), 3)`: the leading
  minus because screen-space Y grows downward, and the negation applied
  after rounding.

Calibration against a real post-era capture: 50,999 of 50,999 position
samples bit-exact once both sides are narrowed to `f32`, and the same for
orientations; `start`, `end`, `dc`, `down` and `dead` exact for all 44
joined players.

## Known gaps

Documented rather than faked — where axilog doesn't compute a field, the
`ei-json` output omits it instead of emitting a plausible zero.

- **Damage modifiers.** Trait/sigil/food/rune modifier attribution
  (`damageModifiers`, `incomingDamageModifiers`) is not implemented; it
  is the next planned milestone.
- **`wvWMapData` objectives.** Only the three team-id fields are emitted.
  EI additionally carries per-objective capture-ownership timelines for
  every Camp/Tower/Keep — a whole event family axilog does not decode
  yet.
- **Skill names and icons.** `skillMap` is built from the log's *own*
  skill table, scoped to the ids squad players actually touch. EI
  supplements this with a bundled, GW2-API-backed skill database that
  supplies disambiguated names, icon URLs and per-skill classifier flags
  (`isInstantCast`, `isTraitProc`, and friends). Those are a genuinely
  different data source, so names are spot-checked rather than
  calibrated, and the flags that need the API are omitted. `canCrit` and
  a narrower `isSwap` are computed from the id alone and match EI on
  every overlapping id.
- **Post-era boon calibration.** Post-rework boon, generation and support
  extraction is implemented and era-gated, and verified by construction
  against EI source plus synthetic era-equivalence tests — but not yet
  calibrated against a real post-rework dps.report export.

## See also

- [axilog overview](/axilog/) — what it is, architecture, scope.
- [Reading damage from logs](/guides/reading-damage/)
- [Boons, buffs & uptime](/guides/boons-and-buffs/)
- [WvW downs & deaths](/guides/wvw-downs-deaths/)
- [Movement & effects](/guides/movement-and-effects/)
