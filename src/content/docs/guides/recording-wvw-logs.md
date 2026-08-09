---
title: Recording WvW logs
description: A practical checklist for getting good WvW logs out of arcdps — what triggers them, the settings that gate saving, and what the files look like.
source: community
---

Raid logging mostly just works — you hit a boss, you get a log. WvW
logging has more knobs: there's no boss, fights are long, and several
settings can silently discard an encounter. This page is the
WvW-shaped path through material covered in depth on the
[installation & files](/guides/installation-and-files/) and
[EVTC format](/reference/evtc-format/) pages.

## How a WvW log starts and stops

From the official evtc-logging notes (quoted in full at
[when a log starts and stops](/reference/evtc-format/#when-a-log-starts-and-stops)):

> pve/wvw: starts on first player combat enter, boss set by first
> damage event on boss, stops when all players exit combat.

In WvW there is no boss species — the log's header carries boss id
`1`, the WvW marker (see [encounter IDs](/reference/encounter-ids/)).
Practically: a "log" is one stretch of continuous squad combat, and a
raid night produces many files. arcdps also starts fresh per map, so a
single log never spans a map hop (the map id is written once near the
front of the event stream — see [WvW maps in logs](/guides/wvw-maps/)).

## Why a WvW log didn't save

When arcdps finishes an encounter but skips writing it, it says why in
its logger window. The full diagnostic list is at
[when a log is *not* saved](/reference/evtc-format/#when-a-log-is-not-saved);
the ones that bite in WvW:

- `log not saved due to saving disabled` — log saving (and WvW saving
  specifically) must be enabled in the logging settings; the
  corresponding `arcdps.ini` keys are `boss_encounter_saving` and
  `boss_encounter_savewvw` (key list on the
  [installation & files](/guides/installation-and-files/#settings-storage-arcdpsini)
  page — per-key semantics are not officially documented, so treat
  the in-game logging settings panel as the interface of record).
- `log not saved due to short duration` — WvW skirmishes below the
  minimum log duration are dropped (`minimum_log_duration`).
- `log not saved due to unmet condition (enemy minimum)` — an
  enemy-count floor (`boss_encounter_minenemy`) filters out logs of
  chasing one roamer, but set too high it also eats real fights.
- Squad minimum / maximum / percent conditions — participation
  filters that matter when you log outside a full squad.

If logs are missing, watch the logger window during a fight and the
message will tell you which setting to change.

## The files

Logs land under
`Documents/Guild Wars 2/addons/arcdps/arcdps.cbtlogs/` by default
(path details at [where logs are written](/reference/evtc-format/#where-logs-are-written)),
named `date-time` — e.g. a real WvW file from the machine this wiki
is developed on: `20260125-202439.zevtc`. WvW files get large: the
three real WvW logs inspected for this wiki's guides held 120k–390k
events each (roughly 8–25 MB uncompressed) for ordinary fights, so
expect a zerg night to produce hundreds of megabytes.

## Version notes that matter for WvW

Recent official changelog entries that change what's *in* a WvW log:

- **may.07.2026** — `CBTS_WVWTEAMS` and `CBTS_WVWOBJECTIVESTATUS`
  events added. Logs from older builds have neither; see
  [WvW team colors](/guides/wvw-team-colors/) for the fallback.
- **jun.02.2026** — `CBTS_WVWOBJECTIVESTATUS`'s `pad61` documented as
  upgrade progress ("yak count"); WvW inactivity check changed to
  consider squad-out damage only.
- **jul.01.2026** — WvW siege detached from its owner ("differs from
  operator") — affects siege damage attribution across builds.

One older build to avoid trusting: community parsers special-case
**build 20250420**, where team-change events fired incorrectly on
despawn (see [WvW team colors](/guides/wvw-team-colors/)).

Keeping arcdps current matters more in WvW than elsewhere — the
WvW-specific events are the newest part of the format and still
gaining fields.
