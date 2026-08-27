## The EI-compat surface

Everything above describes the native container. `--format ei-json` (SDK:
`parseFileEi` / `parse_file_ei`) is the other output: a subset of the real
Elite Insights / dps.report JSON shape, for tools that already read EI
exports. It is a separate, permanent layer — not a transitional one — and it
is deliberately thin, a translation with no analysis of its own.

Unlike the native container, this shape *does* have a flat `players[]`,
because EI's does.

On the committed fixture, with no opt-in flags, the top level is:

```json
{
  "buffMap": {},
  "durationMS": 49285,
  "eliteInsightsVersion": null,
  "fightName": "Detailed WvW - Green Alpine Borderlands",
  "players": [],
  "recordedBy": "Anon104.4848",
  "skillMap": {},
  "success": true,
  "targets": [],
  "wvWMapData": {
    "blueShardID": 0, "blueTeamID": 433,
    "greenShardID": 0, "greenTeamID": 2767,
    "redShardID": 0,   "redTeamID": 697,
    "objectiveData": []
  }
}
```

`eliteInsightsVersion` is `null` on purpose — axilog is not Elite Insights,
and claiming a version number it does not implement would be a lie to any
consumer that branches on it.

`objectiveData` is EI's per-objective capture-ownership timeline. It is
populated from arcdps's `CBTS_WVWOBJECTIVESTATUS`; it is `[]` above only
because this particular fixture records no objective flips, not because the
field is unimplemented.

Each `players[]` entry carries, with no flags:

`account`, `character_name`, `profession`, `elite_spec`, `group`, `teamID`,
`guildID`, `instanceID`, `notInSquad`, `hasCommanderTag`, `activeTimes`,
`dpsAll`, `statsAll`, `statsTargets`, `defenses`, `support`, `buffUptimes`,
`selfBuffs`, `groupBuffs`, `squadBuffs`, `extHealingStats`,
`extBarrierStats` and `combatReplayData`.

`targets[]` entries carry `id`, `name`, `profession`, `teamID`,
`instanceID`, `enemyPlayer`, `isFake` and `dpsAll`.

The opt-in flags add their EI counterparts:

| Flag | Adds |
| --- | --- |
| `--skill-damage` | `totalDamageDist`, `targetDamageDist`, `totalDamageTaken` |
| `--timeseries` | `damage1S`, `targetDamage1S`, `damageTaken1S`, `powerDamageTaken1S`, `targetPowerDamage1S`, `dpsTargets`, `boonsStates`, `healthPercents` |
| `--rotation` | `rotation` |
| `--modifiers` | `damageModifiers`, `damageModifiersTarget`, `incomingDamageModifiers`, `incomingDamageModifiersTarget`, and a top-level `damageModMap` |
| `--replay` | `combatReplayData.{positions, orientations, dc, iconURL}` and a top-level `combatReplayMetaData` |
| `--missiles` | *(nothing — no EI equivalent; native-only)* |

The adapter keys off the native report's own block presence, not a separate
flag, so one flag controls both formats. Several of those gates are GW2EI's
own: `healing1S`, `healthPercents` and the buff state arrays ride
`--timeseries` because EI puts them behind `RawFormatTimelineArrays`.

### Phase conventions

`statsAll`, `defenses`, `support`, `dpsAll`, `totalDamageDist`, `damage1S`
and friends are phase-indexed arrays with exactly one element — axilog does
not model phases, and a WvW log has one. `rotation[]` is *not* phase-wrapped,
matching real EI. `damageModifiers[]`'s inner array is EI's per-phase
dimension, again one element.

### Memory: the streaming serializer

The CLI's `ei-json` path **streams**. Before MSTREAM it materialized the
whole document as a `serde_json::Value` tree — ~366 MB of nodes, walked into
a ~366 MB string, then written — which peaked at 2.4 GiB on a real
583k-event log. It now allocates one player row at a time and writes through
a 1 MiB buffer: peak RSS **−95% (20×)**, with the output verified
byte-identical across 96 flag and output combinations. The wall-clock
improvement (−33% on that run) is a side effect, not a separate
optimization.

The SDK path is different by necessity: napi and pythonize both walk a tree,
so `to_ei_json` must hand back a materialized value and there is nothing to
stream away. Three implementations were measured against each other; the
shipped one is both the lightest and the fastest, and removes the second
definition of the format.

The native `--format json` path was deliberately **not** changed. It was
never the problem.

### The parity philosophy

Three rules, and they explain nearly every difference you will find:

1. **Only emit what is backed by a real computed metric.** Where EI has a
   field axilog does not compute, the key is *omitted*, never emitted as a
   plausible zero. Each omission is documented inline in the EI adapter.
2. **Match EI's shape exactly where it is emitted**, including the
   phase-wrapping conventions (`statsAll` and `totalDamageDist` are
   phase-indexed; `rotation[]` is not, because EI's own isn't) and, for
   replay, the *serialized decimal text* — EI writes C# `float`s, so
   matching the value is not enough.
3. **Where EI is verifiably wrong, emit the correct value** and document the
   divergence, rather than reproducing the bug for the sake of a matching
   number. There are three such places, each traced to the line in GW2EI
   that causes it — see the
   [parity page](/axilog/parity/#verified-ei-bugs-axilog-does-not-reproduce).

Everything is held to a committed golden — the anonymized fixture plus a
real dps.report EI export of the same log — asserted in CI on every run, not
spot-checked once and left to drift.

### Where the two formats differ on icons

The native container carries skill art: `catalogs.skills[].icon` is a
`render.guildwars2.com` URL, resolved from the GW2 API first and GW2EI's
buff table second, so boons and conditions are covered too even though
ArenaNet's `/v2/skills` endpoint has no record of them. On the committed
fixture that is 426 of 434 catalogued skills (as of 1.7.0, which also
resolves display names through the GW2 API and strips the wire format's
leading colon from account names everywhere).

The EI-compat layer does **not** expose them — its `skillMap` and `buffMap`
entries carry names and classifier flags but no icon field. That is a real,
open parity gap rather than a deliberate omission, and a consumer that needs
art should read the native container's catalog.

## See also

- [Quickstart](/axilog/quickstart/) — installing the CLI and SDKs, and a
  first parse in each.
- [Calculation methodology](/axilog/methodology/) — how each field in this
  schema is derived.
- [Accuracy & calibration](/axilog/accuracy/) — what is verified against
  real EI exports, and what is still approximate.
- [Parity & divergences](/axilog/parity/) — where the EI-compat surface
  intentionally differs from EI, and why each difference is a decision.
- [axilog overview](/axilog/) — architecture and scope.
