---
title: Extension registry
description: Runtime extension load/unload/enumeration exports, and the chainload/updater exports.
source: dll-exports
exportSymbols:
  - addextension2
  - removeextension2
  - listextension
  - c_closeandupdate
  - c_exceptionerrormsg
---

Beyond the automatic discovery of `arcdps_*.dll` files at startup
(described in [Getting Started](/getting-started/)), arcdps exposes a
small runtime API for loading, unloading, and enumerating extensions
programmatically — used by chainloaders and multi-module extension
managers. It also exports a couple of exception/update-related utility
functions with less certain documentation status.

Descriptions for `addextension2`, `removeextension2`, and `listextension`
are sourced from the official arcdps API reference
(`https://www.deltaconnected.com/arcdps/api/README.txt`).
`c_closeandupdate` and `c_exceptionerrormsg` are **not** described in that
document — their sections below are reconstructed from binary evidence
(strings in arcdps build `1.2026.718.905`) and labeled as such.

One naming note for readers of community bindings: the Rust
`arcdps-rs` bindings expose `removeextension2` under the name
`freeextension2` — the actual export in arcdps' table is
`removeextension2`.

## addextension2 — load an extension

```c
uint32_t addextension2(HINSTANCE hinst);
```

Loads an extension. arcdps will `LoadLibrary` the given `HINSTANCE` to
increment its refcount, call its `get_init_addr`, and call the function it
returns — the same load sequence used for extensions discovered
automatically at startup (see [Getting Started](/getting-started/)).

Return value is `0` on success, or non-zero on error, per
`enum n_arcdpsextensionload`. (The official notes give the parameter as
`HINSTANCE hinst` and describe the return only in prose; the `uint32_t`
return type above is inferred from it being a small status code.)

```c
/* arcdps api extension load result */
enum n_arcdpsextensionload {
    ARCDPSEXTENLOAD_OK,
    ARCDPSEXTENLOAD_NO_SIG,
    ARCDPSEXTENLOAD_INVALID_IMGUI, // extension stays loaded with imgui functions disabled
    ARCDPSEXTENLOAD_OBSOLETE,
    ARCDPSEXTENLOAD_ALREADY_LOADED,
    ARCDPSEXTENLOAD_NO_FUNCTION_TABLE_RETURNED,
    ARCDPSEXTENLOAD_NO_INIT_FUNCTION_RETURNED,
    ARCDPSEXTENLOAD_LOADLIBRARY_ERROR,
    ARCDPSEXTENLOAD_NO_SLOTS_LEFT,
    ARCDPSEXTENLOAD_MISSING_GET_RELEASE_ADDR,
    ARCDPSEXTENLOAD_SHUTDOWN,
    ARCDPSEXTENLOAD_REMOVE_VIA_EXPORT,
};
```

## removeextension2 — remove an extension

```c
HINSTANCE removeextension2(uint32_t sig);
```

Removes an extension identified by `sig` (the same `sig` value the
extension set on its `arcdps_exports` table — see
[Getting Started](/getting-started/)). arcdps will `FreeLibrary` the
module, call its `get_release_addr`, and call the function it returns.

Upon returning from removal, there will be no more pending callbacks;
however, the caller must ensure no callbacks are executing before freeing
the module.

Return value is `0` if the module was not found, or the `HINSTANCE` of the
DLL otherwise.

:::caution[Binding from another language]
The return value is an `HINSTANCE` — a **pointer-width** handle (64-bit on
x64), not a 32-bit int. Bind it as a pointer/`usize`/`c_void_p`, not as
`uint32`, or you will truncate the handle. Note the asymmetry with
`addextension2`, whose return really is a small status code.
:::

## listextension — enumerate loaded extensions

```c
void listextension(void* callback_fn);
```

Callback-driven listing of currently loaded extensions. `callback_fn` is
of type:

```c
void callback_fn(arcdps_exports* exp);
```

The callback is invoked once for each extension currently loaded, with a
pointer to that extension's `arcdps_exports` table (the same struct shape
described in [Getting Started](/getting-started/#the-arcdps_exports-struct)).

## c_closeandupdate — rundll32 self-update entry point

Not described in the official arcdps API reference — but the arcdps
binary itself (build `1.2026.718.905`) reveals how it's used. The DLL
contains this command-line template:

```
rundll32.exe "%s",c_closeandupdate "%lu,%s"
```

i.e. arcdps re-invokes **itself** through `rundll32.exe`, calling this
export in a fresh process to swap in a downloaded update after the
game closes. Surrounding strings confirm the workflow: staged
`*.dll_update` files, "failed to find arcdps dll_update file, update
aborted", "multiple arcdps modules detected, update aborted", and
"failed to find arcdps in process module list". The signature is
therefore the standard rundll32 entry convention
(`void CALLBACK fn(HWND, HINSTANCE, LPSTR cmdline, int)`), with the
`"%lu,%s"` argument string carrying a process id and path.

This is an **internal updater mechanism, not extension-facing API** —
don't call it. (Classification is binary evidence, not official
documentation.)

## c_exceptionerrormsg — rundll32 crash-dialog entry point

Also undocumented officially; also resolved by binary evidence. The
DLL contains:

```
rundll32.exe "%s",c_exceptionerrormsg "%s"
```

used alongside the crash-handler strings ("Intercepted unhandled
exception in GW2 process. Game will terminate when this box is
closed") — arcdps spawns itself via rundll32 to display the crash
dialog from outside the dying game process, with the message text as
the argument. Same rundll32 entry convention; same caveat: internal,
not extension-facing.

## See also

- [Addon contract](/reference/extension-api/addon-contract/) — the
  `GetAddonDef`/`gw2addon_*` exports, similarly undocumented by the
  official notes.
- [arcdps exports (e0-e10)](/reference/extension-api/arcdps-exports/) —
  the numbered utility exports.
