---
title: axilog output schema
description: The native axilog JSON report — top-level shape, always-on vs opt-in blocks and what each one costs, per-block field summaries, and the Elite Insights compatibility surface behind --format ei-json.
source: community
---

[axilog](/axilog/) has two JSON outputs. The **native report**
(`--format json`, `axilog_schema::Report`) is the primary one: everything
axilog computes, in axilog's own shape. The **EI-compat report**
(`--format ei-json`) is a lossy projection of that same report into Elite
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
  "axilog_version": "0.1.1",
  "encounter": { "kind": "wvw", "map": "Green Alpine Borderlands", "duration_ms": 49285, "...": "..." },
  "players":   [ { "account": ":Anon104.4848", "...": "..." } ],
  "enemies":   [ { "id": 9634, "name": "Juvenile Siege Turtle", "team": "blue", "is_player": false } ],
  "timeline":  { "resolution_ms": 1000, "per_second": { "squad_damage": [], "cc_applied": [], "downs": [] } },
  "skill_map": { "717": { "name": "Protection", "is_swap": false, "can_crit": true } }
}
```

Those seven keys are **always** present. Everything else is either
omit-when-absent (a field the log had no data for) or opt-in behind a
flag — see the next section.

### `schema_version`

Currently `"0.2"`. It tracks the *native report's* shape, independently of
`axilog_version` (the crate version, e.g. `"0.1.1"`). The `0.1 → 0.2` bump
was the retirement of the M1-era `down_contribution` scalar — a fixed 10 s
lookback window — and its replacement by the two four-stat
[contribution](/axilog/methodology/#the-arcdps-down-contribution-family)
blocks, `downs_contribution` and `downed_by`. Treat a minor bump as
"a field changed meaning or went away"; purely additive fields do not bump
it, which is why `hit_stats`, `defenses` and `skill_map` all landed inside
`0.2`.

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

The one exception is `encounter.recorded_by`, which is always present and
may be `null` when the recording agent is unknown.

## Always-on vs opt-in

Every analysis is computed unconditionally by the core — the flags below
only gate whether the result is **copied into the serialized report**. So
opting in costs bytes, not time, and `--view rotation` works without
`--rotation`.

| Block | CLI flag | Node option | Python kwarg | Documented size cost |
| --- | --- | --- | --- | --- |
| `players[].skill_damage` | `--skill-damage` | `skillDamage: true` | `skill_damage=True` | **+249%** |
| `players[].per_second` | `--timeseries` | `timeseries: true` | `timeseries=True` | **+147.7%** |
| `players[].dps_targets` | `--timeseries` | `timeseries: true` | `timeseries=True` | **+36.4%** |
| `players[].rotation` | `--rotation` | `rotation: true` | `rotation=True` | **+66.9%** |
| `replay` (top-level) | `--replay` | `replay: true` | `replay=True` | ~+150% |
| `missiles` (top-level) | `--missiles` | `missiles: true` | `missiles=True` | ~+2% |

The percentages come from the schema crate's own doc comments, each
measured against the committed WvW fixture
(`fixtures/wvw-small.anon.zevtc`, 42 players, ~50 s) with compact
serialization at the time that block landed. They are **not** mutually
comparable — each was taken against the then-current baseline, and the
baseline has grown since as always-on blocks were added. For an
apples-to-apples set, axilog 0.1.1 on the same fixture serializes a
194,773-byte baseline, and each flag alone gives 532,685
(`--skill-damage`), 444,248 (`--timeseries`), 308,857 (`--rotation`),
493,427 (`--replay`) and 198,998 (`--missiles`) bytes.

The rationale is one number: the project's size-discipline guideline is
**~30% growth**, and every block above blows past it on a real WvW log.
The cause is combinatorial, not verbosity — `skill_damage.per_target` is
player × enemy × skill, `per_second.per_target` is player × enemy ×
second, and a WvW zerg fight enumerates dozens of enemy players, siege
pieces, dolyaks and guards per player rather than a boss's handful of
adds. `dps_targets` is the instructive case: it looks small ("one row per
enemy"), was shipped always-on, and immediately broke the HTML report's
250,000-byte size gate on its own. It now sits behind the same
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
| `boons[]` | One entry per tracked boon, in a fixed order: `id`, `name`, `presence_pct` (0–100), `generation` (`self_pct`/`group_pct`/`squad_pct`), and `avg_stacks` for the two intensity-type boons only. |
| `support` | `cleanses`, `cleanses_self`, `strips`, `resurrects`. |
| `healing` | arcdps healing-extension totals: `healing_out_total`, `healing_out_allies`, `healing_out_self`, `barrier_out`, `downed_healing_out`. Omitted when the log carries no extension data. |
| `hit_stats` | 20 outgoing hit-quality counters mirroring EI's `statsAll[0]` — crit/flank/glance/moving counts, connected and direct and condition count+damage pairs, `critable_direct_count`, against-downed, life-leech, and the above-90%-HP power/condition splits. Actor-only: no pet fold, matching EI. |
| `defenses` | 18 incoming counters mirroring EI's `defenses[0]` — blocked/evaded/dodge/missed/interrupted/invulned counts, plus strike, power, condition, life-leech, barrier and breakbar count+damage pairs. |
| `skill_damage` | Opt-in. `outgoing[]`, `taken[]` and `per_target[]` lists of `{ skill_id, total, hits, min, max, crit_hits, flank_hits }`. `sum(outgoing[].total) == damage.total` and `sum(taken[].total) == damage_taken` hold exactly. `hits`/`min`/`max` count only contributing (`dmg > 0`) events. |
| `per_second` / `dps_targets` | Opt-in, both behind `--timeseries`. `per_second` carries **cumulative** running totals — `damage[]`, `damage_taken[]` and `per_target[].damage[]`, one entry per second on the same grid as `timeline`. `dps_targets[]` is the whole-fight `{ enemy_id, damage, dps }` summary. |
| `rotation` | Opt-in. `[{ skill_id, casts: [{ cast_time_ms, duration_ms, time_gained_ms, quickness }] }]`. `cast_time_ms` is relative to log start and may be negative (a pre-log cast). Animated casts only — see the [rotation scope gap](/axilog/methodology/#rotation-and-cast-tracking). |

### `enemies[]`

`id`, `name`, `team`, `is_player`, optional `marker`. This list is
**filtered to combat participants** — an enemy is kept only if it dealt
damage to the squad, took damage from the squad, took CC from the squad,
or is an enemy player (always kept). A real WvW log enumerates every
nearby lootable, tactivator and chest as an "enemy" NPC; those are
dropped here. The EI adapter deliberately uses the *unfiltered* roster
instead, because `statsTargets[playerIndex][targetIndex]` is positionally
keyed to `targets[]` and filtering it would be a real divergence from EI's
shape.

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
[skill-name gap](/axilog/methodology/#known-gaps) for why icons and the
API-backed classifier flags are absent rather than faked.

### `replay` and `missiles`

Both top-level, both opt-in.

`replay` carries `poll_ms` (300), `bounds` (`min_x`/`min_y`/`max_x`/`max_y`
across every track, so a consumer can size a viewBox in one pass) and
`tracks[]`. Each track has `name`, `team`, `commander`, `is_squad`,
`samples` as `[t_ms, x, y]` triples in **raw world units** rounded to one
decimal, and `down_intervals`/`dead_intervals` as `[start_ms, end_ms]`
pairs. This is the native engine, not the EI-shape one — see
[combat replay](/axilog/methodology/#combat-replay) for why there are two.

`missiles` carries per-squad-player
`{ agent_addr, account, fired, hit, denied, reflected_at_self }` plus a
squad-wide rollup
`{ fired, hit, denied, incoming_fired, incoming_denied }`. `denied` is deliberately
undifferentiated: the arcdps wire format has no blocked/reflected/destroyed
reason code, and there is no per-player "denier" credit anywhere, so none
is invented.

## The EI-compat surface

`--format ei-json` (SDK: `parseFileEi` / `parse_file_ei`) emits a subset of
the real Elite Insights / dps.report JSON shape. On the committed fixture
the top level is:

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

and each `players[]` entry carries `account`, `character_name`,
`profession`, `elite_spec`, `group`, `teamID`, `notInSquad`,
`hasCommanderTag`, `activeTimes`, `dpsAll`, `statsAll`, `statsTargets`,
`defenses`, `support`, `buffUptimes`, `extHealingStats`,
`extBarrierStats`, and `combatReplayData`. The opt-in blocks add
`totalDamageDist` / `targetDamageDist` / `totalDamageTaken`
(`--skill-damage`), `damage1S` / `targetDamage1S` / `damageTaken1S` /
`dpsTargets` (`--timeseries`), `rotation` (`--rotation`), and
`combatReplayData.{positions, orientations, dc, iconURL}` plus a top-level
`combatReplayMetaData` (`--replay`). The adapter keys off the native
report's own block presence, not a separate flag — so the same CLI flag
controls both formats.

### The parity philosophy

Three rules, and they explain nearly every difference you will find:

1. **Only emit what is backed by a real computed metric.** Where EI has a
   field axilog does not compute — per-target down-contribution splits,
   most damage-modifier detail, skill icons — the key is *omitted*, never
   emitted as a plausible zero. Each omission is documented inline in
   `crates/axilog-ei/src/lib.rs`.
2. **Match EI's shape exactly where it is emitted**, including the
   phase-wrapping conventions (`statsAll` and `totalDamageDist` are
   phase-indexed; `rotation[]` is not, because EI's own isn't) and,
   for replay, the *serialized decimal text* — EI writes C# `float`s, so
   matching the value is not enough.
3. **Where EI is verifiably wrong, emit the correct value.** There is
   exactly one such field: `lifeLeechDamageTakenCount`. EI's own counting
   is buggy; axilog emits the true derived count and documents the
   divergence rather than reproducing the bug for a matching number.

Everything is held to a committed golden — the anonymized fixture plus a
real dps.report EI export of the same log — asserted in CI on every run,
not spot-checked once and left to drift.

The full field-by-field parity table, with the exact/approximate/gap
status and the calibration numbers behind each row, lives in the
[axilog README](https://github.com/darkharasho/axilog#ei-json-parity).
The [accuracy page](/axilog/accuracy/) distils it, including the two open
gaps: damage-modifier attribution, and `wvWMapData`'s per-objective
capture timelines.

## See also

- [Quickstart](/axilog/quickstart/) — installing the CLI and SDKs, and a
  first parse in each.
- [Calculation methodology](/axilog/methodology/) — how each field in this
  schema is derived.
- [axilog overview](/axilog/) — architecture and scope.
