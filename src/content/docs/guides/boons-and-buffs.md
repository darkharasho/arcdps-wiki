---
title: Boons, buffs & uptime
description: Tracking buff applications and removals in EVTC logs — the classic sc0 encoding, remove kinds, BUFFINITIAL, and how the newer BUFFAPPLY statechanges fit in.
source: community
---

Boon uptime — how much Might, Stability, Protection a squad keeps up —
is the second question every log tool answers after damage. The raw
material is buff apply and remove events, and there are two
generations of encoding for them, so a parser's first job is knowing
which one its log uses. Values below were observed in a real
revision-1 WvW `.zevtc` log (arcdps build 20260114) inspected while
writing this page; layouts are on the
[cbtevent](/reference/data-structures/cbtevent/) and
[statechange payloads](/reference/enums/statechange-payloads/) pages.

## The classic encoding (`is_statechange == 0`)

In the test log, all buff traffic used ordinary combat events with
`buff == 1`, discriminated by two fields:

**Applications** — `is_buffremove == 0`, duration in `value` (ms),
`buff_dmg == 0`. `src_agent` applies the stack to `dst_agent`,
`skillid` is the buff. Observed top applications, names from the
log's own skill table:

| Skill id | Name | Applications | Median duration |
| --- | --- | --- | --- |
| 740 | Might | 2,974 | 8,000 ms |
| 738 | Vulnerability | 1,956 | 5,166 ms |
| 1122 | Stability | 1,801 | 6,914 ms |
| 737 | Burning | 1,121 | 2,545 ms |
| 873 | Resolution | 880 | 2,298 ms |
| 725 | Fury | 759 | 4,000 ms |
| 718 | Regeneration | 704 | 5,215 ms |
| 717 | Protection | 535 | 4,928 ms |

(The single busiest buff was actually a relic proc — "Relic of the
Monk", 9,822 applications at 1 ms median — real logs are noisy with
trait/relic micro-buffs, so filter to the buffs you care about.)

**Removals** — `is_buffremove != 0`, of
[`enum cbtbuffremove`](/reference/enums/#cbtbuffremove-buff-remove-type).
Observed: 26,353 removal events — 5,399 `CBTB_ALL` (1), 11,329
`CBTB_SINGLE` (2), 9,625 `CBTB_MANUAL` (3). The `MANUAL` kind is
synthesized by arcdps itself on all-stack removal ("created by arc on
all-stack-remove"), so **don't count `ALL` and its accompanying
`MANUAL` events as separate removals** — that double-counts.

**Not damage** — buff *damage* ticks share `buff == 1` but have
`value == 0` and the damage in `buff_dmg`; see
[reading damage](/guides/reading-damage/). The three-way split is:

| `value` | `buff_dmg` | `is_buffremove` | Event is |
| --- | --- | --- | --- |
| duration | 0 | 0 | application |
| duration removed | (kind-dependent) | 1–3 | removal |
| 0 | damage | 0 | damage tick |

## Pre-existing buffs — `CBTS_BUFFINITIAL` (18)

Buffs already on an agent when logging starts arrive as
[`CBTS_BUFFINITIAL`](/reference/enums/statechange-payloads/#cbts_buffinitial-18)
statechange events (same shape as an application, plus the stack's
original duration in `buff_dmg`). Seed your tracker with these or
every fight starts with phantom-zero boons.

## Buff metadata — `CBTS_BUFFINFO` (30)

Stacking behavior isn't in the apply events.
[`CBTS_BUFFINFO`](/reference/enums/statechange-payloads/#cbts_buffinfo-30--buff-metadata)
carries each buff's max combined duration, stacking limit, and
category — and logs always include it for a fixed list of common
boons/conditions (the
[always-included buff-formula skills](/reference/encounter-ids/#always-included-buff-formula-skills)).
Whether a buff stacks in intensity (Might, up to 25 stacks) or in
duration (Protection) changes how applications translate to uptime,
so read the metadata rather than hardcoding.

## The newer encoding — `CBTS_BUFFAPPLY` (69) and friends

The current official EVTC notes also document dedicated statechanges:
[`CBTS_BUFFAPPLY` (69)](/reference/enums/statechange-payloads/#cbts_buffapply-69--buff-stack-application),
`CBTS_BUFFCHANGE` (70), and
[`CBTS_BUFFREMOVE_SINGLE` (71) / `CBTS_BUFFREMOVE_ALL` (72)](/reference/enums/statechange-payloads/#cbts_buffremove_single-71--cbts_buffremove_all-72),
which carry a trackable id for following an individual stack. The
build-20260114 test log contained **zero** events of types 69–72 —
its buff traffic was entirely classic-encoded — so parsers handling
logs across builds need to accept both encodings. (When the crossover
happened is not documented in the official notes; detect by presence
rather than by build number.)

## Computing uptime

The standard recipe, per agent per buff:

1. Seed active stacks from `BUFFINITIAL` events.
2. On application: add a stack with its `value` duration (capped by
   the buff's stacking limit from `BUFFINFO`).
3. On removal: `SINGLE` ends one stack, `ALL` clears them (skip the
   redundant `MANUAL` events that follow an `ALL`).
4. Uptime = time with ≥1 active stack ÷ fight duration (from the
   [squad-combat timestamps](/guides/log-timing/)); for
   intensity-stacking buffs like Might, average the stack count
   instead.

Community parsers (Elite Insights being the reference
implementation) add simulation details beyond this — duration
extensions, overstack tracking via `overstack_value` — but the four
steps above are the load-bearing structure.
