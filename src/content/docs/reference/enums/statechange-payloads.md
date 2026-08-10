---
title: Statechange payloads
description: How every cbtstatechange value maps onto cbtevent fields, with evtc and realtime availability — the full per-event payload reference.
source: official-docs
---

The [`cbtevent`](/reference/data-structures/cbtevent/) struct is a
64-byte union in disguise: the `is_statechange` byte selects which
event type it is, and every other field (except usually `time`) is
reinterpreted per type. The [enum reference](/reference/enums/) lists
the `cbtstatechange` values and one-line meanings; **this page is the
full payload mapping** — which fields each event type uses and what
they contain.

Everything here is transcribed from the inline comments of
`enum cbtstatechange` in the official EVTC documentation
(`https://www.deltaconnected.com/arcdps/evtc/README.txt`, fetched
2026-08-08). Fields not listed for an event are unused/zero for that
event. Casts like `(float*)&dst_agent` mean the field's bytes are
reinterpreted, not converted.

## Dispatching on statechange in practice

Because [`cbtevent`](/reference/data-structures/cbtevent/) reinterprets
its fields per event type, a parser's first job is to branch on
`is_statechange` and hand the event to the right reader. A value of `0`
(`CBTS_COMBAT`) is a real combat event and every other value is a state
change with its own field layout, so the usual shape is a fast-path
check followed by a switch:

```c
if (ev->is_statechange == CBTS_COMBAT) {     // 0
    handle_combat(ev);                       // strike/buff damage, per §CBTS_COMBAT
    return;
}

switch (ev->is_statechange) {
case CBTS_TEAMCHANGE:  // 22: dst_agent = new team id, value = old team id
    on_team_change(ev->src_agent, ev->dst_agent);
    break;
case CBTS_BUFFAPPLY:   // 69: src applies skillid to dst for value ms
    on_buff_apply(ev->src_agent, ev->dst_agent, ev->skillid, ev->value);
    break;
case CBTS_POSITION:    // 19: (float*)&dst_agent is float[3] x/y/z
    on_position(ev->src_agent, (float*)&ev->dst_agent);
    break;
default:
    break; // unhandled state change
}
```

Each field read above matches that event's row on this page — reading
`dst_agent` as a team id for `CBTS_TEAMCHANGE` but as a packed
`float[3]` for `CBTS_POSITION` is exactly why the dispatch has to come
first.

Each event also carries two availability notes from the source:

- **evtc** — whether the event is written to `.evtc` log files, and
  under what restriction ("limited to squad" / "limited to agent
  table", both further restricted "outside instances").
- **realtime** — whether the event is delivered on the realtime API
  (the live [combat callback](/reference/extension-api/combat-callback/)
  path).

## Combat and agent state

### `CBTS_COMBAT` (0) — combat events

| Field | Contents |
| --- | --- |
| `src_agent` | source agent |
| `dst_agent` | target agent |
| `value` | combined shield+health strike damage |
| `buff_dmg` | combined shield+health buff damage |
| `overstack_value` | shield damage |
| `skillid` | damage skill id |
| `iff` | friend/foe, of `enum iff` |
| `buff` | skill is a buff |
| `result` | combat result, of `enum cbtresult` |
| `is_ninety` | src is above 90% health |
| `is_fifty` | dst is below 50% health |
| `is_moving` | bit 0: src moving; bit 1: dst moving |
| `is_flanking` | src is flanking dst |
| `is_shields` | damage partially/wholly absorbed by barrier |
| `is_offcycle` | dst was downed at time of event |

evtc: limited to squad outside instances · realtime: limited to squad

### `CBTS_ENTERCOMBAT` (1) / `CBTS_EXITCOMBAT` (2)

| Field | Contents |
| --- | --- |
| `src_agent` | relates to agent |
| `dst_agent` | subgroup |
| `value` | profession id |
| `buff_dmg` | elite spec id |

evtc: limited to squad outside instances · realtime: limited to squad

### `CBTS_CHANGEUP` (3) / `CBTS_CHANGEDEAD` (4) / `CBTS_CHANGEDOWN` (5)

`src_agent` relates to the agent that is alive / dead / downed at the
time of the event.

evtc: limited to agent table outside instances · realtime: limited to squad

### `CBTS_SPAWN` (6) / `CBTS_DESPAWN` (7)

`src_agent` entered / left tracking.

evtc: limited to agent table outside instances · realtime: no

### `CBTS_HEALTHPCTUPDATE` (8)

`src_agent` relates to agent; `dst_agent` is percent × 10000 (99.5% →
`9950`).

evtc: limited to agent table outside instances · realtime: no

### `CBTS_BARRIERPCTUPDATE` (38)

`src_agent` relates to agent; `dst_agent` is percent × 10000.

evtc: limited to agent table outside instances · realtime: no

### `CBTS_MAXHEALTHUPDATE` (12)

`src_agent` relates to agent; `dst_agent` is the new max health.

evtc: limited to non-players · realtime: no

### `CBTS_WEAPSWAP` (11)

`src_agent` relates to agent; `dst_agent` is the new weapon-set id;
`value` is the old weapon-set id.

evtc: yes · realtime: yes

### `CBTS_TEAMCHANGE` (22)

`src_agent` relates to agent; `dst_agent` is the new team id; `value`
is the old team id.

evtc: limited to agent table outside instances · realtime: limited to squad

### `CBTS_TARGETABLE` (24)

`src_agent` relates to agent; `dst_agent` is the new targetable state —
0 false, 1 true, 2 unsupported ("attacktargets if selectable, gadgets
if interactable or healthbar shown, characters if healthbar shown").

evtc: limited to agent table outside instances · realtime: no

### `CBTS_STEALTHCHANGE` (76)

`src_agent` relates to agent; `dst_agent` is the new stealth state —
0 false, 1 true, 2 unsupported (characters only).

evtc: limited to agent table outside instances · realtime: no

### `CBTS_ATTACKTARGET` (23)

`src_agent` is the attacktarget; `dst_agent` is the gadget it belongs
to.

evtc: limited to agent table outside instances · realtime: no

### `CBTS_DEFIANCEBARSTATE` (34)

`src_agent` relates to agent; `dst_agent` is the new breakbar state.

evtc: limited to agent table outside instances · realtime: no

### `CBTS_DEFIANCEBARPERCENT` (35)

`src_agent` relates to agent; `(float*)&value` is `float[1]`, the new
percentage.

evtc: limited to agent table outside instances · realtime: no

### Movement: `CBTS_POSITION` (19) / `CBTS_VELOCITY` (20) / `CBTS_FACING` (21)

`src_agent` relates to agent. `(float*)&dst_agent` is `float[3]`
(x/y/z) for position and velocity, `float[2]` (x/y) for facing.

evtc: limited to agent table outside instances · realtime: no

### `CBTS_GLIDER` (55)

`src_agent` relates to agent; `value` is 1 deployed, 0 stowed.

evtc: limited to agent table outside instances · realtime: no

### `CBTS_STUNBREAK` (56) — disable stopped early

`src_agent` relates to agent; `value` is the duration remaining.

evtc: limited to agent table outside instances · realtime: no

### `CBTS_TRANSFORMATION` (73)

`src_agent` relates to agent; `skillid` is the transformation id (0 if
untransform).

evtc: limited to agent table outside instances · realtime: no

### `CBTS_GUILD` (29)

`src_agent` relates to agent; `(uint8_t*)&dst_agent` is `uint8_t[16]`,
the guild's GUID.

evtc: limited to squad outside instances · realtime: no

### `CBTS_MARKER` (37)

`src_agent` relates to agent; `value` is the markerdef id (0 removes
all markers presently on the agent); `buff` is set if the marker is a
commander tag.

evtc: limited to agent table outside instances · realtime: no

### `CBTS_IIDCHANGE` (64)

Players only — the agent's iid ("previously `evtc_agent->addr`")
changed after spawn when the player's historical data loads (does not
happen if the player has no historical data). `src_agent` is the old
iid, `dst_agent` the new iid.

evtc: yes · realtime: no

## Log/session metadata

### `CBTS_SQCOMBATSTART` (9) / `CBTS_SQCOMBATEND` (10)

Squad combat start (first player enters combat) and stop (last player
leaves combat) — previously named "log start"/"log end". `value` (as
`uint32_t`) is the server unix timestamp; `buff_dmg` the local unix
timestamp. On `CBTS_SQCOMBATEND`, `dst_agent` bit 0 is set if the log
ended by point-of-view map exit.

evtc: yes · realtime: yes

### `CBTS_LOGNPCUPDATE` (47)

Log boss agent changed. `src_agent` is the species id, `dst_agent`
relates to the agent, `value` (as `uint32_t`) is the server unix
timestamp.

evtc: yes · realtime: yes

### `CBTS_POINTOFVIEW` (13)

`src_agent` relates to the "recording" player.  evtc: yes · realtime: no

### `CBTS_LANGUAGE` (14)

`src_agent` is the text language id, of
[`gwlanguage`](/reference/enums/#gwlanguage-text-language).
evtc: yes · realtime: no

### `CBTS_GWBUILD` (15)

`src_agent` is the game build number.  evtc: yes · realtime: no

### `CBTS_SHARDID` (16)

`src_agent` is the server shard id.  evtc: yes · realtime: no

### `CBTS_MAPID` (25)

`src_agent` is the map id; `dst_agent` the map type.
evtc: yes · realtime: no

### `CBTS_MAPCHANGE` (65)

`src_agent` is the new map id; `dst_agent` the old map id; `value` the
new map type.  evtc: yes · realtime: yes

### `CBTS_INSTANCESTART` (42)

`src_agent` is how many milliseconds ago the instance was started;
`*(uint32_t*)&value` is the server socket.  evtc: yes · realtime: no

### `CBTS_FRACTALSCALE` (50)

`src_agent` is the fractal scale.  evtc: yes · realtime: no

### `CBTS_RULESET` (52)

`src_agent` bits: bit 0 PvE, bit 1 WvW, bit 2 PvP (for self).
evtc: yes · realtime: no

### `CBTS_ARCBUILD` (54)

`(char*)&src_agent` is a null-terminated string matching the full
arcdps build string in `arcdps.log`.  evtc: yes · realtime: no

### `CBTS_REWARD` (17)

`dst_agent` is the reward id; `value` the reward type.
evtc: yes · realtime: yes

### `CBTS_INTEGRITY` (36)

One event per message (previously named "error"): `(char*)&time` is
`char[32]`, a short null-terminated message with the reason.
evtc: yes · realtime: no

### `CBTS_TICK` (84)

Emitted every 25 ticks. `src_agent` is the current extrapolated tick
(may go backwards if the real update is lower than the extrapolation);
`dst_agent` is ticks since the last real tick update.
evtc: yes · realtime: no

### `CBTS_IDTOGUID` (46)

Content-id-to-GUID association for volatile types.
`(uint8_t*)&src_agent` is `uint8_t[16]`, the content GUID;
`overstack_value` is of
[`n_contentlocal`](/reference/enums/#n_contentlocal-content-types).
evtc: yes · realtime: no

### Internal: `CBTS_REPLINFO` (26), `CBTS_IDLEEVENT` (48), `CBTS_EARLYEXIT` (66)

Marked "internal use" — no payload documented.

### Extension injection: `CBTS_EXTENSION` (40) / `CBTS_EXTENSIONCOMBAT` (49)

"For extension use, not managed by arcdps" — produced by the
[`e9`/`e10` exports](/reference/extension-api/arcdps-exports/#e9--add-event-to-arcs-processing-pipeline).
`CBTS_EXTENSIONCOMBAT` is assumed to be a `cbtevent`, and its
`skillid` is processed for buffinfo/skillinfo purposes.
evtc: yes · realtime: yes

## Buffs

### `CBTS_BUFFAPPLY` (69) — buff stack application

| Field | Contents |
| --- | --- |
| `src_agent` | agent applying the stack |
| `dst_agent` | agent the stack was applied to |
| `value` | ms duration applied |
| `skillid` | buff skill id |
| `iff` | friend/foe, of `enum iff` |
| `is_ninety` / `is_fifty` / `is_moving` / `is_flanking` | as in `CBTS_COMBAT` |
| `is_shields` | non-zero if buff is active when applied |
| `pad61` | `(uint32_t*)&pad61` is `uint32[1]`, trackable id |

evtc: yes · realtime: limited to visible, must have previous squad to
squad application

### `CBTS_BUFFINITIAL` (18)

Buff application for buffs already existing at the time of the event.
Matches `CBTS_BUFFAPPLY`, except `buff_dmg` is the original ms
duration of the stack.

evtc: limited to squad outside instances · realtime: limited to squad

### `CBTS_BUFFCHANGE` (70) — stack duration change, active only

| Field | Contents |
| --- | --- |
| `dst_agent` | relates to agent |
| `value` | duration difference |
| `overstack_value` | new ms duration |
| `skillid` | buff skill id |
| `pad61` | `(uint32_t*)&pad61` is `uint32[1]`, trackable id |

evtc: yes · realtime: limited to visible, must have previous squad to
squad application

### `CBTS_BUFFREMOVE_SINGLE` (71) / `CBTS_BUFFREMOVE_ALL` (72)

| Field | Contents |
| --- | --- |
| `src_agent` | agent with buff(s) removed |
| `dst_agent` | agent removing the buff(s) |
| `value` | ms duration removed (`_ALL`: calculated as duration) |
| `buff_dmg` | `_ALL` only: ms duration removed calculated as intensity |
| `skillid` | buff skill id |
| `iff` | friend/foe, of `enum iff` |
| `is_buffremove` | of `enum cbtbuffremove` |
| `is_ninety` / `is_fifty` / `is_moving` / `is_flanking` | as in `CBTS_COMBAT` |
| `pad61` | `_SINGLE` only: `(uint32_t*)&pad61` is `uint32[1]`, trackable id |

evtc: yes · realtime: limited to visible, must have previous squad to
squad application

### `CBTS_BUFFACTIVE` (27) / `CBTS_BUFFDEACTIVE` (28)

`CBTS_BUFFACTIVE`: `src_agent` relates to agent, `dst_agent` is the
trackable id, `value` the current buff duration.
`CBTS_BUFFDEACTIVE`: `src_agent` relates to agent, `value` is the new
duration, `(uint32_t*)&pad61` is `uint32[1]`, the trackable id.

evtc: limited to squad outside instances · realtime: limited to squad

### `CBTS_BUFFINFO` (30) — buff metadata

Logs always contain info for the skill ids in the always-included
buff-formula mask (see [encounter IDs](/reference/encounter-ids/#always-included-buff-formula-skills)).

| Field | Contents |
| --- | --- |
| `overstack_value` | max combined duration |
| `skillid` | skilldef id of buff |
| `src_master_instid` | stacking limit |
| `is_flanking` | likely an invuln |
| `is_shields` | likely an invert |
| `is_offcycle` | category |
| `pad61` | buff stacking type |
| `pad62` | likely a resistance |
| `pad63` | non-zero if used in buff damage simulation (rough pov-only check) |

evtc: yes · realtime: no

### `CBTS_BUFFFORMULA` (31) — buff formula (one per event)

| Field | Contents |
| --- | --- |
| `time` | `(float*)&time` is `float[9]`: type, attribute1, attribute2, parameter1, parameter2, parameter3, trait_condition_source, trait_condition_self, content_reference |
| `skillid` | skilldef id of buff |
| `src_instid` | `(float*)&src_instid` is `float[2]`: buff_condition_source, buff_condition_self |

evtc: yes · realtime: no

The attribute indices are arc-build-dependent — Elite Insights maps
them through a build-aware table
(`BuffFormula.cs` in `GW2EIEvtcParser`). The buff-formula strings
observed in the arcdps binary name the formula types: "Base Damage
Multiplier", "Damage Attribute Multiplier", "Lifesteal Damage …", "To
Attribute"/"From Attribute"/"Percentage", "Health Comparison", "Stat
Increase", "Health Percent", "Proc Chance" (binary evidence, build
1.2026.718.905).

## Skills and animations

### `CBTS_SKILLINFO` (32)

`(float*)&time` is `float[4]`: cost, range0, range1, tooltiptime;
`skillid` is the skilldef id.  evtc: yes · realtime: no

### `CBTS_SKILLTIMING` (33)

`src_agent` is the timing type; `dst_agent` the time since activation
in milliseconds; `skillid` the skilldef id. One event per timing.
evtc: yes · realtime: no

### `CBTS_ANIMATIONSTART` (67)

| Field | Contents |
| --- | --- |
| `src_agent` | agent beginning animation |
| `dst_agent` | target agent if applicable |
| `value` | ms duration until minimum of last significant trigger point and tooltip time |
| `buff_dmg` | ms duration when control is returned to agent |
| `overstack_value` | reference data (see `n_customskill` — e.g. emote id for `CSK_EMOTE`, item id for `CSK_PICKUP`) |
| `skillid` | skill id |

evtc: yes · realtime: yes

### `CBTS_ANIMATIONSTOP` (68)

| Field | Contents |
| --- | --- |
| `src_agent` | agent that was animating |
| `value` | ms duration spent in animation, scaled for speed |
| `buff_dmg` | ms duration spent in animation, not scaled |
| `skillid` | skill id of the previous animation start |
| `is_activation` | simple progress check, of `enum cbtanimation` |

evtc: yes · realtime: yes

## Missiles

All missile events carry a **trackable id** in
`(uint32_t*)&pad61` linking create/launch/effect/remove of the same
missile.

### `CBTS_MISSILECREATE` (57)

| Field | Contents |
| --- | --- |
| `src_agent` | related to agent |
| `value` | `(int16*)&value` is `int16[3]`: location x/y/z, divided by 10 |
| `overstack_value` | skin id (player only) |
| `skillid` | missile skill id |

evtc: limited to agent table outside instances · realtime: no

### `CBTS_MISSILELAUNCH` (58)

| Field | Contents |
| --- | --- |
| `src_agent` | related to agent |
| `dst_agent` | at agent, if set and in range |
| `value` | `(int16*)&value` is `int16[6]`: target x/y/z, current x/y/z, divided by 10 |
| `skillid` | missile skill id |
| `iff` | `uint8_t[1]`, launch motion ("unknown, from client") |
| `result` | `(int16_t*)&result` is `int16[1]`, motion radius |
| `is_buffremove` | `(uint32_t*)&is_buffremove` is `uint32_t[1]`, launch flags ("unknown, from client") |
| `is_flanking` | non-zero if first launch |
| `is_shields` | `(int16_t*)&is_shields` is `int16[1]`, missile speed |

evtc: limited to agent table outside instances · realtime: no

### `CBTS_MISSILEREMOVE` (59)

| Field | Contents |
| --- | --- |
| `src_agent` | related to agent |
| `dst_agent` | missile target agent |
| `value` | friendly-fire damage total |
| `buff_dmg` | `(int16*)&buff_dmg` is `int16[3]`: current location x/y/z, divided by 10 |
| `skillid` | missile skill id |
| `is_flanking` | hit at least one enemy along the way |

evtc: limited to agent table outside instances · realtime: no

### `CBTS_MISSILEEFFECT` (79)

`dst_agent` is the owner of the missile; `skillid` the effect id;
`*(uint32_t*)&value` the duration; trackable id in `pad61`.
evtc: limited to agent table outside instances · realtime: no

## Effects

Both create events carry a trackable id in `(uint32_t*)&pad61` matched
by the corresponding remove event.

### `CBTS_EFFECTGROUNDCREATE` (60) / `CBTS_EFFECTGROUNDREMOVE` (61)

Create: `src_agent` related to agent; `(int16*)&dst_agent` is
`int16[6]` — origin x/y/z divided by 10, orient x/y/z multiplied by
1000; `skillid` is the effect id ("prefer using an id to guid map via
n_contentlocal"); `(uint32_t*)&iff` is `uint32_t[1]`, effect duration
(a zero duration may mean fixed-length — see `n_contentlocal`);
`is_buffremove` holds flags; `is_flanking` set if the effect is on a
non-static platform; `(int16_t*)&is_shields` is `int16[1]`, scale
(assume 1 if zero) multiplied by 1000.

Remove: only the trackable id in `pad61`.

Create — evtc: limited to agent table outside instances · realtime: no.
Remove — evtc: yes · realtime: no.

### `CBTS_EFFECTAGENTCREATE` (62) / `CBTS_EFFECTAGENTREMOVE` (63)

Create: `src_agent` related to agent; `skillid` effect id;
`(uint32_t*)&iff` is effect duration (same fixed-length caveat).
Remove: `src_agent` related to agent; trackable id in `pad61`.

evtc: limited to agent table outside instances · realtime: no

## Gadgets and capture points

### `CBTS_GADGETANIMATION` (77)

`src_agent` relates to agent; `dst_agent` is a token.
evtc: limited to agent table outside instances · realtime: no

### `CBTS_GADGETNAME` (78)

`src_agent` relates to agent; `dst_agent` is the new name-visibility
state — 0 false, 1 true, 2 unsupported (gadgets only).
evtc: limited to agent table outside instances · realtime: no

### `CBTS_GADGETCAPTUREOUTLINESHOW` (80)

`src_agent` relates to agent; `buff` is the wrbg colour.
evtc: limited to agent table outside instances · realtime: no

### `CBTS_GADGETCAPTURESPLITPERCENT` (81)

`src_agent` relates to agent; `*(float*)&value` is the percent
(1.0–0.0); `buff` is wrbg capping-from; `result` is wrbg capping-by.
evtc: limited to agent table outside instances · realtime: no

### `CBTS_GADGETCAPTUREOUTLINEHIDE` (82)

`src_agent` relates to agent.
evtc: limited to agent table outside instances · realtime: no

### `CBTS_GADGETCAPTUREOUTLINEPOINT` (83)

`src_agent` relates to agent; `dst_agent` is the point index;
`*(float*)&value` is x; `*(float*)&buff_dmg` is y; `overstack_value`
is the point count for this agent — if 1, the shape is a circle around
the agent with radius x.
evtc: limited to agent table outside instances · realtime: no

## WvW and squad

### `CBTS_WVWTEAMS` (74)

`(uint32_t*)&src_agent` is `uint32[6]`: redshard id, blueshard id,
greenshard id, redteam id, blueteam id, greenteam id.
evtc: yes · realtime: yes

### `CBTS_WVWOBJECTIVESTATUS` (75)

| Field | Contents |
| --- | --- |
| `value` | map id |
| `buff_dmg` | team id |
| `skillid` | objective id |
| `buff` | objective type |
| `pad61` | `(uint32_t*)&pad61` is `uint32[1]`, upgrade progress count |

evtc: yes · realtime: yes

### `CBTS_SQUADMARKER_GROUND` (53)

`(float*)&src_agent` is `float[3]`, the marker location x/y/z — if all
values are zero or infinity, the marker is removed; `skillid` is the
marker index (0 is the arrow).
evtc: yes · realtime: no

## Retired values

`CBTS_STATRESET_DEFUNC` (39, since 260402+),
`CBTS_APIDELAYED_DEFUNC` (41, since 260501+),
`CBTS_RATEHEALTH` (43, since 260627+),
`CBTS_LAST90BEFOREDOWN_DEFUNC` (44, since 240529+),
`CBTS_EFFECT1_DEFUNC` (45, since 230716+),
`CBTS_EFFECT2_DEFUNC` (51, since 250526+) — all explicitly retired;
current arcdps builds no longer emit them, but old logs may contain
them.

## See also

- [Enum reference](/reference/enums/) — the flat value tables for
  `cbtstatechange`, `iff`, `cbtresult`, `cbtanimation`,
  `cbtbuffremove`, `n_customskill`, `gwlanguage`, and
  `n_contentlocal`.
- [`cbtevent`](/reference/data-structures/cbtevent/) — the struct
  layout these payloads live in.
- [EVTC log format](/reference/evtc-format/) — the file format the
  "evtc:" availability column refers to.
