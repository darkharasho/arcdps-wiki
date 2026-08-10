// scripts/auto-update.mjs
// Local/venus entry point mirroring the auto-update workflow: detect a new
// build, refresh both snapshots from the downloaded DLL, record history.
// Leaves changes uncommitted for a human (or the workflow) to commit.

import { execFileSync } from 'node:child_process';

const run = (args, env = {}) =>
  execFileSync('node', args, { stdio: 'inherit', env: { ...process.env, ...env } });

const checkOut = execFileSync('node', ['scripts/check-build.mjs'], { encoding: 'utf8' });
process.stdout.write(checkOut);

if (!/^changed=true$/m.test(checkOut)) process.exit(0);

const dllPath = checkOut.match(/^dll_path=(.+)$/m)?.[1];
if (!dllPath) throw new Error('check-build reported a change but no dll_path');

run(['scripts/snapshot-exports.mjs'], { ARCDPS_DLL: dllPath });
run(['scripts/snapshot-ui-strings.mjs'], { ARCDPS_DLL: dllPath });
run(['scripts/build-history.mjs']);
console.log('auto-update: snapshots and history refreshed; review `git status` and commit.');
