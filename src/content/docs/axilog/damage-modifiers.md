---
title: axilog damage modifiers
description: How axilog attributes trait, rune, relic, sigil and food damage bonuses — the 205-definition catalog, the ten gain computers, the four emitted fields, the g/(100+g) share formula, and the measured coverage and bounded residual.
source: community
---

A damage modifier is a "+X% under condition Y" effect — a trait, a rune, a
relic, a sigil, a food buff. Elite Insights reports, per player and per
modifier, how many hits it applied to and how much of the damage it is
responsible for; [axilog](/axilog/) reproduces that surface from a
transcribed definition catalog rather than a heuristic. This page is the
long form of what that means and where it stops.

The engine is `axilog_core::analysis::damage_mods`, the GW2EI counterpart
is `GW2EIEvtcParser/EIData/DamageModifiers/`, and everything below is
cited against the latter at the pinned commit the repository records.

## The flag gates the computation, not the copy

Every other opt-in block in axilog (`--skill-damage`, `--timeseries`,
`--rotation`) is computed unconditionally by `analyze()`; the flag only
decides whether the result is serialized. **`--modifiers` is the
exception.** `analyze()` never touches this module. The caller runs the
evaluation itself and hands the result to the report builder, so a parse
without the flag is byte-identical to a build compiled without the module
at all.

That is a deliberate cost decision: the engine is a separate pass over
every damage event crossed with the whole catalog, plus a
per-`(actor, buff)` stack-timeline simulation. On the committed fixture it
roughly doubles wall-clock time for a `--format ei-json` run.

| Surface | Flag | Effect |
| --- | --- | --- |
| `--format json` | `--modifiers` | `players[].damage_mods.{outgoing, incoming}` + top-level `damage_mod_map` |
| `--format html` | `--modifiers` | The same native block, because the report page embeds the serialized `Report` verbatim. There is no modifier-specific widget. |
| `--format ei-json` | `--modifiers` | `damageModifiers`, `incomingDamageModifiers`, `damageModifiersTarget`, `incomingDamageModifiersTarget`, `damageModMap`. The only format that asks the engine for the per-target split. |
| `--format table` / `csv` | — | Ignored entirely. |

Node passes `{ modifiers: true }`; Python passes `modifiers=True`.

## The catalog

**239 GW2EI statements considered = 205 transcribed + 34 deliberately
skipped.** Nothing is dropped silently: the skipped table in
`analysis::damage_mods::catalog`'s module doc is exhaustive and each row
carries *every* reason that applies to it.

The table is **generated**, not hand-written:
`scripts/gen_damage_mod_catalog.py` reads a GW2EI checkout and emits the
Rust; re-running it and diffing is the verification step, and the recorded
regen diff is empty. Every entry cites the `file:line` of the C# statement
it came from.

What is in scope, exactly as GW2EI groups it:

| Group | GW2EI source | Coverage |
| --- | --- | --- |
| Item, Gear, Shared | `CommonDamageModifiers/{Item,Gear,Shared}DamageModifiers.cs` | **Complete** — every WvW-expressible member, whether or not it appears in the reference capture |
| Per profession / elite spec | `EIData/ProfHelpers/*.cs` | The definitions whose ids appear in the reference capture's own `damageModMap` |

### Era windows are carried, not resolved

A reworked trait is not one entry with a "current" value. It is several
entries sharing one id with disjoint `[min, max)` build ranges and/or
disjoint modes, exactly as GW2EI writes it. Selection happens at
evaluation time (`DamageModifierDef::available` + `::keep`), so the
catalog itself is era-agnostic and a pre-rework log picks its own variant.
A test — `no_ambiguous_definition_for_any_build_and_mode` — proves the
windows really are disjoint rather than trusting the transcription.

### Spec gating

A definition is only offered to actors GW2EI would offer it to.
`SingleActorDamageModifierHelper.cs:67-88` unions the four universal
sources (`Item`, `Gear`, `Common`, `EncounterSpecific`) with
`GetPersonalOutgoingModifiersPerSpec(Spec)`, and
`ParserHelper.SpecToSources` (`:401-460`) maps a spec to exactly its base
profession plus its elite spec. Without this, every Firebrand would be
credited with `Empowered` — a Warrior trait — on every hit.

### Three transcription rules worth knowing

- **Counters** (`CounterOn{Actor,Foe}DamageModifier`) pass a hardcoded
  `gainPerStack` of `100.0` to their base constructor, so they are
  transcribed with `gain_per_stack: 100.0` and `is_counter: true` — never
  with the "percent" the name suggests.
- **Skill-based** modifiers pass `int.MaxValue` as a sentinel
  (`SkillDamageModifier.cs:27`), because their gain is hardcoded to `1.0`.
  Transcribed literally, so nothing silently trips the non-zero validation
  rule.
- **`NumberOfBoons`** (`SkillIDs.cs:20`, id `-3`) is not a real buff — it
  is the presence merge of every boon graph. A single tracker over it
  therefore returns "how many distinct boons are up", which is exactly
  what a multi-tracker over the twelve boon ids computes, so those
  definitions are transcribed as multi trackers rather than needing a
  synthetic graph.

## The ten gain computers

`gain_per_stack` is written `g` below; `stack` is the tracked buff's stack
count at the moment of the hit. Every variant except the last is a
*multiplier*, which is the only reason EI's `nonMultiplier` flag exists.

| Computer | GW2EI file | Gain |
| --- | --- | --- |
| `ByPresence` | `ByPresence.cs:10-13` | `stack > 0 ? g/(100+g) : 0` |
| `ByStack` | `ByStack.cs:10-13` | `t/(100+t)` with `t = g·stack` |
| `ByMultiPresence` | `ByMultiPresence.cs:3-8` | Literally `: GainComputerByStack` — same formula, but its "stack" is the number of distinct buffs present |
| `ByAbsence` | `ByAbsence.cs:10-13` | `stack == 0 ? g/(100+g) : 0` |
| `ByStackPlusConstant(c)` | `ByStackPlusConstant.cs:11-14` | `t/(100+t)` with `t = g·stack + c` — **non-zero at `stack == 0`** whenever `c ≠ 0` |
| `ByMultiplyingStack` | `ByMultiplyingStack.cs:10-14` | Compounding: `p = 100·(1 + g/100)^stack − 100`, then `p/(100+p)` |
| `AtLeastNStacks(n)` | `AtLeastN.cs:12-15` | `stack ≥ n ? g/(100+g) : 0` |
| `AtMostNStacks(n)` | `AtMostN.cs:12-15` | `stack ≤ n ? g/(100+g) : 0` |
| `ExactNStacks(n)` | `ExactNumber.cs:12-15` | `stack == n ? g/(100+g) : 0` |
| `BySkill` | `SkillDamageModifier.cs:9-21,50-57` | Gain hardcoded to `1.0`; the base `ComputeGain` throws. The only non-multiplier in the GW2EI codebase. |

### Why `g/(100+g)` and not `g/100`

This is the single most important formula on the page, and the one most
often got wrong by reimplementations. The damage figure in the log is the
damage **after** the bonus already applied. A 5% modifier on an observed
hit of 105 did not add 5.25; it added 5. Its share of the observed damage
is therefore `5/105 = g/(100+g)`, not `g/100`.

Consumers recover the effective bonus with the inverse
(`tmplDamageModifierTable.html:324`):

```text
bonus = totalDamage / (totalDamage − damageGain) − 1
```

## The four emitted fields, exactly

Everything here is `SingleActorDamageModifierHelper.cs`,
`ComputeDamageModifierStats` (`:13-45`, incoming twin `:130-163`).

| Field | Meaning |
| --- | --- |
| `hitCount` | How many hits **qualified**: the gain came out non-zero *and* every checker predicate passed. |
| `totalHitCount` | How many hits were **eligible** — the modifier's candidate pool, recomputed independently. Not "all damage": see below. |
| `damageGain` | `Σ gainᵢ · damageᵢ` over the qualifying hits, rounded to 3 decimals (`DamageModGainDigit = 3`). For a counter or a skill-based modifier `gainᵢ = 1`, so this is raw "damage during". |
| `totalDamage` | The **denominator**, filtered by the definition's `compare_type` — *not* its `src_type`; the two are routinely different. |

`totalHitCount`'s pool is narrowed three ways:

1. **Connected hits only** (`Actor.cs:190-202`, `.Where(x => x.HasHit)`).
   Misses, blocks, evades and invulns are out. Absorbed hits are in only
   for `UsingHitAndAbsorbedDamageEvents()` modifiers, which axilog does
   not model (see [gaps](#documented-gaps)).
2. **By `src_type`** (`Actor.FilterDamageEvents`, `:446-479`) — condition
   ticks and life-leech ticks are eligible whenever the modifier's
   `src_type` admits them, and excluded when it is `Strike`.
3. **By `dmg_src`** (`SingleActor.cs:781-845`) — minion damage is included
   for `All`, excluded for `NoPets`, exclusive for `PetsOnly`.

One GW2EI quirk is reproduced on purpose: `PetsOnly` reports the
actor + minion total, because GW2EI's minions-only subtraction is
commented out (`:35-36, 83-84`).

An entry exists only when the modifier produced at least one qualifying
hit. GW2EI's JSON builder iterates a per-modifier event dictionary, so a
modifier with zero events is simply absent from the JSON
(`JsonDamageModifierDataBuilder.cs:43-76`); its HTML builder separately
substitutes a zero row, which the JSON one does not. axilog follows the
JSON rule.

### A worked example

From the committed fixture, one player's outgoing rows (accounts are the
fixture's own `Anon` placeholders):

```json
{ "id": 10,  "hit_count": 118, "total_hit_count": 226, "damage_gain": 5242.952,  "total_damage": 182708 }
{ "id": 98,  "hit_count":  98, "total_hit_count": 226, "damage_gain": 5078.0,    "total_damage": 205612 }
{ "id": 371, "hit_count": 163, "total_hit_count": 319, "damage_gain": 12307.091, "total_damage": 205612 }
```

Id `10` is `Moving Bonus` — *"Seaweed Salad (and the likes) – 5% while
moving"*, applied on strike damage and compared against strike damage.
Three things fall out of one row:

- `hit_count` 118 of `total_hit_count` 226: the player was moving for
  roughly half their connected strikes.
- `total_damage` is 182,708, not the player's 205,612 whole-fight damage,
  because the definition's `compare_type` is strike damage. Id `98`
  (`Excessive Energy`), whose comparison is all damage, reports 205,612 in
  the same block — the two denominators differing is the `compare_type`
  rule being visible.
- `damage_gain` 5,242.952 at `g = 5` means `gainᵢ = 5/105`, so the
  boosted-hit damage behind it is `5242.952 × 21 = 110,102` — the bonus
  accounted for 5,242.95 of that, and
  `182708/(182708 − 5242.952) − 1 = 2.95%` is the effective whole-fight
  multiplier on strike damage.

## The descriptor map

`damage_mod_map` (EI: `damageModMap`, keyed `"d<signed id>"`, negative for
incoming) carries all eight of EI's `DamageModDesc` fields, none faked:
`name`, `icon`, `description`, `nonMultiplier`, `isCounter`, `skillBased`,
`approximate`, `incoming`. `description` is GW2EI's full composed tooltip,
including the derived `<br>Applied on …` / `<br>Compared against …` /
`<br>Counter` / `<br>Non multiplier` / `<br>Approximate` suffixes:

```json
{
  "name": "Moving Bonus",
  "icon": "https://render.guildwars2.com/file/0D442C30D4E29832725800E22990BA111D05E0BE/219455.png",
  "description": "Seaweed Salad (and the likes) – 5% while moving<br>No Minions<br>Applied on Strike Damage<br>Compared against Strike Damage",
  "non_multiplier": false, "is_counter": false, "skill_based": false,
  "approximate": false, "incoming": false
}
```

The map is scoped to only the ids some player actually triggered — GW2EI
fills its own map the same lazy way — and is omitted entirely without
`--modifiers`, because an empty map would claim no player triggered
anything rather than that the engine never ran.

EI's top-level `personalDamageMods` (a `spec → [modifier ids]` re-index)
is **not** emitted: it is a pure re-index of data the map and the
per-player arrays already carry, keyed by GW2EI's own `Spec` enum
spelling, which axilog does not reproduce. Omitted rather than faked with
a near-miss spec name.

## Coverage and accuracy

Measured against a real WvW reference capture and its GW2EI export.

| Measure | Result |
| --- | --- |
| Ids covered | **69 of the export's 75** |
| Ids exact on every field of every account | **38** |
| Whole-fight rows exact | **792 of 958** |
| Per-target rows text-identical | **3,963 / 3,963** across all 56 joined enemy-player targets |
| `damageModMap` entries | **69 / 69** character-for-character identical, every field |
| Aggregate `totalHitCount` / `totalDamage` residual | **0.0 on every id, every account** |

The six uncovered ids each need an engine feature axilog does not have —
absorbed-hit classification, a condition-buff-count graph, EI-synthetic
weaver attunement ids, a source-HP probe, and minion-species/illusion
predicates. They are listed with reasons in the catalog's skipped table:
omitted, never approximated.

### The residual is buff state, not modifier logic

The ids that are not exact carry a **bounded** residual, and the
provenance matters: it is not a damage-modifier defect but the fidelity of
the underlying per-`(actor, buff)` stack timelines. Each such id has its
own measured per-field bound in `damage_mods_golden.rs`'s `ID_BOUNDS`, so
the residual is visible in CI and cannot grow silently.

Two later milestones moved it, and both moved it by fixing something else:

- **MBUFFSIM** closed two systematic buff-state gaps (see
  [buffs & boons](/axilog/buffs/#the-two-event-pipeline-rules)). Row-level
  exactness went **682 → 779** of 958. `d422` "Might 25" went 0/44 → 36/44
  accounts, `d-427` "Stability ≥ 5" 15/44 → 38/44, `d-426` 25/44 → 39/44,
  `d-428` 22/44 → 34/44.
- **MATTRIB** closed an independent cause: M16 had quarantined an
  incoming-denominator gap on one account — 7 self-inflicted Bleeding
  ticks worth 239 damage that GW2EI counts and axilog's incoming branch
  refused, because their source was also a squad member. GW2EI's
  `GetDamageTakenEvents` has no source filter. Row-level exactness went
  **779 → 792**, ids exact **31 → 38**, and every aggregate denominator
  residual pinned at `0.0`.

The id-level counter moves slowly by construction — an id only counts when
all 44 accounts agree on all four fields — so the row counter is the one
to read.

### Float discipline

`damageGain` is emitted as a `double` rounded to 3 decimals, matching
GW2EI's `Math.Round(_, ParserHelper.DamageModGainDigit)` over a `double`.
It is deliberately **not** routed through the `f32`-narrowing helper the
replay coordinates use — that helper exists because EI serializes C#
`float`s there, and it would be wrong here.

## Documented gaps

Each of these is a GW2EI capability axilog can name but not evaluate
faithfully. None is silently approximated.

| Gap | Consequence |
| --- | --- |
| **Shield damage** | GW2EI's `HealthDamage` is shield-adjusted (`Max(HealthDamage − ShieldDamage, 0)`). Nothing in axilog decodes shield damage, so both the gain and the denominator use the same unadjusted damage every other pass uses — consistent, and a known divergence on barrier-heavy targets. |
| **`WithBuffOnActorFromFoe` / `WithBuffOnFoeFromActor`** | "Stacks of B on A applied *by* the foe". axilog's buff extraction records the applier but has no per-applier stack simulation, so both are expressible on the definition purely so the evaluator can **reject** them rather than silently evaluating against total stacks. |
| **`UsingHitAndAbsorbedDamageEvents`** | Widens the pool to absorbed hits and forces `totalDamage` to 0. Five real call sites (Mesmer/Guardian/Elementalist). Nothing in axilog classifies an absorbed hit, so the flag exists only to reject the definition. |
| **Early-exit checkers and gain adjusters** | Not modelled. Early exit is always paired with a minion-identity predicate in the definitions that use it (`Mod_BeastlyWarden_Pet`, `Mod_EmpoweredIllusions`), which axilog cannot express either, so both are skipped together. |
| **`GetFinalMaster()` depth** | `.UsingActorFetchIsAlwaysMaster()` / `.UsingFoeFetchIsAlwaysMaster()` *are* modelled. GW2EI walks the master chain to its top; arcdps only ever reports one level of `*_master_instid`, so axilog resolves as far as the wire allows. |
| **`Skip` fast paths** | GW2EI short-circuits an actor when the tracked buff graph is empty. A pure performance optimisation — an empty graph yields stack 0, which the gain computers already turn into a 0 gain — so it is not reproduced. |

The 34 skipped definitions are dominated by one class that is **not** a
gap at all: the `BuffOnFoe` family. GW2EI's own
`BuffOnFoeDamageModifier.Keep` returns `false` for every WvW and sPvP log
before consulting anything else (`:83-91`), so those modifiers are
definitionally inert in a WvW parse. ("Only parse mode" stopped being
true in v1.5.0: `ModeContext::from_encounter` now gives raids, strikes,
fractals and convergences GW2EI's `Instanced` mode, since several
modifiers are WvW/sPvP-only or instanced-only — the WvW analysis on this
page is unchanged.) Transcribing them would
add dead entries the evaluator drops anyway. The rest are checker
predicates axilog cannot express — flanking-or-breakbar state, a
resurrect-cast intersection, a target-range probe, an HP-fraction probe,
an EI-synthetic attunement graph, a condition-count pseudo-buff.

## Determinism

Output is a `BTreeMap` keyed by `(player representative address, signed
modifier id)`. Both the event scan and the timeline construction are
ordered, and no floating-point accumulation order depends on iteration of
an unordered container — which is what makes the text-identical assertions
above possible at all.

## See also

- [Buffs & boons](/axilog/buffs/) — the stack timelines every buff-gated
  modifier reads, and the residual class above.
- [Output schema](/axilog/schema/#blocks--uniform-id-keyed-statistics) — the
  emitted block shapes.
- [Accuracy & calibration](/axilog/accuracy/) — where this sits against
  the rest of the parity surface.
- [Parity & divergences](/axilog/parity/) — the list of places axilog
  deliberately differs from EI.
