---
title: axilog
description: A cross-platform, CLI-first reimplementation of Elite Insights for arcdps EVTC logs — Rust core, Node and Python SDKs, WvW-first, calibrated against EI on every CI run and faster than EI on every measured axis.
source: community
---

[axilog](https://github.com/darkharasho/axilog) is a cross-platform,
CLI-first parser for arcdps EVTC logs: a Rust core (`axilog-core`) with a
Node SDK ([`@axiapps/axilog`](https://www.npmjs.com/package/@axiapps/axilog),
napi-rs) and a Python SDK ([`axilog`](https://pypi.org/project/axilog/),
PyO3) layered on it, plus an `axilog` binary that emits its own native
JSON, a subset of Elite Insights' JSON shape, CSV, a terminal table, or a
single-file interactive HTML report. It reimplements
[Elite Insights](/guides/ecosystem/) rather than wrapping it, and the
metrics it covers are calibrated against a real dps.report EI export in
CI on every run.

Current release: **v0.3.2**.

## Why it exists

- **Cross-platform.** EI is a Windows-targeted C# application. axilog
  ships prebuilt binaries for Linux (x86-64/aarch64), Windows, and macOS
  (Intel/Apple Silicon), and its SDKs are native extension modules — not
  subprocess wrappers around a bundled parser.
- **CLI-first.** The command line and the library API are the primary
  interfaces; the HTML report is a rendering of the same data structure,
  not a separate pipeline.
- **EI parity where EI is right.** Where a metric exists in both, the
  GW2EI source is treated as the arbiter for ambiguous field roles, and
  numbers are held exact-to-near-exact against committed golden fixtures.
- **Closer to the arcdps spec where EI diverges.** A handful of metrics
  follow the methodology relayed by the arcdps developer rather than EI's
  own approximation — see [Differentiators](#differentiators).
- **Faster and far lighter.** Against the Elite Insights CLI on the same
  logs and a matched output surface: **2.9× faster and 7.3× lighter** on a
  real 583k-event zerg fight, **9.7× / 15×** on a 120k-event skirmish, and
  20–40× on axilog's own default output. See
  [accuracy & calibration](/axilog/accuracy/#against-the-elite-insights-cli).

## Architecture

One Cargo workspace, seven crates:

| Crate | Role |
| --- | --- |
| `axilog-core` | Decode, resolution and all analysis. The only place log semantics live. |
| `axilog-schema` | The native report format **1.0** container and its serialization. |
| `axilog-ei` | Adapter that maps that container into Elite Insights' JSON shape, with a streaming writer for the CLI path. |
| `axilog-cli` | The `axilog` binary — `parse`, `anonymize`, output formats and views. |
| `axilog-node` | napi-rs native addon (`@axiapps/axilog`). |
| `axilog-py` | PyO3 `abi3-py39` extension module (`axilog`). |
| `axilog-html` | Self-contained HTML report renderer (inlined CSS/JS/JSON, zero network requests). |

Every front end drives the same four-stage pipeline; there is no second
implementation to drift:

1. **Decode** — unwrap the `.zevtc` zip, read the header, agent table,
   skill table and the 64-byte event stream (see
   [EVTC log format](/reference/evtc-format/) and
   [parsing EVTC logs](/guides/parsing-logs/)), then run the
   [orphaned-instid repair](/axilog/methodology/#decode-the-orphaned-instid-repair)
   so every downstream pass reads one repaired stream.
2. **Resolve** — agents to players/NPCs/gadgets, instance ids to agent
   addresses *at a point in time* (arcdps recycles instids), minions to
   masters, enemy players regrouped by instid, and WvW teams to friend/foe
   via the log's own `CBTS_WVWTEAMS` event with a static id→colour
   fallback.
3. **Analyze** — damage, downs/kills/deaths, the contribution family, CC
   and stun breaks, boon simulation with generation and waste attribution,
   support stats, healing-extension data, per-skill and per-second series,
   hit quality, defenses, rotation, damage modifiers, and two combat
   replays.
4. **Emit** — native JSON, `ei-json`, CSV, table, or HTML.

Expensive analyses are opt-in flags, because each one materially inflates
the output — on the committed fixture, per-skill damage and per-second
series each grow the native JSON more than sevenfold on their own. The cost
is not all the same kind: most gate only *serialization*, but `--replay` and
`--modifiers` gate the computation itself, so those two cost real parse time
rather than just bytes. `--all` turns on everything the build knows about.
See the [quickstart](/axilog/quickstart/#opt-in-gates) for the measured
table.

## Differentiators

These are the places axilog deliberately does not reproduce Elite
Insights. Each is explained in full on the
[parity & divergences](/axilog/parity/) page.

- **arcdps-methodology down contribution.** EI's `downContribution` uses
  its own algorithm. axilog implements the methodology relayed by the
  arcdps developer: a health-anchored attribution window rather than a
  fixed lookback, four separate contribution stats (damage, CC, boon
  strips, movement impairment), computed in both directions, and split per
  skill.
- **CC over time.** CC applications and durations are tracked as real
  `CROWD_CONTROL`-result events with era-correct decoding, and land in a
  per-second timeline alongside damage and downs.
- **Full timeline support.** A per-second squad damage / CC-applied /
  downs series, plus per-player cumulative damage and damage-taken series,
  exist natively. EI's JSON has no comparable whole-log series for WvW.
- **Three EI bugs it declines to copy.** `lifeLeechDamageTakenCount` (a
  double increment that leaves the count field permanently zero),
  `boonStripsTime` in both directions (a `Math.Max` where `Min` was
  intended), and a trailing default replay sample on logs whose duration
  is a whole multiple of the polling rate. In each case axilog emits the
  correct value and documents the divergence.

## Scope

**WvW-first.** Every calibrated metric was validated against real WvW
logs. PvE encounter logic (boss health phases, mechanics, phase splits) is
not implemented — the native report exposes a single whole-fight phase.

**Both log eras, both calibrated.** arcdps changed how boon apply/remove,
CC results, and cast-animation events are written on the wire around build
`20260501` (GW2EI's `BuffAppliesAndRemovesAsStateChanges` /
`ResultEnumRework` thresholds, with `AnimationAsStateChanges` one day
earlier). Pre-era logs report these as ordinary `is_statechange == 0`
combat events; post-era logs use dedicated statechanges (`BUFF_APPLY`,
`BUFF_CHANGE`, `BUFF_REMOVE_SINGLE`, `BUFF_REMOVE_ALL`,
`ANIMATION_START`/`_STOP`), and genuine CC can arrive on `buff == 1` rows.
axilog era-gates every affected extractor off the header build string and
supports both. The pre-era path is calibrated against a committed
dps.report export; the post-era path is now calibrated against a real
post-rework capture and its export too — 44 accounts and 56 enemy-player
targets.

**Performance.** A real 583k-event WvW log (48 players, 5:48) decodes,
resolves, analyzes and serializes in ~174 ms single-threaded on a Ryzen 9
7900X3D, with no `unsafe`. The committed fixture (120k events) takes
~29 ms.

## Documentation map

| Page | For |
| --- | --- |
| [Quickstart](/axilog/quickstart/) | Installing the CLI and SDKs, the command surface, a first parse in each |
| [Calculation methodology](/axilog/methodology/) | How each metric is derived, and what each rule is grounded in |
| [Damage modifiers](/axilog/damage-modifiers/) | The 205-definition catalog, the gain formula, coverage and residuals |
| [Buffs & boons](/axilog/buffs/) | The stack simulation, generation, waste, and the state timelines |
| [Combat replay](/axilog/combat-replay/) | Both engines, the polling grid, map geometry, float discipline |
| [Output schema](/axilog/schema/) | Every block in the native report, and the EI-compat surface |
| [Accuracy & calibration](/axilog/accuracy/) | The fixtures, the current numbers, the performance comparison |
| [Parity & divergences](/axilog/parity/) | Where axilog intentionally differs from EI, and why |

## Getting it

```sh
# Node
npm install @axiapps/axilog

# Python
pip install axilog
```

CLI binaries and checksums are attached to each
[GitHub Release](https://github.com/darkharasho/axilog/releases). See the
[quickstart](/axilog/quickstart/) for installation, the command surface,
output formats and a first parse in each SDK.

## Privacy

Real `.zevtc` logs contain real GW2 account names.
`axilog anonymize <in> <out>` rewrites every player agent's
character/account name to a deterministic `Anon<N>` placeholder in place,
zeroes guild GUIDs, and preserves every other byte — including the whole
event stream — so parsed metrics are byte-identical before and after. Use
it before filing a bug report, sharing a log, or committing a fixture.
Raw logs are never committed to the repository; the local calibration
captures live in a gitignored directory and every test that needs one
skips gracefully when it is absent.

## See also

- [Ecosystem](/guides/ecosystem/) — the wider arcdps tool landscape.
- [Reading damage from logs](/guides/reading-damage/) — the raw-event
  rules axilog's damage accumulation implements.
- [WvW allies & enemies](/guides/wvw-allies-and-enemies/) — the friend/foe
  problem axilog's team resolution solves.
