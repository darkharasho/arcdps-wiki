---
title: Ecosystem
description: Verified map of the arcdps tool landscape — parsers, uploaders, extensions, bindings, and where the community lives.
source: community
---

arcdps is the center of a substantial tool ecosystem. Every entry
below was verified to exist at the given URL on 2026-08-08;
descriptions quote the project's own description where available. The
official site's pointer for discovery, verbatim: "most extensions and
links to parsing tools can be found on elite insights' discord"
(`https://discord.gg/RaZ5myp`).

## Log parsers and upload services

| Tool | What it is |
| --- | --- |
| [GW2 Elite Insights Parser](https://github.com/baaron4/GW2-Elite-Insights-Parser) | "Binary parser for the .evtc files that arcdps generates after a boss encounter. This will generate a .html file where the results can be easily reviewed." The reference implementation for reading the [EVTC format](/reference/evtc-format/), including revision-0 logs; also produces JSON. |
| [dps.report](https://dps.report/) | Log-upload and rendering service built around Elite Insights; the de-facto standard place to share logs. |
| [PlenBot Log Uploader](https://github.com/Plenyx/PlenBotLogUploader) | "The all-in-one open sourced solution for all your arcdps logs" — watches the log directory, uploads, posts to Discord/Twitch. |

### A note on revision-0 logs

Elite Insights documents (in code) the difference between `cbtevent`
revisions that the official README no longer covers: in **revision 0**
(`header[12] == 0`), `overstack_value` and `skillid` are 2-byte
fields, there is no `dst_master_instid`, and padding fills the
difference; **revision 1** widens both to 4 bytes and adds
`dst_master_instid`. Both event sizes are 64 bytes. If you need to
parse pre-revision-1 logs, mirror `ReadCombatItem` vs
`ReadCombatItemRev1` in EI's `EvtcParser.cs`.

## Notable extensions

| Extension | What it is |
| --- | --- |
| [Unofficial Extras](https://github.com/Krappa322/arcdps_unofficial_extras_releases) | Squad roster/chat/language/keybind API provider — see the [dedicated page](/reference/unofficial-extras/). |
| [arcdps healing stats](https://github.com/Krappa322/arcdps_healing_stats) | "An addon for ArcDPS that shows personal healing stats" — also "logs healing to the arcdps evtc, allowing evtc parsers to show healing stats" (healing is otherwise absent from the combat API — see [limitations](/reference/evtc-format/#known-limitations-of-the-data)). |
| [ArcDPS Boon Table](https://github.com/knoxfighter/GW2-ArcDPS-Boon-Table) | Boon/uptime table plugin. |
| [Mechanics plugin](https://github.com/MarsEdge/GW2-ArcDPS-Mechanics-Log) | "Realtime list of failed mechanics for players… determined by the skill id of the attack" (maintained fork under knoxfighter). |
| [arcdps-clears](https://github.com/gw2scratch/arcdps-clears) | "A plugin for arcdps which adds a window that shows your current weekly clears." |

## Bindings and libraries for extension authors

| Library | Language | Notes |
| --- | --- | --- |
| [arcdps-rs](https://github.com/Zerthox/arcdps-rs) | Rust | "Rust bindings for ArcDPS & EVTC." Workspace crates: `arcdps` (plugin bindings, `export!` macro), `evtc` (typed event API), `evtc_parse` (log parsing), `evtc_dump` (CLI → JSON), `unofficial_extras`. The most actively documented Rust path; docs at `zerthox.github.io/arcdps-rs`. |
| [arcdps_bindings](https://github.com/greaka/arcdps_bindings) | Rust | "rust wrapper for creating gw2 arcdps addons" — the original `arcdps_export!` macro crate that arcdps-rs forked from. |
| [arcdps-extension](https://github.com/Zinn-o-Matics/arcdps-extension) | C++ | "Utilities to use for arcdps addons": update checker, DX11 icon loader, network stack, typed combat-event dispatch and an `EventSequencer` for re-ordering async events, localization, keybind handling, MumbleLink. Formerly `knoxfighter/arcdps-extension` (URL redirects). |

## The axi suite

The axi suite is a family of arcdps-adjacent tools by
[darkharasho](https://github.com/darkharasho) — the maintainer of
this wiki, so consider this section a self-listing. Same
verification rule as the rest of the page: every entry checked at
its URL on 2026-08-26; descriptions quote each project's own README.

Since 2026-08-19 the suite shares one parsing core: AxiPulse (v0.2.0),
its in-game plugin (v0.4.0) and AxiBridge (v3.0.0) all parse logs
natively with [axilog](/axilog/) instead of running Elite Insights —
no bundled EI download, no .NET runtime. AxiBridge alone still offers
EI as a selectable alternate engine.

| Tool | What it is |
| --- | --- |
| [axilog](https://github.com/darkharasho/axilog) | "A fast, cross-platform combat-log parser for Guild Wars 2 arcdps logs" — a Rust parsing core with a CLI and native Node/Python SDKs ("not subprocess wrappers"), now the shared parsing engine for the rest of the suite. Its documentation lives on this wiki: see [axilog](/axilog/) for the architecture, [methodology](/axilog/methodology/) for how each metric is derived, and [accuracy](/axilog/accuracy/) for the calibration results against EI. |
| [AxiBridge](https://github.com/darkharasho/axibridge) | "Automatically uploads arcdps logs, summarizes WvW fights, and sends clean, readable reports to Discord or the web" — log-folder watcher with rankings/MVPs, Discord embeds, combat-replay maps, a fight slicer, and persistent web reports (GitHub Pages or Cloudflare R2). Parses natively with axilog since v3.0.0 (EI remains selectable); dps.report is now a sharing path only, not a parse source. |
| [AxiPulse](https://github.com/darkharasho/axipulse) | "Personal GW2 combat analysis that runs beside your game, not in a browser tab" — a desktop companion that watches the arcdps log folder and parses each fight in-process with axilog (since v0.2.0; previously it managed an Elite Insights install). Per-fight Pulse view, per-second Timeline, WvW replay Map, and History. |
| [arcdps_axipulse](https://github.com/darkharasho/arcdps-axipulse) | The in-game half of AxiPulse: a Rust arcdps plugin that parses each log in-process with axilog (since v0.4.0) and renders WvW overlays in-game — squad stats, per-second timeline, and a combat-replay map on official GW2 tiles. (Its README still describes the pre-v0.4.0 Elite Insights pipeline.) |
| [arcdps-player-outline](https://github.com/darkharasho/arcdps-player-outline) | An arcdps plugin that "draws a persistent, always-on-top marker on your own character — so you can instantly find yourself in a crowded zerg," using MumbleLink position projected to screen space. |

There is no official arcdps source repository — deltaconnected's
GitHub account has no public repos. The canonical API and EVTC
documentation live at
[deltaconnected.com/arcdps/api/](https://www.deltaconnected.com/arcdps/api/)
and
[deltaconnected.com/arcdps/evtc/](https://www.deltaconnected.com/arcdps/evtc/).

## See also

- [Writing an extension in practice](/guides/writing-an-extension/) —
  patterns drawn from working plugins.
- [EVTC log format](/reference/evtc-format/) — the file all the
  parsers above consume.
- [Installation, files & settings](/guides/installation-and-files/) —
  the operator-side view.
