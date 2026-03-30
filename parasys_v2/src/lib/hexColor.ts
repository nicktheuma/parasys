/** Map #rgb or #rrggbb to #rrggbb for `<input type="color">` (invalid → neutral grey). */
export function hexForColorInput(hex: string): string {
  const t = hex.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    const r = t[1]
    const g = t[2]
    const b = t[3]
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return '#888888'
}
