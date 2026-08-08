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
