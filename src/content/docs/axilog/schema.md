---
title: axilog output schema
description: The native axilog JSON report at v0.3.1 — top-level shape, always-on vs opt-in blocks and what each one costs, per-block field summaries including damage modifiers and aftercast stats, and the Elite Insights compatibility surface behind --format ei-json.
source: community
---

[axilog](/axilog/) has two JSON outputs. The **native report**
(`--format json`, `axilog_schema::Report`) is the primary one: everything
axilog computes, in axilog's own shape. The **EI-compat report**
(`--format ei-json`) is a projection of that same report into Elite
Insights' JSON shape, for tools that already read EI exports.

This page describes both. It summarises blocks rather than transcribing
every field — the authoritative typed surfaces are
[`crates/axilog-py/axilog.pyi`](https://github.com/darkharasho/axilog/blob/main/crates/axilog-py/axilog.pyi)
(TypedDicts, one per block) and
[`crates/axilog-node/types.d.ts`](https://github.com/darkharasho/axilog/blob/main/crates/axilog-node/types.d.ts)
(the same shape as TypeScript interfaces). Both are generated from, and
kept in sync with,
[`crates/axilog-schema/src/lib.rs`](https://github.com/darkharasho/axilog/blob/main/crates/axilog-schema/src/lib.rs),
whose doc comments carry the per-field rationale.

## Top-level shape

```json
{
  "schema_version": "0.2",
  "axilog_version": "0.3.1",
  "encounter": { "kind": "wvw", "map": "Green Alpine Borderlands", "duration_ms": 49285, "...": "..." },
  "players":   [ { "account": ":Anon104.4848", "...": "..." } ],
  "enemies":   [ { "id": 9634, "name": "Juvenile Siege Turtle", "team": "blue", "is_player": false } ],
  "timeline":  { "resolution_ms": 1000, "per_second": { "squad_damage": [], "cc_applied": [], "downs": [] } },
  "skill_map": { "717": { "name": "Protection", "is_swap": false, "can_crit": true } }
}
```

Those seven keys are **always** present. Everything else is either
omit-when-absent (a field the log had no data for) or opt-in behind a
flag — with one always-on-but-conditional exception, `warnings`, which is
an array of structured analysis warnings omitted entirely when empty.

### `schema_version`

Currently `"0.2"`. It tracks the *native report's* shape, independently of
`axilog_version` (the crate version, e.g. `"0.3.1"`). The `0.1 → 0.2` bump
was the retirement of the M1-era `down_contribution` scalar — a fixed 10 s
lookback window — and its replacement by the two four-stat
[contribution](/axilog/methodology/#the-arcdps-down-contribution-family)
blocks, `downs_contribution` and `downed_by`. Treat a minor bump as
"a field changed meaning or went away"; purely additive fields do not bump
it, which is why `hit_stats`, `defenses`, `skill_map`, `damage_mods`,
`damage_mod_map` and `aftercast` all landed inside `0.2`.

### Omission convention

Every optional field in this schema is **omitted from the JSON entirely**
rather than serialized as `null`, `0`, or `[]`. That is deliberate and it
is load-bearing for consumers:

- `players[].healing` absent means *the log carries no arcdps
  healing-extension data at all* — not "this player healed for zero".
- `boons[].avg_stacks` absent means *this is a duration-type boon*, for
  which an average stack count is meaningless. Only Might and Stability
  carry it.
- `skill_map[].auto_attack` absent means *unknown*. It is currently always
  absent; the heuristic was refused rather than guessed.
- `encounter.tick_rate` absent means *fewer than two `CBTS_TICK` events*.
- `damage_mod_map` absent means *the modifier engine never ran* — an empty
  map would instead claim no player triggered anything.
- A player with no instid registration is **absent** from
  `instanceID`-style surfaces rather than reported as `0`, so "unknown"
  stays distinguishable from "really zero".

The one exception is `encounter.recorded_by`, which is always present and
may be `null` when the recording agent is unknown.

## Always-on vs opt-in

Four of the five payload flags gate only **serialization** — the analysis
runs either way, so opting in costs bytes, not time, and `--view rotation`
works without `--rotation`. `--modifiers` is the exception: it gates the
**computation**, because the modifier engine is a separate pass over every
damage event crossed with the whole catalog.

| Block | CLI flag | Node option | Python kwarg | Gates |
| --- | --- | --- | --- | --- |
| `players[].skill_damage` | `--skill-damage` | `skillDamage: true` | `skill_damage=True` | Serialization |
| `players[].per_second`, `players[].dps_targets` | `--timeseries` | `timeseries: true` | `timeseries=True` | Serialization |
| `players[].rotation` | `--rotation` | `rotation: true` | `rotation=True` | Serialization |
| `replay` (top-level) | `--replay` | `replay: true` | `replay=True` | Serialization |
| `missiles` (top-level) | `--missiles` | `missiles: true` | `missiles=True` | Serialization |
| `players[].damage_mods`, `damage_mod_map` | `--modifiers` | `modifiers: true` | `modifiers=True` | **Computation** |

### What each one costs

Measured on the committed WvW fixture (`fixtures/wvw-small.anon.zevtc`,
42 players, ~49 s) at v0.3.1, each flag applied alone to a **compact**
serialization of the same parse. The baselines are 216,741 bytes for
`--format json` and 244,169 bytes for `--format ei-json`.

| Flag | native JSON | vs baseline | `ei-json` | vs baseline |
| --- | --- | --- | --- | --- |
| `--skill-damage` | 697,206 B | +222% | 1,126,868 B | +362% |
| `--timeseries` | 644,741 B | +198% | 956,160 B | +292% |
| `--replay` | 515,395 B | +138% | 552,052 B | +126% |
| `--rotation` | 330,825 B | +53% | 341,746 B | +40% |
| `--modifiers` | 303,363 B | +40% | 1,029,699 B | +322% |
| `--missiles` | 220,966 B | +2% | — (native-only) | — |

These are **not** the percentages the schema crate's own doc comments
record. Those were each measured against the then-current baseline at the
milestone that added the block, and the baseline has both grown (always-on
blocks were added) and shrunk (MROSTER cut the `ei-json` `targets[]`
roster 8.8×, and with it the nine arrays positionally joined to it — the
flagless `ei-json` payload on a real 583k-event log went −71.1%, and
`--timeseries` −86.2%). The table above is one internally consistent sweep
at v0.3.1; the doc comments are the historical record.

The rationale for gating at all is one number: the project's
size-discipline guideline is **~30% growth**, and every block above blows
past it on a real WvW log. The cause is combinatorial, not verbosity —
`skill_damage.per_target` is player × enemy × skill, `per_second.per_target`
is player × enemy × second, and `ei-json`'s modifier arrays are
player × target × modifier. `dps_targets` is the instructive case: it
looks small ("one row per enemy"), was shipped always-on, and immediately
broke the HTML report's size gate on its own. It now sits behind the same
`--timeseries` flag as `per_second` rather than a second flag of its own.

`skill_map` is the counter-example, and the reason it is always-on: it is
scoped to only the skill ids squad players actually reference through
damage, rotation or tracked boons — not a dump of the log's ~1,000-entry
skill table — so it stays small.

## Blocks

### `encounter`

`kind` (`"wvw"`), `map` (resolved from the log's `MAP_ID` event),
`duration_ms`, the arcdps `build` string and `revision`, `recorded_by`,
and `teams[]` (`color`, `team_id`, optional content `guid`).

Two native-only extras with no EI equivalent: `markers[]`, the full
`CBTS_MARKER` assignment timeline across *all* agents (`agent_addr`,
`marker`, `time_ms`), and `tick_rate` (`avg`, `min`, `per_second[]`) from
`CBTS_TICK`.

### `players[]`

Identity is `account`, `character`, `profession`, `elite_spec`, `team`,
`subgroup`, `in_squad`, `commander` — plus optional `marker` and
`commander_tag` (`{ variant, guid }`, the richer form alongside the plain
`commander` bool).

| Field | What it holds |
| --- | --- |
| `damage` | `total`, `dps`, and `per_enemy[]` (`enemy_id`, `total`). Pet/minion damage is folded onto the master — see [pet folding](/axilog/methodology/#damage-accumulation-and-pet-folding). |
| `downs_dealt`, `kills_dealt`, `downs_taken`, `deaths`, `damage_taken` | Plain scalars. |
| `cc` | `applied_total`, `applied_duration_ms`, `stun_breaks`, `removed_stun_duration_ms`. |
| `downs_contribution` / `downed_by` | The [arcdps contribution family](/axilog/methodology/#the-four-stats): `damage`, `cc`, `strips`, `movement_impairing`. Outgoing and incoming respectively. |
| `boons[]` | One entry per tracked boon, in a fixed order: `id`, `name`, `presence_pct` (0–100), `generation` (`self_pct`/`group_pct`/`squad_pct` plus the matching `*_wasted`), and `avg_stacks` for the two intensity-type boons only. See [buffs & boons](/axilog/buffs/). |
| `support` | `cleanses`, `cleanses_self`, `strips`, `resurrects`. |
| `healing` | arcdps healing-extension totals: `healing_out_total`, `healing_out_allies`, `healing_out_self`, `barrier_out`, `downed_healing_out`. Omitted when the log carries no extension data. |
| `hit_stats` | 20 outgoing hit-quality counters mirroring EI's `statsAll[0]` — crit/flank/glance/moving counts, connected and direct and condition count+damage pairs, `critable_direct_count`, against-downed, life-leech, and the above-90%-HP power/condition splits. Actor-only: no pet fold, matching EI. |
| `aftercast` | The four cast-interrupt counters behind EI's `statsAll[0].saved`/`timeSaved`/`wasted`/`timeWasted`. Always present. Note the name collision: `statsAll`'s `wasted` is a cast-interrupt count, unrelated to boon-generation waste — both names are real EI's. |
| `defenses` | 18 incoming counters mirroring EI's `defenses[0]` — blocked/evaded/dodge/missed/interrupted/invulned counts, plus strike, power, condition, life-leech, barrier and breakbar count+damage pairs. |
| `skill_damage` | Opt-in. `outgoing[]`, `taken[]` and `per_target[]` lists of `{ skill_id, total, hits, min, max, crit_hits, flank_hits }`. `sum(outgoing[].total) == damage.total` and `sum(taken[].total) == damage_taken` hold exactly. `hits`/`min`/`max` count only contributing (`dmg > 0`) events. |
| `per_second` / `dps_targets` | Opt-in, both behind `--timeseries`. `per_second` carries **cumulative** running totals — `damage[]`, `damage_taken[]` and `per_target[].damage[]`, one entry per second on the same grid as `timeline`. `dps_targets[]` is the whole-fight `{ enemy_id, damage, dps }` summary. |
| `rotation` | Opt-in. `[{ skill_id, casts: [{ cast_time_ms, duration_ms, time_gained_ms, quickness }] }]`. `cast_time_ms` is relative to log start and may be negative (a pre-log cast). Animated casts only — see the [rotation scope gap](/axilog/methodology/#rotation-and-cast-tracking). |
| `damage_mods` | Opt-in. `{ outgoing[], incoming[] }` — see below. |

### `damage_mods` and `damage_mod_map`

`players[].damage_mods` has two arrays, `outgoing` and `incoming`, each
sorted by `id` ascending and each containing only modifiers with at least
one qualifying hit (EI's own emission rule). Incoming ids are **negative**.

```json
{ "id": 10, "hit_count": 118, "total_hit_count": 226,
  "damage_gain": 5242.952, "total_damage": 182708 }
```

| Field | Meaning |
| --- | --- |
| `hit_count` | Hits that qualified — non-zero gain *and* every checker passed. |
| `total_hit_count` | Hits that were **eligible** (the candidate pool), filtered by the definition's own damage-type and minion-source rules. Not "all damage". |
| `damage_gain` | `Σ gainᵢ · damageᵢ` over qualifying hits, rounded to 3 decimals. The gain is `g/(100+g)`, not `g/100` — the logged damage already contains the bonus. |
| `total_damage` | The denominator, filtered by the definition's `compare_type`, which is routinely a different damage type from the one it applies to. |

The top-level `damage_mod_map` is keyed by the same signed id and carries
all eight of EI's `DamageModDesc` fields: `name`, `icon`, `description`
(GW2EI's full composed tooltip, suffixes included), `non_multiplier`,
`is_counter`, `skill_based`, `approximate`, `incoming`. It is scoped to
only the ids some player actually triggered.

Full treatment on the [damage modifiers](/axilog/damage-modifiers/) page.

### `enemies[]`

`id`, `name`, `team`, `is_player`, optional `marker`. This list is
**filtered to combat participants** — an enemy is kept only if it dealt
damage to the squad, took damage from the squad, took CC from the squad,
or is an enemy player (always kept). A real WvW log enumerates every
nearby lootable, tactivator and chest as an "enemy" NPC; those are dropped
here.

Since MINSTID, enemy players are also **regrouped by instid**, GW2EI's own
non-squad rule: one enemy person is one row, even when arcdps registered
several agent addresses for them. On the reference capture that took the
list from 140 rows to 125 (71 → 56 enemy players).

The EI adapter uses a **different, independent filter** over the same
list — see [the enemy roster](/axilog/parity/#the-enemy-roster). Neither
is a subset of the other.

### `timeline`

`resolution_ms` (1000) and `per_second` with three equal-length arrays:
`squad_damage[]`, `cc_applied[]`, `downs[]`. Bucketed from the log's first
event. EI's JSON has no comparable whole-log series for WvW; this one is
always on.

### `skill_map`

An object keyed by skill id as a **string** (`"717"`, plain serde
stringification of the `u32`), each value `{ name, is_swap, can_crit }`
plus an always-omitted `auto_attack`. `name` is the log's own skill-table
text, falling back to `"Skill <id>"`. See the
[skill-name gap](/axilog/parity/#scope-gaps-emitted-but-partial) for why
icons and the API-backed classifier flags are absent rather than faked.

### `replay` and `missiles`

Both top-level, both opt-in.

`replay` carries `poll_ms` (300), `bounds` (`min_x`/`min_y`/`max_x`/`max_y`
across every track, so a consumer can size a viewBox in one pass) and
`tracks[]`. Each track has `name`, `team`, `commander`, `is_squad`,
`samples` as `[t_ms, x, y]` triples in **raw world units** rounded to one
decimal, and `down_intervals`/`dead_intervals` as `[start_ms, end_ms]`
pairs. This is the native engine, not the EI-shape one — see
[combat replay](/axilog/combat-replay/) for why there are two.

`missiles` carries per-squad-player
`{ agent_addr, account, fired, hit, denied, reflected_at_self }` plus a
squad-wide rollup
`{ fired, hit, denied, incoming_fired, incoming_denied }`. `denied` is
deliberately undifferentiated: the arcdps wire format has no
blocked/reflected/destroyed reason code, and there is no per-player
"denier" credit anywhere, so none is invented.

## The EI-compat surface

`--format ei-json` (SDK: `parseFileEi` / `parse_file_ei`) emits a subset of
the real Elite Insights / dps.report JSON shape. On the committed fixture
the flagless top level is:

```json
{
  "buffMap": {}, "durationMS": 49285, "eliteInsightsVersion": null,
  "fightName": "Detailed WvW - Green Alpine Borderlands",
  "players": [], "recordedBy": ":Anon104.4848", "skillMap": {},
  "success": true, "targets": [],
  "wvWMapData": { "blueTeamID": 433, "greenTeamID": 2767, "redTeamID": 697 }
}
```

`eliteInsightsVersion` is `null` on purpose — axilog is not Elite
Insights, and claiming a version number it does not implement would be a
lie to any consumer that branches on it.

### Always-on per-player fields

`account`, `character_name`, `profession`, `elite_spec`, `group`,
`teamID`, `notInSquad`, `hasCommanderTag`, `guildID`, `instanceID`,
`activeTimes`, `dpsAll` (including `breakbarDamage`), `statsAll`,
`defenses` (including `receivedCrowdControl`, `receivedCrowdControlDuration`,
`boonStrips`, `boonStripsTime`), `support`, `buffUptimes`, `selfBuffs`,
`groupBuffs`, `squadBuffs`, `extHealingStats`, `extBarrierStats`, and
`combatReplayData`'s cheap half (`start`, `end`, `down`, `dead` — computed
unconditionally, and byte-identical whether or not `--replay` is passed).

`targets[]` always carries `id`, `name`, `instanceID`, `isFake` and
`dpsAll[0]`.

### What each flag adds

| Flag | Adds |
| --- | --- |
| `--skill-damage` | `totalDamageDist`, `targetDamageDist`, `totalDamageTaken` (with their outcome columns and `downContribution`), `statsTargets[i][0]`, `targets[].totalDamageDist`, the healing/barrier ally matrices and `*Dist` arrays, `minions[].totalDamageTakenDist` |
| `--timeseries` | `damage1S`, `targetDamage1S`, `damageTaken1S`, `powerDamageTaken1S`, `targetPowerDamage1S`, `dpsTargets`, `healing1S`, `healthPercents`, `boonsStates`, `buffUptimes[].states`/`.statesPerSource`, `targets[].damage1S`/`.powerDamage1S`/`.buffs[]` |
| `--rotation` | `rotation[]` — flat, **not** phase-wrapped, because real EI's own isn't |
| `--replay` | `combatReplayData.{positions, orientations, dc, iconURL}` for players and targets, plus the top-level `combatReplayMetaData` |
| `--modifiers` | `damageModifiers`, `incomingDamageModifiers`, `damageModifiersTarget`, `incomingDamageModifiersTarget`, `damageModMap` |

The adapter keys off the native report's own block presence, not a
separate flag — so the same CLI flag controls both formats. Several of
those gates are GW2EI's own: `healing1S`, `healthPercents` and the buff
state arrays ride `--timeseries` because EI puts them behind
`RawFormatTimelineArrays`.

### Phase conventions

`statsAll`, `defenses`, `support`, `dpsAll`, `totalDamageDist`, `damage1S`
and friends are phase-indexed arrays with exactly one element — axilog
does not model phases, and a WvW log has one. `rotation[]` is *not*
phase-wrapped, matching real EI. `damageModifiers[]`'s inner array is EI's
per-phase dimension, again one element.

### Memory: the streaming serializer

The CLI's `ei-json` path **streams**. Before MSTREAM it materialized the
whole document as a `serde_json::Value` tree — ~366 MB of nodes, walked
into a ~366 MB string, then written — which peaked at 2.4 GiB on a real
583k-event log. It now allocates one player row at a time and writes
through a 1 MiB buffer: peak RSS **−95% (20×)**, with the output verified
byte-identical across 96 flag and output combinations. The wall-clock
improvement (−33% on that run) is a side effect, not a separate
optimization.

The SDK path is different by necessity: napi and pythonize both walk a
tree, so `to_ei_json` must hand back a materialized value and there is
nothing to stream away. Three implementations were measured against each
other; the shipped one is both the lightest and the fastest, and removes
the second definition of the format.

The native `--format json` path was deliberately **not** changed. It was
never the problem.

### The parity philosophy

Three rules, and they explain nearly every difference you will find:

1. **Only emit what is backed by a real computed metric.** Where EI has a
   field axilog does not compute, the key is *omitted*, never emitted as a
   plausible zero. Each omission is documented inline in
   `crates/axilog-ei/src/lib.rs`.
2. **Match EI's shape exactly where it is emitted**, including the
   phase-wrapping conventions and, for replay, the *serialized decimal
   text* — EI writes C# `float`s, so matching the value is not enough.
3. **Where EI is verifiably wrong, emit the correct value.** There are
   three such places, all documented on the
   [parity page](/axilog/parity/#verified-ei-bugs-axilog-does-not-reproduce).

Everything is held to a committed golden — the anonymized fixture plus a
real dps.report EI export of the same log — asserted in CI on every run,
not spot-checked once and left to drift.

The full field-by-field parity table, with the exact/approximate/gap
status and the calibration numbers behind each row, lives in the
[axilog README](https://github.com/darkharasho/axilog#ei-json-parity).
The [accuracy page](/axilog/accuracy/) distils it.

## See also

- [Quickstart](/axilog/quickstart/) — installing the CLI and SDKs, and a
  first parse in each.
- [Calculation methodology](/axilog/methodology/) — how each field in this
  schema is derived.
- [Parity & divergences](/axilog/parity/) — where the EI-compat surface
  intentionally differs from EI.
- [axilog overview](/axilog/) — architecture and scope.
