import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Search,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
  StickyNote,
  TriangleAlert,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { ListSubscription } from '@/lib/types'
import { fmtDMY } from '@/lib/format'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

type Tone = 'gray' | 'amber' | 'green' | 'red'
const TONES: Record<Tone, string> = {
  gray: 'bg-muted text-muted-foreground',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  green: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200',
  red: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
}

// Status pretplate -> labela/boja (po statusu, kao sto Pretplate modul trazi).
function statusInfo(row: ListSubscription): { label: string; tone: Tone } {
  if (!row.has_sub || !row.status) return { label: 'Bez pretplate', tone: 'gray' }
  switch (row.status) {
    case 'trialing':
      return { label: 'Probni', tone: 'amber' }
    case 'active':
      return { label: 'Aktivna', tone: 'green' }
    case 'past_due':
      return { label: 'Kasni', tone: 'amber' }
    case 'incomplete':
      return { label: 'Nezavršeno', tone: 'gray' }
    case 'canceled':
      return { label: 'Otkazano', tone: 'red' }
    case 'expired':
      return { label: 'Istekla', tone: 'red' }
    default:
      return { label: row.status, tone: 'gray' }
  }
}

function StatusPill({ row }: { row: ListSubscription }) {
  const { label, tone } = statusInfo(row)
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold',
        TONES[tone],
      )}
    >
      {label}
    </span>
  )
}

const planLabel = (plan: string | null | undefined): string =>
  plan === 'monthly' ? 'Mesečna' : plan === 'yearly' ? 'Godišnja' : '-'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'trialing', label: 'Probni period' },
  { value: 'active', label: 'Aktivna' },
  { value: 'past_due', label: 'Kasni plaćanje' },
  { value: 'canceled', label: 'Otkazano' },
  { value: 'expired', label: 'Istekla' },
  { value: 'incomplete', label: 'Nezavršeno' },
]

const selectCls =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

const DAY = 86400000
const isoFrom = (ms: number): string => new Date(ms).toISOString()
const textOrNull = (v: string): string | null => {
  const t = v.trim()
  return t === '' ? null : t
}
// ISO -> 'YYYY-MM-DD' (lokalno) za <input type=date>.
function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type FilterKey = 'all' | 'active' | 'trial' | 'none' | 'ended'
const FILTERS: { value: FilterKey; label: string }[] = [
  { value: 'all', label: 'Sve' },
  { value: 'active', label: 'Aktivne' },
  { value: 'trial', label: 'Probni period' },
  { value: 'none', label: 'Bez pretplate' },
  { value: 'ended', label: 'Otkazane / istekle' },
]

function matchFilter(row: ListSubscription, f: FilterKey): boolean {
  if (f === 'all') return true
  if (f === 'none') return !row.has_sub
  const expired = row.access_until ? new Date(row.access_until).getTime() <= Date.now() : false
  if (f === 'active') return row.has_sub && (row.status === 'active' || row.status === 'past_due') && !expired
  if (f === 'trial') return row.has_sub && row.status === 'trialing' && !expired
  if (f === 'ended')
    return row.has_sub && (row.status === 'canceled' || row.status === 'expired' || expired)
  return true
}

type SortKey = 'access' | 'status'
const STATUS_RANK: Record<string, number> = {
  active: 0,
  trialing: 1,
  past_due: 2,
  incomplete: 3,
  canceled: 4,
  expired: 5,
}

type Pending = {
  trainerId: string
  trainerName: string
  summary: string
  params: {
    p_trainer_id: string
    p_plan: string | null
    p_status: string
    p_access_until: string | null
    p_note: string | null
  }
}

function KV({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-right text-sm text-foreground', mono && 'break-all font-mono text-xs')}>
        {value}
      </span>
    </div>
  )
}

function SortHead({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string
  col: SortKey
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (c: SortKey) => void
  className?: string
}) {
  const active = sortKey === col
  const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={cn('inline-flex items-center gap-1 transition-colors hover:text-foreground', active && 'text-foreground')}
      >
        {label}
        <Icon className={cn('h-3.5 w-3.5', active ? 'text-primary' : 'text-muted-foreground/50')} />
      </button>
    </TableHead>
  )
}

export default function Pretplate() {
  const [rows, setRows] = useState<ListSubscription[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [sortKey, setSortKey] = useState<SortKey>('access')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [cPlan, setCPlan] = useState('')
  const [cStatus, setCStatus] = useState('active')
  const [cDate, setCDate] = useState('')
  const [cNote, setCNote] = useState('')

  const [pending, setPending] = useState<Pending | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const { data, error: err } = await supabase.rpc('admin_list_subscriptions')
    if (err || !Array.isArray(data)) setError(true)
    else setRows(data as ListSubscription[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onSort = (col: SortKey) => {
    if (sortKey === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(col)
      setSortDir('desc')
    }
  }

  const filtered = useMemo(() => {
    const base = rows ?? []
    const needle = q.trim().toLowerCase()
    const f = base.filter((r) => {
      if (!matchFilter(r, filter)) return false
      if (!needle) return true
      return (
        (r.full_name ?? '').toLowerCase().includes(needle) ||
        (r.email ?? '').toLowerCase().includes(needle)
      )
    })
    const sorted = [...f].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'access') {
        const av = a.access_until ? new Date(a.access_until).getTime() : -Infinity
        const bv = b.access_until ? new Date(b.access_until).getTime() : -Infinity
        cmp = av - bv
      } else {
        const ar = a.status ? (STATUS_RANK[a.status] ?? 98) : 99
        const br = b.status ? (STATUS_RANK[b.status] ?? 98) : 99
        cmp = ar - br
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [rows, q, filter, sortKey, sortDir])

  const selected = selectedId ? (rows ?? []).find((r) => r.trainer_id === selectedId) ?? null : null

  const openRow = (row: ListSubscription) => {
    setSelectedId(row.trainer_id)
    setShowAdvanced(false)
    setCPlan(row.plan ?? '')
    setCStatus(row.status ?? 'active')
    setCDate(toDateInput(row.access_until))
    setCNote(row.admin_note ?? '')
  }

  const trainerName = (row: ListSubscription) => row.full_name || row.email || 'trener'

  const ask = (
    row: ListSubscription,
    plan: string | null,
    status: string,
    accessUntil: string | null,
    note: string | null,
    summary: string,
  ) => {
    setPending({
      trainerId: row.trainer_id,
      trainerName: trainerName(row),
      summary,
      params: {
        p_trainer_id: row.trainer_id,
        p_plan: plan,
        p_status: status,
        p_access_until: accessUntil,
        p_note: note,
      },
    })
  }

  // Preseti: cuvaju postojecu napomenu (RPC bezuslovno pise admin_note = p_note).
  const presets = (row: ListSubscription) => {
    const now = Date.now()
    const base = row.access_until ? new Date(row.access_until).getTime() : now
    const keepNote = row.admin_note ?? null
    const keepPlan = row.plan ?? 'monthly'
    const keepStatus = row.status ?? 'active'
    return [
      {
        label: 'Aktiviraj mesečnu (30 dana)',
        run: () => ask(row, 'monthly', 'active', isoFrom(now + 30 * DAY), keepNote, 'Plan: mesečna, status: aktivna, važi 30 dana.'),
      },
      {
        label: 'Aktiviraj godišnju (365 dana)',
        run: () => ask(row, 'yearly', 'active', isoFrom(now + 365 * DAY), keepNote, 'Plan: godišnja, status: aktivna, važi 365 dana.'),
      },
      {
        label: 'Probni period (30 dana)',
        run: () => ask(row, 'monthly', 'trialing', isoFrom(now + 30 * DAY), keepNote, 'Plan: mesečna, status: probni, važi 30 dana.'),
      },
      {
        label: 'Produži +30 dana',
        run: () => ask(row, keepPlan, keepStatus, isoFrom(base + 30 * DAY), keepNote, 'Zadržava plan i status, +30 dana na važenje.'),
      },
      {
        label: 'Produži +1 godina',
        run: () => ask(row, keepPlan, keepStatus, isoFrom(base + 365 * DAY), keepNote, 'Zadržava plan i status, +365 dana na važenje.'),
      },
      {
        label: 'Deaktiviraj',
        danger: true,
        run: () => ask(row, row.plan ?? null, 'expired', isoFrom(now), keepNote, 'Status: istekla, važenje do sada.'),
      },
    ]
  }

  const applyCustom = (row: ListSubscription) => {
    const accessUntil = cDate ? new Date(`${cDate}T23:59:59`).toISOString() : null
    ask(row, cPlan === '' ? null : cPlan, cStatus, accessUntil, textOrNull(cNote), 'Prilagođena izmena (napredno).')
  }

  const runPending = async () => {
    if (!pending) return
    setSubmitting(true)
    const { data, error: err } = await supabase.rpc('admin_set_subscription', pending.params)
    setSubmitting(false)
    if (err) {
      toast.error('Greška pri izmeni pretplate.')
      return
    }
    setPending(null)
    // Osvezi custom formu iz vracenog reda da naredne rucne izmene krecu od novog stanja.
    const r = data as
      | { plan?: string | null; status?: string | null; access_until?: string | null; admin_note?: string | null }
      | null
    if (r && typeof r === 'object') {
      setCPlan(r.plan ?? '')
      setCStatus(r.status ?? 'active')
      setCDate(toDateInput(r.access_until ?? null))
      setCNote(r.admin_note ?? '')
    }
    toast.success('Pretplata ažurirana')
    await load()
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Pretplate</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stanje FitLink pretplata i ručni override (gratis, komp, reklamacije).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Osveži
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pretraga po imenu ili email-u"
            className="pl-9"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterKey)}
          className={cn(selectCls, 'w-auto min-w-[160px]')}
          aria-label="Filter po statusu"
        >
          {FILTERS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error && !rows ? (
        <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <TriangleAlert className="h-6 w-6" />
          </div>
          <div className="font-display text-lg font-semibold text-foreground">Greška pri učitavanju</div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Nije moguće učitati pretplate. Pokušaj ponovo.
          </p>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" />
            Pokušaj ponovo
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Trener</TableHead>
                <TableHead className="hidden md:table-cell">Plan</TableHead>
                <SortHead label="Status" col="status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortHead
                  label="Važi do"
                  col="access"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  className="hidden sm:table-cell"
                />
                <TableHead className="hidden lg:table-cell">Stripe</TableHead>
                <TableHead className="hidden xl:table-cell">Poslednja naplata</TableHead>
                <TableHead className="w-8" aria-label="Napomena" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !rows ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    <TableCell>
                      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell>
                      <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                    {rows && rows.length > 0 ? 'Nema rezultata za taj filter.' : 'Još nema trenera.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.trainer_id} className="cursor-pointer" onClick={() => openRow(r)}>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {r.full_name || 'Bez imena'}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {planLabel(r.plan)}
                    </TableCell>
                    <TableCell>
                      <StatusPill row={r} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell tabular-nums text-muted-foreground">
                      {fmtDMY(r.access_until)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {r.stripe_customer_id ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                            Stripe
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {`...${r.stripe_customer_id.slice(-6)}`}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell tabular-nums text-muted-foreground">
                      {fmtDMY(r.last_payment_at)}
                    </TableCell>
                    <TableCell>
                      {r.admin_note ? (
                        <StickyNote className="h-4 w-4 text-primary" aria-label="Ima napomenu" />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Detalj + override (slide-over) */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        {selected && (
          <SheetContent onInteractOutside={(e) => pending && e.preventDefault()}>
            <div className="border-b border-border p-5 pr-12">
              <SheetTitle>{selected.full_name || 'Bez imena'}</SheetTitle>
              <SheetDescription>{selected.email || 'Bez email-a'}</SheetDescription>
              <div className="mt-2">
                <StatusPill row={selected} />
              </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                <span className="font-semibold">Ručni override.</span> Za trenere sa aktivnom Stripe
                pretplatom, Stripe (webhook) je izvor istine i može pregaziti ručnu izmenu pri sledećem
                Stripe eventu. Ručni override je za gratis / komp / reklamacije.
              </div>

              <section>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Detalji
                </div>
                <div className="divide-y divide-border">
                  <KV label="Plan" value={planLabel(selected.plan)} />
                  <KV label="Status" value={statusInfo(selected).label} />
                  <KV label="Važi do" value={fmtDMY(selected.access_until)} />
                  <KV label="Probni do" value={fmtDMY(selected.trial_ends_at)} />
                  <KV label="Sledeći period" value={fmtDMY(selected.current_period_end)} />
                  <KV
                    label="Otkazuje se na kraju perioda"
                    value={selected.cancel_at_period_end ? 'Da' : 'Ne'}
                  />
                  <KV label="Stripe customer" value={selected.stripe_customer_id || '-'} mono />
                  <KV label="Stripe subscription" value={selected.stripe_subscription_id || '-'} mono />
                  <KV label="Poslednja naplata" value={fmtDMY(selected.last_payment_at)} />
                  <KV label="Kreiran" value={fmtDMY(selected.created_at)} />
                  <KV label="Ažuriran" value={fmtDMY(selected.updated_at)} />
                  {selected.admin_note && (
                    <div className="py-2">
                      <div className="text-xs text-muted-foreground">Napomena</div>
                      <div className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                        {selected.admin_note}
                      </div>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Detalje naplate vidi u Stripe dashboard-u.
                </p>
              </section>

              <section>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Brzi override
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {presets(selected).map((p) => (
                    <Button
                      key={p.label}
                      variant={p.danger ? 'outline' : 'secondary'}
                      size="sm"
                      className={cn('justify-start', p.danger && 'text-red-600 hover:text-red-700')}
                      onClick={p.run}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </section>

              <section>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center gap-1 text-sm font-semibold text-foreground"
                >
                  {showAdvanced ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Napredno (prilagođeno)
                </button>
                {showAdvanced && (
                  <div className="mt-3 space-y-4 rounded-lg border border-border p-4">
                    <div className="space-y-1.5">
                      <Label>Plan</Label>
                      <select value={cPlan} onChange={(e) => setCPlan(e.target.value)} className={selectCls}>
                        <option value="">Ništa (bez plana)</option>
                        <option value="monthly">Mesečna</option>
                        <option value="yearly">Godišnja</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <select
                        value={cStatus}
                        onChange={(e) => setCStatus(e.target.value)}
                        className={selectCls}
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Važi do</Label>
                      <Input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Napomena</Label>
                      <Textarea
                        rows={3}
                        value={cNote}
                        onChange={(e) => setCNote(e.target.value)}
                        placeholder="Razlog override-a (gratis, reklamacija...)"
                      />
                    </div>
                    <Button size="sm" onClick={() => applyCustom(selected)}>
                      Primeni izmenu
                    </Button>
                  </div>
                )}
              </section>
            </div>
          </SheetContent>
        )}
      </Sheet>

      {/* Confirm */}
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && !submitting && setPending(null)}>
        {pending && (
          <AlertDialogContent>
            <AlertDialogTitle>Ručna izmena pretplate</AlertDialogTitle>
            <AlertDialogDescription>
              Ručno menjaš pretplatu za {pending.trainerName}. Nastaviti?
            </AlertDialogDescription>
            <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {pending.summary}
            </div>
            <AlertDialogFooter>
              <Button variant="outline" size="sm" onClick={() => setPending(null)} disabled={submitting}>
                Otkaži
              </Button>
              <Button size="sm" onClick={runPending} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Potvrdi
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  )
}
