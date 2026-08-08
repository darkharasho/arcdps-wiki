---
title: Addon contract
description: How arcdps discovers, loads, and unloads an extension.
source: dll-exports
exportSymbols:
  - GetAddonDef
  - gw2addon_get_description
  - gw2addon_load
  - gw2addon_unload
  - arcdps_identifier_export
  - arcdps_imguiversion_export
---

arcdps itself is loaded as a Direct3D proxy DLL (`d3d11.dll`/`dxgi.dll`) by
Guild Wars 2, and it in turn loads **extension modules** — third-party
`arcdps_*.dll` files dropped into the game root or `bin64` directory. The
[Getting Started](/getting-started/) page covers the primary, documented
load path arcdps uses for extensions: `get_init_addr` /
`get_release_addr`, and the `arcdps_exports` table they hand back.

This page covers a second set of exports that show up in arcdps' own DLL
export table (and in some extension DLLs): `GetAddonDef`,
`gw2addon_get_description`, `gw2addon_load`, `gw2addon_unload`,
`arcdps_identifier_export`, and `arcdps_imguiversion_export`.

## What the official notes say

The arcdps API reference published at
`https://www.deltaconnected.com/arcdps/api/README.txt` documents the
`get_init_addr` / `get_release_addr` / `arcdps_exports` contract described
on the Getting Started page. It does **not** mention any of the six
symbols below — they are **undocumented** by the official arcdps notes.
Nothing on this page should be treated as arcdps' own description of these
exports; where behavior is asserted, it is labeled as binary evidence.

## Binary evidence: arcdps has an explicit "addon mode"

Strings in the arcdps DLL (build `1.2026.718.905`) confirm that
arcdps distinguishes two load modes at startup: it logs
`info: as <mode> …` where the mode string is either `proxy` or
`addon`, and at least one options item is annotated "Unsupported when
running in addon mode". That is, arcdps supports being loaded **by an
addon manager** rather than as the `d3d11.dll` proxy — which is what
the `gw2addon_*`/`GetAddonDef` export family exists for. The exact
struct layouts and calling conventions of those exports remain
unpublished; the mode itself is no longer speculative.

This matches real-world deployments: on Wine/Proton setups where DXVK
owns the `d3d11.dll` name, arcdps is commonly run from an addon
directory in addon mode.

## Symbol reference

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `GetAddonDef` | undocumented | undocumented — verify against the reference implementation. The name suggests an addon-definition accessor analogous to the third-party ["addon loader" ecosystem's](https://github.com/gw2-addon-loader) `GetAddonDef` convention (a struct describing name/version/load requirements for a generic addon host), but arcdps' own README does not describe this export, and its exact struct layout and calling convention are unconfirmed here. |
| `gw2addon_get_description` | undocumented | undocumented — verify against the reference implementation. |
| `gw2addon_load` | undocumented | undocumented — verify against the reference implementation. |
| `gw2addon_unload` | undocumented | undocumented — verify against the reference implementation. |
| `arcdps_identifier_export` | undocumented | undocumented — verify against the reference implementation. Name suggests it exposes an identifying string, but no signature is documented. |
| `arcdps_imguiversion_export` | undocumented | undocumented — verify against the reference implementation. Name suggests it exposes the ImGui version arcdps was built against (compare `imguiversion` passed into `get_init_addr` on the Getting Started page), but no signature is documented. |

## Two discovery paths, one documented

The naming split hints at two different loader conventions:

- **`gw2addon_*` / `GetAddonDef`** — resembles the generic
  ["addon loader"](https://github.com/gw2-addon-loader) style contract
  used by several community addon hosts, where a DLL exports a
  `GetAddonDef` function returning a struct describing itself, plus
  `Load`/`Unload` entry points. Whether arcdps itself *implements* this
  contract (so other tools can treat `d3d11.dll` as a generic addon) or
  merely *exposes* symbols with these names for some other purpose is not
  established by the official notes.
- **`get_init_addr` / `get_release_addr`** — the contract arcdps
  documents and uses for its own `arcdps_*.dll` extensions, detailed on
  the [Getting Started](/getting-started/) page.

If your extension only needs to work with arcdps as documented, use the
`get_init_addr`/`get_release_addr` contract — it is the one covered by the
official API reference. Treat the `gw2addon_*` family and `GetAddonDef` as
unverified until confirmed against the reference implementation or a
maintainer clarification.

## Lifecycle recap (documented path)

For the documented lifecycle — arcdps calling `get_init_addr` on load,
your module returning an initialization function, arcdps calling that
function to receive an `arcdps_exports` table, and the corresponding
teardown via `get_release_addr` — see
[Getting Started: Required exports](/getting-started/#required-exports).
