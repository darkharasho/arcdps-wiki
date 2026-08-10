// Pure diff between two snapshot generations. UI pools are flattened into a
// single string set: history readers care that a string appeared or vanished,
// not which pool it was classified into.

const diffLists = (before, after) => {
  const b = new Set(before);
  const a = new Set(after);
  // Deduplicate outputs while preserving first-seen order
  const seen = new Set();
  const addedDedup = [];
  for (const x of after) {
    if (!b.has(x) && !seen.has(x)) {
      addedDedup.push(x);
      seen.add(x);
    }
  }
  seen.clear();
  const removedDedup = [];
  for (const x of before) {
    if (!a.has(x) && !seen.has(x)) {
      removedDedup.push(x);
      seen.add(x);
    }
  }
  return {
    added: addedDedup,
    removed: removedDedup,
  };
};

export function diffSnapshots({ oldExports, newExports, oldUi, newUi }) {
  const flat = (ui) => [...ui.configKeys, ...ui.elementIds, ...ui.uiText];
  const exp = diffLists(oldExports.exports, newExports.exports);
  const ui = diffLists(flat(oldUi), flat(newUi));
  return {
    exportsAdded: exp.added,
    exportsRemoved: exp.removed,
    uiStringsAdded: ui.added,
    uiStringsRemoved: ui.removed,
  };
}
