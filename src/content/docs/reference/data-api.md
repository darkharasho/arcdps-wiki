---
title: Data API
description: Small static JSON endpoints serving arcdps/WvW id mappings — team-id-to-colour and WvW map ids — so extensions can fetch them instead of hardcoding.
source: community
---

WvW team ids and map ids are the kind of mapping every WvW tool ends up
hardcoding — and then re-hardcoding in the next project, and updating by
hand when the ids drift. This site serves them as small static JSON
endpoints so you can fetch one canonical copy instead.

They're plain static files (no server, no rate limit, cached at the
edge) with `Access-Control-Allow-Origin: *`, so you can fetch them from
anywhere — a browser tool, an addon updater, a build step.

## Endpoints

| Endpoint | Contents |
| --- | --- |
| [`/api/index.json`](/api/index.json) | Directory of available endpoints |
| [`/api/wvw/teams.json`](/api/wvw/teams.json) | WvW team id → colour (red/blue/green) |
| [`/api/wvw/maps.json`](/api/wvw/maps.json) | WvW map id → name/role |

Base URL: `https://arcdps.axi.link`.

## `wvw/teams.json`

Team id → colour, both grouped and as a flat reverse index. The
mapping is **community-maintained and unofficial** — the payload
carries a `disclaimer` field saying so, and ids do change (e.g. around
World Restructuring). When a log contains a
[`CBTS_WVWTEAMS` (74)](/reference/enums/statechange-payloads/#cbts_wvwteams-74)
event, prefer it; treat unknown ids as "unknown team", not an error.
Background: [WvW team colors in logs](/guides/wvw-team-colors/).

```json
{
  "source": "community (WvW-Fight-Analysis addon defaults)",
  "verified": "2026-08-10",
  "disclaimer": "… prefer CBTS_WVWTEAMS when present …",
  "colors": { "red": [697, 699, …], "blue": [432, 433, …], "green": [39, …] },
  "byTeamId": { "697": "red", "432": "blue", "39": "green", … }
}
```

```js
const teams = await (await fetch("https://arcdps.axi.link/api/wvw/teams.json")).json();
const colour = teams.byTeamId[String(teamId)] ?? "unknown";
```

## `wvw/maps.json`

WvW map id → name and role. These are game map ids sourced from the
official GW2 API (`v2/maps`). Background:
[WvW maps in logs](/guides/wvw-maps/).

```json
{
  "source": "official GW2 API (v2/maps)",
  "verified": "2026-08-09",
  "maps": {
    "38":   { "name": "Eternal Battlegrounds", "role": "center" },
    "95":   { "name": "Alpine Borderlands",    "role": "green-home" },
    "1099": { "name": "Desert Borderlands",    "role": "red-home" }
  }
}
```

```js
const { maps } = await (await fetch("https://arcdps.axi.link/api/wvw/maps.json")).json();
const map = maps[String(mapId)];   // { name, role } or undefined
```

## Notes for consumers

- **Cache**: responses send `Cache-Control: public, max-age=3600`.
  Don't poll tighter than that; the data changes on the order of GW2
  balance patches and matchup restructures, not minutes.
- **Stability**: every payload includes a `meta.generated` date and a
  per-dataset `verified` date. New ids are added over time; existing
  keys are not renamed. Read defensively (`?? "unknown"`), because the
  team table in particular is not exhaustive.
- **Source of truth**: these files are generated at build time from
  [`data/wvw.json`](https://github.com/darkharasho/arcdps-wiki/blob/main/data/wvw.json)
  in the wiki repo. Spot a wrong or missing id?
  [Open a PR or issue](/contributing/) against that one file and the
  endpoints update on the next deploy.

## See also

- [WvW team colors in logs](/guides/wvw-team-colors/)
- [WvW maps in logs](/guides/wvw-maps/)
- [Contributing](/contributing/) — how to fix or extend the data
