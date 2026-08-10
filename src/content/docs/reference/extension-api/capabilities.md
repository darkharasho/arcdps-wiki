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

To make your UI behave like arc's — hiding with the same hotkeys,
respecting the same modifier locks — read arc's current state instead of
tracking it yourself:

- [`e6`](/reference/extension-api/arcdps-exports/#e6--current-ui-settings-bit-mask)
  returns a **bit mask** of UI settings (UI hidden, in-combat state,
  modifier move-lock, modifier click-lock).
- [`e7`](/reference/extension-api/arcdps-exports/#e7--modifier-virtual-key-ids)
  returns arc's configured **modifier virtual-key ids**, so you can
  match its keybind conventions exactly.
- [`e5`](/reference/extension-api/arcdps-exports/#e5--colour-array-pointers)
  hands you arc's **colour arrays** — reuse its profession/subgroup
  palette so your windows are visually consistent.

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

## Open lead: `window_context`

The DLL contains the symbol **`window_context`**, which appears on no
other wiki page and is **not** in arc's export table — placing it with
the extension-imported symbols (`get_init_addr` and friends) or an
internal hook. Its role is **undocumented and unconfirmed**; it's
flagged here as a genuine dark spot worth running down against a working
extension or the disassembly, not a capability you can rely on yet.

## See also

- [arcdps exports (e0–e10)](/reference/extension-api/arcdps-exports/) —
  exact signatures for the exports used above
- [Addon contract](/reference/extension-api/addon-contract/) — the
  `arcdps_exports` table and load handshake
- [Extension registry](/reference/extension-api/extension-registry/) —
  `addextension2`/`removeextension2`/`listextension`
- [Combat callback](/reference/extension-api/combat-callback/) — how
  injected events come back to consumers
