---
title: Combat callback
description: The combat/combat_local callback signature, area vs local semantics, and event ordering.
source: official-docs
---

Extension modules receive combat events through two optional callback
slots in their `arcdps_exports` table (see
[Getting Started](/getting-started/#the-arcdps_exports-struct)):
`combat` (area) and `combat_local` (local). Both share the same call
signature; they differ in scope, timing, and the `skillname` parameter's
constness. This page is sourced from the official arcdps API reference
(`https://www.deltaconnected.com/arcdps/api/README.txt`).

## Signature

```c
void combat(cbtevent* ev, ag* src, ag* dst, const char* skillname,
            uint64_t id, uint64_t revision);

void combat_local(cbtevent* ev, ag* src, ag* dst, char* skillname,
                   uint64_t id, uint64_t revision);
```

- **`ev`** — a `cbtevent*` as defined in the evtc documentation. See the
  [`cbtevent` reference](/reference/data-structures/cbtevent/) for its
  field layout. `ev` may be `null` — see "`ev == null` events" below.
- **`src`** / **`dst`** — `ag*` (agent) pointers. See the
  [`agent (ag)` reference](/reference/data-structures/agent/).
- **`skillname`** — the skill's display name. `const char*` for `combat`,
  non-`const char*` for `combat_local`.
- **`id`** — use this to re-establish event order (an `id` of `0` means
  the event is unordered). Due to a historical change in how `id` is
  assigned, the **first event will always have `id == 2`**.
- **`revision`** — the `cbtevent` type revision; "will most likely be 1".

## Recipe: a minimal combat handler

Nearly every combat callback follows the same shape — bail on the
non-combat cases, then filter to the events you care about. This one
tallies outgoing strike damage per source agent (the core of a DPS
meter):

```c
uintptr_t combat(cbtevent* ev, ag* src, ag* dst,
                 const char* skillname, uint64_t id, uint64_t revision) {
    if (!ev) {
        // agent add/remove/track — not a combat event. See "ev == null".
        return 0;
    }
    if (ev->is_statechange) return 0;   // state changes aren't hits
    if (ev->is_activation)  return 0;   // skill cast start/stop, not damage
    if (ev->is_buffremove)  return 0;   // buff bookkeeping

    if (ev->buff == 0 &&
        (ev->result == CBTR_STRIKE_DAMAGENORMAL ||
         ev->result == CBTR_STRIKE_DAMAGECRIT  ||
         ev->result == CBTR_STRIKE_DAMAGEGLANCE)) {
        // strike damage: ev->value. src may be a minion — credit its master.
        uint64_t attacker = src->prof ? src->id : 0;
        accumulate_damage(attacker, ev->value);          // your state
    } else if (ev->buff == 1 && ev->value == 0) {
        accumulate_damage(src->id, ev->buff_dmg);        // condition tick
    }
    return 0;
}
```

The strike-vs-buff split and the `result` filter are the same logic used
when [reading damage from a log](/guides/reading-damage/) — the realtime
and evtc paths carry the same `cbtevent`, so a handler you write here
works almost unchanged against parsed logs. What differs is *delivery*
(delay and filtering), covered next.

## `combat` (area) vs `combat_local`

| | `combat` | `combat_local` |
| --- | --- | --- |
| Scope | area events | chatbox/local events |
| Timing | asynchronous, delayed roughly 2-3 seconds | not delayed |
| `skillname` type | `const char*` | `char*` |

The official notes describe `combat_local` as "same as combat, but for
chatbox events," and are explicit that `combat`'s ~2-3 second delay makes
it suited for statistics rather than realtime notifications:

> events are delayed by ~2-3 seconds - this is intended for statistics,
> not realtime notifications.

If your extension needs low-latency reactions to the local player's own
events, prefer `combat_local`. If you're aggregating area-wide combat
statistics (e.g. a DPS meter), `combat` is the documented source, with the
understood delay.

## What the realtime feed does and doesn't carry

The realtime API is **filtered as well as delayed**. Key facts:

- Per the EVTC documentation's per-event availability notes, many
  statechange types are *never* delivered on the realtime path (most
  positional, effect, missile, and metadata events are evtc-only),
  and most of the rest are limited to squad members. The full
  per-event "evtc:"/"realtime:" availability is listed on the
  [statechange payloads](/reference/enums/statechange-payloads/) page.
- Community bindings summarize the delivery guarantee as: at least
  one participant of a delivered event will be a party/squad member
  (or minion of one, or a buff applied by the squad in the case of
  buff removes).
- The retired `CBTS_APIDELAYED` statechange existed specifically for
  events "deemed unsafe for realtime" that were held back until the
  squad left combat — evidence that the delay/filtering is a
  deliberate anti-cheat design, not an implementation accident.

Two community-verified practical quirks (from working extensions, not
the official notes):

- **Agent name lifetime** — the `char*` names inside `src`/`dst` are
  only valid for the duration of the callback. Copy the strings; never
  store the pointers.
- **Non-squad hostile players are aggregated** — arcdps reuses the
  profession id as the agent id for hostile players outside your
  squad, so a realtime "enemy roster" tops out at roughly one entry
  per profession. Per-player enemy data only exists in the written
  [`.evtc` log](/reference/evtc-format/), which appears a few seconds
  after combat ends.

## `ev == null` events

`ev` may be `null`. When it is, the meaning of `src`/`dst` changes to
signal agent-list events rather than a combat event:

- If `src->elite == 1`, then `src->id` is the id of the newly targeted
  agent.
- Else, if `src->prof` is set, `src->id` was **added**:
  - `src->name` — character name
  - `dst->name` — account name
  - `src->id` — agent id
  - `dst->id` — instance id on the map
  - `dst->prof` — profession
  - `dst->elite` — elite spec
  - `dst->self` — is-self flag
  - `src->team` — team id
  - `dst->team` — subgroup
- Else, `src->id` was **removed**.

## Calling order and ordering guarantees

- Use `id` to re-establish the order of events; `id == 0` means the event
  is unordered.
- The first event delivered will always have `id == 2` (a documented
  quirk from a past change to id assignment — not a bug to work around,
  it's the expected starting value).
- `combat` events are delayed ~2-3 seconds relative to the in-game event;
  `combat_local` is not.

## Related exports

Extensions can also *inject* synthetic combat events into arcdps'
processing pipeline rather than only receiving them — see
[`e9` and `e10`](/reference/extension-api/arcdps-exports/#e9--add-event-to-arcs-processing-pipeline)
on the arcdps exports reference.

## See also

- [`cbtevent`](/reference/data-structures/cbtevent/) — full field layout
  of the event struct.
- [`agent (ag)`](/reference/data-structures/agent/) — full field layout of
  the `src`/`dst` struct.
- [Getting Started](/getting-started/) — the surrounding
  `arcdps_exports` contract these callbacks are registered through.
