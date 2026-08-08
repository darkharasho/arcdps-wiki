---
title: agent (ag)
description: Field-by-field layout of the ag agent struct, plus FFI mappings for Rust, Python, and Node.
source: official-docs
---

`ag` is the struct arcdps passes as the `src` and `dst` parameters of the
`combat` / `combat_local` callbacks (see the
[combat callback reference](/reference/extension-api/combat-callback/)).
Unlike `cbtevent`, `ag` **is** defined directly in the API README
(`https://www.deltaconnected.com/arcdps/api/README.txt`):

```c
typedef struct ag {
    const char* name;
    uintptr_t id;
    uint32_t prof;
    uint32_t elite;
    uint32_t self;
    uint16_t team;
} ag;
```

## Field reference

| Offset | C type | Name | Meaning |
| --- | --- | --- | --- |
| 0 | `const char*` | `name` | Agent display name. In the `ev == null` agent-list-event convention (see below), a *newly added* agent's `src->name` is the character name and `dst->name` is the account name. |
| 8 | `uintptr_t` | `id` | Agent id. In the `ev == null` convention, an *added* agent's id is `src->id`; a *removed* agent's id is also `src->id`; a *newly targeted* agent's id is `src->id` (see below for how to distinguish these three cases). |
| 16 | `uint32_t` | `prof` | Profession id. Populated as `dst->prof` in the "agent added" convention. The README does not enumerate profession id values here — see the [enum reference](/reference/enums/) for what is/isn't documented. |
| 20 | `uint32_t` | `elite` | Elite specialization id — populated as `dst->elite` in the "agent added" convention. **Overloaded meaning on `src` during `ev == null` events**: `src->elite == 1` signals a "new targeted agent" event rather than an add/remove (see below). |
| 24 | `uint32_t` | `self` | Is-self flag — populated as `dst->self` in the "agent added" convention. Exact truthy encoding (e.g. `0`/`1` vs. any-nonzero) is not spelled out by the README — undocumented beyond "is self". |
| 28 | `uint16_t` | `team` | Context-dependent: as `src->team` in the "agent added" convention it is the team id; as `dst->team` in that same convention it is the *subgroup*. The README uses `team` for both meanings depending on which struct instance (`src` vs. `dst`) and event context it appears in — undocumented beyond those two call sites. |

Total size is 32 bytes on x64: the field widths sum to 30 bytes
(8 + 8 + 4 + 4 + 4 + 2), and standard C struct alignment inserts 2 bytes
of trailing padding after `team` so the struct's size is a multiple of
its 8-byte alignment (driven by the `const char*` / `uintptr_t`
members). This padding is compiler-inserted, not a named field, and is
not stated explicitly by the source docs — treat it as derived from
standard x64 alignment rules, not an official offset table.

## `ev == null` agent-list events

The README documents an overloaded use of `ag` when the combat callback
fires with `ev == null` — at that point `src`/`dst` don't describe a
combat event, they describe an agent-list change:

- If `src->elite == 1`, then `src->id` is the id of the newly **targeted**
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

This is also documented on the
[combat callback reference](/reference/extension-api/combat-callback/#ev--null-events).

## FFI mappings

### Rust

```rust
#[repr(C)]
pub struct Ag {
    pub name: *const std::os::raw::c_char,
    pub id: usize, // uintptr_t
    pub prof: u32,
    pub elite: u32,
    pub self_: u32, // `self` is a Rust keyword
    pub team: u16,
}
```

### Python (`ctypes`)

```python
import ctypes

class Ag(ctypes.Structure):
    _fields_ = [
        ("name", ctypes.c_char_p),
        ("id", ctypes.c_void_p),  # uintptr_t
        ("prof", ctypes.c_uint32),
        ("elite", ctypes.c_uint32),
        ("self_", ctypes.c_uint32),  # `self` shadows the instance arg name
        ("team", ctypes.c_uint16),
    ]
```

### Node.js (`koffi`)

```js
const koffi = require("koffi");

const ag = koffi.struct("ag", {
  name: "str",       // const char*
  id: "uintptr_t",
  prof: "uint32_t",
  elite: "uint32_t",
  self: "uint32_t",
  team: "uint16_t",
});
```

## See also

- [Combat callback](/reference/extension-api/combat-callback/) — how
  `ag*` reaches your extension, and the full `ev == null` convention.
- [`cbtevent`](/reference/data-structures/cbtevent/) — the accompanying
  event struct.
