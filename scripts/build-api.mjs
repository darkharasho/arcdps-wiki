// Generate the static developer data API from the canonical source in
// data/wvw.json. Runs before `astro build` (see package.json) so every
// deploy regenerates the endpoints from one source of truth — extensions
// fetch these instead of hardcoding id mappings across projects.
//
// Output (copied verbatim into dist/ by Astro's public/ handling):
//   public/api/index.json      — endpoint directory
//   public/api/wvw/teams.json  — team id -> colour (+ reverse index)
//   public/api/wvw/maps.json   — WvW map ids
//
// Deterministic: the `generated` date comes from data/wvw.json, not the
// clock, so rebuilds produce byte-identical output.

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const src = JSON.parse(
  readFileSync(new URL('../data/wvw.json', import.meta.url), 'utf8'),
);

const outDir = new URL('../public/api/', import.meta.url);
const wvwDir = new URL('../public/api/wvw/', import.meta.url);
mkdirSync(wvwDir, { recursive: true });

const write = (url, obj) =>
  writeFileSync(url, JSON.stringify(obj, null, 2) + '\n');

// --- teams: grouped colours + a flat id -> colour reverse index ---
const byTeamId = {};
for (const [colour, ids] of Object.entries(src.teams.colors)) {
  for (const id of ids) {
    if (byTeamId[id]) {
      throw new Error(`team id ${id} is in both ${byTeamId[id]} and ${colour}`);
    }
    byTeamId[id] = colour;
  }
}
write(new URL('teams.json', wvwDir), {
  meta: src.meta,
  source: src.teams.source,
  verified: src.teams.verified,
  disclaimer: src.teams.disclaimer,
  colors: src.teams.colors,
  byTeamId,
});

// --- maps ---
write(new URL('maps.json', wvwDir), {
  meta: src.meta,
  source: src.maps.source,
  verified: src.maps.verified,
  maps: src.maps.entries,
});

// --- endpoint directory ---
write(new URL('index.json', outDir), {
  meta: src.meta,
  endpoints: {
    'wvw/teams': {
      url: '/api/wvw/teams.json',
      description: 'WvW team id -> colour (red/blue/green), community-maintained',
    },
    'wvw/maps': {
      url: '/api/wvw/maps.json',
      description: 'WvW map id -> name/role (from the official GW2 API)',
    },
  },
});

const teamCount = Object.keys(byTeamId).length;
const mapCount = Object.keys(src.maps.entries).length;
console.log(`Wrote data API: ${teamCount} team ids, ${mapCount} map ids.`);
