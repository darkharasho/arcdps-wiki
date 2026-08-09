---
title: WvW maps in logs
description: The WvW map ids, how a log tells you which map it was recorded on, and where map ids appear in the event stream.
source: community
---

Every arcdps log records which map it came from, and in WvW that's
often the first thing a parser wants to know — a fight on Eternal
Battlegrounds and a fight on a home borderland are different contexts
even when the squads look identical. This page lists the WvW map ids
and shows where they surface in a log, with values observed in real
revision-1 WvW `.zevtc` logs (arcdps build 20260114) while writing
this page.

## Recognizing a WvW log

Before the map id even matters: the [EVTC header](/reference/evtc-format/#header-16-bytes)'s
boss id is `1` for WvW logs (and `2` for map logs), per the
[official encounter-id list](/reference/encounter-ids/). Both test
logs inspected for this page carried `boss_id = 1`.

## The WvW map ids

Map ids in arcdps events are the game's map ids — the same ids the
official GW2 API serves at
[`api.guildwars2.com/v2/maps`](https://api.guildwars2.com/v2/maps?ids=38,95,96,899,968,1099,1315).
The WvW set (names and ids verified against that endpoint, fetched
2026-08-09):

| Map id | Map | Role in the matchup |
| --- | --- | --- |
| 38 | Eternal Battlegrounds | Center map |
| 95 | Alpine Borderlands | Green home borderland |
| 96 | Alpine Borderlands | Blue home borderland |
| 1099 | Desert Borderlands | Red home borderland |
| 968 | Edge of the Mists | Overflow map |
| 899 | Obsidian Sanctum | Jumping-puzzle map |
| 1315 | Armistice Bastion | Pass-holder lounge |

Note the two Alpine Borderlands share a name but not an id — 95 is
always the green team's home and 96 the blue team's, while red gets
the Desert Borderlands (1099). Which *world* owns each color changes
every matchup; see [WvW team colors in logs](/guides/wvw-team-colors/)
for resolving that side of it.

## Where the map id appears in the event stream

Three statechange events carry map ids — layouts in the
[statechange payload reference](/reference/enums/statechange-payloads/):

- [`CBTS_MAPID` (25)](/reference/enums/statechange-payloads/#cbts_mapid-25)
  — `src_agent` is the map id; written once near the start of the
  log. In both test logs this was the single place to read the map
  from: `src_agent = 95` (Alpine Borderlands), with the map-type field
  (`dst_agent`) observed as `0`.
- [`CBTS_MAPCHANGE` (65)](/reference/enums/statechange-payloads/#cbts_mapchange-65)
  — new map id in `src_agent`, old in `dst_agent`; fires on map
  transitions. Neither test log contained one (arcdps starts a fresh
  log per map, so seeing it is the exception).
- [`CBTS_WVWOBJECTIVESTATUS` (75)](/reference/enums/statechange-payloads/#cbts_wvwobjectivestatus-75)
  — objective capture/upgrade events carry the map id in `value`,
  alongside the owning team id and the objective id.

So for "which map is this log from?", read the `CBTS_MAPID` event —
it's near the front of the event stream, before combat begins. For a
walkthrough of actually decoding the stream, see
[Parsing EVTC logs](/guides/parsing-logs/).

## Objective ids

`CBTS_WVWOBJECTIVESTATUS` identifies objectives (keeps, towers,
camps…) by an objective id in `skillid`. The official notes don't
document the id scheme beyond calling it "objective id", and the test
logs for this page contained no objective events to inspect — so the
mapping from these ids to named objectives is **undocumented** here.
The GW2 API's [`v2/wvw/objectives`](https://api.guildwars2.com/v2/wvw/objectives)
endpoint is the natural place to correlate candidates, but that
correlation hasn't been verified for this page.
