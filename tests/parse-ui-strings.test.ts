import { describe, it, expect } from 'vitest';
import { parseUiStrings } from '../scripts/lib/parse-ui-strings.mjs';

describe('parseUiStrings', () => {
  it('classifies config keys, element ids, and UI text into separate buckets', () => {
    const out = parseUiStrings([
      'boss_encounter_savewvw',
      'stats table###areastatslist',
      'Damage since 2 seconds before target dropped below full health',
    ]);
    expect(out.configKeys).toContain('boss_encounter_savewvw');
    expect(out.elementIds).toContain('areastatslist');
    expect(out.uiText).toContain(
      'Damage since 2 seconds before target dropped below full health',
    );
  });

  it('drops bundled-library noise sharing the ASCII pool', () => {
    const out = parseUiStrings([
      'Bok Choy',                         // ImGui demo content — no domain vocab
      'Calling EndCombo() in wrong window!', // ImGui assert (function-call syntax)
      'Broken pipe',                      // libc strerror
      'CreateWindowExA',                  // Win32 API (camelCase identifier)
      '`vftable\'',                       // MSVC RTTI
      '[nav] NavMoveRequest: result',     // ImGui debug log
    ]);
    expect(out.uiText).toEqual([]);
  });

  it('keeps "@N:" column templates but not printf/debug format strings', () => {
    const out = parseUiStrings([
      '@3: cleave percent of total',
      'evtc: log not saved, squad %d of %d',
    ]);
    expect(out.uiText).toContain('@3: cleave percent of total');
    expect(out.uiText.some((s) => s.includes('%d'))).toBe(false);
  });

  it('sorts and de-duplicates every bucket', () => {
    const out = parseUiStrings(['always_draw_windows', 'always_draw_windows', 'buff_table_ids']);
    expect(out.configKeys).toEqual(['always_draw_windows', 'buff_table_ids']);
  });
});
