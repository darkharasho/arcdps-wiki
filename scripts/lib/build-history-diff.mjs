// Pure diff between two snapshot generations. UI pools are flattened into a
// single string set: history readers care that a string appeared or vanished,
// not which pool it was classified into.

const diffLists = (before, after) => {
  const b = new Set(before);
  const a = new Set(after);
  return {
    added: after.filter((x) => !b.has(x)),
    removed: before.filter((x) => !a.has(x)),
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
