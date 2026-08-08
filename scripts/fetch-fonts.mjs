/**
 * Regenerate the self-hosted webfonts in public/fonts/ and src/styles/fonts.css.
 *
 * The site self-hosts its fonts so visitors never hit a third-party font CDN
 * (privacy) and so the render path has no extra DNS/TLS round-trip (performance).
 * This script re-fetches them from Google Fonts and rewrites the @font-face
 * stylesheet to point at the local copies.
 *
 * Run with: npm run fonts:fetch
 *
 * Both families are licensed under the SIL Open Font License 1.1, which permits
 * redistribution — see public/fonts/OFL.txt.
 */
import { writeFileSync, mkdirSync } from 'node:fs';

// Only latin subsets: this is an English-language technical reference.
const SUBSETS = ['latin', 'latin-ext'];
const SPEC =
  'https://fonts.googleapis.com/css2' +
  '?family=Barlow+Semi+Condensed:wght@500;600;700' +
  '&family=JetBrains+Mono:wght@400;500;600' +
  '&display=swap';

// Google serves woff2 only when the UA looks like a modern browser.
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const cssRes = await fetch(SPEC, { headers: { 'User-Agent': UA } });
if (!cssRes.ok) throw new Error(`Failed to fetch font CSS: ${cssRes.status}`);
const css = await cssRes.text();

// Each @font-face block is preceded by a `/* subset */` comment.
const blocks = css.split(/\/\* (?=[a-z-]+ \*\/)/).slice(1);

mkdirSync(new URL('../public/fonts/', import.meta.url), { recursive: true });

let out =
  '/* Self-hosted fonts (latin + latin-ext subsets, woff2).\n' +
  '   Source: Google Fonts; both families under the SIL Open Font License 1.1.\n' +
  '   Do not edit by hand — regenerate with: npm run fonts:fetch */\n\n';
let count = 0;

for (const block of blocks) {
  const subset = block.slice(0, block.indexOf('*/')).trim();
  if (!SUBSETS.includes(subset)) continue;

  const family = /font-family: '([^']+)'/.exec(block)[1];
  const weight = /font-weight: (\d+)/.exec(block)[1];
  const url = /url\((https:[^)]+\.woff2)\)/.exec(block)[1];
  const range = /unicode-range: ([^;]+);/.exec(block)[1];

  const file = `${family.toLowerCase().replace(/ /g, '-')}-${weight}-${subset}.woff2`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  writeFileSync(
    new URL(`../public/fonts/${file}`, import.meta.url),
    Buffer.from(await res.arrayBuffer()),
  );

  out +=
    `@font-face {\n` +
    `  font-family: '${family}';\n` +
    `  font-style: normal;\n` +
    `  font-weight: ${weight};\n` +
    `  font-display: swap;\n` +
    `  src: url('/fonts/${file}') format('woff2');\n` +
    `  unicode-range: ${range};\n` +
    `}\n\n`;
  count++;
}

if (count === 0) throw new Error('No matching font faces found — did the CSS format change?');

writeFileSync(new URL('../src/styles/fonts.css', import.meta.url), out);
console.log(`Wrote ${count} font files and src/styles/fonts.css.`);
