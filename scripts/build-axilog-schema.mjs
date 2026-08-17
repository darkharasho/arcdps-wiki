// Assemble src/content/docs/axilog/schema.md from the committed snapshot of
// axilog's docs/NATIVE-FORMAT.md plus this repo's two hand-written framing
// sections. Runs before `astro build`/`astro dev` (see package.json), so the
// page is regenerated on every build and cannot drift.
//
// Reads only committed files — no network, no clock — so rebuilds produce
// byte-identical output. Refreshing the snapshot is a separate, manual step:
// scripts/snapshot-axilog-schema.mjs.
//
// The output is gitignored. Editing it by hand is pointless; corrections to
// the generated middle belong in the axilog repo, and corrections to the
// framing belong in data/axilog-schema-page/.

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { buildPage } from './lib/axilog-schema-page.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const source = JSON.parse(read('../data/axilog-source.json'));
const snapshot = read('../data/axilog-native-format.md');
const intro = read('../data/axilog-schema-page/intro.md');
const eiSurface = read('../data/axilog-schema-page/ei-surface.md');

const page = buildPage({
  title: 'axilog output schema',
  description:
    "The axilog native report format 1.0 — its six top-level keys, the entity roster, " +
    'id-keyed catalogs and statistics blocks, the coverage map, the series envelope and ' +
    'combat replay, plus the Elite Insights compatibility surface behind --format ei-json.',
  snapshot,
  intro,
  eiSurface,
  source,
});

const outDir = new URL('../src/content/docs/axilog/', import.meta.url);
mkdirSync(outDir, { recursive: true });
writeFileSync(new URL('schema.md', outDir), page);

console.log(
  `Wrote src/content/docs/axilog/schema.md (${page.length} bytes) from ${source.path} @ ${source.ref.slice(0, 12)}.`,
);
