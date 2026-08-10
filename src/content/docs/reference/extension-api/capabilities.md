---
title: Extension Capabilities
description: What arcdps lets an extension actually do — inject events into the log, draw in the shared ImGui context, ship auto-updates, and register at runtime — with the load contract recovered from the DLL.
source: community
---

The rest of the extension-API reference is organized by *symbol* — here
is `e9`, here is the `arcdps_exports` struct. This page is organized by
*capability*: what you can actually **do** as an extension author, and
the recipe for each. It leans on the reference pages for exact
signatures and on the DLL's own load-contract and warning strings for
the behavior the official notes leave out.

:::note[Sourcing]
Signatures and struct layouts are the documented API (linked inline).
The load-contract and failure-mode details are **binary evidence** —
literal warning strings extracted from the arcdps DLL (build
1.2026.718.905), labeled as such where used. Behavior beyond what a
string states is inference; verify against a working extension.
:::

## Inject your own events into arc's log and pipeline

This is arc's headline extension capability, and the one most worth
understanding: **your extension can write events into arc's combat
processing**, where they flow into the realtime API *and* get written
to the EVTC log that Elite Insights, dps.report, and every other parser
reads. This is how the healing-stats addon puts healing — data absent
from the base combat API — into logs that third-party tools then
display.

Two exports do it
([full signatures](/reference/extension-api/arcdps-exports/#e9--add-event-to-arcs-processing-pipeline)):

```c
void e9(cbtevent* ev, uint32_t sig);   // is_statechange = CBTS_EXTENSION
void e10(cbtevent* ev, uint32_t sig);  // is_statechange = CBTS_EXTENSIONCOMBAT
```

- **`e9`** stamps your event with `is_statechange = CBTS_EXTENSION` and
  writes your `sig` across `pad61`–`pad64`. The event lands in the
  ringbuffer and goes out on the realtime API.
- **`e10`** is the same but sets `CBTS_EXTENSIONCOMBAT` and treats
  `skillid` as a **real skill id** — the skill gets added to the EVTC
  skill table, so parsers can name it.

The `sig` you pass is your extension's unique identifier — the same
`sig` from your [`arcdps_exports`](/reference/extension-api/addon-contract/)
table. It's how consumers tell *your* injected events apart from arc's
and from other extensions'. Downstream, these arrive as
[`CBTS_EXTENSION` (40) / `CBTS_EXTENSIONCOMBAT` (49)](/reference/enums/statechange-payloads/)
statechanges — "for extension use, not managed by arcdps."

### Recipe: emit a custom event

Resolve `e9`/`e10` the same way as the UI exports (`GetProcAddress` on
arc's handle, cached at init). Then fill a
[`cbtevent`](/reference/data-structures/cbtevent/) and hand it over —
arc sets `is_statechange` and `sig` for you, so you only populate the
fields your event needs:

```c
typedef void (*arc_e10_t)(cbtevent* ev, uint32_t sig);
static arc_e10_t arc_add_event;   // = GetProcAddress(arc_dll, "e10"), cached

#define MY_SIG        0x4D594558u  // your module's unique sig
#define MY_SKILL_ID   0x50000001u  // a private skill id you own

// Record "my_value" as a strike-shaped event from src onto dst.
void emit_my_metric(uintptr_t src_id, uintptr_t dst_id, int32_t my_value) {
    cbtevent ev = {0};                 // zero every field you don't set
    ev.time      = timeGetTime();      // arc's own clock (see cbtevent.time)
    ev.src_agent = src_id;
    ev.dst_agent = dst_id;
    ev.value     = my_value;
    ev.skillid   = MY_SKILL_ID;        // e10 adds this to the evtc skill table
    ev.result    = CBTR_STRIKE_DAMAGENORMAL;
    arc_add_event(&ev, MY_SIG);        // arc stamps is_statechange + sig
}
```

Pick the export by intent: **`e10`** when the event names a skill you
want parsers to resolve (it registers `skillid` in the log's skill
table); **`e9`** for a raw signal where the skill id is just a tag. On
the read side, your own combat callback and every other consumer see
these as [`CBTS_EXTENSIONCOMBAT`/`CBTS_EXTENSION`](/reference/enums/statechange-payloads/)
carrying your `sig` in `pad61`–`pad64` — filter on it to pick out your
own events.

**Why this is the high-leverage move:** anything you can express as a
`cbtevent` becomes first-class log data. You are not limited to reading
arc's events — you can add to the shared record the entire ecosystem
consumes.

## Draw in arc's shared ImGui context

arc renders with [Dear ImGui](https://github.com/ocornut/imgui) and
**shares its context with extensions**, so your UI draws into the same
frame as arc's windows — no separate rendering setup. You opt in through
the `arcdps_exports` callback slots
([struct](/reference/extension-api/addon-contract/)):

- `imgui` — called each frame to draw your windows
- `options_tab` — draw controls into your row of arc's options window
- `options_windows` — contribute to arc's window-visibility menu

You wire these by returning a filled `arcdps_exports` from your init
function — set the callback pointers and arc calls them inside its own
frame, so plain ImGui calls just work:

```c
arcdps_exports arc_exports = {0};

// your init (returned from get_init_addr) fills the table:
arc_exports.size       = sizeof(arcdps_exports);
arc_exports.sig        = MY_SIG;
arc_exports.imguivers  = IMGUI_VERSION_NUM;   // MUST match arc — see below
arc_exports.out_name   = "my extension";
arc_exports.out_build  = MY_BUILD_STRING;
arc_exports.imgui      = imgui;               // your per-frame draw fn
arc_exports.options_tab = options_tab;        // optional
return &arc_exports;
```

### The version gotcha (binary evidence)

There is a trap here the official notes don't spell out, but the DLL
does. Your module reports the ImGui version it was built against
(`imguivers` in your exports, and the `imguiversion` arc passes into
[`get_init_addr`](/getting-started/#get_init_addr)). If it doesn't match
arc's, arc **silently stops calling your UI callbacks** — your combat
logic keeps running, but nothing you draw appears. The exact DLL string:

> `warning: ignoring ui callbacks for "%s", imgui version mismatch: %u != %u, is this up-to-date?`

So if your windows vanish after an arcdps update, this is why: rebuild
against the ImGui version the current arc ships. arc also guards the
handshake itself —

> `warning: received incompatible imgui context, using standalone`

— meaning a context it can't accept drops you to a standalone context
rather than crashing.

## Ship an auto-updating extension

arc can fetch and hot-swap extension updates over HTTP, and your module
participates by exposing three lookup symbols arc calls on yours (these
are **not** arc exports — arc imports them *from you*):

- `get_update_url` — where arc fetches your latest build
- `get_init_addr` — your init entry (the same one from the
  [load handshake](/getting-started/#get_init_addr))
- `get_release_addr` — your teardown entry, required for hot-swap

The load contract for this is exact, again from the DLL's own failure
strings (binary evidence):

> `warning: failed to load "%s", missing get_release_addr`
> `warning: failed to load "%s", found init but extension did not provide function table`

In other words: to be updatable you **must** expose `get_release_addr`,
and your init **must** return a function table — arc refuses to load a
module that has an init but no table. arc reports success as
`extensions: retrieved update for "%s"` and surfaces server-side
failures verbatim (`extension provided reason: %s`).

## Register and unregister extensions at runtime

Beyond the loader, arc exposes a runtime sub-extension registry
([full signatures](/reference/extension-api/extension-registry/)):

```c
uint32_t  addextension2(HINSTANCE hinst);    // load a module you hold a handle to
HINSTANCE removeextension2(uint32_t sig);     // unload by sig
/* listextension — enumerate loaded extensions */
```

This lets a host extension load *other* modules itself (an
extension-of-extensions pattern) rather than relying on arc's directory
scan — useful for bundlers or managers. `addextension2` returns a small
status code; `removeextension2` returns the module handle so you can
`FreeLibrary` it.

## Read arc's live UI state

If your extension draws windows, users expect them to behave like arc's:
vanish on the same hide hotkey, freeze on the same modifier locks, use
the same profession colours. You get all of that by **reading arc's
state each frame** instead of reimplementing it — via `e5`/`e6`/`e7`.

### Resolve the exports once

You already hold arc's module handle: it's the second argument to your
[`get_init_addr`](/getting-started/#get_init_addr). Resolve the export
pointers there and cache them — don't call `GetProcAddress` per frame.

```c
typedef uint64_t (*arc_e6_t)(void);
typedef uint64_t (*arc_e7_t)(void);
typedef void     (*arc_e5_t)(ImVec4** out);

static arc_e6_t arc_ui_flags;   // e6: UI settings bitmask
static arc_e7_t arc_mod_keys;   // e7: modifier virtual-key ids
static arc_e5_t arc_colours;    // e5: colour array pointers

// inside your module init, arc_dll = the HMODULE arc handed you
arc_ui_flags = (arc_e6_t)GetProcAddress(arc_dll, "e6");
arc_mod_keys = (arc_e7_t)GetProcAddress(arc_dll, "e7");
arc_colours  = (arc_e5_t)GetProcAddress(arc_dll, "e5");
```

### Hide and lock in sync with arc

In your `imgui` callback, gate drawing on arc's
[`e6`](/reference/extension-api/arcdps-exports/#e6--current-ui-settings-bit-mask)
bitmask so your window obeys the same hide hotkey and modifier locks the
user already configured:

```c
enum { ARC_UI_HIDDEN = 1<<0, ARC_UI_MOVELOCK = 1<<2, ARC_UI_CLICKLOCK = 1<<3 };

void imgui(uint32_t not_charsel_or_loading) {
    if (!not_charsel_or_loading) return;   // arc's own draw guard
    uint64_t ui = arc_ui_flags ? arc_ui_flags() : 0;
    if (ui & ARC_UI_HIDDEN) return;        // user hit the hide key — respect it

    ImGuiWindowFlags flags = 0;
    if (ui & ARC_UI_MOVELOCK)  flags |= ImGuiWindowFlags_NoMove;
    if (ui & ARC_UI_CLICKLOCK) flags |= ImGuiWindowFlags_NoInputs;

    if (ImGui::Begin("my extension", nullptr, flags)) {
        // ... your window ...
    }
    ImGui::End();
}
```

### Match arc's modifier keys and palette

[`e7`](/reference/extension-api/arcdps-exports/#e7--modifier-virtual-key-ids)
gives you the exact virtual-key ids arc uses for its modifiers, so a
keybind you add feels native (decode is on the `e7` page). And
[`e5`](/reference/extension-api/arcdps-exports/#e5--colour-array-pointers)
hands you arc's live colour arrays — reuse them so a profession or
subgroup is the same colour in your window as in arc's:

```c
ImVec4* cols[5];
arc_colours(cols);
// cols[1] = profession base, cols[3] = subgroup base (see e5 for the full layout)
ImVec4 prof_colour = cols[1] ? cols[1][profession] : fallback;  // see caveat
```

:::caution[Two gotchas the reference implementation learned the hard way]
- **`e5` pointers can be null for the first few frames** after load —
  keep a fallback palette until arc has populated them, or you'll
  dereference null on startup.
- Refresh subgroup colours on the `combatenter` statechange; they aren't
  stable for the whole session.
:::

## Load as a generic addon host (Nexus / addon-loader)

arc's export table also carries `GetAddonDef` and the
`gw2addon_load` / `gw2addon_unload` / `gw2addon_get_description` family.
These aren't in the arcdps API notes — they match the generic
[GW2 addon-loader / Nexus](https://github.com/gw2-addon-loader)
convention, letting a third-party addon manager load arc as a managed
addon. The [addon contract page](/reference/extension-api/addon-contract/#symbol-reference)
documents these as **undocumented** pending confirmation against a
reference host; treat the struct layout and calling convention as
unverified.

## Not a capability: `window_context` (investigated)

`window_context` is a string in the DLL that sits alphabetically next to
the extension-imported updater symbols (`get_init_addr` and friends),
which made it look like it might be another symbol arc looks up in your
module. **Disassembly says otherwise — it is internal, not an extension
hook.** Recorded here so the lead is closed rather than left dangling.

What the binary shows (build 1.2026.718.905, binary evidence):

- The string (`.rdata`, `0x1801189c8`) is referenced by exactly **one**
  `lea` in the whole binary, at `0x180076a52`, inside a helper at
  `0x180076a40`.
- That reference is a **null-default**: `cmovne r14, rcx` — the helper
  takes a name pointer and falls back to the literal `"window_context"`
  only when the caller passes null. So it's a *default identifier*, not
  a name arc imports from you.
- It is **not** passed to `GetProcAddress`, **not** in the export table,
  and its address is **not** stored in any pointer/dispatch table (a raw
  qword-pointer scan finds zero occurrences) — unlike the real
  extension-imported symbols, which are `lea`'d in the loader/updater
  cluster around `0x18002f800`.
- The helper has **8 internal callers** and manipulates a name-keyed id
  stack with 2-bit flag fields — shape consistent with an ImGui-style
  window/id routine (this last point is inference from the disassembly,
  not a certainty).

**Takeaway for extension authors:** there is nothing to implement or
call here. `window_context` is arc's internal default window/context
identifier, not a leverage point.

## See also

- [arcdps exports (e0–e10)](/reference/extension-api/arcdps-exports/) —
  exact signatures for the exports used above
- [Addon contract](/reference/extension-api/addon-contract/) — the
  `arcdps_exports` table and load handshake
- [Extension registry](/reference/extension-api/extension-registry/) —
  `addextension2`/`removeextension2`/`listextension`
- [Combat callback](/reference/extension-api/combat-callback/) — how
  injected events come back to consumers
