---
title: API revision history
description: Timeline of breaking and notable changes to the arcdps extension API and EVTC format, from the official changelog.
source: official-docs
---

arcdps has no versioned API — the contract is "whatever the current
DLL does," updated in step with game builds. That makes the
changelog on the official site
(`https://www.deltaconnected.com/arcdps/`, fetched 2026-08-08) the
only record of when the API and EVTC format changed shape. This page
collects the entries that matter to extension authors and log-parser
maintainers, quoted verbatim (grouping and emphasis ours). The
current release at fetch time was `1.2026.718.905`.

Update cadence context, from the same page: "some client updates may
change components used by arcdps, requiring an arcdps update," and
"most errors will disable logging and extension data sharing
features" — i.e. after a game patch, a stale arcdps usually degrades
gracefully rather than crashing.

## may.07.2026 — the big restructuring

The most consequential recent batch for anyone with pre-2026 code or
docs:

> updated imgui, all addons will need to be updated manually or
> through their updater

> evtc: animation events moved to CBTS_ANIMATIONSTART and
> CBTS_ANIMATIONSTOP rather than inferred.

> evtc: buff apply and remove events moved to CBTS_BUFFAPPLY,
> CBTS_BUFFCHANGE, CBTS_BUFFREMOVE_SINGLE, CBTS_BUFFREMOVE_ALL rather
> than inferred.

> evtc: merged cbtbuffcycle into cbtresult.

> api: updated to imgui 1.92.7.

> api: replaced directx version with imguiversion in get_init_addr.

> defuncd CBTS_APIDELAYED.

**Impact**: older third-party documentation (and many bindings)
describe skill activations and buff applies/removes as plain
`CBTS_COMBAT`-family events discriminated by
`is_activation`/`is_buffremove` — that describes **pre-may-2026**
behavior. Current events are explicit statechanges (67–72). The old
`cbtbuffcycle` enum's values now live at the tail of
[`cbtresult`](/reference/enums/#cbtresult-combat-result)
(`CBTR_BUFF_DAMAGE*`, values 14–18). The last `get_init_addr`
parameter changed meaning from a DirectX version to
`IMGUI_VERSION_NUMBER`, and the ImGui bump means `imguivers` must now
be `19270`.

## jun.02.2026 — unload contract hardened

> api: enforce presence of get_release_addr export.

> api: allow extensions to refuse unload by returning 0 in
> get_release_addr.

> api: get_release_addr will get u32 reason of removal in parameter 1.

> evtc: added CBTS_STEALTHCHANGE/GADGETANIMATION/GADGETNAME

**Impact**: `get_release_addr` went from a zero-argument formality to
`void* get_release_addr(uint32_t reason)` with veto power. Extensions
without the export no longer load
(`ARCDPSEXTENLOAD_MISSING_GET_RELEASE_ADDR`).

## jul.01.2026 — evtc event batch

> evtc: added CBTS_MISSILEEFFECT.

> evtc: added CBTS_GADGETCAPTURECREATE / GADGETCAPTUREPROGRESS /
> GADGETCAPTUREREMOVE / GADGETCAPTUREOUTLINEPOINT.

> evtc: retired CBTS_RATEHEALTH, added CBTS_TICK.

> evtc: removed hitbox height from evtc_agent (defunc, wasnt hitbox
> height).

**Impact**: the final `uint16_t` of
[`evtc_agent`](/reference/evtc-format/#agent-table) is now named
`defunc`; tick-rate monitoring moved from `CBTS_RATEHEALTH` to
[`CBTS_TICK`](/reference/enums/statechange-payloads/#cbts_tick-84).

## Older retirements still visible in the enum

The `_DEFUNC` entries in
[`cbtstatechange`](/reference/enums/#cbtstatechange-the-is_statechange-field)
carry their own retirement dates in the source: `CBTS_EFFECT1_DEFUNC`
(since 230716+), `CBTS_LAST90BEFOREDOWN_DEFUNC` (since 240529+),
`CBTS_EFFECT2_DEFUNC` (since 250526+), `CBTS_STATRESET_DEFUNC` (since
260402+), `CBTS_APIDELAYED_DEFUNC` (since 260501+), `CBTS_RATEHEALTH`
(since 260627+). Old logs may still contain them; current builds
don't emit them.

Similarly, the EVTC `cbtevent` **revision byte** (`header[12]`)
records the one historical struct-layout break — see
[revision notes](/reference/evtc-format/#revision-history-notes).

## Practical advice

- Pin your docs reading to a date: anything describing
  activation/buff events as `is_activation`/`is_buffremove` flags on
  combat events, a `directx version` parameter, or an optional
  `get_release_addr` predates mid-2026.
- Parsers should key behavior off the **header build date** (bytes
  4–11 of the [EVTC header](/reference/evtc-format/#header-16-bytes))
  — that's what Elite Insights does for build-dependent semantics like
  buff-formula attributes.
- One community-recorded bad build worth knowing: arcdps `20250420`
  had broken team-change-on-despawn events; at least one WvW tool
  special-cases logs from that build.

## See also

- [EVTC log format](/reference/evtc-format/) — the format the evtc
  entries above modify.
- [Getting Started](/getting-started/) — the current form of the
  contract after these changes.
