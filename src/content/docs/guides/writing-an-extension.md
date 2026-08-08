---
title: Writing an extension in practice
description: Field-tested patterns for building arcdps extensions — ImGui pinning, error signaling, input handling, threading, textures, and Wine/Proton deployment.
source: community
---

[Getting Started](/getting-started/) covers the documented export
contract. This page collects the *practical* knowledge you need on top
of it — patterns and pitfalls verified against three working
extensions developed in this project's neighborhood (a C++ overlay
plugin and two Rust plugins built on the
[`arcdps-rs`](https://github.com/Zerthox/arcdps-rs) bindings), plus
the official API README (fetched 2026-08-08). Everything here is
community knowledge unless it quotes the README.

## Choosing a binding

- **C++** — bind the structs by hand (they're small; see
  [Getting Started](/getting-started/)) and vendor the exact ImGui
  release arcdps uses. The
  [arcdps-extension](https://github.com/Zinn-o-Matics/arcdps-extension)
  utility library adds update-checking, icon loading, event
  sequencing, and more.
- **Rust** — use [`arcdps-rs`](https://github.com/Zerthox/arcdps-rs)
  (crate `arcdps`; originally a fork of
  [`greaka/arcdps_bindings`](https://github.com/greaka/arcdps_bindings)).
  Its `export!` macro generates `get_init_addr`/`get_release_addr`,
  the exports table, and safe callback wrappers:

  ```rust
  arcdps::export! {
      name: "example addon",
      sig: 0x4A1B0DBE,        // random, unique
      init,
      combat: combat_callback,
      imgui: draw,
      options_end: draw_options,
  }
  ```

  If `init` returns `Err`, arcdps won't consider the plugin loaded
  and will display the error.

**Build with the MSVC ABI.** A `x86_64-pc-windows-gnu` build of a Rust
extension links cleanly but crashes on load inside GW2; use
`x86_64-pc-windows-msvc`. C++ extensions should likewise be built with
MSVC-compatible toolchains.

## ImGui: pin the exact version

arcdps shares its ImGui context with extensions, which only works if
both sides were compiled against the same ImGui layout:

- The API README states arcdps is "currently built with **imgui
  1.92.7** release as of may7 2026" — `IMGUI_VERSION_NUM` **19270**.
  That's the value to put in `arcdps_exports.imguivers`.
- If your `imguivers` doesn't match, arcdps loads the extension but
  **silently disables its UI callbacks** (load result
  `ARCDPSEXTENLOAD_INVALID_IMGUI`; the arcdps log shows "ignoring ui
  callbacks … imgui version mismatch: %u != %u, is this
  up-to-date?"). Your combat callback still runs — a confusing
  half-working state worth knowing about.
- If you don't use ImGui at all, community bindings historically set
  `imguivers` to `18000`.
- When arcdps updates ImGui (as it did in may 2026), "all addons will
  need to be updated manually or through their updater" — re-vendor
  the matching ImGui and rebuild.

In `get_init_addr`, wire up the shared context *and* allocators before
any ImGui call:

```cpp
ImGui::SetCurrentContext((ImGuiContext*)imguicontext);
ImGui::SetAllocatorFunctions((void*(*)(size_t, void*))mallocfn,
                             (void (*)(void*, void*))freefn);
```

Skipping `SetAllocatorFunctions` means your module allocates ImGui
data on its own heap while arcdps frees it on its heap — a classic
cross-DLL crash.

### The ImGui callback actually takes two arguments

The README documents
`void imgui(uint32_t not_charsel_or_loading, uint32_t hide_if_combat_or_ooc)`.
Some bindings declare only the first parameter — harmless under the
x64 calling convention, but the second flag is then unavailable and
you must query the [`e6` UI-settings bitmask](/reference/extension-api/arcdps-exports/#e6--current-ui-settings-bit-mask)
instead. `not_charsel_or_loading` is nonzero when the player is not in
character select, a loading screen, or a forced camera — gate all
drawing on it.

## The `id3dptr` / `imguiversion` parameters

Two easy misreadings of `get_init_addr`, both verified against
working plugins:

- `id3dptr` is the **`IDXGISwapChain*`**, not a device. Get the
  device via `swapchain->GetDevice(...)` when you need one (e.g. for
  texture uploads).
- The last parameter is the **ImGui version number** (e.g. 19270).
  The README notes it was "previously directx version", and older
  bindings that gate d3d11 behavior on `param7 == 11` break silently
  — one of the local plugins carries a vendored patch precisely
  because upstream's check "failed for every plugin, leaving the swap
  chain unset."

## Signaling a load error

Per the README, the exports table doubles as the error channel:

> to signal an error in loading, set sig to 0, and set size to a cast
> of a char* error message (or set to 0)

So on failure return a table with `sig = 0` and `size` pointing at a
NUL-terminated static string (or `0` for no message). arcdps shows
the message in its log ("failed to load '%s', extension provided
reason: %s"). Keep the string alive — arcdps reads it after
`mod_init` returns. (The README also notes the *normal* table "is
copied after return, the original is not accessed thereafter.")

## Unload semantics (since jun 2026)

`get_release_addr` now receives a `uint32_t reason` (of
`n_arcdpsextensionload`), and — per the changelog — extensions may
**refuse unload by returning 0** from `get_release_addr`; arcdps
enforces that the export exists at load time
(`ARCDPSEXTENLOAD_MISSING_GET_RELEASE_ADDR` otherwise). If you build
against docs older than jun 2026, re-check this contract.

## Input: `wnd_nofilter` vs `wnd_filter`

- `wnd_filter` only fires **when arcdps' modifier keys are held**
  (alt+shift by default). If you want plain, unmodified hotkeys (F
  keys, etc.), register `wnd_nofilter` — that's what the local
  plugins do.
- The return value is assigned to `uMsg`; **return 0 to swallow** the
  message (neither arcdps nor the game sees it), or return `uMsg`
  unchanged to pass it through.
- Standard decode for key events:

  ```c
  case WM_KEYDOWN: case WM_KEYUP:
  case WM_SYSKEYDOWN: case WM_SYSKEYUP: {
      int key_down      = (uMsg & 1) == 0;        /* *KEYDOWN are even */
      int prev_key_down = (lParam >> 30) & 1;
      /* wParam is the virtual key code */
  }
  ```

- Don't infer modifier state from the message stream; the local
  plugins query `GetAsyncKeyState(VK_CONTROL/VK_SHIFT/VK_MENU)`
  directly.
- Read arcdps' own modifier bindings via
  [`e7`](/reference/extension-api/arcdps-exports/#e7--modifier-virtual-key-ids)
  if you want to compose with them.

## Options callbacks

- `options_tab` (called `options_end` in community bindings) draws
  your section in the arcdps options panel. Behavioral note from a
  local plugin: arcdps only calls it **while the settings pane is
  visible** — usable as a cheap "options open?" signal.
- `options_windows` is called once per window-checkbox in arcdps'
  settings, and **the last call is always with `windowname == NULL`**
  (community-verified). Returning nonzero suppresses arcdps' own
  checkbox for that window; the local plugins draw their own controls
  on the `NULL` call and always return 0.

## Threading and crash containment

- The combat callback "may be called asynchronously" — use the `id`
  parameter to re-establish order (first id is 2) and expect
  callbacks on non-render threads. The local plugins funnel all
  shared state through a mutex touched by both the combat callback
  and background threads.
- Wrap **every** callback body in crash containment
  (`catch_unwind` in Rust, SEH/noexcept discipline in C++): a panic
  or exception escaping your WndProc callback can kill the game's
  input loop. The Rust bindings' default `unwind` ABI feature exists
  "to allow Arc to create crash logs on panic."
- On `removeextension2`-driven unload, "there will be no more pending
  callbacks; however, the caller must ensure no callbacks are
  executing before freeing" — design your teardown accordingly.

## Drawing textures

The pattern used by the local plugins (same approach as
`arcdps_healing_stats`): get the `ID3D11Device` from the swap chain,
create a texture and shader-resource-view for your RGBA pixels, and
hand the SRV pointer to ImGui as a `TextureId` — arcdps' D3D11
backend resolves it directly. Timing gotcha: the device is typically
**not available yet during `mod_init`** — retry on the first `imgui`
callback frame, then cache.

Colors: prefer
[`e5`](/reference/extension-api/arcdps-exports/#e5--colour-array-pointers)
for arcdps-consistent profession/subgroup colors, but the arrays "may
be null pointers in the first frames after load" — keep a fallback
palette.

## Realtime API expectations

Things the local plugins learned the hard way — see the
[combat callback](/reference/extension-api/combat-callback/) page for
the documented model:

- The area feed is delayed ~2–3 s **by design** and filtered to
  squad-relevant events; roughly half the
  [statechange types](/reference/enums/statechange-payloads/) never
  appear on the realtime path at all.
- Agent names in `ag*` are only valid **for the duration of the
  call** — copy them out, never store the pointers.
- Non-squad hostile players are aggregated: arcdps reuses the
  profession id as the agent id for enemies outside your squad, so a
  WvW "enemy roster" via the realtime API tops out around one entry
  per profession. Per-player enemy data only exists in the written
  `.evtc` log (which appears a few seconds after combat ends).
- If you need squad roster, account names, or chat, that's the
  [Unofficial Extras](/reference/unofficial-extras/) API, not arcdps
  itself.

## Deploying (including Wine/Proton)

- Drop the DLL next to `Gw2-64.exe` or into `bin64/`; the name must
  include `arcdps` for arcdps to log it. On addon-manager setups it
  lives in `addons/` alongside other `arcdps_*.dll` files.
- arcdps discovers extensions **at launch only** — a map change won't
  pick up a newly copied DLL.
- Under Wine/Proton, never `cp` over a loaded DLL: `cp` truncates the
  inode in place and corrupts pages the game has mapped executable.
  Write to a temp file and `rename(2)` over the target.
- For auto-updates, export
  [`get_update_url`](/getting-started/#get_update_url-optional)
  (HTTPS on port 443 only).

## See also

- [Getting Started](/getting-started/) — the documented contract this
  page builds on.
- [arcdps exports (e0–e10)](/reference/extension-api/arcdps-exports/)
  — the utilities available to a loaded extension.
- [Unofficial Extras](/reference/unofficial-extras/) — squad, chat,
  language, and keybind callbacks.
- [Ecosystem](/guides/ecosystem/) — bindings and reference
  extensions to learn from.
