---
title: EVTC log format
description: Full binary-format specification for arcdps' .evtc/.zevtc combat logs — header, agent table, skill table, event stream, and the standard parsing recipe.
source: official-docs
---

`.evtc` files are the binary combat logs arcdps writes to disk after an
encounter. They are consumed **offline** by separate tooling (parsers,
uploaders, analysis sites) — not by extension DLLs at runtime. This page
is a full specification of the format, sourced from deltaconnected's
official EVTC documentation:

- `https://www.deltaconnected.com/arcdps/evtc/README.txt` (the format
  README; fetched 2026-08-08, server last-modified 2026-08-07)
- `https://www.deltaconnected.com/arcdps/evtc/writeencounter.cpp` (the
  official sample code that writes the file; last-modified 2025-08-19)

Statements below sourced from the local arcdps binary
(build `1.2026.718.905`) rather than those documents are called out
inline as **binary evidence**.

## Where logs are written

Logs are written to
`Documents/Guild Wars 2/addons/arcdps/arcdps.cbtlogs/` by default (the
directory is configurable in the arcdps options). Within that directory,
arcdps groups logs into a subdirectory per encounter — **binary
evidence**: the path template is `arcdps.cbtlogs\%s (%u)\`, i.e. the
boss name followed by its species id in parentheses — and names each
file with a `%Y%m%d-%H%M%S` timestamp.

When compression is enabled, arcdps writes the log into a zip container
staged as `<name>.tmp.zip` and renamed to **`.zevtc`** (binary
evidence: both templates appear in the DLL). A `.zevtc` file is a
standard zip archive containing a single `.evtc` file — unzip it (or
read the first entry) and parse the contents exactly as below.

### When a log starts and stops

From the official site's evtc-logging notes:

> pve/wvw: starts on first player combat enter, boss set by first damage
> event on boss, stops when all players exit combat.
> map: starts on joining an instance type map, stops on leaving map.

The set of NPC species ids that arcdps treats as log-starting bosses is
listed on the [encounter IDs](/reference/encounter-ids/) page. The NPC
id for a PvE log "can be found via detail window and noting species in
window title, or tooltip in target list after attacking."

### When a log is *not* saved

**Binary evidence** — the DLL contains a literal diagnostic for each
reason a finished encounter is discarded instead of written:

- `log not saved due to invalid map type`
- `log not saved due to saving disabled`
- `log not saved due to short duration`
- `log not saved due to unmet condition (squad minimum)`
- `log not saved due to unmet condition (squad maximum)`
- `log not saved due to unmet condition (squad percent)`
- `log not saved due to unmet condition (enemy minimum)`
- `log not saved due to no boss interact`
- `map log not saved due to short duration`

Each corresponds to a logging setting (minimum log duration, squad
min/max/percent participation, WvW enemy minimum — see the
[installation & files](/guides/installation-and-files/) page for the
matching `arcdps.ini` keys). These messages appear in the arcdps logger
window when a log is skipped, which makes them the fastest way to answer
"why didn't my log save?"

## File layout

An `.evtc` file is five consecutive sections with no padding between
them:

| # | Section | Size |
| --- | --- | --- |
| 1 | Header | 16 bytes |
| 2 | Agent count | `uint32_t` |
| 3 | Agent table | count × `sizeof(evtc_agent)` (96 bytes each) |
| 4 | Skill count | `uint32_t` |
| 5 | Skill table | count × `sizeof(evtc_skill)` (68 bytes each) |
| 6 | Event stream | `cbtevent` structs (64 bytes each) to end of file |

All integers are little-endian. Skill and agent names use UTF-8.

### Header (16 bytes)

From `writeencounter.cpp`:

| Offset | Size | Contents |
| --- | --- | --- |
| 0 | 4 | Magic bytes `EVTC` |
| 4 | 8 | arcdps build date as an ASCII `yyyymmdd` string (the README describes bytes 0–11 together as "evtc bytes for filetype, arcdps build yyyymmdd for compatibility") |
| 12 | 1 | `cbtevent` **revision** byte — `1` for the current struct layout ("revision 1, when header[12] == 1"); `0` in old logs using the pre-revision layout |
| 13 | 2 | `uint16_t` species id of the boss being logged |
| 15 | 1 | Unused (`0`) — "possibly expanded to an extra byte for species id just in case" |

Two special species-id values in the header:

> an npcid of 1 indicates log is wvw.
> an npcid of 2 indicates log is map

### Agent table

Each entry is an `evtc_agent` (96 bytes):

```c
typedef struct evtc_agent {
    uint64_t iid;
    uint32_t prof;
    uint32_t is_elite;
    int16_t toughness;
    int16_t concentration;
    int16_t healing;
    uint16_t hitbox_width;
    int16_t condition;
    uint16_t defunc;
    char name[64];
} evtc_agent;
```

The final `uint16_t` was named `hitbox_height` in older documentation
(and still is in `writeencounter.cpp`); the jul.01.2026 changelog
retired it — "removed hitbox height from evtc_agent (defunc, wasnt
hitbox height)" — and the current README names the field `defunc`.

**Classifying an agent** (verbatim rules from the README):

> if evtc_agent.is_elite == 0xffffffff && upper half of evtc_agent.prof
> == 0xffff, agent is a gadget with pseudo id as lower half of
> evtc_agent.prof (volatile id).
> if evtc_agent.is_elite == 0xffffffff && upper half of evtc_agent.prof
> != 0xffff, agent is a npc with species id as lower half of
> evtc_agent.prof (reliable id).
> if evtc_agent.is_elite != 0xffffffff, agent is a player with
> profession as evtc_agent.prof and elite spec as evtc_agent.is_elite.

Gadget caveat, verbatim:

> gadgets do not have true ids and are generated through a combination
> of gadget parameters - they will collide with npcs and should be
> treated separately.

**Player names** are a combo string:

> evtc_agent.name is a combo string on players - character name <null>
> account name <null> subgroup str literal <null>.

So a player's 64-byte `name` field contains three null-terminated
strings back to back: character name, account name (with the leading
`:` as seen in game), and the subgroup number as a string literal.

**Player stats are anonymized.** `writeencounter.cpp` reduces each
player's toughness/concentration/healing/condition to a coarse `0` or
`10` before writing — `10` if the player's value exceeds 0.66 of the
squad maximum for that stat, else `0`. Don't read these fields as real
attribute values; they only indicate "relatively high" vs "relatively
low" within the squad.

Also note, verbatim: "nameless/combatless agents may not be written to
table while appearing in events" — be prepared for events whose
`src_agent`/`dst_agent` have no agent-table entry.

### Skill table

Each entry is an `evtc_skill` (68 bytes), one per unique skill id seen
in the log's events:

```c
typedef struct evtc_skill {
    int32_t id;
    char name[64];
} evtc_skill;
```

Some skill ids in the event stream are synthetic arcdps ids rather than
game skills — see [`n_customskill`](/reference/enums/#n_customskill-synthetic-skill-ids)
(dodge, weapon swap, generic damage, and friends, starting at 23275).

### Event stream

The rest of the file is raw [`cbtevent`](/reference/data-structures/cbtevent/)
structs, 64 bytes each, in write order. The `is_statechange` byte on
each event determines how every other field is interpreted — the
complete per-event payload mapping is on the
[statechange payloads](/reference/enums/statechange-payloads/) page.

Not every event type present in the live extension API makes it into
the file: each statechange has an "evtc:" availability note (yes /
no / limited to squad or agent-table, with instanced content further
restricted). Those notes are reproduced per-event on the payloads page.

## The standard parsing recipe

The README prescribes a three-pass approach after reading the tables
(verbatim, lightly reflowed):

1. **Add bookkeeping fields.** "add u16 field to the agent table,
   agents[x].instance_id, initialized to 0. add u64 fields
   agents[x].first_aware initialized to 0, and agents[x].last_aware
   initialized to u64max. add u64 field agents[x].master_addr,
   initialized to 0."
2. **Pass 1 — instance ids and awareness ranges.** "iterate through all
   events, assigning instance ids and first/last aware ticks. set
   agents[x].instance_id = src_instid where agents[x].addr == src_agent
   && !is_statechange. set agents[x].first_aware = time on first event,
   then all consecutive event times to agents[x].last_aware."
3. **Pass 2 — master resolution (minions → owners).** "iterate through
   all events again, this time assigning master agent. set
   agents[z].master_addr = agents[x].addr where agents[x].instance_id
   == src_master_instid && agent[x].first_aware < time < last_aware."
4. **Pass 3 — your data.** "iterate through all events one last time,
   this time parsing for the data you want. src_agent and/or dst_agent
   should be used to associate event data with local data."

The awareness-window check in pass 2 matters because instance ids are
reused: an instid only maps to a specific agent *during that agent's
first/last-aware window*.

One newer wrinkle: `CBTS_IIDCHANGE` events (players only) signal that an
agent's iid — "previously evtc_agent->addr" — changed after spawn when
the player's historical data loads. Parsers tracking agents by address
across a log should honor these events.

## Known limitations of the data

From the official site's limitations list — things the combat API
simply does not receive from the server, or approximates:

- Area stats are missing percent-based damage, siphon damage, healing,
  combo finishers, and buff extension sources ("not notified by
  server").
- Condition damage is **simulated**: arcdps builds the attacker's
  condition attribute from gear/traits/buffs on a simulated server
  tick. Components can be missed (e.g. inactive revenant legends), and
  condition scaling at levels 1–79 differs from the game's.
- On-skill-use procs are attributed at animation start.
- The strike-damage notify bubble may drop out-of-range events (e.g.
  Deimos).
- Strips ignore last-stack stability.
- Skill activation tracking only counts animated skills — no shouts,
  no instant casts.

## Revision history notes

- **Revision byte**: current logs have `header[12] == 1` and use the
  `cbtevent` layout documented here and on the
  [`cbtevent`](/reference/data-structures/cbtevent/) page. Logs with
  `header[12] == 0` predate the revision-1 layout; the official README
  no longer documents the revision-0 struct. Per Elite Insights'
  reader (`ReadCombatItem` vs `ReadCombatItemRev1` in
  `GW2EIEvtcParser/EvtcParser.cs` — community source), the revision-0
  event is still 64 bytes but differs as follows: `overstack_value`
  and `skillid` are **2-byte (`uint16_t`)** fields; there is **no
  `dst_master_instid`** (parsers substitute 0); and the difference is
  made up with garbage/padding bytes (9 bytes after
  `src_master_instid`, one trailing byte). Use EI's rev-0 reader as
  the authoritative reference if you must parse very old logs.
- **may.07.2026**: animation events moved to
  `CBTS_ANIMATIONSTART`/`CBTS_ANIMATIONSTOP`; buff apply/remove moved
  to `CBTS_BUFFAPPLY`, `CBTS_BUFFCHANGE`, `CBTS_BUFFREMOVE_SINGLE`,
  `CBTS_BUFFREMOVE_ALL`; `cbtbuffcycle` merged into `cbtresult`. Older
  third-party docs that describe activation/buff-remove events as
  plain `CBTS_COMBAT` events with `is_activation`/`is_buffremove` set
  describe the pre-may-2026 behavior.
- **jul.01.2026**: added `CBTS_MISSILEEFFECT` and the gadget-capture
  events; retired `CBTS_RATEHEALTH`; added `CBTS_TICK`; removed hitbox
  height from `evtc_agent`.

## See also

- [Parsing EVTC logs in practice](/guides/parsing-logs/) — a minimal
  Python walkthrough of this spec, tested against a real revision-1
  log.
- [Statechange payloads](/reference/enums/statechange-payloads/) — how
  every `cbtstatechange` value maps onto `cbtevent` fields, with
  evtc/realtime availability.
- [`cbtevent`](/reference/data-structures/cbtevent/) — the 64-byte
  event struct shared by logs and the live API.
- [Encounter IDs](/reference/encounter-ids/) — the species ids that
  start boss logs, and secondary target ids.
- [Elite Insights](https://github.com/baaron4/GW2-Elite-Insights-Parser)
  — the reference community parser for this format.
