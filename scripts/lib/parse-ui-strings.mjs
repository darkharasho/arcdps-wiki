// Classify raw `strings` output from the arcdps DLL into three buckets that
// describe the in-game UI: config keys (arcdps.ini tokens), ImGui element ids
// (arc's internal panel/widget names), and human-facing UI text (labels and
// tooltips). The DLL bundles Dear ImGui, stb, a zlib variant, DXVK shaders, and
// embedded-PNG metadata, so the ASCII string pool is heavily contaminated;
// filtering here is precision-first (a curated domain allowlist plus a
// library-noise blocklist), on the assumption that results are cross-checked
// in-game before publishing. Recall is deliberately sacrificed — a missed
// string is cheaper than a wrong one under the wiki's accuracy rule.

// Words that mark a string as arc's own combat-UI vocabulary. A human-facing
// phrase must contain at least one of these to be kept as uiText.
const DOMAIN_VOCAB = [
  'combat', 'squad', 'target', 'buff', 'boon', 'down', 'strip', 'cleanse',
  'cleave', 'defiance', 'missile', 'evtc', 'subgroup', 'profession', 'healing',
  'minion', 'crowd control', 'reflect', 'barrier', 'uptime', 'encounter',
  'cast', 'poll', 'volume', 'nominal', 'flanking', 'tag', 'commander',
  'graph', 'window', 'column', 'bar', 'table', 'panel', 'stat', 'fight',
  'player', 'enemy', 'ally', 'allies', 'agent', 'skill', 'damage', 'health',
  'log', 'hits', 'revive', 'resurrect', 'distance', 'percent', 'moving',
];

// Substrings that mark a string as bundled-library or build noise, not arc UI.
const LIBRARY_NOISE = [
  // Dear ImGui internals / asserts / demo content
  'imgui', 'begincombo', 'endcombo', 'beginmenu', 'endmenu', 'beginpopup',
  'endpopup', 'begintable', 'endtable', 'begincolumns', 'endcolumns',
  'wrong window', 'in wrong', 'scope', 'setcursor', 'getio', 'clipper',
  'dockid', 'viewport', 'navigation', 'drag and drop', 'item flag',
  'alpha bar', 'enable asserts', 'metrics/debugger',
  // ImGui debug-log lines (contain "window"/"nav" but are library logging)
  'navid', 'popupid', 'focuswindow', 'navmove', 'navinit', 'navrestore',
  'navwindowing', 'lockwheeling', 'closepopup', 'mainmenubar', 'setnavwindow',
  'applyresult', 'unlessbelowmodal',
  // stb / zlib / shader / graphics
  'truetype', 'inflate', 'deflate', 'zlib', 'tdefl', 'tinfl', 'register(',
  'float4', 'vs_input', 'ps_input', 'sv_position', 'projectionmatrix',
  'd3d', 'dxgi', 'shader', 'vertexbuffer',
  // embedded PNG / Photoshop metadata
  'adobe', 'xmpmeta', 'xpacket', 'rdf:', 'photoshop', 'iccprofile',
  // C runtime strerror / misc
  'temporarily unavailable', 'bad address', 'bad file', 'broken pipe',
  'arg list', 'not permitted', 'no such', 'too many', 'invalid argument',
  // MSVC C++ RTTI / vtable / SEH machinery
  'vftable', 'vbtable', 'vtable', 'static guard', 'constructor closure',
  'local static', 'rtti', 'typeinfo',
  // Win32 API-set / window-class / OS plumbing
  'api-ms-win', 'window class', 'window_class', 'arenanet', 'menu bar',
  'main menu', '.dll', 'kernel32', 'ntuser',
];

const hasAny = (lower, needles) => needles.some((n) => lower.includes(n));

// arcdps.ini / export snake_case token: lowercase, digits, underscores, must
// contain at least one underscore, and must not be a known library token.
const CONFIG_KEY_RE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;
const CONFIG_KEY_NOISE = new Set([
  'imgui_impl_dx11', 'imgui_impl_win32', 'stb_truetype', 'iimgui_impl_dx11',
  'ps_4_0', 'vs_4_0', 'd3d9_wrapper',
]);

// Strip a leading ImGui id/label separator ("label###id" or "###id") to recover
// the raw element id.
const ELEMENT_ID_RE = /###/;

/**
 * @param {string[]} lines - deduped lines from `strings` (ASCII and UTF-16 pools combined)
 * @returns {{configKeys: string[], elementIds: string[], uiText: string[]}}
 */
export function parseUiStrings(lines) {
  const configKeys = new Set();
  const elementIds = new Set();
  const uiText = new Set();

  for (const raw of lines) {
    const s = raw.trim();
    if (s.length < 3) continue;
    const lower = s.toLowerCase();

    // 1. Config keys — cleanest bucket, check first.
    if (CONFIG_KEY_RE.test(s) && !CONFIG_KEY_NOISE.has(s)) {
      configKeys.add(s);
      continue;
    }

    // 2. ImGui element ids — arc's internal panel/widget names.
    if (ELEMENT_ID_RE.test(s)) {
      const id = s.slice(s.indexOf('###') + 3).replace(/%[0-9a-z]+/gi, '').trim();
      if (id.length >= 3 && /^[a-z0-9_]+$/i.test(id)) elementIds.add(id);
      continue;
    }

    // 3. Human-facing UI text — precision-filtered.
    if (s.length < 5 || s.length > 160) continue;
    if (!/[a-z]/.test(s)) continue;              // must have lowercase letters
    if (/^[[.@#`(]/.test(s) && !/^@\d+:/.test(s)) continue; // ImGui log tags / ids / MSVC decorations (keep "@N:" column templates)
    if (/%[-+ #0-9.]*[a-z]/i.test(s)) continue;  // printf format = log/debug string, not a UI label
    if (!/\s/.test(s) && /[a-z][A-Z]/.test(s)) continue; // camelCase single token = code identifier (Win32 API, ImGui var)
    if (hasAny(lower, LIBRARY_NOISE)) continue;
    if (!hasAny(lower, DOMAIN_VOCAB)) continue;
    if (/[{}<>\\]|::|0x[0-9a-f]/i.test(s)) continue; // code-ish
    if (/[A-Za-z_]\w*\([^)]*\)/.test(s)) continue;   // identifier() = ImGui assert/function ref, not UI prose
    uiText.add(s);
  }

  const sort = (set) => [...set].sort((a, b) => a.localeCompare(b));
  return {
    configKeys: sort(configKeys),
    elementIds: sort(elementIds),
    uiText: sort(uiText),
  };
}
