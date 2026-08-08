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

That last sentence is the key fact for reading this page: **only `time`
has a single fixed meaning across every event.** Every other field's
meaning depends on the value of `is_statechange` (which state-change type
the event is) — the same byte offset carries different data for, say,
`CBTS_COMBAT` versus `CBTS_POSITION` versus `CBTS_BUFFINFO`. See the
[enum reference](/reference/enums/) for the full per-event-type field
mapping (`cbtstatechange`); this page documents the struct's fixed C
layout and the fields' *generic*/most-common (`CBTS_COMBAT`) roles.

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
| 0 | `uint64_t` | `time` | `timeGetTime()` at time of registering the event. The one field with a fixed meaning across all event types (some event types repurpose it anyway — noted where documented). |
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

## See also

- [Combat callback](/reference/extension-api/combat-callback/) — how
  `cbtevent*` reaches your extension.
- [`agent (ag)`](/reference/data-structures/agent/) — the `src`/`dst`
  struct passed alongside `ev`.
- [Enum reference](/reference/enums/) — full `cbtstatechange` table
  mapping each state-change type to the fields it repurposes.
