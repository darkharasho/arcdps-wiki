---
title: Allies, enemies & NPCs in WvW logs
description: How to tell squad players, enemy players, siege, and NPCs apart in a WvW log's agent table — with values from a real log.
source: community
---

A WvW log's agent table mixes four very different kinds of agents:
your squad, enemy players, siege engines, and assorted NPCs (guards,
lords, yaks…). Getting stats right means classifying them correctly
first. The [EVTC format page](/reference/evtc-format/#agent-table)
documents the raw classification rules; this page applies them to WvW
specifically, quoting values from a real revision-1 WvW `.zevtc` log
(arcdps build 20260114, Alpine Borderlands) inspected while writing
this page. That log's 133 agents broke down as: 13 squad players, 31
enemy players, 28 gadgets, and 61 NPCs.

## The base classification

From the official EVTC docs (see the
[agent table](/reference/evtc-format/#agent-table) section for the
verbatim rules):

- `is_elite == 0xFFFFFFFF` and upper half of `prof` `== 0xFFFF` →
  **gadget** (volatile pseudo-id in the lower half of `prof`)
- `is_elite == 0xFFFFFFFF` and upper half of `prof` `!= 0xFFFF` →
  **NPC** (species id in the lower half of `prof`)
- `is_elite != 0xFFFFFFFF` → **player** (`prof` is profession,
  `is_elite` the elite spec)

That splits players from everything else — but in WvW the interesting
split is *within* the player group.

## Squad players vs. enemy players

Both sides are "players" by the rule above. The difference is in the
64-byte `name` field, which for players holds three null-terminated
strings: character name, account name, subgroup (see
[agent table](/reference/evtc-format/#agent-table)).

**Squad/subgroup players** have all three populated. Observed:

```
prof=6, is_elite=67, name = "Wag Toof\0:Wag Z.8294\03\0"
```

— character name, account name with the leading `:` as seen in game,
and subgroup `3` as a string.

**Enemy players** have an **empty account name** (and no subgroup).
Observed:

```
prof=1, is_elite=27, name = "Dragonhunter\0\0"
```

The character-name slot doesn't contain their real character name —
in the test log every enemy player's name was the *name of their
spec* ("Dragonhunter", "Willbender", …), while `prof`/`is_elite`
stayed machine-readable. Enemy players are anonymous in logs:
no account, no real name.

So the practical rule community parsers use: **a player-typed agent
with an empty account-name field is an enemy player.** Cross-checking
with [team ids](/guides/wvw-team-colors/) tells you *which* enemy
side they're on.

Two caveats:

- This page's test logs only contained squad members on the allied
  side, so whether same-team players *outside* your squad appear with
  account names is **unverified here** — don't assume the
  empty-account rule maps exactly onto "same team vs. other team"
  without checking team ids too.
- Player stat fields (toughness/concentration/healing/condition) are
  coarsened to 0-or-10 on write — see the
  [anonymization note](/reference/evtc-format/#agent-table) — so you
  can't distinguish builds from those.

## Siege and other gadgets

Siege engines are **gadgets**. Observed in the test log:

```
prof=0xFFFFB58E, is_elite=0xFFFFFFFF, name = "Flame Ram Build Site\0"
```

Gadget ids are volatile pseudo-ids ("generated through a combination
of gadget parameters — they will collide with npcs and should be
treated separately", per the official docs), so don't key siege
identity on the id across logs — the name string is the human-useful
part. One related official changelog note (jul.01.2026): WvW siege
was detached from its *owner*, which "differs from operator" — so
damage attribution for siege depends on the arcdps build that wrote
the log.

## NPCs

Structure NPCs (guards, veterans, lords) and ambient creatures are
**NPC** agents with a real species id. In the test log, WvW NPCs
carried generated names of the form `ch<species>-<n>`:

```
prof=27031, is_elite=0xFFFFFFFF, name = "ch27031-2429\0"
```

The species id (here 27031, the lower half of `prof`) is the reliable
identifier; the `ch…` name string is a placeholder, not an in-game
name. The meaning of specific WvW species ids is not documented in
the official notes — correlating them to guard types is left to
community tooling.

## Summary decision table

| Check (in order) | Classification |
| --- | --- |
| `is_elite == 0xFFFFFFFF`, `prof >> 16 == 0xFFFF` | Gadget (siege, build sites, tablets…) |
| `is_elite == 0xFFFFFFFF`, otherwise | NPC — species id in `prof & 0xFFFF` |
| Player with non-empty account name | Squad/subgroup player (your side) |
| Player with empty account name | Enemy player — resolve side via [team ids](/guides/wvw-team-colors/) |

For reading the agent table itself, see
[Parsing EVTC logs](/guides/parsing-logs/).
