// scripts/check-build.mjs
// Change detector for the auto-update pipeline. Polls the ~50-byte md5sum
// file; downloads the DLL only when the md5 differs from the committed
// data/arcdps-build.json (missing file = bootstrap = treated as changed).
// Never HEAD the DLL URL — the server hangs on HEAD requests.
//
// Outputs (stdout always; $GITHUB_OUTPUT when set):
//   changed=true|false
//   dll_path=<tmp path>      (only when changed)
//   dll_version=<VS version> (only when changed)

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMd5Sum, extractDllVersion } from './lib/check-build-core.mjs';

const MD5_URL = 'https://www.deltaconnected.com/arcdps/x64/d3d11.dll.md5sum';
const DLL_URL = 'https://www.deltaconnected.com/arcdps/x64/d3d11.dll';
const BUILD_FILE = fileURLToPath(new URL('../data/arcdps-build.json', import.meta.url));
const dryRun = process.argv.includes('--dry-run');

const setOutput = (key, value) => {
  console.log(`${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
};

const md5Res = await fetch(MD5_URL);
if (!md5Res.ok) throw new Error(`md5sum fetch failed: HTTP ${md5Res.status}`);
const advertised = parseMd5Sum(await md5Res.text());

const known = existsSync(BUILD_FILE)
  ? JSON.parse(readFileSync(BUILD_FILE, 'utf8')).md5
  : null;

if (advertised === known) {
  console.log(`up to date (${advertised})`);
  setOutput('changed', 'false');
  process.exit(0);
}

const dllRes = await fetch(DLL_URL);
if (!dllRes.ok) throw new Error(`DLL fetch failed: HTTP ${dllRes.status}`);
const buf = Buffer.from(await dllRes.arrayBuffer());
const actual = createHash('md5').update(buf).digest('hex');
if (actual !== advertised) {
  throw new Error(`md5 mismatch: advertised ${advertised}, downloaded ${actual} — torn download or stale md5sum, aborting`);
}

const dllPath = join(tmpdir(), 'arcdps-d3d11.dll');
writeFileSync(dllPath, buf);

const wide = execFileSync('strings', ['-a', '-el', '-n', '3', dllPath], {
  encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
}).split('\n');
const dllVersion = extractDllVersion(wide);

if (!dryRun) {
  const record = { md5: advertised, dllVersion, updatedAt: new Date().toISOString().slice(0, 10) };
  writeFileSync(BUILD_FILE, JSON.stringify(record, null, 2) + '\n');
}

console.log(`new build ${dllVersion || '(no version string)'} md5 ${advertised}${dryRun ? ' [dry-run: not recorded]' : ''}`);
setOutput('changed', 'true');
setOutput('dll_path', dllPath);
setOutput('dll_version', dllVersion);
