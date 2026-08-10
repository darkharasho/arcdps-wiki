---
title: Enum reference
description: Reference tables for the arcdps combat-event enums — cbtstatechange, cbtresult, iff, cbtanimation, cbtbuffremove, n_customskill, gwlanguage, and n_contentlocal.
source: official-docs
---

arcdps' combat-event enums are not defined in the API README — like
`cbtevent` itself, they live in the separate EVTC combat-log format
documentation (`https://www.deltaconnected.com/arcdps/evtc/README.txt`),
which this page is sourced from. Field names below match the C source
exactly; the arcdps API README calls the on-`ev` discriminant field
`is_statechange`, and the EVTC docs name the enum backing it
`cbtstatechange` — the two refer to the same thing.

Every enum here is 0-indexed and sequential (each enumerator's value is
the previous value + 1) **unless otherwise noted** — `n_customskill` is
the one exception, explicitly starting at `23275`.

## Using these enums in practice

These tables aren't just value lookups — they drive the branching in any
[`cbtevent`](/reference/data-structures/cbtevent/) consumer. A couple of
worked examples that combine facts from the tables below.

**Counting landed strike damage with `cbtresult`.** On a `CBTS_COMBAT`
event the `result` field is a `cbtresult`. Only values `0`–`2`
(`CBTR_STRIKE_DAMAGENORMAL`, `CBTR_STRIKE_DAMAGECRIT`,
`CBTR_STRIKE_DAMAGEGLANCE`) are actual strike hits carrying damage;
`8` (`CBTR_KILLINGBLOW`) and `9` (`CBTR_DOWNED`) are outcome **markers**
— "target was killed / downed by skill" — not damage rows, so summing
their `value` would double-count. Crit rate is just the share of the
strike hits whose `result` is `1`:

```c
if (ev->result <= CBTR_STRIKE_DAMAGEGLANCE) { // 0,1,2 only
    total_strike += ev->value;                // combined shield+health strike damage
    if (ev->result == CBTR_STRIKE_DAMAGECRIT) // 1
        crit_strikes++;
}
```

**Splitting friend from foe with `iff`.** The `iff` field is `0`
`IFF_FRIEND`, `1` `IFF_FOE`, `2` `IFF_UNKNOWN`. Route outgoing damage
you deal to a foe versus incoming damage separately, and don't fold
`IFF_UNKNOWN` into either bucket:

```c
if (ev->iff == IFF_FOE)         // 1
    dealt_to_foes += ev->value;
else if (ev->iff == IFF_FRIEND) // 0
    ; // friendly-fire / support target
// iff == IFF_UNKNOWN (2): leave out of both tallies
```

See the [guide to reading damage](/guides/reading-damage/) for the full
event walk-through.

## `cbtstatechange` (the `is_statechange` field)

This is the event-type discriminant on [`cbtevent`](/reference/data-structures/cbtevent/)
— its value determines how every other field on the struct (besides
`time`) is interpreted. The "Meaning" column below is the enum's own
inline comment; the full per-field payload mapping for every event
type, including each type's evtc/realtime availability, is on the
[statechange payloads](/reference/enums/statechange-payloads/) page.
Entries suffixed `_DEFUNC` are explicitly marked **retired** in the
source and should not be relied on for current arcdps builds.

| Value | Name | Meaning |
| --- | --- | --- |
| 0 | `CBTS_COMBAT` | combat events |
| 1 | `CBTS_ENTERCOMBAT` | agent entered combat |
| 2 | `CBTS_EXITCOMBAT` | agent left combat |
| 3 | `CBTS_CHANGEUP` | agent is alive at time of event |
| 4 | `CBTS_CHANGEDEAD` | agent is dead at time of event |
| 5 | `CBTS_CHANGEDOWN` | agent is down at time of event |
| 6 | `CBTS_SPAWN` | agent entered tracking |
| 7 | `CBTS_DESPAWN` | agent left tracking |
| 8 | `CBTS_HEALTHPCTUPDATE` | agent health percentage changed |
| 9 | `CBTS_SQCOMBATSTART` | squad combat start, first player enter combat (previously named log start) |
| 10 | `CBTS_SQCOMBATEND` | squad combat stop, last player left combat (previously named log end) |
| 11 | `CBTS_WEAPSWAP` | agent weapon set changed |
| 12 | `CBTS_MAXHEALTHUPDATE` | agent maximum health changed |
| 13 | `CBTS_POINTOFVIEW` | "recording" player |
| 14 | `CBTS_LANGUAGE` | text language id |
| 15 | `CBTS_GWBUILD` | game build |
| 16 | `CBTS_SHARDID` | server shard id |
| 17 | `CBTS_REWARD` | wiggly box reward |
| 18 | `CBTS_BUFFINITIAL` | buff application for buffs already existing at time of event |
| 19 | `CBTS_POSITION` | agent position changed |
| 20 | `CBTS_VELOCITY` | agent velocity changed |
| 21 | `CBTS_FACING` | agent facing direction changed |
| 22 | `CBTS_TEAMCHANGE` | agent team id changed |
| 23 | `CBTS_ATTACKTARGET` | attacktarget to gadget association |
| 24 | `CBTS_TARGETABLE` | agent targetable state (0 false, 1 true, 2 unsupported) |
| 25 | `CBTS_MAPID` | map info |
| 26 | `CBTS_REPLINFO` | internal use |
| 27 | `CBTS_BUFFACTIVE` | buff instance is now active |
| 28 | `CBTS_BUFFDEACTIVE` | buff set inactive |
| 29 | `CBTS_GUILD` | agent is a member of guild |
| 30 | `CBTS_BUFFINFO` | buff information (logs always contain info for skill ids in the always-included buff-skill mask) |
| 31 | `CBTS_BUFFFORMULA` | buff formula, one per event of this type |
| 32 | `CBTS_SKILLINFO` | skill information |
| 33 | `CBTS_SKILLTIMING` | skill timing, one per event of this type |
| 34 | `CBTS_DEFIANCEBARSTATE` | agent defiance bar state changed |
| 35 | `CBTS_DEFIANCEBARPERCENT` | agent defiance bar percentage changed |
| 36 | `CBTS_INTEGRITY` | one event per message (previously named error) |
| 37 | `CBTS_MARKER` | one event per marker on an agent |
| 38 | `CBTS_BARRIERPCTUPDATE` | agent barrier percentage changed |
| 39 | `CBTS_STATRESET_DEFUNC` | retired, not used since 260402+ |
| 40 | `CBTS_EXTENSION` | for extension use, not managed by arcdps |
| 41 | `CBTS_APIDELAYED_DEFUNC` | retired, not used since 260501+ |
| 42 | `CBTS_INSTANCESTART` | map instance start |
| 43 | `CBTS_RATEHEALTH` | retired, not used since 260627+ |
| 44 | `CBTS_LAST90BEFOREDOWN_DEFUNC` | retired, not used since 240529+ |
| 45 | `CBTS_EFFECT1_DEFUNC` | retired, not used since 230716+ |
| 46 | `CBTS_IDTOGUID` | content id to guid association for volatile types |
| 47 | `CBTS_LOGNPCUPDATE` | log boss agent changed |
| 48 | `CBTS_IDLEEVENT` | internal use |
| 49 | `CBTS_EXTENSIONCOMBAT` | for extension use, not managed by arcdps (assumed to be a `cbtevent`; `skillid` processed for buffinfo/skillinfo) |
| 50 | `CBTS_FRACTALSCALE` | fractal scale for fractals |
| 51 | `CBTS_EFFECT2_DEFUNC` | retired, not used since 250526+ |
| 52 | `CBTS_RULESET` | ruleset for self |
| 53 | `CBTS_SQUADMARKER_GROUND` | squad ground markers |
| 54 | `CBTS_ARCBUILD` | arc build info |
| 55 | `CBTS_GLIDER` | glider status change |
| 56 | `CBTS_STUNBREAK` | disable stopped early |
| 57 | `CBTS_MISSILECREATE` | create a missile |
| 58 | `CBTS_MISSILELAUNCH` | launch missile |
| 59 | `CBTS_MISSILEREMOVE` | remove missile |
| 60 | `CBTS_EFFECTGROUNDCREATE` | play effect on ground |
| 61 | `CBTS_EFFECTGROUNDREMOVE` | stop effect on ground |
| 62 | `CBTS_EFFECTAGENTCREATE` | play effect around agent |
| 63 | `CBTS_EFFECTAGENTREMOVE` | stop effect around agent |
| 64 | `CBTS_IIDCHANGE` | iid (previously `evtc_agent->addr`) changed — players only, happens after spawn when historical data loads |
| 65 | `CBTS_MAPCHANGE` | map changed |
| 66 | `CBTS_EARLYEXIT` | internal use |
| 67 | `CBTS_ANIMATIONSTART` | animation start |
| 68 | `CBTS_ANIMATIONSTOP` | animation stop |
| 69 | `CBTS_BUFFAPPLY` | buff stack application |
| 70 | `CBTS_BUFFCHANGE` | buff stack duration change, active only |
| 71 | `CBTS_BUFFREMOVE_SINGLE` | buff stack removed |
| 72 | `CBTS_BUFFREMOVE_ALL` | all buff stacks of `skillid` removed |
| 73 | `CBTS_TRANSFORMATION` | transformation |
| 74 | `CBTS_WVWTEAMS` | wvw team association |
| 75 | `CBTS_WVWOBJECTIVESTATUS` | status update on wvw objectives |
| 76 | `CBTS_STEALTHCHANGE` | agent stealth state (0 false, 1 true, 2 unsupported) |
| 77 | `CBTS_GADGETANIMATION` | play model animation |
| 78 | `CBTS_GADGETNAME` | gadget name visibility state (0 false, 1 true, 2 unsupported) |
| 79 | `CBTS_MISSILEEFFECT` | apply effect to missile |
| 80 | `CBTS_GADGETCAPTUREOUTLINESHOW` | gadget capture point show outline |
| 81 | `CBTS_GADGETCAPTURESPLITPERCENT` | gadget capture point percent split |
| 82 | `CBTS_GADGETCAPTUREOUTLINEHIDE` | gadget capture point hide outline |
| 83 | `CBTS_GADGETCAPTUREOUTLINEPOINT` | gadget capture point point data |
| 84 | `CBTS_TICK` | tick, every 25 ticks |
| 85 | `CBTS_UNKNOWN` | unknown/unsupported type newer than this list |

## `iff` (friend/foe)

Backs the `cbtevent.iff` field for `CBTS_COMBAT` and buff apply/remove
events.

| Value | Name |
| --- | --- |
| 0 | `IFF_FRIEND` |
| 1 | `IFF_FOE` |
| 2 | `IFF_UNKNOWN` |

## `cbtresult` (combat result)

Backs the `cbtevent.result` field.

| Value | Name | Meaning |
| --- | --- | --- |
| 0 | `CBTR_STRIKE_DAMAGENORMAL` | damage is strike |
| 1 | `CBTR_STRIKE_DAMAGECRIT` | strike was crit |
| 2 | `CBTR_STRIKE_DAMAGEGLANCE` | strike was glance |
| 3 | `CBTR_BLOCK` | blocked, e.g. mesmer shield 4 |
| 4 | `CBTR_EVADE` | evaded, e.g. dodge or mesmer sword 2 |
| 5 | `CBTR_INTERRUPT` | action was interrupted |
| 6 | `CBTR_ABSORB` | invulnerable or absorbed, e.g. guardian elite |
| 7 | `CBTR_BLIND` | action missed |
| 8 | `CBTR_KILLINGBLOW` | target was killed by skill |
| 9 | `CBTR_DOWNED` | target was downed by skill |
| 10 | `CBTR_DEFIANCE_DAMAGENORMAL` | damage is to defiance |
| 11 | `CBTR_SKILLCAST` | on-skill-use signal event |
| 12 | `CBTR_CROWDCONTROL` | target was crowdcontrolled |
| 13 | `CBTR_INVERT` | damage was inverted |
| 14 | `CBTR_BUFF_DAMAGECYCLE` | buff damage happened on tick timer |
| 15 | `CBTR_BUFF_DAMAGENOTCYCLE` | buff damage happened outside tick timer |
| 16 | `CBTR_BUFF_DAMAGENOTCYCLEDMGTOTARGETONHIT` | buff damage happened to target on hitting target |
| 17 | `CBTR_BUFF_DAMAGENOTCYCLEDMGTOSOURCEONHIT` | buff damage happened to source on hitting target |
| 18 | `CBTR_BUFF_DAMAGENOTCYCLEDMGTOTARGETONSTACKREMOVE` | buff damage happened to target on buff removal |
| 19 | `CBTR_UNKNOWN` | (no inline comment given) |

## `cbtanimation` (skill activation state)

Backs the `cbtevent.is_activation` field (the API README refers to this
concept as skill "activation"; the EVTC source names the enum
`cbtanimation`).

| Value | Name | Meaning |
| --- | --- | --- |
| 0 | `ACTV_NONE` | undocumented — no inline comment given |
| 1 | `ACTV_START_DEFUNC` | undocumented — no inline comment given (retired, `_DEFUNC` suffix) |
| 2 | `ACTV_QUICKNESS_DEFUNC` | undocumented — no inline comment given (retired, `_DEFUNC` suffix) |
| 3 | `ACTV_MINIMUM` | stopped animation with reaching minimum of first trigger point or tooltip time |
| 4 | `ACTV_CANCEL` | stopped animation without reaching minimum of first trigger point or tooltip time |
| 5 | `ACTV_RESET` | animation completed fully |
| 6 | `ACTV_NODATA` | same as `ACTV_MINIMUM` but on 0/uncertain expected duration |
| 7 | `ACTV_UNKNOWN` | undocumented — no inline comment given |

## `cbtbuffremove` (buff remove type)

Backs the `cbtevent.is_buffremove` field.

| Value | Name | Meaning |
| --- | --- | --- |
| 0 | `CBTB_NONE` | not used — not this kind of event |
| 1 | `CBTB_ALL` | last/all stacks removed (sent by server) |
| 2 | `CBTB_SINGLE` | single stack removed (sent by server) |
| 3 | `CBTB_MANUAL` | single stack removed (created by arc on all-stack-remove) |
| 4 | `CBTB_UNKNOWN` | undocumented — no inline comment given |

## `n_customskill` (synthetic skill ids)

Synthetic `skillid` values arcdps emits for events that aren't a real
game skill (e.g. dodges, weapon swaps). Unlike the enums above, this one
does **not** start at 0 — `CSK_DODGE` is explicitly assigned `23275`, and
every subsequent enumerator increments sequentially from there.

| Value | Name | Meaning |
| --- | --- | --- |
| 23275 | `CSK_DODGE` | undocumented — no inline comment given |
| 23276 | `CSK_DEFIANCEDAMAGE` | undocumented — no inline comment given |
| 23277 | `CSK_SELFCAST1` | undocumented — no inline comment given |
| 23278 | `CSK_ENEMYCAST1` | undocumented — no inline comment given |
| 23279 | `CSK_SELFCAST2` | undocumented — no inline comment given |
| 23280 | `CSK_ENEMYCAST2` | undocumented — no inline comment given |
| 23281 | `CSK_SELFCAST3` | undocumented — no inline comment given |
| 23282 | `CSK_ENEMYCAST3` | undocumented — no inline comment given |
| 23283 | `CSK_BREAKBAR_DEFUNC` | undocumented — no inline comment given (retired, `_DEFUNC` suffix) |
| 23284 | `CSK_WEAPONDRAW` | undocumented — no inline comment given |
| 23285 | `CSK_WEAPONSTOW` | undocumented — no inline comment given |
| 23286 | `CSK_GENERICBLOCK` | undocumented — no inline comment given |
| 23287 | `CSK_GENERICDAMAGE` | undocumented — no inline comment given |
| 23288 | `CSK_GENERICKILL` | undocumented — no inline comment given |
| 23289 | `CSK_GENERICDOWN` | undocumented — no inline comment given |
| 23290 | `CSK_GENERICEVADE` | undocumented — no inline comment given |
| 23291 | `CSK_GENERICINTERRUPT` | undocumented — no inline comment given |
| 23292 | `CSK_GENERICABSORB` | undocumented — no inline comment given |
| 23293 | `CSK_GENERICMISS` | undocumented — no inline comment given |
| 23294 | `CSK_GENERICKNOCKDOWN` | undocumented — no inline comment given |
| 23295 | `CSK_GENERICKNOCKBACKPULL` | undocumented — no inline comment given |
| 23296 | `CSK_GENERICFLOATLAND` | undocumented — no inline comment given |
| 23297 | `CSK_GENERICLAUNCH` | undocumented — no inline comment given |
| 23298 | `CSK_GENERICWATERFLOATSINK_DEFUNC` | undocumented — no inline comment given (retired, `_DEFUNC` suffix) |
| 23299 | `CSK_GENERICCCBUFF` | undocumented — no inline comment given |
| 23300 | `CSK_GENERICSTAGGER` | undocumented — no inline comment given |
| 23301 | `CSK_GENERICINVALID` | undocumented — no inline comment given |
| 23302 | `CSK_GADGETINTERACT` | undocumented — no inline comment given |
| 23303 | `CSK_EMOTE` | emote id given in the paired `CBTS_ANIMATIONSTART` event |
| 23304 | `CSK_GENERICFLOATWATER` | undocumented — no inline comment given |
| 23305 | `CSK_GENERICSINK` | undocumented — no inline comment given |
| 23306 | `CSK_GENERICLOCKOUT` | undocumented — no inline comment given |
| 23307 | `CSK_GENERICFEAR` | undocumented — no inline comment given |
| 23308 | `CSK_PICKUP` | item id given in the paired `CBTS_ANIMATIONSTART` event |
| 23309 | `CSK_GENERICFALLDOWN` | undocumented — no inline comment given |

## `gwlanguage` (text language)

Backs the `CBTS_LANGUAGE` statechange's `src_agent` payload. Note the
gap: there is no value 1.

| Value | Name | Language |
| --- | --- | --- |
| 0 | `GWL_ENG` | English |
| 2 | `GWL_FRE` | French |
| 3 | `GWL_GEM` | German |
| 4 | `GWL_SPA` | Spanish |
| 5 | `GWL_CN` | Chinese |

The [Unofficial Extras](/reference/unofficial-extras/) `Language` enum
uses identical values.

## `n_contentlocal` (content types)

Backs the `overstack_value` of `CBTS_IDTOGUID` events — the type of
content whose id-to-GUID association is being reported. Sequential
from 0.

| Value | Name | Notes (from the source's inline comments) |
| --- | --- | --- |
| 0 | `CONTENTLOCAL_EFFECT` | `src_instid`: content type; `(float*)&buff_dmg` is the default duration, if available (when the effect event has no duration or agent set) |
| 1 | `CONTENTLOCAL_MARKER` | `src_instid`: is in commander-tag defs |
| 2 | `CONTENTLOCAL_SKILL` | no extra data — see `CBTS_SKILLINFO`/`CBTS_BUFFINFO` events |
| 3 | `CONTENTLOCAL_SPECIES_NOT_GADGET` | no extra data |
| 4 | `CONTENTLOCAL_EMOTE` | no extra data |
| 5 | `CONTENTLOCAL_TRANSFORMATION` | no extra data |

The source also defines two enums marked "(debug only, subject to
change)" — `n_animationstart` and `n_animationstop` — which are not
reproduced here because the source itself flags them as unstable.

## Profession ids (community)

The EVTC docs don't enumerate profession ids; the values below are
**community knowledge** (used identically by the Rust bindings and
matching the game's `code` values from the official GW2 web API's
`/v2/professions` endpoint). They back `ag.prof` for players,
`evtc_agent.prof`, and the `value` field of
`CBTS_ENTERCOMBAT`/`CBTS_EXITCOMBAT`.

| Value | Profession |
| --- | --- |
| 0 | unknown |
| 1 | Guardian |
| 2 | Warrior |
| 3 | Engineer |
| 4 | Ranger |
| 5 | Thief |
| 6 | Elementalist |
| 7 | Mesmer |
| 8 | Necromancer |
| 9 | Revenant |

This ordering is corroborated by the arcdps binary itself: its icon
strings run `001`–`009` and its profession list appears in exactly
this order ("guardian, warrior, engineer, ranger, thief,
elementalist, mesmer, necromancer, revenant") in the settings UI
strings. Elite specialization ids (`ag.elite` /
`evtc_agent.is_elite`) are the game's specialization ids from
`/v2/specializations` — a larger, game-managed id space not
enumerated here (`0xFFFFFFFF` marks a non-player agent; see the
[EVTC agent classification rules](/reference/evtc-format/#agent-table)).

## See also

- [Statechange payloads](/reference/enums/statechange-payloads/) — the
  full per-event field mapping for every `cbtstatechange` value.
- [`cbtevent`](/reference/data-structures/cbtevent/) — the struct these
  enums back.
- [`agent (ag)`](/reference/data-structures/agent/) — the accompanying
  agent struct.
