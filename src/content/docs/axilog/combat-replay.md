---
title: axilog combat replay
description: The two replay engines axilog runs over the same events — the native world-unit track and the EI-shape map-pixel reproduction — the 300 ms polling grid, awareness widening, the velocity-gated hold branch, the five-map geometry table and the float discipline that makes the output text-exact.
source: community
---

[axilog](/axilog/) has **two** combat-replay engines over the same movement
events. That is a deliberate duplication, not an oversight: the two output
shapes differ in grid bounds, units, interval semantics and rounding, so
reshaping one into the other would be wrong in both directions.

| Engine | Module | Shape | Consumed by |
| --- | --- | --- | --- |
| Native (M9) | `analysis::replay` | Raw world units, samples only where real bracketing position data exists, half-open down/dead intervals | `--format json`'s `replay` block; the HTML report's animated Replay tab |
| EI-shape (M15) | `analysis::ei_replay` | Map **pixels** on GW2EI's own grid, `dc` sentinel bracketing, C# float text | `--format ei-json`'s `combatReplayData` + `combatReplayMetaData` |

One flag, `--replay`, turns on whichever one the chosen format needs.
`--format table` and `csv` ignore it.

The wire formats themselves are not re-derived by the second engine — it
reuses M9's packed-float decoders verbatim. For the raw-event view see
[movement & effects](/guides/movement-and-effects/).

## The source events

Three statechanges, ordinals hand-counted from the arcdps reference and
cross-checked against GW2EI's `ArcDPSEnums`:

| Event | Ordinal | GW2EI name |
| --- | --- | --- |
| `CBTS_POSITION` | 19 | `StateChange.Position` |
| `CBTS_VELOCITY` | 20 | `StateChange.Velocity` |
| `CBTS_FACING` | 21 | `StateChange.Rotation` |

The ordinals were additionally confirmed by an event-count fingerprint on
the real post-rework capture — 61,336 / 57,333 / 50,182 events
respectively, position most frequent and facing least, which is what the
three kinds of telemetry should look like. The packed-float payload
layout comes from GW2EI's `MovementEvent.PackMovementData` /
`UnpackMovementData`, because the arcdps reference text alone does not
spell out where `z` lives.

### Which points survive

The three `MovementEvent` subclasses filter their own payloads before
appending, and the asymmetry matters:

- **`PositionEvent.AddPoint3D`** drops the point when all three components
  are exactly zero, when any is NaN or infinite, or when the XY length
  exceeds **40,000** (`LengthSquared() > 16e8` — outside any real map).
- **`RotationEvent` / `VelocityEvent`** drop only on NaN or infinity. A
  **zero velocity vector is kept**, and that is load-bearing: it is
  exactly what triggers the hold branch below.

## The polling grid

`ParserHelper.CombatReplayPollingRate = 300` — a **compile-time constant**,
not a fight-length-dependent rate, independently confirmed by the
reference export's own `combatReplayMetaData.pollingRate: 300`.

GW2EI's `CombatReplay.PollingRate` computes a start offset from the first
position and rotation samples, but because C# integer division truncates
toward zero and every axilog timestamp is log-relative and non-negative,
that offset is `0` when the first sample is at or after the rate and
`−rate` when it is before. Either way it is a multiple of the rate, so
**the grid is exactly the multiples of 300 ms**, run while
`t < logDuration`.

Polling happens over the **whole log for every actor**; per-actor
narrowing happens afterwards in `Trim`. One consequence worth knowing as a
consumer: `orientations` is always the same length as `positions` whenever
the actor has any facing event at all, and empty otherwise. There is no
independent rotation window.

## Per-actor trimming, and the `PlayerActor` override

`SingleActor.TrimCombatReplay` clamps each actor's window to
`GetActiveSegmentsForCRTrim`, which is **virtual**. The base implementation
returns just the active segments — but `PlayerActor` overrides it
(`PlayerActor.cs:57-66`) to return dead + down + active, sorted by start.

Every actor this engine builds is a player, so the trim window spans down
and dead time too. That is load-bearing: a player downed at *D* and never
revived has `actives = [[FirstAware, D]]` but `downs = [[D, LastAware]]`,
so GW2EI keeps polling to the end of the fight. Trimming on `actives`
alone would truncate that player's track at the moment they went down.

A player still dead at the end gets a `dead` tail reaching `long.MaxValue`,
which the call site's `Math.Min(trimEnd, LastAware)` clamps back.

Verified against all 48 players of the reference export: every
`combatReplayData.start` equals that player's first-aware time and every
`.end` its last-aware time, and the resulting sample count reproduces
GW2EI's own `positions.length` for all 48 — 1,159 for the 45 players whose
first-aware falls in `1..=300`, 1,160 for the 3 whose first-aware is
exactly `0`, and 1,032 for the one who joined at `t = 38317`.

### Awareness comes from both sides

Everything above hangs off `AgentItem.FirstAware` / `LastAware`, which
GW2EI's parser widens from **both** the source and the destination side of
every combat item. A player who is damaged or buffed before their own
first outgoing event — or after their last — gets a correspondingly wider
window, and therefore a wider `start`/`end` and different `dc` sentinels.
Keying off `src_agent` alone (as the native M9 engine's own first-aware
scan does) understates it.

`SrcIsAgent()` / `DstIsAgent()` are fixed statechange whitelists, both
including `StateChange.Combat` (id 0, an ordinary combat event whose src
and dst are attacker and target) — which is what makes the destination
side matter at all. The pass calls the *plain* overloads, not the
extension-aware ones, so arcdps extension events (`CBTS_EXTENSION` 40 /
`CBTS_EXTENSIONCOMBAT` 49, including the healing extension) do **not**
widen awareness here.

## `dc`, `down` and `dead`

`SingleActorStatusHelper.FillStatus` builds all three from the status
stream: `CHANGE_DOWN` (5), `CHANGE_UP` (3), `CHANGE_DEAD` (4), `SPAWN` (6)
and `DESPAWN` (7).

Two `dc` segments are structural rather than real disconnects: an
always-present `[long.MinValue, FirstAware]` head, and a
`[LastAware, long.MaxValue]` tail. Genuine mid-fight disconnects are
`CBTS_DESPAWN` → `[despawn_t, next_status_t]` segments in between, and a
late spawn more than 50 ms after first-aware adds a
`[FirstAware, spawn_t]` segment. A player still dead at the end of the log
gets the `[LastAware, MAX]` tail on `dead` instead of on `dc`.

Segment emission is a no-op unless `start < end`. GW2EI concatenates the
status kinds in the order downs, alives, deads, spawns, despawns and then
applies LINQ's `OrderBy`, which is a documented **stable** sort — so that
concatenation order is the same-timestamp tiebreak, and axilog reproduces
it via an ordered discriminant rather than relying on sort stability by
accident.

The native engine builds its own `down_intervals` / `dead_intervals`
directly: `CHANGE_DOWN` opens a down interval, `CHANGE_DEAD` closes an
open down and opens a dead, `CHANGE_UP` closes whichever is open. That
construction was verified end to end by reproducing GW2EI's exported
`down` / `dead` arrays exactly on both fixtures, including a player with
two separate down windows.

## The two subtleties that decide accuracy

Both live in GW2EI's `HandlePosition`, and getting them right is the
entire difference between the native engine's 99.77% agreement and the
EI-shape engine's 100%.

**1. Interpolate from the previously *polled* point.** At each grid point
EI interpolates from the previously polled position when that is later
than the current raw sample — not from the raw sample itself. While a
bracketing segment is unchanged the two are algebraically identical, but
after a hold they are not: the track eases out of where it was frozen
instead of snapping back onto the raw segment.

**2. The velocity-gated hold branch.** When the next raw position is more
than 600 ms away *and* the most recent velocity sample is approximately
zero, EI refuses to interpolate and freezes the actor in place. That is
the "player stood still, arcdps stopped emitting positions" case.
Interpolating across it drags the icon smoothly toward somewhere the actor
actually teleported to.

## World coordinates to map pixels

Only the EI-shape engine does this; the native engine emits raw world
units and lets the renderer size its own viewBox.

```text
(width, height) = image size rescaled so max dimension == 750
x = (realX − rect.topX) / (rect.bottomX − rect.topX)
y = (realY − rect.topY) / (rect.bottomY − rect.topY)
px = round(scaleX · pixelWidth  · x, 3)
py = round(scaleY · (pixelHeight − pixelHeight · y), 3)
```

Note the Y flip, and note that `round` is **C#'s `Math.Round(double, int)`
— round-half-to-even**, then narrowed to `f32`, because GW2EI's exported
positions are single-precision and the emitted decimal *text* has to
match. `ParserHelper.CombatReplayDataDigit = 3` confirms the 3 decimals
are rounding and not truncation.

**Orientations** are `−round(degrees(atan2(y, x)), 3)`: the leading minus
because screen-space Y grows downward while world-space Y grows upward,
the radian value narrowed to `f32` *before* the degree conversion, and the
negation applied *after* the rounding. Range is `[−180, 180]`.

### The five-map geometry table

Transcribed from GW2EI's `WvWLogic.GetCombatMapInternal`:

| Map id | Map | Pixel size | World rect (topX, topY, bottomX, bottomY) |
| --- | --- | --- | --- |
| 38 | Eternal Battlegrounds | 954 × 1000 | −35914, −34614, 37814, 39114 |
| 95 | Green Alpine Borderlands | 697 × 1000 | −30720, −43008, 30720, 43008 |
| 96 | Blue Alpine Borderlands | 697 × 1000 | −30720, −43008, 30720, 43008 |
| 968 | Edge of the Mists | 3556 × 3646 | −36864, −36864, 36864, 36864 |
| 1099 | Red Desert Borderlands | 1000 × 1000 | −36864, −36864, 36864, 36864 |

A test asserts the table covers exactly GW2EI's five ids and nothing else.
Obsidian Sanctum and Armistice Bastion are named by GW2EI but have no
arena image, so they fall to the same default branch as any unknown id:
`combatReplayData` is still emitted, from the computed bounding box,
exactly as GW2EI does — but `combatReplayMetaData` is **omitted**, because
there is no arena image for the pixel coordinates to be relative to. See
[WvW maps in logs](/guides/wvw-maps/) for the map-id side of this.

`combatReplayMetaData` itself is text-exact against both references,
including `inchToPixel: 0.009` — and the decimal text, not just the value,
is what is gated.

## Calibration

Against the real post-rework capture and its GW2EI export (Blue Alpine
Borderlands, 348,362 ms):

| Field | Result |
| --- | --- |
| `positions` | **50,999 / 50,999 (100.00%) bit-exact** once both sides are narrowed to the `f32` GW2EI serializes; worst residual `3.2e-5 px`, purely `serde_json` widening EI's decimal text back to `f64` |
| `orientations` | **50,999 / 50,999 (100.00%) bit-exact**, worst residual `7.6e-6 deg` |
| `start`, `end`, `dc`, `down`, `dead` | **Exact for every one** of the 44 joined players |
| Pre-era fixture | 6,074 samples, 37/37 accounts, same exactness |

The committed orientation *gate* is the looser "99% within 1 degree",
deliberately: `atan2` is not bit-reproducible across platform libms, so
the achievable floor is set by GW2EI's own 3-decimal rounding rather than
by axilog. Both eras additionally get a structural sweep — monotone grid
at the declared rate, sample counts on the grid, no NaN or infinite
coordinates, angles in range, `dc` sentinel bracketing.

## Where EI is wrong: the trailing default sample

EI pre-sizes its polled-position array at
`(logDuration − startOffset) / rate + 1`, but the polling loop's own
`t < logDuration` bound excludes the exact-multiple endpoint. So on any
log whose duration is a whole multiple of the 300 ms rate, the last slot
is never written and keeps C#'s default zero `Vector3`. For an actor whose
first-aware is `0`, that stray `(0, 0, 0)`-at-`t=0` point survives `Trim`
— which clamps by index, not by re-validating values — and can push the
exported track's last real timestamp past the actor's own `end`.

axilog's loop pushes one real sample per iteration and has no pre-sized
slot to leave stale. A regression test asserts no zero sample is ever
emitted and no sample runs past the bound. See
[parity & divergences](/axilog/parity/) for the full list.

## The native block, as a consumer sees it

```json
"replay": {
  "poll_ms": 300,
  "bounds": { "min_x": "…", "min_y": "…", "max_x": "…", "max_y": "…" },
  "tracks": [
    { "name": "…", "team": "green", "commander": false, "is_squad": true,
      "samples": [["t_ms", "x", "y"]],
      "down_intervals": [["start_ms", "end_ms"]], "dead_intervals": [] }
  ]
}
```

`samples` are `[t_ms, x, y]` triples in raw world units rounded to one
decimal; `bounds` spans every track so a consumer can size a viewBox in a
single pass. Enemy tracks are per-enemy-player *representative*, not per
agent — see the [instid regroup](/axilog/parity/#the-enemy-roster).

The HTML report's Replay tab draws this block with an SVG stage,
play/pause, a scrub slider and a 1×/4×/8× speed toggle. There is no map
imagery: the zero-network invariant holds, so the stage is an abstract
field sized from `replay.bounds`. All motion comes from one pure
`positionsAt(tracks, t)` function, node-tested for the exact-sample,
between-samples, before-first, after-last and empty-track cases.

## See also

- [Calculation methodology](/axilog/methodology/) — the rest of the
  derivations.
- [Movement & effects](/guides/movement-and-effects/) — the raw position,
  velocity and facing events.
- [WvW maps in logs](/guides/wvw-maps/) — map ids and what they mean.
- [Output schema](/axilog/schema/#combat-replay--two-halves-two-gates) — the block shapes.
