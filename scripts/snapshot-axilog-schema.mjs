// Snapshot axilog's docs/NATIVE-FORMAT.md into data/axilog-native-format.md.
//
// This is the fetch-and-commit half of the axilog schema page (the build half
// is scripts/build-axilog-schema.mjs). Same shape as snapshot-exports.mjs:
// the network/tooling step runs by hand and commits its result, so `npm run
// build` stays offline and deterministic.
//
// The ref is a PINNED COMMIT SHA in data/axilog-source.json, not a branch.
// Pointing at `main` would silently republish unreleased schema changes on
// the next deploy; bumping the sha is a reviewed one-line diff instead.
//
// Refresh:
//   npm run snapshot-axilog-schema                    # fetch the pinned ref
//   AXILOG_REF=<sha> npm run snapshot-axilog-schema   # and move the pin
//   AXILOG_REPO=../axilog npm run snapshot-axilog-schema   # local checkout
//
// AXILOG_REPO reads from a local clone instead of GitHub, for bootstrapping
// a commit that has not been pushed yet. It still records the pinned ref, so
// re-running against GitHub afterwards must produce a byte-identical file.

import { readFileSync, writeFileSync } from 'node:fs';

const CONFIG = new URL('../data/axilog-source.json', import.meta.url);
const OUT = new URL('../data/axilog-native-format.md', import.meta.url);

const config = JSON.parse(readFileSync(CONFIG, 'utf8'));
const ref = process.env.AXILOG_REF ?? config.ref;
const local = process.env.AXILOG_REPO;

let body;
if (local) {
  body = readFileSync(new URL(`${local.replace(/\/$/, '')}/${config.path}`, `file://${process.cwd()}/`), 'utf8');
  console.log(`Read ${config.path} from local checkout ${local}.`);
} else {
  const url = `https://raw.githubusercontent.com/${config.repo}/${ref}/${config.path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  }
  body = await res.text();
  console.log(`Fetched ${url}`);
}

if (!body.includes('Native format')) {
  throw new Error(`${config.path} does not look like the native-format reference — refusing to snapshot`);
}

// Provenance rides in the file itself rather than a sibling JSON so the
// snapshot is self-describing and a stale one is obvious in a diff. No
// timestamp: it would churn the file on every re-run and tell you nothing
// the ref does not.
const header = [
  '<!--',
  `  repo: ${config.repo}`,
  `  ref: ${ref}`,
  `  path: ${config.path}`,
  `  describes: ${config.describes}`,
  '',
  '  Snapshotted by scripts/snapshot-axilog-schema.mjs. Do not edit — edit',
  '  the source file in the axilog repo and re-snapshot.',
  '-->',
  '',
].join('\n');

writeFileSync(OUT, header + body);
console.log(`Wrote data/axilog-native-format.md (${body.length} bytes) at ${ref.slice(0, 12)}.`);

if (ref !== config.ref) {
  writeFileSync(CONFIG, JSON.stringify({ ...config, ref }, null, 2) + '\n');
  console.log(`Moved the pin: ${config.ref.slice(0, 12)} -> ${ref.slice(0, 12)}.`);
}
