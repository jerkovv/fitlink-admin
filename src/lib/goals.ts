// goal_type enum (vezbacev cilj) -> srpske labele.
export const GOAL_OPTIONS: { value: string; label: string }[] = [
  { value: 'lose_weight', label: 'Mršavljenje' },
  { value: 'gain_muscle', label: 'Mišićna masa' },
  { value: 'endurance', label: 'Izdržljivost' },
  { value: 'mobility', label: 'Pokretljivost' },
  { value: 'general', label: 'Opšte' },
]

const GOAL_LABELS: Record<string, string> = Object.fromEntries(
  GOAL_OPTIONS.map((o) => [o.value, o.label]),
)

export function goalLabel(goal: string | null | undefined): string {
  return goal ? (GOAL_LABELS[goal] ?? goal) : '-'
}
