---
title: axilog parity & divergences vs EI
description: The definitive list of where axilog deliberately does not reproduce Elite Insights — three verified EI bugs it declines to copy, the arcdps-methodology contribution family, the curated target roster, and the fields it omits rather than fakes.
source: community
---

[axilog](/axilog/) treats Elite Insights as the arbiter for every
algorithm that has to match EI's output. This page is the complete list of
places where it *deliberately does not*, and why each one is a decision
rather than a defect.

Three rules generate almost every entry below:

1. **Only emit what is backed by a real computed metric.** Where EI has a
   field axilog does not compute, the key is *omitted* — never emitted as
   a plausible zero. Each omission is documented inline in the adapter
   source.
2. **Match EI's shape exactly where it is emitted**, including
   phase-wrapping conventions and, for replay, the serialized decimal
   *text* — EI writes C# `float`s, so matching the value is not enough.
3. **Where EI is verifiably wrong, emit the correct value** and document
   the divergence, rather than reproducing the bug for the sake of a
   matching number.

## Verified EI bugs axilog does not reproduce

### `lifeLeechDamageTakenCount` is never incremented

EI's defenses constructor increments `LifeLeechDamageTaken` **twice** in
the life-leech branch — once correctly by the damage, and once by one,
which was plainly meant to be `LifeLeechDamageTakenCount++`. The sibling
count field is therefore never touched at all.

Confirmed against the golden two independent ways: the field reads `0` for
all 41 players, including several with a substantial nonzero
`lifeLeechDamageTaken`; and the reported sum is consistently
`[true sum] + [true count]`, exactly the double increment's algebraic
signature, cross-checked against the
`powerDamageTaken − strikeDamageTaken` gap.

axilog emits the true derived count.

### `boonStripsTime`, both directions

`DefensePerTargetStatistics.cs:63` reads
`Math.Max(current + duration, LogDuration)` where `Min` was clearly
intended, so EI's exported number is essentially
`distinct_boons_stripped × logDuration`. The outgoing twin,
`SupportPerAllyStatistics.cs`, accumulates
`Math.Max(foeTime + RemovedDuration, LogDuration)` per boon and has the
same bug.

axilog emits the **true sum** on both. The calibration joins the reference
by *reconstructing* EI's formula from axilog's own per-boon detail —
exact on 44/44 accounts, with `boonStrips` counts themselves exact.

Worth noting for consumers: axibridge already clamps this field to 0 above
999,999, a guard that fires on either side's number when a log carries a
boon with a near-permanent remaining duration.

### The trailing default combat-replay sample

On any log whose duration is a whole multiple of the 300 ms polling rate,
EI's pre-sized position array keeps one unwritten slot holding C#'s
default zero `Vector3`, which can survive `Trim` and push a track's last
timestamp past the actor's own `end`. axilog's loop has no pre-sized slot
to leave stale. Full mechanics on the
[combat replay](/axilog/combat-replay/#where-ei-is-wrong-the-trailing-default-sample)
page.

## Deliberate methodology divergences

### The down-contribution family

This is axilog's founding differentiator and the one place it is
deliberately *not* calibrated against EI, because EI's own
`downContribution` uses a different algorithm by design — there is no
golden to match.

| | EI | axilog |
| --- | --- | --- |
| Window | 90%-health-to-downstate (`OffensiveStatistics.cs:81-108`) | Health-anchored: `max(last-≥99%-health − 2000 ms, log start, prev-down + 2100 ms)` to the downing blow, both bounds inclusive |
| Stats | One number | Four — damage, CC, boon strips, movement impairment |
| Direction | Outgoing | Both: `downs_contribution` and `downed_by` |

The methodology is the one relayed directly from the arcdps developer,
verified by unit tests per documented nuance plus real-log sanity checks.
That is a weaker guarantee than everything else in the project, and it is
stated as such. Derivation on the
[methodology](/axilog/methodology/#the-arcdps-down-contribution-family)
page.

The divergence propagates wherever EI surfaces the number:
`statsAll[0].downContribution`, `statsTargets[i][0].downContribution`, and
— since the per-skill split landed — `totalDamageDist[][].downContribution`
too. The per-skill split is accumulated at the one site that assigns the
scalar, so it **sums back to `statsAll[0].downContribution` exactly, per
player** (asserted). Measured overlap against GW2EI's own algorithm,
stated as a measurement and not a parity claim: **344 skills both credit
(114 identically), 53 only here, 36 only there.**

### Breakbar damage cannot contribute to a down

Two sites in axilog counted `DamageResult.BreakbarDamage` (result 10) as
damage where every health-damage total excludes it. They resolved
**differently**, and the difference is the finding — "countable damage" is
not one question.

**Closed** — the contribution window now applies the health-damage
predicate. The deciding argument is not EI parity (there is no EI golden
here, by design) but causality: this family measures damage that *led to*
a down, and defiance-bar damage does not reduce health, so it cannot
contribute to one. Counting it credited players for downs their damage
could not physically have caused.

Enumerated exposure, from a full output diff: **zero changed values** on
the committed fixture, and exactly **two cells** on the reference capture
— both `downs_contribution.damage`, 146,331 → 144,331 and 3,864 → 2,864.
Both move down, which is the intended direction.

**Kept** — the combat-participant enemy filter. Measured the same way:
zero changed bytes on both fixtures. No measurement discriminates, which
leaves the semantic argument, and it favours keeping: that set answers
"did the squad interact with this agent at all", and a defiance-bar hit is
interaction.

### CC over time, and the whole-log timeline

CC applications and durations are tracked as real `CROWD_CONTROL`-result
events with era-correct decoding, and land in a per-second timeline
alongside damage and downs. EI's JSON has no comparable whole-log series
for WvW, so `timeline.per_second` is native-only rather than a divergence
— but it is one of the reasons the project exists.

## Roster and index-space differences

### The enemy roster

`ei-json`'s `targets[]` is **not** every enemy agent the log enumerated.
It reproduces GW2EI's own WvW rule (`WvWLogic.cs:325-375`): only agents of
type `NonSquadPlayer`, split by friendliness, with same-`InstID` agents
regrouped first (`AgentManipulationHelper.cs:467-474`).

Two milestones got it there:

- **MROSTER** curated the roster from every enemy agent — 624 on the
  reference capture — to the enemy-player rule, leaving 71.
- **MINSTID** added the instid regroup. The previous dedupe keyed on
  *account*, which WvW anonymisation leaves empty for enemies, so it was a
  no-op for them and 13 instids carried two agent rows each. Keying on
  instid took native `enemies[]` 140 → 125 rows (71 → 56 enemy players)
  and `ei-json` `targets[]` 71 → **56, set-equal to GW2EI's 56
  enemy-player instids**.

Every merged row was verified to be the sum or union of its parts:
per-target scalars conserve, `killed`/`downed` OR, damage-modifier
numerators add while denominators become target-wide, skill distributions
fold with sum/min/max. The only non-additive movements are ±1 `dps`
rounding on 16 cells and one `min` where a part row's
no-connected-hits zero dropped out — which now matches the reference.

**The one remaining delta is EI's 57th target**, a synthetic
`Dummy PvP Agent` aggregate (`WvWLogic.cs:307`) and the only row for which
EI sets `isFake: true`. axilog does not synthesize it: its numbers would
be a re-derived sum of the real rows, and every known consumer discards
it. So `targets[]` and the nine arrays positionally joined to it are not
blindly index-interchangeable with a real EI export — but they now list
the same actors at the same granularity, and the calibrations join on
arcdps agent identity instead of index.

The native `enemies[]` list is a **different, independent filter** over
the same enemy set: combat participants only — an enemy is kept if it
exchanged damage or CC with the squad, or is an enemy player. A real WvW
log enumerates every nearby lootable, tactivator and chest as an "enemy".
Neither list is a subset of the other.

### `personalDamageMods`

Not emitted. It is a pure re-index of data `damageModMap` and the
per-player arrays already carry, keyed by GW2EI's own `Spec` enum
spelling, which axilog does not reproduce — omitted rather than faked with
a near-miss spec name.

## Scope gaps: emitted-but-partial

These are fields axilog emits with a documented, measured shortfall rather
than a silent approximation.

| Surface | Shortfall |
| --- | --- |
| `skillMap` | Names come from the log's **own** skill table (falling back to `"Skill <id>"`), a genuinely narrower data source than EI's bundled, GW2-API-backed skill database. Names are spot-checked, not calibrated. `icon`, `autoAttack` and every API-dependent classifier flag (`isInstantCast`, `isTraitProc`, …) are omitted. `canCrit` and a narrower `isSwap` are computed from the id alone and match EI on every overlapping id. |
| `rotation[]` | Reproduces EI's **animated**-cast pipeline only. The separate instant-cast pipeline (weapon swaps, procs, instant-cast mechanics) is ~29% of a real log's cast entries and is not decoded. |
| `wvWMapData` | Only the three `{red,blue,green}TeamID` fields. EI additionally carries `{red,blue,green}ShardID` and `objectiveData[]` — per-objective capture-ownership timelines for every Camp, Tower and Keep. A whole event family axilog does not decode: parked, not faked. |
| `damageModifiers` | 69 of the reference export's 75 ids; the 6 uncovered each need an engine feature axilog lacks, listed with reasons. See [damage modifiers](/axilog/damage-modifiers/#coverage-and-accuracy). |
| `targets[].totalDamageDist` | Its `connectedHits` reproduces EI's `HasHit` from the result byte rather than axilog's own `dmg > 0` convention, because the consumer divides by it. |
| `players[].minions[]` | Two bounded label/roster residuals, both traced: arcdps names species 26153 `Clone` where EI's export reads `Rifle Clone`, and one player owns an englobed agent EI lists as its own `UNKNOWN` group (12 rows / 25,963 damage) that axilog classifies as a player. EI's other twenty minion arrays are read nowhere downstream and are not emitted. |
| `outgoingHealingAllies` / `outgoingBarrierAllies` | Carry `healing`, `downedHealing` and `barrier` only. EI's seventeen other per-ally fields split by a source attribute the arcdps healing extension's wire format does not carry. |
| Enemy `iconURL` | EI's unknown-spec fallback, because axilog resolves no profession for enemies. |

## Ruled exceptions

An "exception" here is not a loosened tolerance. It is a written trace of
the divergence's root cause, an explicitly authorized bound set at the
*measured* residual plus a margin, and a named allowlist in the test file.

| Exception | Bound | Cause |
| --- | --- | --- |
| Barrier out, squad-wide | measured **7.5993%**, authorized **8.0%** | GW2EI's `SanitizeForSrc` deduplicates healing-extension rows per healer; one repeating skill — same id, same fixed amount, several peer-relayed copies within a tick — straddles its all-or-nothing rule. Reproducing it byte-for-byte would also require reproducing GW2EI's internal per-agent-lifetime identity tracking. |
| Regeneration generation / waste | mean and max recorded per scope; waste peak **10.94 pp** | GW2EI admits stack-active events in NoID mode for Regeneration alone and threads them into an overridden duration that `HealingLogic` prefers. Needs per-stack instance ids the pipeline does not carry. See [buffs](/axilog/buffs/#regeneration-and-healinglogic). |
| Three enemy-target `dpsAll` cells | allowlisted and diagnosed | A damage-**credit** divergence that predates the instid regroup — each merged total is the exact sum of its pre-merge parts — made visible only because the regroup made those targets joinable for the first time. |

The Stability average-stack allowlist that used to sit here is **gone**:
MBUFFSIM took it 7 cells → 0 and tightened the bound 10× at the same time.
That is the pattern the project aims for — an exception is a placeholder
for a root cause not yet found, not a permanent settlement.

## Not a divergence: things that only look like one

- **`eliteInsightsVersion: null`.** Deliberate. axilog is not Elite
  Insights, and claiming a version number it does not implement would be a
  lie to any consumer that branches on it.
- **`targets[].isFake` always `false`.** Every emitted target is a real,
  individually tracked agent; the one `true` row in EI's WvW output is the
  synthetic aggregate above.
- **`BuffOnFoe` damage modifiers absent.** GW2EI's own
  `BuffOnFoeDamageModifier.Keep` returns `false` for every WvW and sPvP
  log before consulting anything else, so those modifiers are
  definitionally inert in axilog's only parse mode.
- **The `[20260430, 20260501)` build window.** axilog carries the single
  `is_post_buff_rework` header flag, not a separate
  `AnimationAsStateChanges` one, so a log built inside that narrow window
  would be scanned with the pre-era shape throughout — including resurrect
  detection, which is actually gated on the earlier threshold. Flagged
  honestly rather than silently mishandled, and judged out of scope
  against adding a header field the project otherwise has no use for.

## See also

- [Accuracy & calibration](/axilog/accuracy/) — how the non-divergent
  fields are held exact.
- [Calculation methodology](/axilog/methodology/) — the derivations
  behind the divergences.
- [Output schema](/axilog/schema/#the-ei-compat-surface) — the emitted
  EI-compat field set.
- The full field-by-field parity table, with every calibration number,
  lives in the
  [axilog README](https://github.com/darkharasho/axilog#ei-json-parity).
