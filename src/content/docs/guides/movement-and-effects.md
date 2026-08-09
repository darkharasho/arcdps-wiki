---
title: Movement, effects & missiles in logs
description: The spatial side of EVTC logs — position/velocity/facing sampling, visual effect events and their GUID resolution, and missile tracking.
source: community
---

Beyond damage and buffs, a modern log is full of *spatial* data:
where every agent stood, what projectiles flew, what visual effects
played. It's the raw material for replay maps, positioning analysis,
and mechanic detection. This page covers the three event families,
with values observed in a real revision-1 WvW `.zevtc` log (arcdps
build 20260114, Alpine Borderlands, ~6.7-minute fight) inspected
while writing this page. Payload layouts are on the
[statechange payloads](/reference/enums/statechange-payloads/) page.

## Movement: `CBTS_POSITION` (19) / `CBTS_VELOCITY` (20) / `CBTS_FACING` (21)

`src_agent` is the agent; the coordinates are floats overlaid on
`dst_agent` — `float[3]` (x/y/z) for
[position and velocity, `float[2]` for facing](/reference/enums/statechange-payloads/#movement-cbts_position-19--cbts_velocity-20--cbts_facing-21).

What the test log showed:

- **Volume**: 18,862 position, 17,534 velocity, and 13,882 facing
  events — movement is roughly a third of this log's event count.
- **Everyone is tracked**, not just the squad: positions broke down
  as 9,285 squad, 7,203 enemy-player, 2,346 NPC, and 28 gadget
  samples. Enemy movement analysis is possible straight from the
  log.
- **Sampling rate**: the busiest agent had 1,113 position samples at
  a **300 ms median interval** — dense enough for smooth replay
  paths.
- **Coordinates** are game-world units in map space; observed ranges
  in this Alpine Borderlands fight were roughly x ∈ [−22,260,
  17,857], y ∈ [−35,597, 21,792], z ∈ [−6,152, 19] (a real sample:
  `(10956.7, 15051.2, −3450.7)`). The official notes don't document
  the unit or axis conventions — correlating them to in-game
  coordinates is left to community tooling.

Related one-offs: `CBTS_GLIDER` (55) marks glider deploy/stow — 117
events in this WvW log (bombing keeps from the air leaves a trail).

Note the availability caveat on all of these: "evtc: limited to agent
table outside instances · realtime: no" — you get them in open-world
/WvW logs, but **extensions never see them live** through the combat
callback.

## Visual effects: `CBTS_EFFECTGROUNDCREATE` (60) / `CBTS_EFFECTAGENTCREATE` (62)

Effect events record visual content playing
[on the ground](/reference/enums/statechange-payloads/#cbts_effectgroundcreate-60--cbts_effectgroundremove-61)
(with origin/orientation packed as `int16`s) or
[around an agent](/reference/enums/statechange-payloads/#cbts_effectagentcreate-62--cbts_effectagentremove-63).
Observed: 3,269 ground and 5,049 agent effect creates.

Two practical points, both confirmed in the test log:

**Effect ids are not skill ids.** The `skillid` field of an effect
event holds a volatile *effect* id — none of the 671 distinct effect
ids observed had a name in the log's skill table. The official notes
say to "prefer using an id to guid map via n_contentlocal": each id
is resolved by a
[`CBTS_IDTOGUID` (46)](/reference/enums/statechange-payloads/#cbts_idtoguid-46)
event carrying the persistent 16-byte content GUID in `src_agent`
and the content type ([`n_contentlocal`](/reference/enums/#n_contentlocal-content-types))
in `overstack_value`. In the test log this resolution was complete:
all 671 effect ids had a matching type-`CONTENTLOCAL_EFFECT` entry
(keyed by the `skillid` field — observed, as the payload notes don't
name the id field explicitly). Build the GUID map first, then key
your effect logic on GUIDs, which are stable across logs.

(The log also contained 24 `IDTOGUID` events with content type `3`,
one past the documented `n_contentlocal` range of 0–2 — a newer,
still-undocumented content type.)

**Removes are rare; durations matter.** Ground effects: 3,269
creates, **zero** removes. Agent effects: 5,049 creates, 41 removes.
Most effects simply expire — the create event's duration field (a
`uint32` overlaid at `iff`) plus the default duration from the
`IDTOGUID` payload is how you know when; a remove event (trackable
id in `pad61`) only arrives for early termination.

## Missiles: `CBTS_MISSILECREATE` (57) / `CBTS_MISSILELAUNCH` (58) / `CBTS_MISSILEREMOVE` (59)

Projectiles are tracked as create → launch(es) → remove, with
positions packed as `int16` triples divided by 10 (layouts:
[missile events](/reference/enums/statechange-payloads/#cbts_missilecreate-57)).
Observed: 2,169 creates, 2,339 launches, 2,112 removes — launches
exceed creates because one missile can re-launch (`is_flanking`
flags the first launch). Unlike effect ids, missile `skillid`s *are*
real skills — the log's top missile sources were Rapid Fire (140),
Vicious Shot (137), Long Range Shot (102), all named in the skill
table. The remove event carries a friendly-fire damage total in
`value`.

## What this enables

- **Replay maps**: positions at 300 ms resolution for both sides,
  plus facing for cone-skill analysis — see
  [WvW allies & enemies](/guides/wvw-allies-and-enemies/) for
  classifying who's who first.
- **Mechanic/AoE detection**: ground effects with orientation and
  scale, GUID-stable across logs.
- **Projectile analysis**: per-skill missile counts and flight
  endpoints.

All of it is evtc-only — none of these events reach realtime
extensions — and all of it is per-map-instance data, so pair it with
the [map id](/guides/wvw-maps/) before plotting anything.
