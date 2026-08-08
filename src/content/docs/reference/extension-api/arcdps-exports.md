---
title: arcdps exports (e0-e10)
description: The numbered "eN" utility exports arcdps' DLL exposes to extensions.
source: dll-exports
exportSymbols:
  - e0
  - e3
  - e4
  - e5
  - e6
  - e7
  - e8
  - e9
  - e10
---

In addition to the extension load contract described in
[Getting Started](/getting-started/) and the [addon contract](/reference/extension-api/addon-contract/)
page, arcdps' own DLL exports a small set of numbered utility functions —
`e0` through `e10` — that a loaded extension can call directly (by
resolving them with `GetProcAddress` against the arcdps DLL handle it was
handed in `get_init_addr`, or by linking against the arcdps import
library, per the reference implementation's convention).

The naming is arcdps' own; there's no acronym to expand. The DLL export
table snapshot (`data/arcdps-exports.json`) confirms `e0`, `e3`, `e4`,
`e5`, `e6`, `e7`, `e8`, `e9`, and `e10` all exist as real exports.
**`e1` and `e2` are absent** from the current export table — they are
historical/reserved numbers with no current export.

All descriptions below are sourced from the official arcdps API reference
(`https://www.deltaconnected.com/arcdps/api/README.txt`) except where
noted.

## e0 — ini path

```c
wchar_t* e0();
```

Returns a `wchar_t*` (UTF-16) path to the arcdps ini file
(`<GW2 dir>\addons\arcdps\arcdps.ini`). No parameters. Extensions
conventionally store their own settings next to it.

## e3 — log to arcdps.log

```c
void e3(char* str);
```

Logs `str` to `arcdps.log`.

## e4 — undocumented

The export table snapshot includes `e4`, but it is **present in the
export table; not documented by the official notes**. The README covers
`e0`, `e3`, `e5`, `e6`, `e7`, `e8`, `e9`, and `e10` by name — `e4` (like
`e1`/`e2`, though those aren't even present in the current table) is not
described anywhere in the published API reference. Do not assume a
signature or purpose for `e4` here — verify against the reference
implementation if your extension needs it.

## e5 — colour array pointers

```c
void e5(ImVec4** out);
```

Community-verified caveat: the entries may still be **null pointers in
the first frames after load** — keep a fallback palette until arcdps
has populated them. Subgroup indices are valid `0..=15` per the
community bindings.

Writes colour array pointers to `*out`, where `*out` is an `ImVec4* out[5]`:

- `out[0]` — core colours, indexed by `enum n_colours_core`: `CCOL_TRANSPARENT`, `CCOL_WHITE`, `CCOL_LWHITE`, `CCOL_LGREY`, `CCOL_LYELLOW`, `CCOL_LGREEN`, `CCOL_LRED`, `CCOL_LTEAL`, `CCOL_MGREY`, `CCOL_DGREY`, `CCOL_NUM`
- `out[1]` — profession colours, base
- `out[2]` — profession colours, highlight (index matches the profession enum; `0` is unknown)
- `out[3]` — subgroup colours, base
- `out[4]` — subgroup colours, highlight (index matches subgroup, up to the game's max; update from `combatenter` statechange)

## e6 — current UI settings bit mask

```c
uint64_t e6();
```

Returns a bit mask of current UI settings:

| Bit | Meaning |
| --- | --- |
| 0 | UI is hidden |
| 1 | UI drawn always |
| 2 | UI is modifier move locked |
| 3 | UI is modifier click locked |
| 4 | UI is closing windows with Esc |

## e7 — modifier virtual key ids

```c
uint64_t e7();
```

Returns modifier virtual key ids **word-split** within the 64-bit return
value. The official notes give the ranges as:

| Bytes | Meaning |
| --- | --- |
| 0-1 | mod1 |
| 2-3 | mod2 |
| 4-5 | modmulti |

These are byte ranges, i.e. one 16-bit word each — that is what "word
split" means here, and a Windows virtual key id does not fit in a
2-bit field.

Derived from the above (not stated verbatim in the official notes), each
id can be read as:

```c
uint64_t m = e7();
uint16_t mod1     = (uint16_t)( m        & 0xFFFF);  /* bytes 0-1 */
uint16_t mod2     = (uint16_t)((m >> 16) & 0xFFFF);  /* bytes 2-3 */
uint16_t modmulti = (uint16_t)((m >> 32) & 0xFFFF);  /* bytes 4-5 */
```

## e8 — log to logger window, extension tab

```c
void e8(char* str);
```

Logs `str` to the logger window's extension tab. Colours are HTML-like:
`<c=#aaaaaa>coloured text</c>`.

## e9 — add event to arc's processing pipeline

```c
void e9(cbtevent* ev, uint32_t sig);
```

Adds `ev` to arc's event processing. `is_statechange` will be set to
`CBTS_EXTENSION`, and `pad61`-`pad64` will be set to `sig`. Events end up
in the ringbuffer and are sent along the realtime API.

## e10 — add event with skill processing

```c
void e10(cbtevent* ev, uint32_t sig);
```

Same as `e9`, but `is_statechange` is set to `CBTS_EXTENSIONCOMBAT`, and
`skillid` is treated as an actual skill id — the skill is added to the
evtc skill table.

## See also

- [`cbtevent`](/reference/data-structures/cbtevent/) — the struct passed
  to `e9`/`e10` and received in combat callbacks.
- [Extension registry](/reference/extension-api/extension-registry/) —
  the `addextension2`/`removeextension2`/`listextension` sub-extension
  loader exports, plus the chainload/updater exports.
