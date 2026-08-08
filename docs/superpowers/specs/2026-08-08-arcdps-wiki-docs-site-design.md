# arcdps-wiki — Docs Site + Seed Content (Design Spec)

- **Date:** 2026-08-08
- **Status:** Approved (design), pending spec review
- **Scope:** Documentation site + hand-seeded technical API reference. No automation.

## 1. Summary

A community-managed, Git-backed documentation site for **arcdps** (the Guild Wars 2
combat-analysis addon), hosted under `axi.link` on Cloudflare Pages. Contributors edit
Markdown via GitHub pull requests. This first spec covers the **site** and a **hand-seeded
technical reference** derived from the arcdps DLL's public export surface plus
deltaconnected's published API notes.

The content is **technical-reference-first** (for downstream/addon developers), not an
end-user "how to use arcdps" guide. It is written to be **approachable to modern-language
developers** (Node / Python / Rust FFI consumers), not only low-level C/C++ developers.

## 2. Goals

- Ship a beautiful, modern docs site on Cloudflare Pages under `axi.link`.
- PR-based Markdown contribution workflow with per-PR preview deploys.
- Seed a technical reference for the arcdps **public extension/plugin API surface**.
- Make every reference page approachable to FFI consumers (Rust / Python / Node), with
  per-struct layout mappings, not just C declarations.
- Structure DLL-derived content so a future automated pipeline can regenerate it in place.

## 3. Non-goals (this spec)

- Decompiling arcdps internals (algorithms, private structures, hook implementation).
- The scheduled decompile-and-regenerate pipeline (deferred to its own sub-project).
- End-user "how to use arcdps" content (settings walkthroughs, in-game usage).
- In-browser wiki-style editing with a live database backend.
- A complete EVTC binary-format specification (stubbed as a planned follow-on; see §7).

## 4. Architecture

- **Astro + Starlight**, Markdown/MDX content, static build.
- **Cloudflare Pages** deploy on an `axi.link` subdomain (exact hostname TBD by the user
  during setup). Merge to `main` → production deploy. Pull requests → preview deploys.
- **No runtime backend.** Fully static.
- **Generated-content boundary:** DLL-derived pages live at stable paths and carry
  frontmatter marking their source (§6), so a future generator can replace them in place
  without touching community-authored prose.

## 5. Content architecture

```
Home / Overview        → what arcdps is, the addon + d3d11-proxy model, at a dev's altitude
Getting Started (dev)  → building an extension: export contract, minimal skeleton addon
Extension API
  ├─ Addon contract    → GetAddonDef, gw2addon_load/unload/get_description, init/release
  ├─ Combat callback   → combat callback signature, agent/skill/event params
  ├─ arcdps exports    → e0, e3–e10 (log, ini path, modifiers, add-event, ui, etc.)
  └─ Extension registry→ addextension2, removeextension2, listextension,
                         arcdps_identifier_export, arcdps_imguiversion_export
Data Structures        → cbtevent (field-by-field), ag (agent) struct
Enums                  → cbtstateevent, cbtresult, iff, activation, buffremove, …
Exports Reference      → full DLL export table, grouped by function + raw appendix
  └─ DirectX proxy     → why arcdps ships as d3d11.dll (proxy surface, one page, brief)
EVTC Log Format        → STUB page: planned; realistic entry point for Node/Python/Rust
Contributing           → PR flow, page conventions, frontmatter/source contract
```

Decisions:
- **Exports reference** is organized **grouped-by-function**, with the **raw export table as
  an appendix**. Not one page per ordinal.
- **DirectX proxy exports** get **one explanatory page** (why arcdps proxies `d3d11.dll`),
  not per-symbol pages.
- **EVTC Log Format** is a **stub** this round — a real page in the IA marking it planned,
  so the follow-on has a home. Full binary-format authoring is out of scope here.

## 6. Source-of-truth contract

Every reference page carries frontmatter declaring provenance:

- `source: dll-exports` — verifiable directly against the arcdps DLL export table.
- `source: official-docs` — from deltaconnected's published API notes
  (https://www.deltaconnected.com/arcdps/x64/).
- `source: community` — community knowledge / reverse-engineered (e.g. EVTC format).

This makes the "what a future generator owns vs. what humans own" boundary explicit and
prevents automation from later clobbering community prose.

**Accuracy rule:** where the public docs are silent on a field's meaning, the page states
that explicitly rather than guessing. No invented field semantics.

## 7. Modern-language accessibility

Two treatments, both approved:

1. **Approachable presentation (this spec).** The API is a C ABI, but reference pages
   explain it for FFI consumers: alongside the C declaration, show the equivalent layout as
   Rust `#[repr(C)]`, Python `ctypes.Structure`, and a node-ffi/koffi-style layout, plus
   plain-language field semantics. No assumption the reader writes C++.
2. **EVTC consumption path (stubbed follow-on).** Most Node/Python/Rust devs consume arcdps
   by parsing its `.evtc`/`.zevtc` combat-log files (as Elite Insights does) rather than
   writing native extensions. The EVTC binary format gets a stub page now and full authoring
   later.

## 8. Seed data source (verified)

The arcdps DLL is available locally and its export table has been read (read-only,
`objdump -p`; no decompilation). Confirmed export groups feeding the seed:

- **arcdps "e" exports:** `e0`, `e3`, `e4`, `e5`, `e6`, `e7`, `e8`, `e9`, `e10`
  (`e1`/`e2` absent — historical).
- **Extension registry:** `addextension2`, `removeextension2`, `listextension`,
  `arcdps_identifier_export`, `arcdps_imguiversion_export`.
- **Addon-loader interface:** `GetAddonDef`, `gw2addon_load`, `gw2addon_unload`,
  `gw2addon_get_description`.
- **Chainload/updater:** `c_closeandupdate`, `c_exceptionerrormsg`.
- **DirectX proxy surface:** `CreateDXGIFactory*`, `D3D11CreateDevice*`, the `D3DKMT*`
  block, `DXGI*`, `PIX*`, and compat shims (`ApplyCompatResolutionQuirking`, `CompatString`,
  `CompatValue`, `SetAppCompatStringPointer`, `EnableFeatureLevelUpgrade`,
  `UpdateHMDEmulationStatus`).

Combat structs/enums (`cbtevent`, `ag`, `cbtstateevent`, …) are **not** in the export table
and are sourced from deltaconnected's published API notes (`source: official-docs`).

## 9. Accuracy & testing

- CI runs the Starlight/Astro build; broken internal links and broken MDX **fail** the build.
- A lightweight check verifies the documented export list matches the actual DLL export
  table, so drift is caught. This is the one automated guard retained without the full
  pipeline. (Requires the DLL, or a checked-in snapshot of its export list, to be available
  to CI — mechanism decided during planning.)
- Every struct/enum page cites its official source per §6.

## 10. Deployment & workflow

- GitHub repo, `main` is production.
- Cloudflare Pages project bound to the repo: production build on `main`, preview builds on
  PRs.
- Contributing page documents: PR flow, page conventions, required frontmatter, and the
  source-of-truth contract.

## 11. Open items to resolve during planning

- Exact `axi.link` subdomain hostname (user-provided at Cloudflare setup).
- How the export-drift check obtains the export list in CI (checked-in snapshot vs. other).
- Cloudflare Pages provisioning requires Cloudflare account authorization not available in
  this session; captured as a setup intent.

## 12. Deferred sub-projects (own specs later)

- Scheduled decompile-and-regenerate pipeline (GitHub Actions vs. venus.local), gated on
  explicit arc-dev sign-off for decompiling/redistributing derived material.
- Full EVTC binary-format reference.
- End-user usage documentation, if desired.
