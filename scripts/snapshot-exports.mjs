import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { parseExports } from './lib/parse-exports.mjs';

const DLL = process.env.ARCDPS_DLL
  ?? '/var/mnt/data/SteamLibrary/steamapps/common/Guild Wars 2/addons/ArcDPS.dll';

const objdump = execFileSync('objdump', ['-p', DLL], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const exports = parseExports(objdump);

// Version string from the DLL, best-effort; empty if strings/grep unavailable.
let dllVersion = '';
try {
  const strings = execFileSync('strings', [DLL], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const hit = strings.split('\n').find((l) => /^EVTC\d{8}$/.test(l));
  if (hit) dllVersion = hit;
} catch { /* strings optional */ }

const snapshot = { dllVersion, generatedFrom: 'objdump -p', exports };
writeFileSync(new URL('../data/arcdps-exports.json', import.meta.url), JSON.stringify(snapshot, null, 2) + '\n');
console.log(`Wrote ${exports.length} exports (version: ${dllVersion || 'unknown'}).`);
