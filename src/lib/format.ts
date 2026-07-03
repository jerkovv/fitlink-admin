// Broj sa separatorom hiljada tackom (4.699). "-" ako fali.
export function fmtInt(n: number | undefined | null): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-'
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// Datum kao dd.mm.yyyy. "-" ako fali/nevalidno.
export function fmtDMY(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

// Inicijali iz imena (ili email-a kao fallback) za avatar placeholder.
export function initials(name?: string | null, email?: string | null): string {
  const src = (name && name.trim()) || (email ? email.split('@')[0] : '') || '?'
  const parts = src.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}
