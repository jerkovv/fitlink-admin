// muscle_group enum -> srpske labele.
export const MUSCLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'grudi', label: 'Grudi' },
  { value: 'ledja', label: 'Leđa' },
  { value: 'ramena', label: 'Ramena' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'podlaktice', label: 'Podlaktice' },
  { value: 'kvadriceps', label: 'Kvadriceps' },
  { value: 'zadnja_loza', label: 'Zadnja loža' },
  { value: 'glutei', label: 'Glutei' },
  { value: 'listovi', label: 'Listovi' },
  { value: 'core', label: 'Core' },
  { value: 'celo_telo', label: 'Celo telo' },
  { value: 'kardio', label: 'Kardio' },
]

// equipment_type enum -> srpske labele.
export const EQUIP_OPTIONS: { value: string; label: string }[] = [
  { value: 'sipka', label: 'Šipka' },
  { value: 'bucice', label: 'Bučice' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'masina', label: 'Mašina' },
  { value: 'kabl', label: 'Kabl' },
  { value: 'sopstvena_tezina', label: 'Sopstvena težina' },
  { value: 'guma', label: 'Guma' },
  { value: 'medicinka', label: 'Medicinka' },
  { value: 'kardio_oprema', label: 'Kardio oprema' },
  { value: 'ostalo', label: 'Ostalo' },
]

const MUSCLE_LABELS: Record<string, string> = Object.fromEntries(
  MUSCLE_OPTIONS.map((o) => [o.value, o.label]),
)
const EQUIP_LABELS: Record<string, string> = Object.fromEntries(
  EQUIP_OPTIONS.map((o) => [o.value, o.label]),
)

export function muscleLabel(v: string | null | undefined): string {
  return v ? (MUSCLE_LABELS[v] ?? v) : '-'
}
export function equipLabel(v: string | null | undefined): string {
  return v ? (EQUIP_LABELS[v] ?? v) : '-'
}
