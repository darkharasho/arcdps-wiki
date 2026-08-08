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
document — they are marked undocumented below.

## addextension2 — load an extension

```c
uint32_t addextension2(HINSTANCE hinst);
```

Loads an extension. arcdps will `LoadLibrary` the given `HINSTANCE` to
increment its refcount, call its `get_init_addr`, and call the function it
returns — the same load sequence used for extensions discovered
automatically at startup (see [Getting Started](/getting-started/)).

Return value is `0` on success, or non-zero on error, per
`enum n_arcdpsextensionload`:

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
uint32_t removeextension2(uint32_t sig);
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

## c_closeandupdate — undocumented

```c
/* signature undocumented */
```

Not described in the official arcdps API reference. The name suggests it
triggers a close-and-self-update sequence (compare the optional
`get_update_url` export documented for extensions on
[Getting Started](/getting-started/), which arcdps uses to self-update
*extensions*) — but no parameters, return value, or confirmed behavior are
given in the published notes. Undocumented — verify against the reference
implementation.

## c_exceptionerrormsg — undocumented

```c
/* signature undocumented */
```

Not described in the official arcdps API reference. The name suggests it
retrieves or formats an error message following an exception, but no
signature or semantics are given. Undocumented — verify against the
reference implementation.

## See also

- [Addon contract](/reference/extension-api/addon-contract/) — the
  `GetAddonDef`/`gw2addon_*` exports, similarly undocumented by the
  official notes.
- [arcdps exports (e0-e10)](/reference/extension-api/arcdps-exports/) —
  the numbered utility exports.
