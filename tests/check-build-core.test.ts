import { describe, it, expect } from 'vitest';
import { parseMd5Sum, extractDllVersion } from '../scripts/lib/check-build-core.mjs';

describe('parseMd5Sum', () => {
  it('parses the deltaconnected md5sum format', () => {
    expect(parseMd5Sum('753f00b01829bb9088c00dcc32d19077  d3d11.dll\n'))
      .toBe('753f00b01829bb9088c00dcc32d19077');
  });
  it('throws on HTML/garbage (e.g. a Cloudflare challenge page)', () => {
    expect(() => parseMd5Sum('<!DOCTYPE html><html>...')).toThrow(/unparseable/i);
  });
  it('throws on empty input', () => {
    expect(() => parseMd5Sum('')).toThrow(/unparseable/i);
  });
});

describe('extractDllVersion', () => {
  it('finds the VS_VERSION-style string among noise', () => {
    expect(extractDllVersion(['junk', ' 1.2026.718.905 ', 'more'])).toBe('1.2026.718.905');
  });
  it('returns empty string when absent', () => {
    expect(extractDllVersion(['no', 'version', 'here'])).toBe('');
  });
});
