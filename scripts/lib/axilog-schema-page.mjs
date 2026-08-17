// Pure transforms for the axilog schema page.
//
// The page at /axilog/schema/ is NOT hand-written. Its body is axilog's own
// docs/NATIVE-FORMAT.md, snapshotted into data/axilog-native-format.md by
// scripts/snapshot-axilog-schema.mjs and assembled into a Starlight page by
// scripts/build-axilog-schema.mjs. That way the wiki cannot drift from the
// format it documents — which is exactly what happened to the previous
// hand-written version, which described the pre-1.0 schema for months after
// the 1.0 container shipped.
//
// Everything here is a pure string transform so tests/axilog-schema-page.
// test.ts can exercise it without network or filesystem.

/** Repo-relative paths that should become links to GitHub when they appear
 *  inside a code span. Anchored so `docs/foo.md` matches but a bare word
 *  like `crates` does not. */
const REPO_PATH = /^(?:docs\/[A-Za-z0-9._-]+\.md|crates\/[A-Za-z0-9._\-/]+\.(?:rs|toml|pyi|ts|txt))$/;

/** GitHub blob URL for a repo-relative path at a pinned ref. */
export function blobUrl({ repo, ref }, path) {
  return `https://github.com/${repo}/blob/${ref}/${path}`;
}

/**
 * Turn code-span references to repo files into links to GitHub.
 *
 * The source document is written for someone with the repo checked out, so
 * it says things like "see `docs/EI-PARITY.md`" rather than linking. On the
 * wiki those are dead ends. Rewriting the code span into a link *around* the
 * code span (`[`docs/EI-PARITY.md`](url)`) keeps the monospace rendering the
 * author intended while making it reachable.
 *
 * Deliberately skips spans already inside a link (`](` immediately before)
 * and anything inside a fenced code block, where a backtick run is content,
 * not markup.
 */
export function linkRepoPaths(md, source) {
  const lines = md.split('\n');
  let inFence = false;

  return lines
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;

      return line.replace(/(\[?)`([^`\n]+)`/g, (whole, openBracket, inner) => {
        // Already the label of a link — leave it alone.
        if (openBracket) return whole;
        if (!REPO_PATH.test(inner)) return whole;
        return `[\`${inner}\`](${blobUrl(source, inner)})`;
      });
    })
    .join('\n');
}

/**
 * Drop the document's own H1.
 *
 * Starlight renders the frontmatter `title` as the page's H1, so keeping the
 * source's `# Native format 1.0 reference` would emit two.
 */
export function stripLeadingH1(md) {
  const lines = md.split('\n');
  const i = lines.findIndex((l) => l.trim() !== '');
  if (i === -1 || !/^#\s+/.test(lines[i])) return md;
  lines.splice(i, 1);
  // Collapse the blank line the heading left behind.
  while (lines[i] === '') lines.splice(i, 1);
  return lines.join('\n');
}

/** Strip the provenance comment snapshot-axilog-schema.mjs writes on top. */
export function stripProvenance(md) {
  return md.replace(/^<!--[\s\S]*?-->\n+/, '');
}

/** Read the provenance comment back out as an object. */
export function readProvenance(md) {
  const block = md.match(/^<!--([\s\S]*?)-->/);
  if (!block) return null;
  const out = {};
  for (const line of block[1].split('\n')) {
    const m = line.match(/^\s*([a-zA-Z]+):\s*(.+?)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return Object.keys(out).length ? out : null;
}

/** YAML-escape a scalar for the frontmatter block. */
function yamlString(s) {
  return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Assemble the final Starlight page.
 *
 * Order is intro → generated body → EI-compat surface. The EI half is
 * hand-written because axilog's NATIVE-FORMAT.md is, by design, only about
 * the native container — it does not describe the ei-json field surface, so
 * a straight vendor would lose it.
 */
export function buildPage({ title, description, snapshot, intro, eiSurface, source }) {
  const provenance = readProvenance(snapshot);
  const body = linkRepoPaths(stripLeadingH1(stripProvenance(snapshot)), source);

  const frontmatter = [
    '---',
    `title: ${yamlString(title)}`,
    `description: ${yamlString(description)}`,
    'source: generated',
    '---',
  ].join('\n');

  const banner = [
    ':::note[Generated page]',
    `The section below is [axilog](https://github.com/${source.repo})'s own`,
    `[\`docs/NATIVE-FORMAT.md\`](${blobUrl(source, 'docs/NATIVE-FORMAT.md')}), rendered here`,
    provenance?.ref
      ? `from commit \`${provenance.ref.slice(0, 12)}\`${provenance.describes ? ` (schema ${provenance.describes})` : ''}.`
      : 'from a pinned commit.',
    'It is the single source of truth for the format — corrections belong in',
    'that file, not on this page, which is regenerated on every build.',
    ':::',
  ].join('\n');

  return [frontmatter, '', intro.trim(), '', banner, '', body.trim(), '', eiSurface.trim(), ''].join('\n');
}
