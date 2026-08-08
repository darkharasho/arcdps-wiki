import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return out;
    throw err;
  }
  for (const entry of entries) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.mdx?$/.test(p)) out.push(p);
  }
  return out;
}

// Collect symbols from each page's `exportSymbols:` frontmatter array.
export function collectDocumentedExports(dir) {
  const symbols = new Set();
  for (const file of walk(dir)) {
    const text = readFileSync(file, 'utf8');
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) continue;
    const block = fm[1].match(/exportSymbols:\s*\n((?:\s*-\s*\S+\n?)+)/);
    if (!block) continue;
    for (const m of block[1].matchAll(/-\s*(\S+)/g)) symbols.add(m[1]);
  }
  return symbols;
}
