import { cn } from '@/lib/utils'

type Tone = 'gray' | 'amber' | 'green' | 'red'

const TONES: Record<Tone, string> = {
  gray: 'bg-muted text-muted-foreground',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  green: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200',
  red: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
}

// Izvedi labelu + boju iz sub_status + sub_access_until (istek nadjacava aktivan status).
function subInfo(
  status: string | null | undefined,
  accessUntil: string | null | undefined,
): { label: string; tone: Tone } {
  if (!status) return { label: 'Bez pretplate', tone: 'gray' }
  if (status === 'canceled') return { label: 'Otkazano', tone: 'red' }
  const expired = accessUntil ? new Date(accessUntil).getTime() <= Date.now() : false
  if (status === 'expired' || expired) return { label: 'Istekla', tone: 'gray' }
  if (status === 'trialing') return { label: 'Probni period', tone: 'amber' }
  if (status === 'active') return { label: 'Aktivna', tone: 'green' }
  if (status === 'past_due') return { label: 'Kasni plaćanje', tone: 'amber' }
  if (status === 'incomplete') return { label: 'Nezavršeno', tone: 'gray' }
  return { label: status, tone: 'gray' }
}

export function SubBadge({
  status,
  accessUntil,
  className,
}: {
  status: string | null | undefined
  accessUntil: string | null | undefined
  className?: string
}) {
  const { label, tone } = subInfo(status, accessUntil)
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold',
        TONES[tone],
        className,
      )}
    >
      {label}
    </span>
  )
}
