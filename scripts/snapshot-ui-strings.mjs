// Extract a de-noised inventory of arcdps' in-game UI from the DLL string pool:
// arcdps.ini config keys, ImGui element ids, and human-facing labels/tooltips.
// Sibling of snapshot-exports.mjs — same DLL, same "commit a snapshot, diff on
// each release" contract, so new/removed UI strings surface when arc updates.
//
// This reads only string literals. It does NOT decompile or reconstruct source.
// Every phrase it emits is arc describing its own UI; behavior still needs
// in-game confirmation before it lands on a page as fact (accuracy rule).

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { parseUiStrings } from './lib/parse-ui-strings.mjs';

const DLL = process.env.ARCDPS_DLL
  ?? '/var/mnt/data/SteamLibrary/steamapps/common/Guild Wars 2/addons/ArcDPS.dll';

const run = (args) =>
  execFileSync('strings', args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 })
    .split('\n');

// ASCII (8-bit) and UTF-16LE pools — arc's tooltips are ASCII, its config keys
// are wide; take both.
const ascii = run(['-a', '-n', '3', DLL]);
const wide = run(['-a', '-el', '-n', '3', DLL]);
const lines = [...new Set([...ascii, ...wide])];

const { configKeys, elementIds, uiText } = parseUiStrings(lines);

// Best-effort version string (VS_VERSION_INFO, e.g. 1.2026.718.905).
let dllVersion = '';
const hit = wide.find((l) => /^\d+\.\d{4}\.\d{2,4}\.\d{2,4}$/.test(l.trim()));
if (hit) dllVersion = hit.trim();

const snapshot = {
  dllVersion,
  generatedFrom: 'strings -a (ASCII + UTF-16LE)',
  note: 'Extracted UI string literals only; not decompiled source. Confirm behavior in-game before documenting as fact.',
  counts: {
    configKeys: configKeys.length,
    elementIds: elementIds.length,
    uiText: uiText.length,
  },
  configKeys,
  elementIds,
  uiText,
};

writeFileSync(
  new URL('../data/arcdps-ui-strings.json', import.meta.url),
  JSON.stringify(snapshot, null, 2) + '\n',
);
console.log(
  `Wrote UI-string snapshot (version: ${dllVersion || 'unknown'}): ` +
  `${configKeys.length} config keys, ${elementIds.length} element ids, ${uiText.length} UI strings.`,
);
