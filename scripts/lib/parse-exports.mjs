// Parse `objdump -p` Ordinal/Name Pointer table text into sorted, unique export names.
export function parseExports(objdumpText) {
  const names = new Set();
  for (const line of objdumpText.split('\n')) {
    // Rows look like: "\t[  19] +base[  20]  0000 SymbolName"
    const m = line.match(/^\s*\[\s*\d+\]\s*\+base\[\s*\d+\]\s+[0-9a-fA-F]+\s+(\S+)\s*$/);
    if (m) names.add(m[1]);
  }
  return [...names].sort();
}
