---
title: Downs, deaths & kill credit in WvW logs
description: Tracking downs and deaths for both sides of a WvW fight — CHANGEDOWN/CHANGEDEAD statechanges, KILLINGBLOW/DOWNED results, and what kill credit actually means.
source: community
---

"How many did we down, how many did we kill, and who got the killing
blows?" is the core scoreboard question for a WvW log. The events that
answer it are documented individually in the
[statechange payloads](/reference/enums/statechange-payloads/) and
[enum reference](/reference/enums/) pages; this page connects them
into the WvW workflow, with counts observed in a real revision-1 WvW
`.zevtc` log (arcdps build 20260114) inspected while writing this
page.

## The two event families

There are two independent record types, and robust parsers use both:

**State transitions** —
[`CBTS_CHANGEUP` (3) / `CBTS_CHANGEDEAD` (4) / `CBTS_CHANGEDOWN` (5)](/reference/enums/statechange-payloads/#cbts_changeup-3--cbts_changedead-4--cbts_changedown-5)
statechange events, where `src_agent` is the agent that is now
alive / dead / downed. These are *facts about an agent's state*, with
no attacker attached.

**Skill results** — ordinary damage events (`is_statechange == 0`)
whose [`result`](/reference/enums/#cbtresult-combat-result) field is
`CBTR_KILLINGBLOW` (8, "target was killed by skill") or `CBTR_DOWNED`
(9, "target was downed by skill"). These are *facts about a hit*:
`src_agent` is the attacker, `dst_agent` the victim — this is where
kill/down **credit** lives.

## Enemy downs and deaths are recorded

The key WvW-relevant observation: state transitions fire for **enemy
players too**, not just your squad. In the test log
(13 squad players, 31 enemy players — see
[allies & enemies](/guides/wvw-allies-and-enemies/) for the split):

| Event | Squad players | Enemy players | NPCs |
| --- | --- | --- | --- |
| `CHANGEDOWN` (5) | 11 | 32 | 13 |
| `CHANGEDEAD` (4) | 1 | 28 | 26 |
| `CHANGEUP` (3) | 11 | 32 | 1 |

Alongside those, the log contained 66 `CBTR_DOWNED` and 71
`CBTR_KILLINGBLOW` skill results.

A few patterns worth noting in those numbers:

- **Downs ≠ deaths.** 32 enemy downs but 28 enemy deaths — some
  downed enemies got back up (rallied or were revived). Count
  `CHANGEDEAD` for kills, `CHANGEDOWN` for downs; don't infer one
  from the other.
- **`CHANGEUP` pairs with `CHANGEDOWN`** for players (32/32 for
  enemies, 11/11 for squad here): a player who recovers — by rally,
  revive, or respawn appearing in the same log — emits `CHANGEUP`.
- **The two families won't match exactly.** 71 killing-blow results
  vs. 55 total player+NPC-relevant deaths in this log — killing blows
  also land on agents whose state transitions fall outside what the
  log captured (despawns, NPCs, timing at log edges). Treat state
  transitions as the count of record and results as the attribution
  layer.

## Attributing kills and downs

For "who downed/killed whom", use the skill-result events: the damage
event with `result == 9` names the downer in `src_agent`, and
`result == 8` names the killing-blow dealer. Remember `src_agent` may
be a pet or minion — resolve to its master via `src_master_instid`
(see [cbtevent](/reference/data-structures/cbtevent/)) before
crediting a player.

Anything beyond the literal killing blow — "damage contribution",
per-player kill participation, tag range credit — is **not in the
log** as a first-class concept. Community tools derive it by summing
damage to the victim in a window before death; that's a convention,
not arcdps data.

## Caveats for WvW counting

- **Agents can leave the log while downed or dead-adjacent.** Enemies
  who despawn (run out of range/leave combat) stop emitting events;
  a fight at the edge of the logged area undercounts. The official
  log lifecycle ("stops when all players exit combat" — see
  [when a log starts and stops](/reference/evtc-format/#when-a-log-starts-and-stops))
  bounds what you can see.
- **Respawns within one log** show as another `CHANGEUP`; a player
  can legitimately die twice in one long WvW log, so count *events*,
  not unique agents.
- **NPC deaths mix in.** 26 of the 55 `CHANGEDEAD` events in the test
  log were NPCs (guards, etc.) — filter by agent class first
  ([allies & enemies](/guides/wvw-allies-and-enemies/)) or your
  "kills" number will include camp guards.
