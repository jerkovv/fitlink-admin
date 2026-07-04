import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, RefreshCw, ArrowUp, ArrowDown, ChevronsUpDown, TriangleAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ListAthlete } from '@/lib/types'
import { fmtDMY, fmtInt, initials } from '@/lib/format'
import { goalLabel } from '@/lib/goals'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

type SortKey = 'name' | 'workouts' | 'joined'

const selectCls =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

// '__none__' = bez trenera; '' = svi treneri.
const NO_TRAINER = '__none__'

function Avatar({ url, name, email }: { url: string | null; name: string | null; email: string | null }) {
  if (url) return <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-primary">
      {initials(name, email)}
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

export default function Vezbaci() {
  const nav = useNavigate()
  const [rows, setRows] = useState<ListAthlete[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [q, setQ] = useState('')
  const [trainerFilter, setTrainerFilter] = useState('') // '' svi, NO_TRAINER bez, inace trainer_id
  const [sortKey, setSortKey] = useState<SortKey>('joined')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const { data, error: err } = await supabase.rpc('admin_list_athletes')
    if (err || !Array.isArray(data)) setError(true)
    else setRows(data as ListAthlete[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onSort = (col: SortKey) => {
    if (sortKey === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(col)
      setSortDir(col === 'name' ? 'asc' : 'desc')
    }
  }

  // Treneri koji imaju bar jednog vezbaca (za filter dropdown).
  const trainerOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows ?? []) {
      if (r.trainer_id) map.set(r.trainer_id, r.trainer_name || 'Bez imena')
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'sr'))
  }, [rows])

  const filtered = useMemo(() => {
    const base = rows ?? []
    const needle = q.trim().toLowerCase()
    const f = base.filter((a) => {
      if (trainerFilter === NO_TRAINER && a.trainer_id) return false
      if (trainerFilter && trainerFilter !== NO_TRAINER && a.trainer_id !== trainerFilter) return false
      if (!needle) return true
      return (
        (a.full_name ?? '').toLowerCase().includes(needle) ||
        (a.email ?? '').toLowerCase().includes(needle)
      )
    })
    const sorted = [...f].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = (a.full_name ?? '').localeCompare(b.full_name ?? '', 'sr')
      else if (sortKey === 'workouts') cmp = (a.workouts_done ?? 0) - (b.workouts_done ?? 0)
      else cmp = new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [rows, q, trainerFilter, sortKey, sortDir])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Vežbači</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows ? `${fmtInt(rows.length)} vežbača na platformi.` : 'Svi vežbači na platformi.'}
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
          value={trainerFilter}
          onChange={(e) => setTrainerFilter(e.target.value)}
          className={cn(selectCls, 'w-auto min-w-[180px] max-w-[240px]')}
          aria-label="Filter po treneru"
        >
          <option value="">Svi treneri</option>
          <option value={NO_TRAINER}>Bez trenera</option>
          {trainerOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
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
            Nije moguće učitati listu vežbača. Pokušaj ponovo.
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
                <SortHead label="Vežbač" col="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Trener</TableHead>
                <TableHead className="hidden sm:table-cell">Cilj</TableHead>
                <SortHead
                  label="Treninga"
                  col="workouts"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <TableHead className="hidden lg:table-cell">Poslednji</TableHead>
                <SortHead
                  label="Član od"
                  col="joined"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  className="hidden sm:table-cell"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !rows ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-8 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                    {rows && rows.length > 0 ? 'Nema vežbača za taj filter.' : 'Još nema vežbača.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer"
                    onClick={() => nav(`/vezbaci/${a.id}`, { state: { athlete: a } })}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar url={a.avatar_url} name={a.full_name} email={a.email} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">
                            {a.full_name || 'Bez imena'}
                          </div>
                          <div className="truncate text-xs text-muted-foreground md:hidden">
                            {a.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {a.email || '-'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {a.trainer_name || '-'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {goalLabel(a.goal)}
                    </TableCell>
                    <TableCell className="tabular-nums">{fmtInt(a.workouts_done)}</TableCell>
                    <TableCell className="hidden lg:table-cell tabular-nums text-muted-foreground">
                      {fmtDMY(a.last_workout)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell tabular-nums text-muted-foreground">
                      {fmtDMY(a.joined_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
