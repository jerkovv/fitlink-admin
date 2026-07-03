import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, RefreshCw, ArrowUp, ArrowDown, ChevronsUpDown, TriangleAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ListTrainer } from '@/lib/types'
import { fmtDMY, fmtInt, initials } from '@/lib/format'
import { SubBadge } from '@/components/SubBadge'
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

type SortKey = 'name' | 'created' | 'athletes'

function Avatar({ url, name, email }: { url: string | null; name: string | null; email: string | null }) {
  if (url) {
    return <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
  }
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
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-foreground',
          active && 'text-foreground',
        )}
      >
        {label}
        <Icon className={cn('h-3.5 w-3.5', active ? 'text-primary' : 'text-muted-foreground/50')} />
      </button>
    </TableHead>
  )
}

export default function Treneri() {
  const nav = useNavigate()
  const [rows, setRows] = useState<ListTrainer[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const { data, error: err } = await supabase.rpc('admin_list_trainers')
    if (err || !Array.isArray(data)) setError(true)
    else setRows(data as ListTrainer[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onSort = (col: SortKey) => {
    if (sortKey === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(col)
      setSortDir(col === 'name' ? 'asc' : 'desc')
    }
  }

  const filtered = useMemo(() => {
    const base = rows ?? []
    const needle = q.trim().toLowerCase()
    const f = needle
      ? base.filter(
          (t) =>
            (t.full_name ?? '').toLowerCase().includes(needle) ||
            (t.email ?? '').toLowerCase().includes(needle),
        )
      : base
    const sorted = [...f].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = (a.full_name ?? '').localeCompare(b.full_name ?? '', 'sr')
      else if (sortKey === 'athletes') cmp = (a.athlete_count ?? 0) - (b.athlete_count ?? 0)
      else cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [rows, q, sortKey, sortDir])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Treneri</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows ? `${fmtInt(rows.length)} trenera na platformi.` : 'Svi treneri na platformi.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Osveži
        </Button>
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pretraga po imenu ili email-u"
          className="pl-9"
        />
      </div>

      {error && !rows ? (
        <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <TriangleAlert className="h-6 w-6" />
          </div>
          <div className="font-display text-lg font-semibold text-foreground">Greška pri učitavanju</div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Nije moguće učitati listu trenera. Pokušaj ponovo.
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
                <SortHead label="Trener" col="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Grad / studio</TableHead>
                <SortHead
                  label="Vežbači"
                  col="athletes"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <TableHead>Pretplata</TableHead>
                <SortHead
                  label="Član od"
                  col="created"
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
                    <TableCell>
                      <div className="h-4 w-8 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell>
                      <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-16 text-center">
                    <div className="text-sm text-muted-foreground">
                      {rows && rows.length > 0
                        ? 'Nema trenera za tu pretragu.'
                        : 'Još nema trenera.'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer"
                    onClick={() => nav(`/treneri/${t.id}`, { state: { trainer: t } })}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar url={t.avatar_url} name={t.full_name} email={t.email} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">
                            {t.full_name || 'Bez imena'}
                          </div>
                          <div className="truncate text-xs text-muted-foreground md:hidden">
                            {t.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {t.email || '-'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {[t.city, t.studio_name].filter(Boolean).join(' / ') || '-'}
                    </TableCell>
                    <TableCell className="tabular-nums">{fmtInt(t.athlete_count)}</TableCell>
                    <TableCell>
                      <SubBadge status={t.sub_status} accessUntil={t.sub_access_until} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell tabular-nums text-muted-foreground">
                      {fmtDMY(t.created_at)}
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
