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

// Datum i vreme kao dd.mm.yyyy. hh:mm. "-" ako fali/nevalidno.
export function fmtDMYHM(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return `${fmtDMY(iso)}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Koliko je proslo: "danas", "juce", "pre 5 dana", "pre 3 meseca". "-" ako fali.
export function prePre(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const pocetak = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dana = Math.round((pocetak(new Date()) - pocetak(d)) / 86400000)
  if (dana <= 0) return 'danas'
  if (dana === 1) return 'juče'
  if (dana < 60) return `pre ${dana} dana`
  const meseci = Math.round(dana / 30)
  return `pre ${meseci} ${meseci < 5 ? 'meseca' : 'meseci'}`
}

// Platforma uredjaja za prikaz.
export function nazivPlatforme(p: string | null | undefined): string {
  if (p === 'ios') return 'iPhone'
  if (p === 'android') return 'Android'
  return p || '-'
}

// Inicijali iz imena (ili email-a kao fallback) za avatar placeholder.
export function initials(name?: string | null, email?: string | null): string {
  const src = (name && name.trim()) || (email ? email.split('@')[0] : '') || '?'
  const parts = src.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}
