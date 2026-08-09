---
title: Reading damage from logs
description: How to sum damage correctly from EVTC combat events — strike vs. buff damage, barrier absorption, minions, and the result codes that aren't damage at all.
source: community
---

"Total damage" sounds like one number, but an EVTC log splits it
across two event shapes and a dozen result codes, and summing the
wrong ones silently inflates or deflates every player's total. This
page gives the filter rules, with numbers observed in a real
revision-1 WvW `.zevtc` log (arcdps build 20260114, ~6.7-minute
fight) inspected while writing this page. Field layouts are on the
[cbtevent](/reference/data-structures/cbtevent/) page; enum values on
the [enum reference](/reference/enums/).

All damage lives in ordinary combat events — `is_statechange == 0` —
and splits on the `buff` byte.

## Strike damage (`buff == 0`)

Direct hits. `value` is the damage dealt (combined barrier + health,
per the official field notes), `src_agent` the attacker, `dst_agent`
the victim, `skillid` the skill. Only three
[`result`](/reference/enums/#cbtresult-combat-result) codes are
actual connecting strikes:

| `result` | Meaning |
| --- | --- |
| 0 | `CBTR_STRIKE_DAMAGENORMAL` |
| 1 | `CBTR_STRIKE_DAMAGECRIT` |
| 2 | `CBTR_STRIKE_DAMAGEGLANCE` |

Observed: 8,194 such events totalling 8,401,224 damage (of which
5,745 were crits — WvW zerg fights crit a lot).

Everything else in the `result` column is **not** health damage and
must be excluded from damage sums:

- 3–7 (`BLOCK`/`EVADE`/`INTERRUPT`/`ABSORB`/`BLIND`) — the hit didn't
  land; `value` there is not applied damage.
- 8/9 (`KILLINGBLOW`/`DOWNED`) — marker events; see
  [downs & deaths](/guides/wvw-downs-deaths/).
- 10 (`DEFIANCE_DAMAGENORMAL`) and 12 (`CROWDCONTROL`) — defiance-bar
  and CC records, not health damage. The test log had 2,174
  crowd-control events; adding their `value` fields would have
  inflated total damage by ~18%.
- 11 (`SKILLCAST`) — an on-use signal, no damage.

## Buff damage (`buff == 1`, `value == 0`)

Damage-over-time ticks (conditions, and damaging auras/traits).
The classic encoding, confirmed in the test log: `buff == 1`,
**`value == 0`, and the damage is in `buff_dmg`**. Observed top
sources, with names taken from the log's own skill table:

| Skill id | Name | Tick events | Total damage |
| --- | --- | --- | --- |
| 737 | Burning | 1,070 | 650,404 |
| 19426 | Torment | 351 | 240,108 |
| 736 | Bleeding | 1,132 | 157,262 |
| 30285 | Vampiric Aura | 946 | 74,028 |
| 723 | Poisoned | 454 | 66,808 |

The `value == 0` check is what separates these from **buff
applications**, which share `buff == 1` but carry the duration in
`value` and zero in `buff_dmg` — see
[boons & buffs](/guides/boons-and-buffs/). Sum `buff_dmg` for buff
events, `value` for strike events, never both fields of one event.

## Barrier

When a strike is partially or wholly absorbed by barrier, the event
sets `is_shields` and `overstack_value` holds the barrier-absorbed
portion (`value` remains the combined total). Observed: 495 of the
8,194 strikes were barrier-flagged, absorbing 252,127 — so "damage to
health" and "damage dealt" differ by about 3% in this fight.
Boon-ball WvW squads run heavy barrier; ignoring `is_shields`
overstates damage that actually reached health bars.

## Minions and pets

92 of the observed strike events had a nonzero `src_master_instid` —
necromancer minions, ranger pets, turrets. Their damage belongs to
the master: resolve `src_master_instid` against the agents' instance
ids before crediting, or minion damage silently vanishes from player
totals. Note WvW siege ownership is its own case — see the
[version notes](/guides/recording-wvw-logs/#version-notes-that-matter-for-wvw)
on siege owner vs. operator.

## The checklist

To compute a player's damage output:

1. Take `is_statechange == 0` events where the player (or a minion
   whose `src_master_instid` resolves to them) is `src_agent`.
2. Add `value` where `buff == 0` and `result` ∈ {0, 1, 2}.
3. Add `buff_dmg` where `buff == 1` and `value == 0`.
4. Track `overstack_value` on `is_shields` events separately if you
   want damage-to-health vs. damage-absorbed split.
5. Divide by fight duration from the squad-combat timestamps — see
   [timestamps & duration](/guides/log-timing/).

For decoding the raw event stream these filters run over, see
[Parsing EVTC logs](/guides/parsing-logs/).
