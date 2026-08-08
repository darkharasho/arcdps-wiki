---
title: Getting Started (extension developers)
description: Build a minimal arcdps extension — the export contract and a skeleton addon.
source: official-docs
---

arcdps extension modules are ordinary DLLs, dropped into the GW2 root or
`bin64` directory using the naming convention `arcdps_*.dll`, that export two
plain C functions. This page walks through that contract and gives a
minimal, illustrative skeleton to start from.

The lifecycle and struct fields described below are sourced from the
official arcdps API reference published alongside the DLL
(`https://www.deltaconnected.com/arcdps/api/README.txt`, fetched
2026-08-08). Anything not covered by that document is called out
explicitly as undocumented.

Two preliminaries from the README itself:

- Exported function names "must be c-style exports (unmangled)".
- "place arcdps_some_module.dll in gw2 root dir or in bin64 (if your
  dll name does not include arcdps, it will not be logged)."

The README also directs every extension author to read
[ArenaNet's third-party-programs policy](https://help.guildwars2.com/hc/en-us/articles/360013625034-Policy-Third-Party-Programs)
before building anything.

## Required exports

Your extension DLL must export exactly two functions:

### `get_init_addr`

```c
void* get_init_addr(
    char* arcversionstr,
    void* imguicontext,
    void* id3dptr,
    HANDLE arcdll,
    void* mallocfn,
    void* freefn,
    uint32_t imguiversion
);
```

arcdps calls `LoadLibrary` on your DLL (incrementing its refcount), then
calls `get_init_addr`, passing:

- `arcversionstr` — the arcdps build date string, e.g.
  `20221023.100940-439-x64` (README's own example).
- `imguicontext` — the shared ImGui context, for
  `ImGui::SetCurrentContext`.
- `id3dptr` — the **active swap chain** (`IDXGISwapChain*`), not a
  device; obtain the device via `GetDevice` if you need one.
- `arcdll` — a handle to the arcdps DLL, for resolving the
  [`e0`–`e10` exports](/reference/extension-api/arcdps-exports/) via
  `GetProcAddress`.
- `mallocfn` / `freefn` — allocator function pointers for
  `ImGui::SetAllocatorFunctions` (skipping this causes cross-heap
  crashes).
- `imguiversion` — `IMGUI_VERSION_NUMBER` of the ImGui build arcdps
  uses. The README notes this parameter was "previously directx
  version" — older bindings that treat it as a D3D version break
  silently.

`get_init_addr` must return a pointer to your **module initialization
function** — a function with no parameters that returns a pointer to an
`arcdps_exports` table:

```c
arcdps_exports* mod_init();
```

arcdps calls that returned function immediately, and the `arcdps_exports`
struct it returns is what registers your module's callbacks.

### `get_release_addr`

```c
void* get_release_addr(uint32_t reason);
```

Called on unload with a reason code. `reason` is a value of
`enum n_arcdpsextensionload` — the same enum `addextension2` returns; its
values are listed on the
[extension registry](/reference/extension-api/extension-registry/) page.
It must return a pointer to your **module removal function** — no
parameters, no return value:

```c
void mod_release();
```

Per the README, "returning 0 will trigger a warning without removing
the function table or unloading the module" — i.e. since the jun 2026
API revision, an extension can **refuse unload** by returning 0 from
`get_release_addr`. arcdps also enforces at load time that the export
exists at all (`ARCDPSEXTENLOAD_MISSING_GET_RELEASE_ADDR` otherwise).

### `get_update_url` (optional)

```c
const wchar_t* get_update_url();
```

Optional self-update hook: return `NULL`, or a `wchar_t*` URL
(**443/HTTPS only**). If a string is returned, arcdps FreeLibrary's
the module, replaces it with the file downloaded from the URL, and
re-loads it.

## The `arcdps_exports` struct

```c
typedef struct arcdps_exports {
    uint64_t size;         /* size of exports table */
    uint32_t sig;          /* unique identifier for your module */
    uint32_t imguivers;    /* imgui version used to compile your module */
    const char* out_name;  /* module name shown in arcdps addon list */
    const char* out_build; /* module build/version string */

    /* optional callbacks — set to 0/NULL if unused */
    void* wnd_nofilter;
    void* combat;
    void* imgui;
    void* options_tab;
    void* combat_local;
    void* wnd_filter;
    void* options_windows;
} arcdps_exports;
```

`size`, `sig`, `imguivers`, `out_name`, and `out_build` are required. The
remaining fields are optional callback pointers — leave any you don't need
as `NULL`.

Field notes from the README:

- `size` — `sizeof(arcdps_exports)`.
- `sig` — "pick a number between 1 and uint32_max that is not used by
  any other module, this is how arc identifies duplicate loads."
- `imguivers` — `IMGUI_VERSION_NUM` of the ImGui you compiled
  against. arcdps is "currently built with imgui 1.92.7" (per the
  README as of may 2026), i.e. `19270`; community bindings
  historically set `18000` when not using ImGui at all. A mismatch
  loads the module but **disables its UI callbacks**.
- The struct "is copied after return, the original is not accessed
  thereafter" — but keep `out_name`/`out_build` strings alive, since
  only the table itself is copied.

**Signaling a load error**: "to signal an error in loading, set sig
to 0, and set size to a cast of a char* error message (or set to 0)."
arcdps logs the message and does not consider the module loaded.

## Callback signatures

These are the callback signatures documented in the official README:

```c
/* fires on every combat event, called asynchronously (roughly a
   2-3 second delay relative to the in-game event) */
void combat(cbtevent* ev, ag* src, ag* dst, const char* skillname,
            uint64_t id, uint64_t revision);

/* same as combat, but fires for events involving the local player
   without the asynchronous delay */
void combat_local(cbtevent* ev, ag* src, ag* dst, char* skillname,
                   uint64_t id, uint64_t revision);

/* raw window message hooks; return the (possibly modified) message value */
UINT wnd_nofilter(HWND hWnd, UINT uMsg, WPARAM wParam, LPARAM lParam);
UINT wnd_filter(HWND hWnd, UINT uMsg, WPARAM wParam, LPARAM lParam);

/* called every frame before arcdps draws its own ImGui content */
void imgui(uint32_t not_charsel_or_loading, uint32_t hide_if_combat_or_ooc);

/* called when arcdps draws your module's entry in its options window */
void options_tab();

/* called when arcdps draws an options-window-style panel for your module */
void options_windows(char* windowname);
```

The README describes `options_windows` as "called during options
window list, before the 'window' checkbox is drawn." Two
community-verified details (from working extensions and the Rust
bindings, not the README): the callback actually returns a value —
nonzero suppresses arcdps' own checkbox for that window — and **the
final call in each pass is always with `windowname == NULL`**, which
working plugins use as the slot to draw their own controls.

The `ag` (agent) struct referenced above is documented:

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

`cbtevent` is not defined in the API README itself — the README points to
the separate EVTC documentation for that struct. See the
[`cbtevent` reference](/reference/data-structures/cbtevent/) for its field
layout.

The two window-message callbacks differ in filtering: `wnd_nofilter`
receives "unfiltered window event messages", while `wnd_filter` receives
"modifiers-filtered window event messages". Both return a `UINT` that is
assigned to the real `uMsg`. The precise filtering criteria applied to
`wnd_filter` (i.e. exactly which modifier state suppresses a message) are
not spelled out in the official notes — verify against the reference
implementation if your extension depends on the exact rule.

## Minimal illustrative skeleton

The following is **illustrative**, assembled from the documented pieces
above — the official README does not ship a single complete compilable
file, so treat this as a starting skeleton rather than a verbatim quote.
It's written as **C++** (arcdps addons are typically built as C++, and the
`extern "C"` linkage specifier below requires it — a pure-C compiler will
reject this file):

```cpp
#include <windows.h>
#include <cstdint>
#include <cstring>

typedef struct ag {
    const char* name;
    uintptr_t id;
    uint32_t prof;
    uint32_t elite;
    uint32_t self;
    uint16_t team;
} ag;

typedef struct arcdps_exports {
    uint64_t size;
    uint32_t sig;
    uint32_t imguivers;
    const char* out_name;
    const char* out_build;
    void* wnd_nofilter;
    void* combat;
    void* imgui;
    void* options_tab;
    void* combat_local;
    void* wnd_filter;
    void* options_windows;
} arcdps_exports;

static arcdps_exports arc_exports = { 0 };

/* forward declare cbtevent from your own copy of the EVTC-derived header */
struct cbtevent;

void combat_cb(struct cbtevent* ev, ag* src, ag* dst,
               const char* skillname, uint64_t id, uint64_t revision) {
    /* handle combat event */
}

arcdps_exports* mod_init() {
    memset(&arc_exports, 0, sizeof(arcdps_exports));
    arc_exports.size = sizeof(arcdps_exports);
    arc_exports.sig = 0x1234; /* pick a unique id for your module */
    arc_exports.imguivers = 19270; /* IMGUI_VERSION_NUM matching arcdps (1.92.7) */
    arc_exports.out_name = "example extension";
    arc_exports.out_build = "0.0.1";
    arc_exports.combat = (void*)combat_cb;
    return &arc_exports;
}

void mod_release() {
    /* free resources here */
}

extern "C" __declspec(dllexport) void* get_init_addr(
    char* arcversionstr, void* imguicontext, void* id3dptr,
    HANDLE arcdll, void* mallocfn, void* freefn, uint32_t imguiversion) {
    return (void*)mod_init;
}

extern "C" __declspec(dllexport) void* get_release_addr(uint32_t reason) {
    return (void*)mod_release;
}
```

## Consuming the API from other languages

Everything above is a plain C ABI: two exported functions and a
fixed-layout struct of pointer-sized fields. That's straightforward to
bind from most FFI-capable languages:

- **Rust** — use the [`arcdps-rs`](https://github.com/Zerthox/arcdps-rs)
  bindings (`export!` macro generates the exports and safe callback
  wrappers), or hand-roll it: export `get_init_addr` /
  `get_release_addr` with `#[no_mangle] extern "system" fn` and
  mirror `arcdps_exports` as a `#[repr(C)]` struct. Build with the
  **MSVC** target — `x86_64-pc-windows-gnu` builds load-crash inside
  GW2.
- **Node.js** — native addons via N-API/`node-ffi` can build the DLL
  export table, though in practice most Node-based tooling consumes
  arcdps output (EVTC logs) rather than loading as an in-process
  extension.
- **Python** — similarly, direct in-process extensions are impractical;
  Python tooling typically parses EVTC output rather than implementing
  `get_init_addr`.

Struct layout and calling convention details for language interop aren't
covered by the official README — treat the field-by-field FFI mapping
notes on the [`arcdps_exports` reference](/reference/extension-api/arcdps-exports/)
and [`ag`](/reference/data-structures/agent/) pages as the source of
truth once those reference pages are filled in; where they're silent,
verify against the reference implementation.

## Next steps

- [Writing an extension in practice](/guides/writing-an-extension/) —
  field-tested patterns: ImGui pinning, input handling, threading,
  textures, Wine/Proton deployment.
- [Addon contract](/reference/extension-api/addon-contract/) — the full
  lifecycle reference.
- [Combat callback](/reference/extension-api/combat-callback/) — event
  ordering and delay semantics in detail.
- [`cbtevent`](/reference/data-structures/cbtevent/) and
  [`agent (ag)`](/reference/data-structures/agent/) — the structs passed
  into your callbacks.
- [Unofficial Extras](/reference/unofficial-extras/) — squad roster,
  chat, and keybind callbacks arcdps itself doesn't provide.
