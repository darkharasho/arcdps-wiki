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

### Minimal loadable extension

The smallest module arcdps will accept, wiring the whole entry path in
one place (field-by-field detail of `arcdps_exports` is on the
[Getting Started](/getting-started/#required-exports) page):

```c
static arcdps_exports arc_exports;      // must outlive init() — file/static scope
static HMODULE        self_dll;         // this module (from DllMain)
static HMODULE        arc_dll;          // arcdps, for GetProcAddress of e5..e10

// arcdps calls this; it must return your init function.
// Signature is exact — note the last arg is imguiversion, NOT a d3d version
// (treating it as one breaks silently). See Getting Started.
extern "C" __declspec(dllexport)
void* get_init_addr(char* arcversionstr, void* imguicontext, void* id3dptr,
                    HANDLE arcdll, void* mallocfn, void* freefn,
                    uint32_t imguiversion) {
    ImGui::SetCurrentContext((ImGuiContext*)imguicontext);        // join arc's context
    ImGui::SetAllocatorFunctions((ImGuiMemAllocFunc)mallocfn,     // skipping this
                                 (ImGuiMemFreeFunc)freefn);        // cross-heap crashes
    arc_dll = (HMODULE)arcdll;   // cache to GetProcAddress e5..e10 (see Capabilities)
    return (void*)mod_init;
}

// arcdps calls this on unload; return your release function (or 0).
extern "C" __declspec(dllexport)
void* get_release_addr() { return mod_release; }

// Your init: hand arcdps the exports table.
static arcdps_exports* mod_init() {
    arc_exports.size      = sizeof(arcdps_exports);
    arc_exports.sig       = 0x4D594558;              // your unique sig
    arc_exports.imguivers = IMGUI_VERSION_NUM;       // must match arc's build
    arc_exports.out_name  = "my extension";
    arc_exports.out_build = "1.0";
    arc_exports.combat    = combat;                  // optional callbacks
    arc_exports.imgui     = imgui;                   // set only what you use
    return &arc_exports;
}

static uintptr_t mod_release() { return 0; }

BOOL APIENTRY DllMain(HMODULE h, DWORD reason, LPVOID) {
    if (reason == DLL_PROCESS_ATTACH) self_dll = h;
    return TRUE;
}
```

The filename must contain `arcdps` (e.g. `arcdps_myext.dll`) for arcdps
to scan and load it. From here, the leverage points — drawing UI,
reading arc's state, injecting events — are on the
[Extension Capabilities](/reference/extension-api/capabilities/) page.
