---
title: axilog quickstart
description: Install the axilog CLI from a GitHub Release, tour parse's formats, views and opt-in gates, and run a first parse from the Node and Python SDKs — with real output from the project's committed WvW fixture.
source: community
---

Everything on this page was run against [axilog](/axilog/) **1.7.0** and
the project's committed, anonymized WvW fixture
(`fixtures/wvw-small.anon.zevtc` — 49.3 s on Green Alpine Borderlands, 122
tracked entities, of which 42 are friendly players and 38 are squad
members). Those three counts are why the numbers below differ depending on
what is being counted. The `Anon<N>.<digits>` account names in the output
are the fixture's own placeholders, not redactions. (arcdps writes account
names with a leading colon on the wire; axilog has stripped it from every
output since 0.3.7.)

## CLI

### Install

Prebuilt binaries and a consolidated `SHA256SUMS` are attached to every
[GitHub Release](https://github.com/darkharasho/axilog/releases). Targets
published per release: `x86_64-unknown-linux-gnu`,
`aarch64-unknown-linux-gnu`, `x86_64-pc-windows-msvc` (`.zip`),
`x86_64-apple-darwin`, `aarch64-apple-darwin`.

Verify the checksum before extracting:

```sh
VER=1.7.0
TARGET=x86_64-unknown-linux-gnu
BASE=https://github.com/darkharasho/axilog/releases/download/v$VER

curl -LO $BASE/axilog-$VER-$TARGET.tar.gz
curl -LO $BASE/axilog-$VER-$TARGET.tar.gz.sha256

sha256sum -c axilog-$VER-$TARGET.tar.gz.sha256
# axilog-1.7.0-x86_64-unknown-linux-gnu.tar.gz: OK

tar xzf axilog-$VER-$TARGET.tar.gz
./axilog --version
# axilog 1.7.0
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
Anon104.4848             Engineer         205612     4172      1      0       0
Anon171.7327             Engineer         192437     3905      2      1       0
Anon110.5070             Necromancer      169689     3443      4      0       0
Anon116.5292             Necromancer      162652     3300      1      0       0
Anon107.4959             Mesmer           154899     3143      0      0       0
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
Anon133.5921             Elementalist        93       0          0          1
Anon118.5366             Mesmer              76       1          0          1
Anon125.5625             Ranger              66       0          0          0
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
Anon104.4848             Engineer          19.43    66.2     0.0    72.7    90.9
Anon105.4885             Ranger            10.17    31.3     0.0    79.5    67.6
Anon106.4922             Guardian          13.82    44.5     0.0    70.1    98.0
```

`--view healing` renders `-` per row rather than misleading zeros when the
log carries no arcdps healing-extension data at all.

Note that `--view rotation` does **not** require `--rotation`. The cast
analysis always runs; the flag only controls whether per-cast detail is
serialized into JSON.

### Opt-in gates

Six flags add blocks to the JSON outputs, plus `--all`, which turns on
everything at once.

```sh
axilog parse fight.zevtc --skill-damage --timeseries --rotation -o full.json
axilog parse fight.zevtc --all -o everything.json
```

| Flag | Adds |
| --- | --- |
| `--skill-damage` | Per-skill outgoing and incoming splits under `blocks.damage`. |
| `--timeseries` | Per-entity per-second channels in `blocks.series` (including `healing_received_1s` / `barrier_received_1s` since 1.1.0), the buff stack timelines in `blocks.boons` and `blocks.conditions`, and the `blocks.self_effects` condition/control uptimes (since 1.3.0). |
| `--rotation` | Per-entity cast lists and aftercast detail in `blocks.rotation`. |
| `--replay` | Position tracks in `blocks.replay.tracks`. Also feeds the `html` report's replay tab. |
| `--missiles` | Projectile fired/hit/denied counts, per entity and squad-wide. |
| `--modifiers` | Damage-modifier attribution in `blocks.damage_mods`, plus its catalog. |
| `--all` | Every analysis pass **this version** knows about — a union with the individual flags, never an override. |

Prefer `--all` to enumerating flags if you want complete documents: it is
defined as "everything that exists in this version", so a pass added by a
later release is included automatically rather than silently missing.

They are not free, and they are not all the same kind of cost.
`--skill-damage`, `--timeseries` and `--rotation` only control whether an
already-computed result is serialized. `--replay` and `--modifiers` gate the
computation itself — the modifier engine is a separate pass over every
damage event crossed with ~200 catalogued definitions, and nothing pays for
it unless asked.

Measured on the committed fixture (release build, compact JSON):

| Flag | Bytes | Wall |
| --- | --- | --- |
| *(none)* | 616,949 | 0.10 s |
| `--missiles` | 622,428 | 0.10 s |
| `--rotation` | 960,465 | 0.10 s |
| `--modifiers` | 772,748 | 0.11 s |
| `--replay` | 1,835,476 | 0.14 s |
| `--skill-damage` | 3,498,967 | 0.10 s |
| `--timeseries` | 4,026,051 | 0.12 s |
| `--all` | 8,631,143 | 0.20 s |

(The flagless baseline grew from 0.3.2's 461 kB: 1.7.0's default output
carries the always-on `squad_buffs` block and a larger name-resolved
skill catalog.)

That fixture is a 49-second skirmish, and those ratios do not hold as logs
grow. The per-skill and per-second blocks are combinatorial — entity ×
target × skill and entity × target × second — and a WvW zerg fight
enumerates dozens of enemy players, siege pieces, dolyaks and guards per
player rather than a boss's handful of adds. See the project's
`docs/BENCHMARKS.md` for real-log numbers.

`--skill-damage`, `--timeseries`, `--rotation`, `--modifiers` and `--replay`
also unlock their counterparts in `--format ei-json`; `--missiles` has no EI
equivalent and is native-only. See
[the EI-compat surface](/axilog/schema/#the-ei-compat-surface) for the
field-by-field mapping.

### Always check `coverage`

`coverage` is the container's answer to a question the old flat schema could
not express: whether a missing block means "you didn't ask for it" or "the
log genuinely had none". `empty` is a fact about the log — safe to render as
zero rows. `not_computed` is a fact about your flags — re-parse with the gate
on. The other two values are `present` and `unsupported`; see
[the coverage map](/axilog/schema/#coverage--what-a-blocks-status-means-and-what-to-do-about-it)
for the full table.

### Anonymize before sharing

Real logs contain real GW2 account names.

```sh
axilog anonymize fight.zevtc fight.anon.zevtc
```

Every player agent's character and account name becomes a deterministic
`Anon<N>` / `:Anon<N>.<4 digits>` placeholder on the wire (parsers strip
the arcdps leading colon on output), and guild GUIDs are zeroed
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

console.log(report.axilog)

const squad = report.entities.filter((e) => e.role === 'squad')
const damage = report.blocks.damage
console.log(squad.length, 'squad of', report.entities.length, '| squad damage', damage.squad.total)

const top = squad
  .map((e) => [e, damage.by_entity[e.id]])
  .sort((a, b) => b[1].total - a[1].total)[0]
console.log(top[0].account, top[0].profession, top[1].total, top[1].dps)
```

```text
{ schema: '1.0', version: '1.7.0', generated_from: 'wvw-small.anon.zevtc' }
38 squad of 122 | squad damage 2138414
Anon104.4848 Engineer 205612 4171.898143451354
```

There is no flat `players[]` in the native container — the roster is
`entities[]` filtered by `role`, and per-entity statistics live in
`blocks.<name>.by_entity`, keyed by `entities[].id`. Those keys are JSON
object keys, so they are *strings*; JS numeric indexing coerces for you, but
Python needs `str(id)`.

Opt-in gates go in a second argument, in **camelCase**:

```js
const full = parseFile('./fight.zevtc', { skillDamage: true, rotation: true })

console.log(Object.keys(full.blocks.damage.by_entity['1']).sort())
```

```text
[ 'breakbar_damage_dealt', 'by_skill', 'by_skill_taken', 'downs_dealt',
  'dps', 'kills_dealt', 'per_target', 'taken', 'total' ]
```

Note the asymmetry: the *options* object is camelCase (`skillDamage`),
while the *report* keys are the schema's own snake_case (`by_skill_taken`).
The options are a napi-generated JS surface; the report is the native JSON
verbatim.

`ParseOptions` accepts `replay`, `skillDamage`, `timeseries`, `missiles`,
`rotation`, `modifiers` and `everything` — the last being the SDK mirror of
the CLI's `--all`. The rest of the API is `parseBuffer(buf, opts?)` for
already-read bytes, `parseFileEi(path, opts?)` for the EI-compat shape,
and `anonymizeFile(inPath, outPath)`, which returns the number of player
agents rewritten. Types ship with the package —
[`types.d.ts`](https://github.com/darkharasho/axilog/blob/main/crates/axilog-node/types.d.ts)
exports `ReportV1`.

## Python

```sh
pip install axilog
```

Wheels are `cp39-abi3`, so one wheel per platform covers every CPython
3.9 and newer. It is a PyO3 extension module over the same Rust core, and
`parse_file` returns plain dicts and lists.

```python
import axilog

report = axilog.parse_file("./fight.zevtc")

print(report["axilog"])
print(report["encounter"]["map"], report["encounter"]["duration_ms"])

squad = [e for e in report["entities"] if e["role"] == "squad"]
damage = report["blocks"]["damage"]
print(len(squad), "squad of", len(report["entities"]), "entities")

top = max(squad, key=lambda e: damage["by_entity"][str(e["id"])]["total"])
row = damage["by_entity"][str(top["id"])]
print(top["account"], top["profession"], row["total"], round(row["dps"], 1))
```

```text
{'schema': '1.0', 'version': '1.7.0', 'generated_from': 'wvw-small.anon.zevtc'}
Green Alpine Borderlands 49285
38 squad of 122 entities
Anon104.4848 Engineer 205612 4171.9
```

Names are not repeated per entity — they live once in `catalogs`, and the
blocks reference them by id:

```python
boons = report["blocks"]["boons"]["by_entity"][str(top["id"])]
print(report["catalogs"]["buffs"]["1187"]["name"], round(boons["1187"]["uptime_pct"], 1))
```

```text
Quickness 66.2
```

Opt-in gates are keyword arguments, in snake_case, all defaulting to
`False`: `replay`, `skill_damage`, `timeseries`, `missiles`, `rotation`,
`modifiers` and `everything`.

### Damage modifiers from Python

`modifiers=True` fills `blocks.damage_mods` and the `catalogs.damage_mods`
descriptor map. The per-entity entries are keyed by modifier id, and the
key's **sign** encodes direction — negative ids are incoming modifiers,
positive ids outgoing:

```python
report = axilog.parse_file("./fight.zevtc", modifiers=True)

top = next(e for e in report["entities"] if e["account"] == "Anon104.4848")
mods = report["blocks"]["damage_mods"]["by_entity"][str(top["id"])]["overall"]
cat = report["catalogs"]["damage_mods"]

outgoing = {k: v for k, v in mods.items() if not k.startswith("-")}
for mod_id, e in sorted(outgoing.items(), key=lambda kv: -kv[1]["damage_gain"])[:3]:
    print(cat[mod_id]["name"], e["hit_count"], "/", e["total_hit_count"], e["damage_gain"])
```

```text
Fury 226 / 226 182708.0
Might >= 20 272 / 319 168704.0
Might 25 242 / 319 136539.0
```

`damage_gain` is the modifier's share of the *observed* damage, which
already contains the bonus — see
[the gain formula](/axilog/damage-modifiers/#why-g100g-and-not-g100).

For the EI-compat shape, `parse_file_ei` takes the same flags as
keyword-only arguments. That shape *does* have a flat `players[]`, because
EI's does:

```python
ei = axilog.parse_file_ei("./fight.zevtc")
print(ei["fightName"], ei["durationMS"], len(ei["players"]))
print(ei["players"][0]["account"], ei["players"][0]["dpsAll"][0]["damage"])
```

```text
Detailed WvW - Green Alpine Borderlands 49285 42
Anon104.4848 205612
```

The rest of the API is `parse_bytes(data, ...)` for already-read bytes and
`anonymize_file(in_path, out_path)`, which returns the number of player
agents rewritten. `parse_file` raises `OSError` if the path cannot be read
and `ValueError` if the bytes are not a decodable arcdps log. Types ship as
[`axilog.pyi`](https://github.com/darkharasho/axilog/blob/main/crates/axilog-py/axilog.pyi)
— `parse_file` is typed as returning `ReportV1`.

## See also

- [Output schema](/axilog/schema/) — every block in the native report, and
  the EI-compat surface.
- [Calculation methodology](/axilog/methodology/) — how the numbers above
  are derived.
- [Damage modifiers](/axilog/damage-modifiers/) — what `--modifiers`
  actually computes.
- [axilog overview](/axilog/) — architecture, scope and differentiators.
