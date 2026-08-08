---
title: Encounter IDs
description: The NPC species ids arcdps uses to start boss logs, secondary target ids, and the always-included buff-formula skill list.
source: official-docs
---

The official EVTC documentation
(`https://www.deltaconnected.com/arcdps/evtc/README.txt`, fetched
2026-08-08) ends with three reference lists that parsers and log
tooling need: the species ids that trigger boss logs, the secondary
target ids, and the buff skill ids whose
[`CBTS_BUFFINFO`/`CBTS_BUFFFORMULA`](/reference/enums/statechange-payloads/#cbts_buffinfo-30--buff-metadata)
metadata is always written to logs. They are reproduced here.

Two special values appear in the [EVTC header](/reference/evtc-format/#header-16-bytes)
instead of a species id: `1` marks a WvW log and `2` marks a map log.

## Log-starting bosses (`characters[]`)

"npcs that get used for starting logs" — when the first damage event
hits one of these species ids, it becomes the log's boss.

### Raids

| Species id | Encounter |
| --- | --- |
| 15438 | Vale Guardian |
| 15429 | Gorseval |
| 15375 | Sabetha |
| 16123 | Slothasor |
| 16088 | Berg (Bandit Trio) |
| 16115 | Matthias |
| 16253 | McLeod (Escort) |
| 16235 | Keep Construct |
| 16247 | Twisted Castle |
| 16246 | Xera (100–50%) |
| 17194 | Cairn |
| 17172 | Mursaat Overseer |
| 17188 | Samarog |
| 17154 | Deimos |
| 19767 | Soulless Horror |
| 19828 | River of Souls ("rainbow road") |
| 19691 / 19536 / 19844 | Statues of Grenth |
| 19450 | Dhuum |
| 21105 | Nikare (Twin Largos) |
| 20934 | Qadim |
| 21964 | Sabir |
| 22006 | Adina |
| 22000 | Qadim the Peerless |
| 26725 | Greer |
| 26774 | Decima |
| 26867 | Decima CM |
| 26712 | Ura |

### Fractals

| Species id | Encounter |
| --- | --- |
| 17021 | MAMA |
| 17028 | Siax |
| 16948 | Ensolyss |
| 17632 | Skorvald |
| 17949 | Artsariiv |
| 17759 | Arkk |
| 23254 | Sorrowful Spellcaster (Ai) |
| 25577 | Kanaxai |
| 26231 | Eparch |
| 27010 | Whispering Shadow |

### Strikes

| Species id | Encounter |
| --- | --- |
| 22154 | Icebrood Construct |
| 22343 | Voice of the Fallen (Kodan) |
| 22492 | Fraenir of Jormag |
| 22521 | Boneskinner |
| 22711 | Whisper of Jormag |
| 24033 | Mai Trin |
| 23957 | Ankka |
| 24485 | Minister Li |
| 24266 | Minister Li CM |
| 25413 / 25414 | Old Lion's Court (NM / CM) |
| 25705 | Dagda |
| 25989 | Cerus |

### Golems and special

| Species id | Encounter |
| --- | --- |
| 16199 | Standard Kitty Golem |
| 16177, 16198, 16178, 16202, 16169, 16176, 16174, 19645, 19676 | other training-area golems |
| 21333 | Freezie (Wintersday) |

## Secondary targets (`characters_secondary[]`)

"npcs that get used for vs target dps" — additional agents counted for
target-DPS stats, e.g. 15434 (Gorseval's charged soul), Sabetha's adds
(15372, 15404, 15430), 16286 (Xera 50–0%), Kenut 21089 (Twin Largos),
Mai Trin / Minister Li phantoms and lieutenants, observatory flux
anomalies, and Lonely Tower fractal adds (Cruelty 26270, Judgement
26260). The source list also contains commented-out entries marking
targets deliberately *not* counted — consult the README directly when
you need the exact current set.

## Always-included buff-formula skills

`CBTS_BUFFINFO` / `CBTS_BUFFFORMULA` events are always written for
this skill-id mask, so logs can reconstruct common buff behavior
without the buff needing to appear organically:

| Skill id | Buff |
| --- | --- |
| 717 | Protection |
| 718 | Regeneration |
| 719 | Swiftness |
| 723 | Poison |
| 725 | Fury |
| 726 | Vigor |
| 736 | Bleeding |
| 738 | Vulnerability |
| 740 | Might |
| 742 | Weakness |
| 861 | Confusion |
| 873 | Resolution |
| 1187 | Quickness |
| 19426 | Torment |
| 30328 | Alacrity |
| 42883 | Kalla's Fervor |

The mask also includes these ids, listed without names in the source:
9162, 9759, 9774, 9776, 9779, 9784, 9788, 9792, 10004, 10231, 10233,
12518, 13061, 14444, 14458, 14459, 15788, 15790, 17825, 25879, 29025,
29466, 36406, 43499, 44871, 46273, 51683, 53222, 62733.

## Finding ids in-game

From the official site: the NPC id for a PvE log "can be found via
detail window and noting species in window title, or tooltip in target
list after attacking." Additional boss ids and map ids can be added in
the arcdps logging options (**binary evidence**, build
`1.2026.718.905`: "Additional boss IDs", "Map ID can be found in the
metrics window tooltip", and a blacklist mode — "Log all instance maps
except those on the map ID list").

## See also

- [EVTC log format](/reference/evtc-format/) — where the boss species
  id lands in the file header.
- [Statechange payloads](/reference/enums/statechange-payloads/) —
  `CBTS_BUFFINFO`, `CBTS_BUFFFORMULA`, `CBTS_LOGNPCUPDATE`.
