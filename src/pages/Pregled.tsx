import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Users,
  Dumbbell,
  CreditCard,
  TrendingUp,
  Hourglass,
  BadgeCheck,
  Calendar,
  CalendarDays,
  CircleX,
  UserPlus,
  Activity,
  Apple,
  Flag,
  TriangleAlert,
  RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Stats = {
  trainers_total: number
  athletes_total: number
  exercises_total: number
  subs_active_total: number
  subs_trialing: number
  subs_paid: number
  subs_monthly: number
  subs_yearly: number
  subs_canceled_expired: number
  revenue_monthly_eur: number
  new_trainers_7d: number
  new_athletes_7d: number
  open_media_reports: number
  food_items_total: number
}

// Broj sa separatorom hiljada tackom (4.699). "-" ako podatak fali.
function fmtInt(n: number | undefined | null): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-'
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function fmtEur(n: number | undefined | null): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-'
  return `${fmtInt(n)} EUR`
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </div>
  )
}

function HeroKpi({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <Card className="p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 font-display text-3xl font-bold leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      <div className="mt-2 text-sm font-medium text-muted-foreground">{label}</div>
    </Card>
  )
}

function MiniStat({
  label,
  value,
  icon: Icon,
  warn = false,
}: {
  label: string
  value: string
  icon: LucideIcon
  warn?: boolean
}) {
  return (
    <Card className={cn('p-4', warn && 'border-amber-300 bg-amber-50')}>
      <div className="flex items-center justify-between gap-2">
        <div
          className={cn(
            'font-display text-2xl font-bold tracking-tight tabular-nums',
            warn ? 'text-amber-700' : 'text-foreground',
          )}
        >
          {value}
        </div>
        <Icon className={cn('h-4 w-4 shrink-0', warn ? 'text-amber-500' : 'text-muted-foreground/50')} />
      </div>
      <div className={cn('mt-1 text-xs font-medium', warn ? 'text-amber-700/80' : 'text-muted-foreground')}>
        {label}
      </div>
    </Card>
  )
}

function SkelCard({ big = false }: { big?: boolean }) {
  return (
    <Card className={big ? 'p-5' : 'p-4'}>
      {big && <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />}
      <div
        className={cn('animate-pulse rounded bg-muted', big ? 'mt-4 h-8 w-24' : 'h-7 w-16')}
      />
      <div className={cn('animate-pulse rounded bg-muted', big ? 'mt-2 h-3.5 w-20' : 'mt-2 h-3 w-16')} />
    </Card>
  )
}

function SkeletonDashboard() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkelCard key={i} big />
        ))}
      </div>
      {/* Rezervisi visinu SectionLabel-a da nema skoka kad podaci stignu. */}
      <div>
        <div className="mb-3 h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkelCard key={i} />
          ))}
        </div>
      </div>
      <div>
        <div className="mb-3 h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkelCard key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <TriangleAlert className="h-6 w-6" />
      </div>
      <div className="font-display text-lg font-semibold text-foreground">Greška pri učitavanju</div>
      <p className="max-w-sm text-sm text-muted-foreground">
        Nije moguće učitati statistiku. Pokušaj ponovo.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />
        Pokušaj ponovo
      </Button>
    </Card>
  )
}

function Dashboard({ stats }: { stats: Stats }) {
  const reportsWarn = stats.open_media_reports > 0
  return (
    <div className="space-y-8">
      {/* HERO */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroKpi label="Treneri" value={fmtInt(stats.trainers_total)} icon={Users} />
        <HeroKpi label="Vežbači" value={fmtInt(stats.athletes_total)} icon={Dumbbell} />
        <HeroKpi label="Aktivne pretplate" value={fmtInt(stats.subs_active_total)} icon={CreditCard} />
        <HeroKpi label="Mesečni prihod" value={fmtEur(stats.revenue_monthly_eur)} icon={TrendingUp} />
      </div>

      {/* PRETPLATE */}
      <div>
        <SectionLabel>Pretplate</SectionLabel>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <MiniStat label="U probnom periodu" value={fmtInt(stats.subs_trialing)} icon={Hourglass} />
          <MiniStat label="Plaćene aktivne" value={fmtInt(stats.subs_paid)} icon={BadgeCheck} />
          <MiniStat label="Mesečne" value={fmtInt(stats.subs_monthly)} icon={Calendar} />
          <MiniStat label="Godišnje" value={fmtInt(stats.subs_yearly)} icon={CalendarDays} />
          <MiniStat
            label="Otkazane / istekle"
            value={fmtInt(stats.subs_canceled_expired)}
            icon={CircleX}
          />
        </div>
      </div>

      {/* AKTIVNOST + OSTALO */}
      <div>
        <SectionLabel>Aktivnost i ostalo</SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Novi treneri (7 dana)" value={fmtInt(stats.new_trainers_7d)} icon={UserPlus} />
          <MiniStat label="Novi vežbači (7 dana)" value={fmtInt(stats.new_athletes_7d)} icon={Activity} />
          <MiniStat label="Vežbi u bazi" value={fmtInt(stats.exercises_total)} icon={Dumbbell} />
          <MiniStat label="Namirnica u bazi" value={fmtInt(stats.food_items_total)} icon={Apple} />
          <MiniStat
            label="Otvorene prijave"
            value={fmtInt(stats.open_media_reports)}
            icon={reportsWarn ? TriangleAlert : Flag}
            warn={reportsWarn}
          />
        </div>
      </div>
    </div>
  )
}

export default function Pregled() {
  const [data, setData] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const { data: res, error: err } = await supabase.rpc('admin_overview_stats')
    if (err || !res) setError(true)
    else setData(res as Stats)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Pregled</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ključne metrike i stanje platforme.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Osveži
        </Button>
      </div>

      {error && !data ? (
        <ErrorState onRetry={load} />
      ) : !data ? (
        <SkeletonDashboard />
      ) : (
        <>
          {error && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Osvežavanje nije uspelo. Prikazani su poslednji učitani podaci.
            </div>
          )}
          <Dashboard stats={data} />
        </>
      )}
    </div>
  )
}
