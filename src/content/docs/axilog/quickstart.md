---
title: axilog quickstart
description: Install the axilog CLI from a GitHub Release, tour parse's formats, views and six opt-in flags, and run a first parse from the Node and Python SDKs — with real output from the project's committed WvW fixture.
source: community
---

Everything on this page was run against [axilog](/axilog/) **0.3.1** and
the project's committed, anonymized WvW fixture
(`fixtures/wvw-small.anon.zevtc` — 42 players, 49.3 s, Green Alpine
Borderlands). The `:Anon<N>.<digits>` account names in the output are the
fixture's own placeholders, not redactions.

## CLI

### Install

Prebuilt binaries and a consolidated `SHA256SUMS` are attached to every
[GitHub Release](https://github.com/darkharasho/axilog/releases). Targets
published per release: `x86_64-unknown-linux-gnu`,
`aarch64-unknown-linux-gnu`, `x86_64-pc-windows-msvc` (`.zip`),
`x86_64-apple-darwin`, `aarch64-apple-darwin`.

Verify the checksum before extracting:

```sh
VER=0.3.1
TARGET=x86_64-unknown-linux-gnu
BASE=https://github.com/darkharasho/axilog/releases/download/v$VER

curl -LO $BASE/axilog-$VER-$TARGET.tar.gz
curl -LO $BASE/axilog-$VER-$TARGET.tar.gz.sha256

sha256sum -c axilog-$VER-$TARGET.tar.gz.sha256
# axilog-0.3.1-x86_64-unknown-linux-gnu.tar.gz: OK

tar xzf axilog-$VER-$TARGET.tar.gz
./axilog --version
# axilog 0.3.1
```

Each archive contains a single `axilog` binary — put it anywhere on your
`PATH`. On Windows the archive is a `.zip` and the per-asset checksum file
works the same way; the release's `SHA256SUMS` covers every asset at once
if you'd rather verify them all together.

Building from source needs only a Rust toolchain:

```sh
cargo build --workspace --release   # binary at target/release/axilog
```

### A first parse

`--format table` is the fastest way to see whether a log parsed sensibly:

```sh
axilog parse fight.zevtc --format table
```

```text
account                  profession       damage      DPS  downs  kills  deaths
:Anon104.4848            Engineer         205612     4172      1      0       0
:Anon171.7327            Engineer         192437     3905      2      1       0
:Anon110.5070            Necromancer      169689     3443      4      0       0
:Anon116.5292            Necromancer      162652     3300      1      0       0
:Anon107.4959            Mesmer           154899     3143      0      0       0
```

Both `.zevtc` (zipped) and raw `.evtc` are accepted.

### Formats

| `--format` | What you get |
| --- | --- |
| `json` *(default)* | The native report — everything axilog computes. See the [schema reference](/axilog/schema/). |
| `table` | One row per player, human-readable, sorted by the active `--view`'s key. |
| `csv` | The default view's per-player fields, machine-readable. |
| `ei-json` | A subset of Elite Insights' JSON shape, for tools that already read EI exports. |
| `html` | One self-contained interactive report — CSS, JS and data all inlined, zero network requests. |

`-o/--output FILE` writes to a file instead of stdout, and works with
every format — not just `html`:

```sh
axilog parse fight.zevtc --format html -o report.html
axilog parse fight.zevtc --format ei-json -o fight.ei.json
```

The `ei-json` writer **streams**: it serializes one player row at a time
through a buffered writer rather than building the whole document in
memory. On a real 583k-event log with every flag on, that is the
difference between a 2.4 GiB peak and a 117 MiB one.

### Views

`--view` changes the `table` format's columns and sort key. It is ignored
by every other format, which always emit their full field set.

```sh
axilog parse fight.zevtc --format table --view support
```

```text
account                  profession    cleanses  strips resurrects stunbreaks
:Anon133.5921            Elementalist        93       0          0          1
:Anon118.5366            Mesmer              76       1          0          1
:Anon125.5625            Ranger              66       0          0          0
```

| `--view` | Columns |
| --- | --- |
| `default` | damage / DPS / downs / kills / deaths |
| `support` | condi cleanses / boon strips / resurrects / stun breaks |
| `boons` | Might average stacks, plus presence % for Quickness, Alacrity, Stability, Protection |
| `healing` | healing out (total), to allies, barrier out, downed-ally healing |
| `defense` | blocks / evades / dodges, damage taken with a strike-vs-condi split, downs taken |
| `rotation` | animated-cast count and APM (casts per minute of *active* time) |

```sh
axilog parse fight.zevtc --format table --view boons
```

```text
account                  profession   Might(avg)  Quick%   Alac%   Stab%   Prot%
:Anon104.4848            Engineer          19.43    66.2     0.0    72.7    90.9
:Anon105.4885            Ranger            10.17    31.3     0.0    79.5    67.6
:Anon106.4922            Guardian          13.82    44.5     0.0    70.1    98.0
```

`--view healing` renders `-` per row rather than misleading zeros when the
log carries no arcdps healing-extension data at all.

Note that `--view rotation` does **not** require `--rotation`. The cast
analysis always runs; the flag only controls whether per-cast detail is
serialized into JSON.

### Opt-in blocks

Six flags add expensive blocks to the JSON outputs.

```sh
axilog parse fight.zevtc --skill-damage --timeseries --rotation -o full.json
```

| Flag | Adds |
| --- | --- |
| `--skill-damage` | Per-player damage grouped by skill id — outgoing, per-target, and incoming. |
| `--timeseries` | Per-player cumulative per-second series, plus the per-enemy DPS summary. |
| `--rotation` | Per-player cast lists grouped by skill id. |
| `--replay` | Position tracks on a 300 ms grid, with down/dead intervals. Also feeds the `html` report's replay tab. |
| `--missiles` | Projectile fired/hit/denied counts, per player and squad-wide. |
| `--modifiers` | Per-player trait/rune/relic/sigil/food damage-modifier attribution, plus the descriptor map. |

Five of the six cost **bytes, not parse time** — the underlying analyses
run either way. `--modifiers` is the exception: it gates the computation,
not just the serialization, because the modifier engine is a separate pass
over every damage event crossed with a ~200-definition catalog. On the
committed fixture an `ei-json` run goes 0.074 s → 0.155 s with it on.

`--skill-damage`, `--timeseries`, `--rotation` and `--modifiers` also
unlock their counterparts in `--format ei-json` (`totalDamageDist`,
`damage1S`, `rotation[]`, `damageModifiers`, and friends); `--replay` adds
EI's own pixel-coordinate `combatReplayData`. `--missiles` has no EI
equivalent and is native-only. See
[always-on vs opt-in](/axilog/schema/#always-on-vs-opt-in) for what each
one costs in bytes.

### Anonymize before sharing

Real logs contain real GW2 account names.

```sh
axilog anonymize fight.zevtc fight.anon.zevtc
```

Every player agent's character and account name becomes a deterministic
`Anon<N>` / `:Anon<N>.<4 digits>` placeholder, and guild GUIDs are zeroed
(mirroring GW2EI's own `GuildEvent.Anonymize()`). Every other byte — the
whole event stream, the skill table, NPC and gadget agents — is preserved
exactly, so parsed metrics are identical before and after. Do this before
filing a bug report, sharing a log publicly, or committing a fixture.

## Node

```sh
npm install @axiapps/axilog
```

The published package is a napi-rs native addon, not a subprocess wrapper
— npm resolves the right platform package (`linux-x64-gnu`,
`darwin-arm64`, `win32-x64-msvc`, …) as an optional dependency.

```js
const { parseFile } = require('@axiapps/axilog')

const report = parseFile('./fight.zevtc')

console.log(report.schema_version, report.encounter.map, report.encounter.duration_ms)

const squadDamage = report.players.reduce((sum, p) => sum + p.damage.total, 0)
console.log(report.players.length, 'players,', squadDamage, 'squad damage')

const top = [...report.players].sort((a, b) => b.damage.total - a.damage.total)[0]
const quickness = top.boons.find((b) => b.name === 'Quickness')
console.log(top.account, top.profession, top.damage.total, quickness.presence_pct.toFixed(1))
```

```text
0.2 Green Alpine Borderlands 49285
42 players, 2138414 squad damage
:Anon104.4848 Engineer 205612 66.2
```

`presence_pct` is a full-precision `f64`; the table view rounds it to one
decimal for display.

Opt-in blocks go in a second argument, in **camelCase**:

```js
const report = parseFile('./fight.zevtc', { skillDamage: true, rotation: true })

const p = report.players.find((p) => p.account === ':Anon104.4848')
console.log(p.skill_damage.outgoing.length, 'skills;', p.rotation.length, 'rotation entries')
console.log(p.skill_damage.outgoing[0])
```

```text
18 skills; 15 rotation entries
{ crit_hits: 0, flank_hits: 34, hits: 62, max: 1268, min: 1, skill_id: 736, total: 13782 }
```

Note the asymmetry: the *options* object is camelCase (`skillDamage`),
while the *report* keys are the schema's own snake_case (`skill_damage`).
The options are a napi-generated JS surface; the report is the native JSON
verbatim.

`ParseOptions` accepts `replay`, `skillDamage`, `timeseries`, `missiles`,
`rotation` and `modifiers`. The rest of the API is
`parseBuffer(buf, opts?)` for already-read bytes, `parseFileEi(path,
opts?)` for the EI-compat shape, and `anonymizeFile(inPath, outPath)`,
which returns the number of player agents rewritten. Types ship with the
package —
[`types.d.ts`](https://github.com/darkharasho/axilog/blob/main/crates/axilog-node/types.d.ts)
is the typed `Report`.

## Python

```sh
pip install axilog
```

Wheels are `cp39-abi3`, so one wheel per platform covers every CPython 3.9
and newer. It is a PyO3 extension module over the same Rust core, and
`parse_file` returns plain dicts and lists.

```python
import axilog

report = axilog.parse_file("./fight.zevtc")

print(report["schema_version"], report["encounter"]["map"], report["encounter"]["duration_ms"])

squad_damage = sum(p["damage"]["total"] for p in report["players"])
print(len(report["players"]), "players,", squad_damage, "squad damage")

top = max(report["players"], key=lambda p: p["damage"]["total"])
quickness = next(b for b in top["boons"] if b["name"] == "Quickness")
print(top["account"], top["profession"], top["damage"]["total"], round(quickness["presence_pct"], 1))
```

```text
0.2 Green Alpine Borderlands 49285
42 players, 2138414 squad damage
:Anon104.4848 Engineer 205612 66.2
```

Opt-in blocks are keyword arguments, in snake_case, all defaulting to
`False`:

```python
report = axilog.parse_file("./fight.zevtc", skill_damage=True, timeseries=True)

p = next(p for p in report["players"] if p["account"] == ":Anon104.4848")
print(len(p["skill_damage"]["outgoing"]), "skills;", len(p["per_second"]["damage"]), "seconds")
print(p["per_second"]["damage"][20:28])
```

```text
18 skills; 50 seconds
[79307, 82180, 101155, 108740, 119234, 139715, 148405, 156394]
```

Those are cumulative running totals, one per second — not per-second
deltas. The last entry equals that player's whole-fight `damage.total`.

### Damage modifiers from Python

`modifiers=True` fills `players[].damage_mods` and the top-level
`damage_mod_map`:

```python
report = axilog.parse_file("./fight.zevtc", modifiers=True)

p = next(p for p in report["players"] if p["account"] == ":Anon104.4848")
mods = report["damage_mod_map"]
for e in p["damage_mods"]["outgoing"][:3]:
    print(mods[str(e["id"])]["name"], e["hit_count"], "/", e["total_hit_count"], e["damage_gain"])
```

```text
Moving Bonus 118 / 226 5242.952
Excessive Energy 98 / 226 5078.0
Relic of the Eagle 64 / 226 7080.636
```

`damage_gain` is the modifier's share of the *observed* damage, which
already contains the bonus — see
[the gain formula](/axilog/damage-modifiers/#why-g100g-and-not-g100).

For the EI-compat shape, `parse_file_ei` takes the same flags as
keyword-only arguments:

```python
ei = axilog.parse_file_ei("./fight.zevtc")
print(ei["fightName"], ei["durationMS"], len(ei["players"]))
print(ei["players"][0]["account"], ei["players"][0]["dpsAll"][0]["damage"])
```

```text
Detailed WvW - Green Alpine Borderlands 49285 42
:Anon104.4848 205612
```

The rest of the API is `parse_bytes(data, ...)` and
`anonymize_file(in_path, out_path)`. `parse_file` raises `OSError` if the
path cannot be read and `ValueError` if the bytes are not a decodable
arcdps log. Types ship as
[`axilog.pyi`](https://github.com/darkharasho/axilog/blob/main/crates/axilog-py/axilog.pyi)
— one `TypedDict` per schema block.

## See also

- [Output schema](/axilog/schema/) — every block in the native report, and
  the EI-compat surface.
- [Calculation methodology](/axilog/methodology/) — how the numbers above
  are derived.
- [Damage modifiers](/axilog/damage-modifiers/) — what `--modifiers`
  actually computes.
- [axilog overview](/axilog/) — architecture, scope and differentiators.
