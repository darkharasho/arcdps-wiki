---
title: axilog
description: A cross-platform, CLI-first reimplementation of Elite Insights for arcdps EVTC logs — Rust core, Node and Python SDKs, WvW-first, calibrated against EI.
source: community
---

[axilog](https://github.com/darkharasho/axilog) is a cross-platform,
CLI-first parser for arcdps EVTC logs: a Rust core
(`axilog-core`) with a Node SDK ([`@axiapps/axilog`](https://www.npmjs.com/package/@axiapps/axilog),
napi-rs) and a Python SDK ([`axilog`](https://pypi.org/project/axilog/),
PyO3) layered on it, plus a `axilog` binary that emits its own native
JSON, a subset of Elite Insights' JSON shape, CSV, a terminal table, or a
single-file interactive HTML report. It reimplements
[Elite Insights](/guides/ecosystem/) rather than wrapping it, and the
metrics it covers are calibrated against a real dps.report EI export in
CI on every run.

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
  numbers are held exact-to-near-exact against a committed golden fixture.
- **Closer to the arcdps spec where EI diverges.** A handful of metrics
  follow the methodology relayed by the arcdps developer rather than EI's
  own approximation — see [Differentiators](#differentiators).

## Architecture

One Cargo workspace, seven crates:

| Crate | Role |
| --- | --- |
| `axilog-core` | Decode, resolution and all analysis. The only place log semantics live. |
| `axilog-schema` | The native report type (`Report`) and its serialization. |
| `axilog-ei` | Adapter that maps a `Report` into Elite Insights' JSON shape. |
| `axilog-cli` | The `axilog` binary — `parse`, `anonymize`, output formats and views. |
| `axilog-node` | napi-rs native addon (`@axiapps/axilog`). |
| `axilog-py` | PyO3 `abi3-py39` extension module (`axilog`). |
| `axilog-html` | Self-contained HTML report renderer (inlined CSS/JS/JSON, zero network requests). |

Every front end drives the same four-stage pipeline; there is no second
implementation to drift:

1. **Decode** — unwrap the `.zevtc` zip, read the header, agent table,
   skill table and the 64-byte event stream (see
   [EVTC log format](/reference/evtc-format/) and
   [parsing EVTC logs](/guides/parsing-logs/)).
2. **Resolve** — agents to players/NPCs/gadgets, instance ids to agent
   addresses *at a point in time* (arcdps recycles instids), minions to
   masters, and WvW teams to friend/foe via the log's own
   `CBTS_WVWTEAMS` event with a static id→colour fallback.
3. **Analyze** — damage, downs/kills/deaths, the contribution family, CC
   and stun breaks, boon simulation and generation attribution, support
   stats, healing-extension data, per-skill and per-second series, hit
   quality, defenses, rotation, and combat replay.
4. **Emit** — native JSON, `ei-json`, CSV, table, or HTML.

Expensive analyses (replay, missiles, per-skill damage, per-second
series, rotation detail) are opt-in flags, because each one materially
inflates the output: on the committed fixture, per-skill damage alone is
+249% JSON size and per-second series +148%.

## Differentiators

These are the places axilog deliberately does not reproduce Elite
Insights. Each is explained in full on the
[methodology](/axilog/methodology/) page.

- **arcdps-methodology down contribution.** EI's `downContribution` uses
  its own algorithm. axilog implements the methodology relayed by the
  arcdps developer: a health-anchored attribution window rather than a
  fixed lookback, four separate contribution stats (damage, CC, boon
  strips, movement impairment), computed in both directions.
- **CC over time.** CC applications and durations are tracked as real
  `CROWD_CONTROL`-result events with era-correct decoding, and land in a
  per-second timeline alongside damage and downs.
- **Full timeline support.** A per-second squad damage / CC-applied /
  downs series, plus per-player cumulative damage and damage-taken
  series, exist natively. EI's JSON has no comparable whole-log series
  for WvW.
- **True life-leech counts.** EI's own `lifeLeechDamageTakenCount` has a
  verified counting bug; axilog emits the correct derived count rather
  than reproducing the bug for the sake of a matching number. This is the
  one field in `ei-json` that intentionally differs.

## Scope

**WvW-first.** Every calibrated metric was validated against real WvW
logs. PvE encounter logic (boss health phases, mechanics, phase splits)
is not implemented — the native report exposes a single whole-fight
phase.

**Both log eras.** arcdps changed how boon apply/remove, CC results, and
cast-animation events are written on the wire around build `20260501`
(GW2EI's `BuffAppliesAndRemovesAsStateChanges` / `ResultEnumRework`
thresholds, with `AnimationAsStateChanges` one day earlier). Pre-era logs
report these as ordinary `is_statechange == 0` combat events; post-era
logs use dedicated statechanges (`BUFF_APPLY`, `BUFF_CHANGE`,
`BUFF_REMOVE_SINGLE`, `BUFF_REMOVE_ALL`, `ANIMATION_START`/`_STOP`), and
genuine CC can arrive on `buff == 1` rows. axilog era-gates every
affected extractor off the header build string and supports both;
pre-era is fully calibrated against a dps.report export, post-era is
calibrated for hit quality, defenses and replay and verified by
construction elsewhere.

**Performance.** A real 583k-event WvW log (48 players, 5:48) decodes,
resolves, analyzes and serializes in ~174 ms single-threaded on a Ryzen
9 7900X3D — including down contribution, boons and generation, support,
healing, per-skill damage, per-second series, hit quality, defenses and
rotation. The committed fixture (120k events) takes ~29 ms.

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
character/account name to a deterministic `Anon<N>` placeholder in place
and preserves every other byte — including the whole event stream — so
parsed metrics are byte-identical before and after. Use it before filing
a bug report, sharing a log, or committing a fixture.

## See also

- [Calculation methodology](/axilog/methodology/) — how each metric is
  derived, and what it is grounded in.
- [Ecosystem](/guides/ecosystem/) — the wider arcdps tool landscape.
- [Reading damage from logs](/guides/reading-damage/) — the raw-event
  rules axilog's damage accumulation implements.
