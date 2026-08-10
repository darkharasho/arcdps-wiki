// Renders the whole build-history page from data/build-history.json. The
// page is machine-owned: full regeneration every run, no prose fencing.

export function renderBuildHistoryPage(history) {
  const lines = [
    '---',
    'title: Build history',
    'description: Auto-generated record of what changed in each arcdps build, as observed by the update pipeline.',
    'source: generated',
    '---',
    '',
    ':::note',
    'This page is machine-written by the auto-update pipeline. Manual edits will be overwritten on the next build refresh.',
    ':::',
    '',
  ];

  for (const e of history) {
    lines.push(`## ${e.dllVersion || e.md5.slice(0, 12)} (${e.observedAt})`, '');
    lines.push(`- md5: \`${e.md5}\``);
    const section = (label, items) => {
      if (!items.length) return;
      lines.push(`- ${label}:`);
      for (const item of items) lines.push(`  - \`${item}\``);
    };
    section('Exports added', e.exportsAdded);
    section('Exports removed', e.exportsRemoved);
    section('UI strings added', e.uiStringsAdded);
    section('UI strings removed', e.uiStringsRemoved);
    const changes = e.exportsAdded.length + e.exportsRemoved.length
      + e.uiStringsAdded.length + e.uiStringsRemoved.length;
    if (changes === 0) lines.push('- No export or UI-string changes (binary-only update).');
    lines.push('');
  }

  return lines.join('\n');
}
