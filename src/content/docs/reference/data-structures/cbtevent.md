---
title: cbtevent
description: Field-by-field layout of the cbtevent combat-event struct, plus FFI mappings for Rust, Python, and Node.
source: official-docs
---

`cbtevent` is the struct arcdps passes as the `ev` parameter of the
`combat` / `combat_local` callbacks (see the
[combat callback reference](/reference/extension-api/combat-callback/)).

**It is not defined in the API README.** The README's only statement
about it is:

> ev parameter is cbtevent as in evtc documentation.

The authoritative layout lives in the separate EVTC combat-log format
documentation
(`https://www.deltaconnected.com/arcdps/evtc/README.txt`), which this page
is sourced from. That document also states the struct is revision 1
(matching the `revision` parameter of the combat callbacks, "will most
likely be 1"):

> combat event logging (revision 1, when header[12] == 1). all fields
> except time are event-specific, refer to descriptions of events above

That last sentence is the key fact for reading this page: **`time` is the
only field the notes call out as generally stable across events** — with
three documented exceptions where it is reinterpreted as an inline data
buffer rather than a timestamp:

| State-change type | `time` is reinterpreted as |
| --- | --- |
| `CBTS_BUFFFORMULA` | `(float*)&time` → `float[9]`: type, attribute1, attribute2, parameter1, parameter2, parameter3, trait_condition_source, trait_condition_self, content_reference |
| `CBTS_SKILLINFO` | `(float*)&time` → `float[4]`: cost, range0, range1, tooltiptime |
| `CBTS_INTEGRITY` | `(char*)&time` → `char[32]`: a short null-terminated message with the reason |

Treat `time` as a timestamp only after ruling those three out. Every
other field's
meaning depends on the value of `is_statechange` (which state-change type
the event is) — the same byte offset carries different data for, say,
`CBTS_COMBAT` versus `CBTS_POSITION` versus `CBTS_BUFFINFO`. The full
per-event-type field mapping is on the
[statechange payloads](/reference/enums/statechange-payloads/) page;
this page documents the struct's fixed C layout and the fields'
*generic*/most-common (`CBTS_COMBAT`) roles.

## C declaration

```c
typedef struct cbtevent {
    uint64_t time; /* timegettime() at time of event */
    uint64_t src_agent;
    uint64_t dst_agent;
    int32_t value;
    int32_t buff_dmg;
    uint32_t overstack_value;
    uint32_t skillid;
    uint16_t src_instid;
    uint16_t dst_instid;
    uint16_t src_master_instid;
    uint16_t dst_master_instid;
    uint8_t iff;
    uint8_t buff;
    uint8_t result;
    uint8_t is_activation;
    uint8_t is_buffremove;
    uint8_t is_ninety;
    uint8_t is_fifty;
    uint8_t is_moving;
    uint8_t is_statechange;
    uint8_t is_flanking;
    uint8_t is_shields;
    uint8_t is_offcycle;
    uint8_t pad61;
    uint8_t pad62;
    uint8_t pad63;
    uint8_t pad64;
} cbtevent;
```

Total size is 64 bytes with standard x64 struct alignment (no explicit
`#pragma pack` is documented, and none is needed — the field widths sum
to 64 bytes with every member already naturally aligned). The trailing
`pad61`–`pad64` byte names correspond to 1-indexed byte offsets 61–64 of
the struct, which is consistent with that natural-alignment layout — a
useful sanity check when porting the struct, but the offset column below
is **derived from the field widths and standard C alignment rules, not
stated explicitly by the source docs.**

## Field reference

| Offset | C type | Name | Meaning |
| --- | --- | --- | --- |
| 0 | `uint64_t` | `time` | `timeGetTime()` at time of registering the event — except for `CBTS_BUFFFORMULA`, `CBTS_SKILLINFO` and `CBTS_INTEGRITY`, which reinterpret these 8 bytes as an inline data buffer (see the table above). |
| 8 | `uint64_t` | `src_agent` | Event-specific (see `cbtstatechange` mapping). For `CBTS_COMBAT`: source agent. |
| 16 | `uint64_t` | `dst_agent` | Event-specific. For `CBTS_COMBAT`: target agent. |
| 24 | `int32_t` | `value` | Event-specific. For `CBTS_COMBAT`: combined shield+health strike damage. |
| 28 | `int32_t` | `buff_dmg` | Event-specific. For `CBTS_COMBAT`: combined shield+health buff damage. |
| 32 | `uint32_t` | `overstack_value` | Event-specific. For `CBTS_COMBAT`: shield damage. |
| 36 | `uint32_t` | `skillid` | Event-specific. For `CBTS_COMBAT`: the damage skill id. |
| 40 | `uint16_t` | `src_instid` | Id of the source agent as it appears in-game at the time of the event. Out-of-range agents may still have this set even when `src_agent` is zero. |
| 42 | `uint16_t` | `dst_instid` | Id of the target agent as it appears in-game at the time of the event. Out-of-range agents may still have this set even when `dst_agent` is zero. |
| 44 | `uint16_t` | `src_master_instid` | If `src_agent` has a master (e.g. is a minion), equals the instance id of the master; zero otherwise. |
| 46 | `uint16_t` | `dst_master_instid` | If `dst_agent` has a master (e.g. is a minion), equals the instance id of the master; zero otherwise. |
| 48 | `uint8_t` | `iff` | Event-specific. For `CBTS_COMBAT`: friend/foe relationship, of `enum iff`. See [enum reference](/reference/enums/). |
| 49 | `uint8_t` | `buff` | Event-specific. For `CBTS_COMBAT`: whether the skill is a buff (as opposed to a direct strike). |
| 50 | `uint8_t` | `result` | Event-specific. For `CBTS_COMBAT`: combat result, of `enum cbtresult`. See [enum reference](/reference/enums/). |
| 51 | `uint8_t` | `is_activation` | Event-specific. Skill-activation state, of `enum cbtanimation` — used by `CBTS_ANIMATIONSTOP`. |
| 52 | `uint8_t` | `is_buffremove` | Event-specific. Buff-remove kind, of `enum cbtbuffremove` — used by buff-remove events. |
| 53 | `uint8_t` | `is_ninety` | Event-specific. For `CBTS_COMBAT`/buff-apply/-remove events: source is above 90% health. |
| 54 | `uint8_t` | `is_fifty` | Event-specific. For `CBTS_COMBAT`/buff-apply/-remove events: target is below 50% health. |
| 55 | `uint8_t` | `is_moving` | Event-specific. For `CBTS_COMBAT`/buff-apply/-remove events: bit 0 set if source is moving, bit 1 set if target is moving. |
| 56 | `uint8_t` | `is_statechange` | Which `cbtstatechange` enum value this event is — the discriminant that determines how every other field (except `time`) is interpreted. See [enum reference](/reference/enums/). |
| 57 | `uint8_t` | `is_flanking` | Event-specific. For `CBTS_COMBAT`/buff-apply/-remove events: source is flanking target. |
| 58 | `uint8_t` | `is_shields` | Event-specific. For `CBTS_COMBAT`: damage was partially or wholly absorbed by barrier. |
| 59 | `uint8_t` | `is_offcycle` | Event-specific. For `CBTS_COMBAT`: target was downed at the time of the event. |
| 60 | `uint8_t` | `pad61` | Padding for most event types; **repurposed as event-specific data by several state-change types** (e.g. a `uint32_t` "trackable id" spanning `pad61`–`pad64` for several `CBTS_*` events). See [enum reference](/reference/enums/) for which. |
| 61 | `uint8_t` | `pad62` | Padding for most event types; repurposed by some state-change types. Undocumented outside those specific mappings. |
| 62 | `uint8_t` | `pad63` | Padding for most event types; repurposed by some state-change types. Undocumented outside those specific mappings. |
| 63 | `uint8_t` | `pad64` | Padding for most event types; repurposed by some state-change types. Undocumented outside those specific mappings. |

## FFI mappings

These mirror the C declaration's field order, widths, and (default, no
explicit packing documented) alignment.

### Rust

```rust
#[repr(C)]
pub struct CbtEvent {
    pub time: u64,
    pub src_agent: u64,
    pub dst_agent: u64,
    pub value: i32,
    pub buff_dmg: i32,
    pub overstack_value: u32,
    pub skillid: u32,
    pub src_instid: u16,
    pub dst_instid: u16,
    pub src_master_instid: u16,
    pub dst_master_instid: u16,
    pub iff: u8,
    pub buff: u8,
    pub result: u8,
    pub is_activation: u8,
    pub is_buffremove: u8,
    pub is_ninety: u8,
    pub is_fifty: u8,
    pub is_moving: u8,
    pub is_statechange: u8,
    pub is_flanking: u8,
    pub is_shields: u8,
    pub is_offcycle: u8,
    pub pad61: u8,
    pub pad62: u8,
    pub pad63: u8,
    pub pad64: u8,
}
```

### Python (`ctypes`)

```python
import ctypes

class CbtEvent(ctypes.Structure):
    _fields_ = [
        ("time", ctypes.c_uint64),
        ("src_agent", ctypes.c_uint64),
        ("dst_agent", ctypes.c_uint64),
        ("value", ctypes.c_int32),
        ("buff_dmg", ctypes.c_int32),
        ("overstack_value", ctypes.c_uint32),
        ("skillid", ctypes.c_uint32),
        ("src_instid", ctypes.c_uint16),
        ("dst_instid", ctypes.c_uint16),
        ("src_master_instid", ctypes.c_uint16),
        ("dst_master_instid", ctypes.c_uint16),
        ("iff", ctypes.c_uint8),
        ("buff", ctypes.c_uint8),
        ("result", ctypes.c_uint8),
        ("is_activation", ctypes.c_uint8),
        ("is_buffremove", ctypes.c_uint8),
        ("is_ninety", ctypes.c_uint8),
        ("is_fifty", ctypes.c_uint8),
        ("is_moving", ctypes.c_uint8),
        ("is_statechange", ctypes.c_uint8),
        ("is_flanking", ctypes.c_uint8),
        ("is_shields", ctypes.c_uint8),
        ("is_offcycle", ctypes.c_uint8),
        ("pad61", ctypes.c_uint8),
        ("pad62", ctypes.c_uint8),
        ("pad63", ctypes.c_uint8),
        ("pad64", ctypes.c_uint8),
    ]
```

### Node.js (`koffi`)

```js
const koffi = require("koffi");

const cbtevent = koffi.struct("cbtevent", {
  time: "uint64_t",
  src_agent: "uint64_t",
  dst_agent: "uint64_t",
  value: "int32_t",
  buff_dmg: "int32_t",
  overstack_value: "uint32_t",
  skillid: "uint32_t",
  src_instid: "uint16_t",
  dst_instid: "uint16_t",
  src_master_instid: "uint16_t",
  dst_master_instid: "uint16_t",
  iff: "uint8_t",
  buff: "uint8_t",
  result: "uint8_t",
  is_activation: "uint8_t",
  is_buffremove: "uint8_t",
  is_ninety: "uint8_t",
  is_fifty: "uint8_t",
  is_moving: "uint8_t",
  is_statechange: "uint8_t",
  is_flanking: "uint8_t",
  is_shields: "uint8_t",
  is_offcycle: "uint8_t",
  pad61: "uint8_t",
  pad62: "uint8_t",
  pad63: "uint8_t",
  pad64: "uint8_t",
});
```

## Layout corroboration

The offset table above (derived from natural alignment) is confirmed
by independent implementations: community Rust bindings declare the
identical `#[repr(C)]` layout, and at least one from-scratch
reimplementation carries a compile-time test asserting
`sizeof == 64` and `skillid` at byte offset 36 — matching the derived
table exactly.

One field nuance recorded by the community bindings (not in the
official notes): for strike events, `is_flanking` values lie "in a
range of 1 to 135 degrees where 135 is rear" — i.e. it is an angle
indicator, not a plain boolean.

## Reading a cbtevent in practice

Because every field but `time` is reinterpreted per event type, the
first thing any consumer does is dispatch on `is_statechange`. If it is
nonzero the event is a state-change; interpret its fields per the
[statechange payloads](/reference/enums/statechange-payloads/) page. If
it is zero the event is a `CBTS_COMBAT` event, and you branch on `buff`
to pick which field carries the damage:

```c
void handle(const cbtevent* ev) {
    if (ev->is_statechange) {
        /* state-change event: fields mean what the payloads page
           says for this cbtstatechange value. */
        dispatch_statechange(ev);
        return;
    }

    /* is_statechange == 0 -> CBTS_COMBAT. */
    if (ev->buff == 0) {
        /* direct strike: value is the combined shield+health damage.
           Only these results actually connected. */
        if (ev->result == CBTR_STRIKE_DAMAGENORMAL ||
            ev->result == CBTR_STRIKE_DAMAGECRIT   ||
            ev->result == CBTR_STRIKE_DAMAGEGLANCE) {
            credit_strike(ev->src_agent, ev->value);
        }
        /* other results (block/evade/absorb/CC/etc.) are not
           applied health damage — see the cbtresult table. */
    } else if (ev->buff == 1 && ev->value == 0) {
        /* condition/DoT tick: damage is in buff_dmg. buff == 1 with
           value != 0 is a buff *application* (duration in value),
           not damage. */
        credit_buff_dmg(ev->src_agent, ev->buff_dmg);
    }
}
```

Two fields worth calling out are `is_activation` and `is_buffremove`.
Current builds deliver skill activation and buff removal as their own
state-change types (`CBTS_ANIMATIONSTART`/`CBTS_ANIMATIONSTOP` and
`CBTS_BUFFREMOVE_*` — the buff-remove statechanges were added in the
may-2026 build), so they arrive on the `is_statechange != 0` path above.
Older logs may instead carry these as `CBTS_COMBAT` events with the
`is_activation`/`is_buffremove` fields set — so if you parse historical
logs, guard those fields in the combat branch too (as the
[combat-callback recipe](/reference/extension-api/combat-callback/#recipe-a-minimal-combat-handler)
does).

See the [`cbtresult` table](/reference/enums/#cbtresult-combat-result)
for the full result codes, and
[Reading damage from logs](/guides/reading-damage/) for the complete
summation rules (barrier, minions, and which results to exclude).

## See also

- [Statechange payloads](/reference/enums/statechange-payloads/) —
  full per-event mapping of how each state-change type repurposes
  these fields.
- [Combat callback](/reference/extension-api/combat-callback/) — how
  `cbtevent*` reaches your extension.
- [`agent (ag)`](/reference/data-structures/agent/) — the `src`/`dst`
  struct passed alongside `ev`.
- [Enum reference](/reference/enums/) — the enum value tables.
- [EVTC log format](/reference/evtc-format/) — the same struct as it
  appears on disk (revision byte `header[12] == 1`).
