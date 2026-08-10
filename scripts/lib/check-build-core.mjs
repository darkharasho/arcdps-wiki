// Pure helpers for the auto-update change detector. Kept fetch/fs-free so
// they are unit-testable without network.

export const parseMd5Sum = (text) => {
  const m = text.trim().match(/^([0-9a-f]{32})\s+\S+/);
  if (!m) throw new Error(`unparseable md5sum content: ${JSON.stringify(text.slice(0, 80))}`);
  return m[1];
};

// Same VS_VERSION_INFO pattern snapshot-ui-strings.mjs already relies on.
export const extractDllVersion = (lines) => {
  const hit = lines.find((l) => /^\d+\.\d{4}\.\d{2,4}\.\d{2,4}$/.test(l.trim()));
  return hit ? hit.trim() : '';
};
