---
title: Timestamps & fight duration
description: Making sense of time in EVTC logs — the local-ms time field, squad-combat unix timestamps, computing duration, and mapping events to wall clock.
source: community
---

Every event in a log carries a `time` field, but it's not a wall-clock
time — and the log's real start/end times live in two dedicated
events. This page shows how the pieces fit, with values from a real
revision-1 WvW `.zevtc` log (arcdps build 20260114, file
`20260125-202439.zevtc`) inspected while writing this page.

## The `time` field: local milliseconds, arbitrary origin

Per the official struct notes, `cbtevent.time` is "`timegettime()` at
time of event" — the Windows `timeGetTime()` counter, i.e.
**milliseconds since the machine booted**, not since the epoch and
not since the fight started. In the test log the ordinary combat
events ran from `time = 34,048,366` to `34,449,450` — a machine ~9.5
hours into its uptime, spanning 401.084 seconds of fight.

Use it for *relative* math only: event ordering, deltas, phase
timing. Two logs' `time` values are not comparable unless they came
from the same machine session.

**One trap:** for three statechange types — `CBTS_BUFFFORMULA`,
`CBTS_SKILLINFO`, `CBTS_INTEGRITY` — the 8 `time` bytes are
reinterpreted as inline data (see
[cbtevent](/reference/data-structures/cbtevent/)). Filter those out
before taking min/max of `time`, or your "fight start" becomes a
float array.

## Wall clock: `CBTS_SQCOMBATSTART` (9) / `CBTS_SQCOMBATEND` (10)

The log's real-world start and end arrive as
[squad-combat statechanges](/reference/enums/statechange-payloads/#cbts_sqcombatstart-9--cbts_sqcombatend-10)
(previously named "log start"/"log end"): `value` is the **server**
unix timestamp, `buff_dmg` the **local** unix timestamp; on the end
event, `dst_agent` bit 0 flags a log ended by leaving the map.

Observed in the test log:

| Event | Server time (UTC) | Local-unix | `dst_agent` |
| --- | --- | --- | --- |
| `SQCOMBATSTART` | 2026-01-26 04:17:57 | +1 s | 3 |
| `SQCOMBATEND` | 2026-01-26 04:24:38 | +1 s | 0 |

Two useful checks fall out of the real values:

- **Duration agrees across sources**: 04:17:57 → 04:24:38 is 401
  seconds, matching the 401.084 s span of the `time` field — so
  either source gives you fight duration; the unix pair is
  coarser (whole seconds) but absolute.
- **Server and local clocks can differ**: here by ~1 s. Use the
  server value when correlating logs from different squad members.

To place *any* event on the wall clock, anchor once:
`wall_clock(e) = start_unix + (e.time − time_of(SQCOMBATSTART)) / 1000`.

Note the start event's `dst_agent` was 3 in this log — its meaning
beyond the documented bit-0-on-end flag is **undocumented**, so don't
interpret it.

## The filename

Log files are named `date-time` (official: written to
`…/arcdps.cbtlogs/…/date-time.evtc`). The test file
`20260125-202439.zevtc` corresponds to 20:24:39 **local** time
(UTC−8), one second after the log's end timestamp of 04:24:38 UTC —
i.e., in this sample the filename reflects local time at *write*
(fight end), not fight start. One observation, not a documented
contract — treat filenames as labels and take real times from the
events inside.

## Boss changes and ticks

Two more timing-adjacent events, for completeness:

- [`CBTS_LOGNPCUPDATE` (47)](/reference/enums/statechange-payloads/#cbts_lognpcupdate-47)
  — if the log's boss changes mid-log, this carries the new species
  id and another server unix timestamp. WvW logs (boss id 1) won't
  normally see it.
- [`CBTS_TICK` (84)](/reference/enums/statechange-payloads/#cbts_tick-84)
  — the server-tick counter, emitted every 25 ticks, useful for
  detecting skill-lag (ticks stretching out under server load).
  Documented in the current format notes, but the build-20260114
  test log contained none — like the newer
  [buff events](/guides/boons-and-buffs/#the-newer-encoding--cbts_buffapply-69-and-friends),
  detect by presence, not by assumption.

## Duration checklist

1. Find `SQCOMBATSTART`/`SQCOMBATEND` (statechange 9/10); duration =
   `end.value − start.value` seconds; absolute times come free.
2. If either is missing (crash-truncated log), fall back to
   `max(time) − min(time)` over events whose statechange doesn't
   reinterpret `time`.
3. For DPS denominators, community tools conventionally use their
   own phase/combat-time definitions — pick one and state it; the
   log gives you the raw timestamps, not the convention.
