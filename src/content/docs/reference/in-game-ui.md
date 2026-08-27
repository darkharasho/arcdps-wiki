---
title: In-game UI reference
description: An inventory of arcdps' in-game windows, stat columns, and options — extracted from the DLL's string literals and awaiting in-game confirmation.
source: community
---

arcdps' developer notes document the EVTC format and the extension API,
but say almost nothing about the **in-game UI** — the options window,
the stat columns, and the years of accumulated toggles. arc's own
author put it plainly: *"those are the easy parts… it's all the in-game
UI things I've added over the years that at this point even I don't
know about."*

This page is a first pass at that gap. It is built by **extracting the
string literals** compiled into the arcdps DLL — labels, tooltips, and
internal element ids — **not** by decompiling or reconstructing source.
Everything here is arc describing its own UI, in its own words.

:::caution[Status: extracted, unconfirmed]
Every entry on this page was pulled from the DLL string table
(build **1.2026.816.1149**) and has **not yet been confirmed in-game**.
A string tells you a feature exists and, where a tooltip was found,
what arc says it does — but not which panel it lives in, its exact
behavior, or its edge cases. Treat everything here as a lead to verify,
not settled fact. Rows confirmed against the running addon will be
marked **[verified]**; until then, assume unconfirmed.

Extraction is reproducible: `npm run snapshot-ui-strings` writes
`data/arcdps-ui-strings.json`, and the raw inventory (86 config keys,
112 element ids, 318 UI strings) lives there.
:::

## The options window

The DLL's ImGui element ids expose a tab structure. The following
tab grouping is **inferred from the `tb…` id prefixes** and needs
in-game confirmation:

| Inferred tab | Element id(s) |
| --- | --- |
| Logging | `tblogging`, `tblogmain` |
| Windows | `tbwindows` |
| Interface | `tbinterface` |
| Extras | `tbextras` |
| Filter | `tbfilter` |
| Style (with sub-tabs) | `tbstylestyle`, `tbstylearc`, `tbstylearea`, `tbstylebuffs`, `tbstylegraphs`, `tbstyleprof`, `tbstylesquad`, `tbstylepre` |

The content panels arc renders (from `area…`/`…list` ids): a stats
list (`areastatslist`), buffs list (`areabuffslist`), graphs list
(`areagraphslist`), player list (`areaplist`), plus skill, extension,
squad, and subgroup-hide lists (`skillslist`, `extenslist`, `sqlist`,
`subhidelist`) and a log filter/message pane (`logfilter`,
`logmessages`).

## Stat columns and their definitions

The highest-value extraction: arc's own tooltip text defining what
each stat column measures. Quoted **verbatim** from the DLL.

### Contribution & down/kill stats

| Column | arc's tooltip (verbatim) |
| --- | --- |
| Contribution damage ratio | "Sum of damage contributions divided by total damage" |
| Downs damage contribution | (label; see "Damage since 2 seconds before target dropped below full health") |
| Downs crowd control contribution | "Crowd control count since 2 seconds before target dropped below full health" |
| Downs strips contribution | "Strips since 2 seconds before target dropped below full health" |
| Downs movement slow contribution | "Active movement impairing buff time since 2 seconds before target dropped below full health" |
| Kills damage contribution | "Damage since 2 seconds before target dropped below full health" (label: *Only requires player damage*) |
| Damage while target was down | (label) |

The recurring phrase **"since 2 seconds before target dropped below
full health"** is arc's window for attributing a down — it credits
contribution starting 2 s before the target first left full health,
not from the down itself. This is the kind of semantic that appears
nowhere in the official notes.

### Defiance & crowd control

| Column | arc's tooltip (verbatim) |
| --- | --- |
| Defiance damage | "Damage to defiance bars only. Excludes loss-of-control effects" |
| Crowd control count | "Sum of loss-of-control effects. Excludes defiant, defiance bars, and blocked" |

### Missiles

| Column | arc's tooltip (verbatim) |
| --- | --- |
| Missile launch to hit ratio | "(tooltip: skill misses)" |
| Incoming missile launch to hit ratio | "(tooltip: skill misses)" |
| Missile effectiveness / Incoming missile effectiveness | (labels) |
| Missile friendly fire | (label) |

### Cleave, strips, cleanses, resurrects

Extracted column labels (no tooltip found unless quoted):
*Outgoing strips on enemies*, *Outgoing cleanses on allies*,
*strip in* / *strip out*, *cleanse in* / *cleanse out*, *cleave* /
*cleave bar*, *Resurrect activations*, *resurrect count* /
*resurrect time*, *Times downed*, *Time between downing*,
*Time spent not dead or down*.

## Column value modes

Several stats can be displayed in different modes — extracted labels:

- **As volume**: *as volume applied*, *as volume on squad*, *on
  subgroup*, *on friendly*, *on enemy*
- **As percentage**: *as percentage of hits*, *as percentage casting*,
  *as percentage polled*
- **Hit filters**: *hits (all)*, *hits (damage)*, *hits (not-aoe)*,
  *average all hits*
- **Nominal caps**: *limit in to nominal (minimum)* / *(maximum)*,
  *1 / 5 / 10 target nominal*
- **Uptime**: "Calculate as uptime percentage instead of average",
  "Calculate ignoring buff active flag"

## Normalized & current-fight stats

arc distinguishes *current fight* from *normalized* rolling stats, with
these verbatim tooltips:

- *Current fight*: "from first player combat enter to last player
  combat exit"
- *Normalized*: "accumulated per-player individually, reset as per
  interface options"
- "Minutes. Applies to normalized stats only" (the
  `normalized_rolling_minutes` window)
- "Seconds. Applies to current fight stats only"
- "Seconds. Shared between fight and logging configuration"

## Title-bar variables

arc's stats windows support title-bar format variables. Extracted:

- "Variables 1-5 use current fight values only"
- "Variables can be found in the checkbox tooltip for each stat"
- Column-template strings like `@5: squad combat time`,
  `@7: combat time for self`, `@3: cleave percent of total`,
  `@6: target percent of total` — the `@N:` variable definitions.
- "Stats window ID is displayed in title bar" / "Must use ID lower…"
- "Buffs window ID is displayed in title bar"

## Window & display options

Extracted toggles (arc's label text). Behavior unconfirmed:

- **Visibility**: *hide windows during combat*, *…out of combat*,
  *…during cinematics*, *always draw windows*, *esc closes windows*,
  *close window*, *hide close button in title bar*
- **Interaction**: *clicking windows requires modifiers*, *moving
  windows requires modifiers*, *slow worldstep when window inactive*
- **Layout**: *window width*, *window minimum height*, *window
  padding*, *bar padding*, *window relative position*, *from anchor
  window corner*, *combine bars across windows*
- **Roster display**: *Hide player*, *Hide professions*, *Hide
  subgroups*, *profession icons* / *profession text*, *replace player
  with account name*, *use unique player colours*, *use subgroup for
  bar colour* / *name colour*, *use red names for players loading*
- **Privacy**: "Hides player names and colours. Disables…" (label
  *Disabled on out-of-party agents*)

Build **1.2026.816.1149** (2026-08-26) added five element ids and one
tooltip in this area: `panelcopy` / `panelpaste` with the tooltip
"Paste window configuration" — copying one window's configuration onto
another — and `buffsvis` / `chclivis` / `squadvis`, which by their `…vis`
naming look like per-window visibility controls for the buffs, chat-cli,
and squad windows. All unconfirmed in-game, like everything else here;
see the [build history](/reference/build-history/) for the diff.

## Logging options

Many logging controls overlap the `arcdps.ini` keys already documented
on the [installation & files](/guides/installation-and-files/#settings-storage-arcdpsini)
page and the ["why wasn't my log saved"](/reference/evtc-format/#when-a-log-is-not-saved)
diagnostics. Extraction adds arc's own tooltips for a few:

- *save boss logs* / *save map logs* / *save wvw logs*, *save logs to:*
- "Must be enabled prior to squad entering combat to log"
- "Must be enabled prior to entering instance to log"
- "Map ID can be found in the metrics window tooltip. Logging will
  not…" and "No maps are logged by default, ID can be found in metrics
  window tooltip."
- "Log all instance maps except those on the map ID list" (the
  `map_encounter_ids_asblacklist` toggle)
- *minimum squad participants* / *maximum squad participants* /
  *percent squad participants* / *minimum enemy player participants*
- *ignore fights shorter than* / *ignore logs shorter than*, *end wvw
  fight when inactive after*

## How to help confirm these

Because everything here is unconfirmed, the useful next step is
in-game verification: open arc's options, find the labeled control,
and confirm what it does. Confirmed entries can be promoted to
**[verified]** with a note on which tab they live in. The extraction
also drops real strings (it filters aggressively to avoid keeping
library noise), so the in-game UI is a superset of this list — if you
find a control that isn't here, it's a genuine addition to document.

## See also

- [Ecosystem](/guides/ecosystem/) — tools built around arcdps
- [Installation, files & settings](/guides/installation-and-files/) —
  the `arcdps.ini` key list
- [Contributing](/contributing/) — the accuracy rule this page's
  "extracted, unconfirmed" tagging follows
