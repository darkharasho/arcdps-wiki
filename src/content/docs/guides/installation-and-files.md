---
title: Installation, files & settings
description: Installing, updating, and removing arcdps; every file it creates; chainloading; load modes; and the arcdps.ini settings surface.
source: community
---

This page covers arcdps from the operator's side: how it gets into the
game process, every file it reads and writes, and how its
configuration is stored. Facts are sourced from the official site
(`https://www.deltaconnected.com/arcdps/`, fetched 2026-08-08) and,
where marked **binary evidence**, from strings in the arcdps DLL
itself (build `1.2026.718.905` / FileVersion `1.2026.718.905`).

:::caution[Not supported by ArenaNet]
The official site leads with this warning, verbatim:

> WARNING: MODIFYING GUILD WARS 2 THROUGH ANY 3RD PARTY TOOLS IS NOT
> SUPPORTED BY ARENANET OR NCSOFT. DO NOT CONTACT SUPPORT ABOUT GAME
> CLIENT ISSUES WHILE USING THIS TOOL. THERE IS NO HELP OR WARRANTY.
> THIS IS ENTIRELY AT YOUR OWN RISK AND YOU ASSUME ALL RESPONSIBILITY.

ArenaNet's [Policy: Third-Party Programs](https://help.guildwars2.com/hc/en-us/articles/360013625034-Policy-Third-Party-Programs)
does not name arcdps or DPS meters; it prohibits programs that give
"an unintended, unnatural, or unfair advantage", states that for
utilities which "help players without affecting others … in general,
we will not take action", that "action is subject to ArenaNet's
discretion", and that "ArenaNet does not review, approve, or endorse
any third-party program."
:::

## Install, update, uninstall

Verbatim from the official site:

> to install, place d3d11.dll next to gw2-64.exe while the client is
> not running, optionally can be renamed to dxgi.dll.
> addons and arcdps config directory will be created alongside client
> exe after launch.
> to update, replace arcdps dll.
> to reset, delete the config directory above while the client is not
> running.
> to remove, delete the arcdps dll while the client is not running.
> some client updates may change components used by arcdps, requiring
> an arcdps update.
> most errors will disable logging and extension data sharing features.

The download is `https://www.deltaconnected.com/arcdps/x64/d3d11.dll`,
alongside `d3d11.dll.md5sum` and `d3d11.dll.version`. **Binary
evidence**: the DLL's built-in updater fetches exactly those three
URLs (plus an `x64-beta/` variant when beta updates are enabled) and
refuses updates on "version mismatch" or "hash mismatch" against the
published `.version`/`.md5sum` files.

### Load modes

**Binary evidence** — arcdps logs its own load mode at startup as
`info: as <mode>`, where mode is `proxy` or `addon`:

- **Proxy mode** — the documented install: the DLL is named
  `d3d11.dll` (or `dxgi.dll`) next to `Gw2-64.exe`, and Windows'
  loader pulls it in instead of the system DirectX library. See
  [DirectX proxy exports](/reference/exports/directx-proxy/) for how
  the forwarding works.
- **Addon mode** — arcdps loaded by a third-party addon manager
  through its [`gw2addon_*` exports](/reference/extension-api/addon-contract/)
  rather than as the proxy DLL. The binary contains an options note
  "Unsupported when running in addon mode" for at least one feature,
  so expect minor feature differences here.
- **Chainloading** — arcdps in proxy position can itself load a
  further wrapper: **binary evidence** shows it probing
  `<name>_chainload.dll` (i.e. `d3d11_chainload.dll` /
  `dxgi_chainload.dll`) and logging `info: chainloading active`. The
  official troubleshooting advice mentions chainloads only to say:
  when crashing, "remove all arcdps extensions and chainloads, and
  try to repeat the crash." An options warning in the binary notes
  "Updating may fail or crash in chainload or external load
  environments."
- **Wine/Proton** — **binary evidence**: arcdps calls
  `wine_get_version` and logs `info: detected wine %s`. It runs under
  Proton; note that on typical Linux/Steam setups the `d3d11.dll` in
  the game root is DXVK's, and arcdps is loaded by other means (e.g.
  an addon manager in `addons/`).

### Extensions

> place next to gw2 exe or in gw2 install dir/bin64/.

Extension DLL names must include `arcdps` to be logged (per the API
README). arcdps can also self-update extensions that export
[`get_update_url`](/getting-started/#get_update_url-optional):
**binary evidence** shows staged `*.dll_update` files and the message
"extensions: retrieved update for" — updates download to a
`.dll_update` file and are swapped in via the
[`c_closeandupdate`](/reference/extension-api/extension-registry/#c_closeandupdate--rundll32-self-update-entry-point)
rundll32 helper. A `safemode` INI switch (**binary evidence**:
"Restart required. Prevent loading of extensions, do not accept imgui
contexts") disables extension loading entirely — useful when
bisecting a crash.

## Files arcdps creates

All per-install files live in `<GW2 dir>/addons/arcdps/` (**binary
evidence** for each name):

| File | Purpose |
| --- | --- |
| `arcdps.ini` | main settings file (see below) |
| `arcdps.log` | diagnostic log — first place to look when something breaks |
| `arcdps_lastcrash.log` | crash report from the built-in crash handler |
| `arcdps_imgui.ini` | ImGui window layout state |
| `arcdps_font.ttf` | optional user-supplied custom font ("Custom fonts can be loaded by placing arcdps_font.ttf in config directory") |
| `arcdps_lang.ini` | optional translation file (community French/Chinese translations exist; see the official site's translations page) |
| `icons/` | optional custom icons: `001.png`–`009.png` for professions and `e101.png`–`e904.png` for elite specializations |

Combat logs go to
`Documents/Guild Wars 2/addons/arcdps/arcdps.cbtlogs/` by default
(configurable), grouped per encounter — see the
[EVTC log format](/reference/evtc-format/#where-logs-are-written) page.

### Crash handling

**Binary evidence**: arcdps installs an unhandled-exception filter —
"Intercepted unhandled exception in GW2 process. Game will terminate
when this box is closed" — and writes a structured report (exception
code/address, game build, map and position, OS version, CPU, RAM, GPU,
VRAM, driver version) to `arcdps.log`/`arcdps_lastcrash.log`. The
crash dialog is shown via the
[`c_exceptionerrormsg`](/reference/extension-api/extension-registry/#c_exceptionerrormsg--rundll32-crash-dialog-entry-point)
rundll32 entry point. An INI-facing option can skip the handler when
the game build matches a known-crashing value ("Skip arc crash handler
if value matches game build number"), and `ueh_filter` appears among
the INI keys.

## Using it

From the official site:

> by default, holding alt and shift is required for hotkeys, t is the
> hotkey for options.
> right click on windows to bring up their context menu options if
> available.

## Settings storage (`arcdps.ini`)

The options UI writes to `arcdps.ini` in the config directory.
Extensions can locate the file via the
[`e0` export](/reference/extension-api/arcdps-exports/#e0--ini-path).
The key names below were extracted from the DLL's string table
(**binary evidence**; the INI schema is not officially documented, so
treat names as informative, not a stable API):

- **Session/behavior**: `safemode`, `session`, `log_max_scrollback`,
  `no_warn_nonessential_patterns`, `ignore_error_log`, `ueh_filter`
- **Window behavior**: `always_draw_windows`, `hide_in_combat`,
  `show_in_combat`, `hide_in_cinematic`, `movelock_altui`,
  `clicklock_altui`, `window_fastclose`, `font_size`, `font_raster`
- **Keys**: `global_mod1`, `global_mod2`, `global_hide`,
  `global_options`, `global_self`, `global_selfstats`,
  `global_selfskills`, `global_metrics`, `global_close`
- **Logging**: `boss_encounter_ids2`, `map_encounter_ids`,
  `map_encounter_ids_asblacklist`, `boss_encounter_path`,
  `boss_encounter_saving`, `boss_encounter_npc_dirs`,
  `boss_encounter_player_dirs`, `boss_encounter_savewvw`,
  `boss_encounter_savemap`, `boss_encounter_minsq`,
  `boss_encounter_maxsq`, `boss_encounter_pctsq`,
  `boss_encounter_minenemy`, `minimum_log_duration`,
  `minimum_log_duration_pve`, `minimum_log_duration_map`,
  `minimum_fight_duration`
- **Updates**: `check_version3`, `check_version3_beta`,
  `check_version3_ext`, `check_version3_lang`
- **Stats behavior**: `reset_on_partychange`, `reset_on_mapchange`,
  `wvwinactive`, `ignore_wvw_conditions_historical`,
  `disconnected_history_time`, `normalized_rolling_minutes`,
  `target_mb_usage`, `slowva`, `no_obl_combattext`, `no_obl_alltext`
- **Appearance**: `appearance_imgui_style192`,
  `appearance_imgui_colours192` (and `_180` variants from the
  pre-1.92 ImGui era), `appearance_arc_colours`,
  `appearance_proft_colours`, `appearance_profb_colours`,
  `appearance_sqt_colours`, `appearance_sqb_colours`, plus per-panel
  `panel_*` keys

The logging keys map directly onto the
["why wasn't my log saved"](/reference/evtc-format/#when-a-log-is-not-saved)
diagnostics.

## Troubleshooting

From the official site's "something isn't working" section, condensed:

- Check `<GW2 dir>/addons/arcdps/` for `arcdps.log` or
  `arcdps_lastcrash.log`.
- Nothing draws → check the DLL name and placement.
- Crashes at character select or "image modified" errors → another
  overlay app is interfering; repair the client, remove all arcdps
  extensions and chainloads, and try to reproduce.
- Hotkeys not working → another app may hold a global hook.
- File-creation errors → missing read/write permission on the
  directories above.
- Known issues and support: the Elite Insights Discord
  (`https://discord.gg/RaZ5myp`).

## See also

- [Getting Started](/getting-started/) — the extension developer's
  entry point.
- [Ecosystem](/guides/ecosystem/) — parsers, uploaders, and notable
  extensions.
- [EVTC log format](/reference/evtc-format/) — what's inside the logs
  arcdps writes.
