---
title: WvW team colors in logs
description: How to resolve red/blue/green team colors from arcdps team ids — TEAMCHANGE events, the WVWTEAMS statechange, and the community id→color table.
source: community
---

In WvW logs there is no fixed "enemy" side: every agent belongs to one
of the matchup's three teams — **red**, **blue**, or **green** — and
allies vs. enemies is just *your* color vs. the other two. arcdps
records team membership as a numeric **team id**, not a color, so
turning a log into a red/blue/green breakdown takes two steps: collect
each agent's team id, then map ids to colors. This page covers both,
with values observed in real logs. For the raw event layouts see the
[statechange payload reference](/reference/enums/statechange-payloads/).

## Step 1: collect team ids — `CBTS_TEAMCHANGE` (22)

Team membership arrives as [`CBTS_TEAMCHANGE`](/reference/enums/statechange-payloads/#cbts_teamchange-22)
statechange events: `src_agent` is the agent, `dst_agent` the **new**
team id, `value` the **old** team id.

Two practical caveats, both confirmed against real revision-1 WvW
`.zevtc` logs (arcdps build 20260114) while writing this page:

- **Most team-change events carry team id 0.** One test log contained
  139 `TEAMCHANGE` events, of which 133 had a new team id of 0 — these
  fire when agents despawn/reset, not when they join a team. A typical
  despawn event looked like `(src_agent=9520, dst_agent=0,
  value=2767)`: new team 0, old team 2767. Parsers should ignore id 0
  and keep each agent's **latest nonzero** team id.
- **Events can repeat.** The same agent can emit multiple team changes
  across a long log; last-nonzero-wins is the standard treatment (it's
  what community parsers such as Elite Insights and WvW plugins do).

One known-bad build: community parsers skip or special-case logs from
**arcdps build 20250420**, where team-change events were emitted
incorrectly on agent despawn.

Your own color comes from the `TEAMCHANGE` event whose `src_agent` is
the self agent (the agent flagged by [`CBTS_POINTOFVIEW`](/reference/enums/statechange-payloads/#cbts_pointofview-13)).

## Step 2: map ids to colors

### The authoritative way — `CBTS_WVWTEAMS` (74)

When present, [`CBTS_WVWTEAMS`](/reference/enums/statechange-payloads/#cbts_wvwteams-74)
tells you exactly which team ids are red, blue, and green for this
log: `(uint32_t*)&src_agent` is a `uint32[6]` of red/blue/green shard
ids followed by red/blue/green **team ids**. If your log has this
event, use it and skip the lookup table below.

**It is not in every log.** The event is recent — the official
changelog added `CBTS_WVWTEAMS` on **may.07.2026** — so logs from
earlier arcdps builds never contain it. Neither of the two
build-20260114 WvW logs inspected for this page had one, consistent
with that date. A parser handling historical logs still needs a
fallback.

### The fallback — community id→color table

The mapping below is community-maintained (it originates in the
[WvW-Fight-Analysis addon](https://github.com/jake-greygoose/WvW-Fight-Analysis-Addon)
and is reused by other WvW tooling). It is **not** official, ids
have changed before (notably around World Restructuring), and new ids
appear over time — treat unknown ids as "unknown team", not as an
error.

| Color | Team ids |
| --- | --- |
| Red | 697, 699, 705, 706, 707, 882, 885, 886, 2520 |
| Blue | 432, 433, 1277, 1281, 1282, 1989, 1996, 2304 |
| Green | 39, 2739, 2741, 2752, 2763, 2767 |

The observed values from our test logs fit this table: the id-433
agents were blue, and the id-2767 despawns were green.

You don't have to copy this table into your own project — it's served
as machine-readable JSON at
[`/api/wvw/teams.json`](/reference/data-api/) (with a flat
`byTeamId` reverse index), so you can fetch one canonical copy instead
of maintaining the mapping yourself.

Remember colors are **per-matchup sides**, not identities: the same
world can be red one matchup and green the next. If you're aggregating
across logs, aggregate by color *within* each log, never by color
across logs.

## Putting it together

A minimal resolution algorithm, as implemented by community parsers:

1. Scan all events for `TEAMCHANGE` (22); build a map of agent →
   latest nonzero team id.
2. If a `WVWTEAMS` (74) event exists, use its team-id triple to label
   each id red/blue/green.
3. Otherwise, look each id up in the community table; unknown ids stay
   unlabeled.
4. Your side is the color of the self agent; the other one or two
   colors present are the enemies.

For a walkthrough of actually reading the event stream these steps
scan, see [Parsing EVTC logs](/guides/parsing-logs/).
