// Kanonske kategorije namirnica (tacni srpski nazivi sa kvacicama). Unos je slobodan tekst
// (datalist) da admin moze da ispravi postojece typo-e u pravu kategoriju.
export const FOOD_CATEGORIES = [
  'Povrće',
  'Ugljeni hidrati',
  'Pića',
  'Jaja i mleko',
  'Voće',
  'Začini i dodaci',
  'Meso',
  'Suplementi',
  'Slatkiši',
  'Riba',
  'Pekarski',
  'Orašasti plodovi',
  'Gotova jela',
  'Brza hrana',
  'Mahunarke',
  'Masnoće i ulja',
]

// Broj -> kratak prikaz (ceo broj bez decimala, inace jedna decimala).
export function fmtG(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0'
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
