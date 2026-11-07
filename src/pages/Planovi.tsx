import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  TriangleAlert,
  ClipboardList,
  Apple,
  FileWarning,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { PlanTrainerRow } from '@/lib/types'
import { fmtDMY, fmtInt, initials } from '@/lib/format'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { PrikazPrekidac, type Prikaz } from '@/components/TestNalozi'

type SortKey = 'name' | 'ukupno' | 'poslato' | 'nacrti' | 'sabloni' | 'poslednji'

function Avatar({ url, name, email }: { url: string | null; name: string | null; email: string | null }) {
  if (url) {
    return <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-brand">
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
        <Icon className={cn('h-3.5 w-3.5', active ? 'text-brand' : 'text-muted-foreground/50')} />
      </button>
    </TableHead>
  )
}

/** Brojka u tabeli - nula se stisa da oko odmah uhvati gde ima sadrzaja. */
function Brojka({ n }: { n: number }) {
  return (
    <span className={cn('tabular-nums', n === 0 ? 'text-muted-foreground' : 'text-foreground')}>
      {fmtInt(n)}
    </span>
  )
}

function KartaZbir({
  ikona: Ikona,
  naslov,
  broj,
  opis,
  tonUpozorenja,
}: {
  ikona: typeof ClipboardList
  naslov: string
  broj: number
  opis: string
  tonUpozorenja?: boolean
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            tonUpozorenja && broj > 0
              ? 'bg-destructive/10 text-destructive'
              : 'bg-accent text-brand',
          )}
        >
          <Ikona className="h-4 w-4" />
        </div>
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {naslov}
        </div>
      </div>
      <div className="mt-3 font-display text-2xl font-bold tabular-nums tracking-tight text-foreground">
        {fmtInt(broj)}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{opis}</p>
    </Card>
  )
}

export default function Planovi() {
  const nav = useNavigate()
  const [rows, setRows] = useState<PlanTrainerRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('ukupno')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [prikaz, setPrikaz] = useState<Prikaz>('pravi')

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const { data, error: err } = await supabase.rpc('admin_list_trainer_plans')
    if (err || !Array.isArray(data)) setError(true)
    else setRows(data as PlanTrainerRow[])
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

  const brojPravih = (rows ?? []).filter((t) => !t.is_test).length
  const brojTest = (rows ?? []).filter((t) => t.is_test).length

  const vidljivi = useMemo(
    () => (rows ?? []).filter((t) => (prikaz === 'test' ? t.is_test : !t.is_test)),
    [rows, prikaz],
  )

  const zbir = useMemo(() => {
    const s = (f: (t: PlanTrainerRow) => number) => vidljivi.reduce((a, t) => a + f(t), 0)
    return {
      sabloni: s((t) => t.sablona_treninga + t.sablona_ishrane),
      poslato: s((t) => t.programa_poslato + t.ishrane_poslato),
      nacrti: s((t) => t.programa_nacrt + t.ishrane_nacrt),
      bezPlana: vidljivi.reduce((a, t) => a + Math.max(0, t.vezbaca - t.vezbaca_sa_planom), 0),
    }
  }, [vidljivi])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const f = needle
      ? vidljivi.filter(
          (t) =>
            (t.full_name ?? '').toLowerCase().includes(needle) ||
            (t.email ?? '').toLowerCase().includes(needle),
        )
      : vidljivi
    const sorted = [...f].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = (a.full_name ?? '').localeCompare(b.full_name ?? '', 'sr')
      else if (sortKey === 'sabloni')
        cmp = a.sablona_treninga + a.sablona_ishrane - (b.sablona_treninga + b.sablona_ishrane)
      else if (sortKey === 'poslato')
        cmp = a.programa_poslato + a.ishrane_poslato - (b.programa_poslato + b.ishrane_poslato)
      else if (sortKey === 'nacrti')
        cmp = a.programa_nacrt + a.ishrane_nacrt - (b.programa_nacrt + b.ishrane_nacrt)
      else if (sortKey === 'poslednji')
        cmp =
          new Date(a.poslednji_plan_at ?? 0).getTime() - new Date(b.poslednji_plan_at ?? 0).getTime()
      else cmp = a.planova_ukupno - b.planova_ukupno
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [vidljivi, q, sortKey, sortDir])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Planovi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Koliko planova ima koji trener i koji su to tačno. Klik na red otvara spisak.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Osveži
        </Button>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KartaZbir
          ikona={ClipboardList}
          naslov="Šabloni"
          broj={zbir.sabloni}
          opis="Treninga i ishrane, spremni za dodelu."
        />
        <KartaZbir
          ikona={Apple}
          naslov="Poslato"
          broj={zbir.poslato}
          opis="Planovi koje vežbači stvarno vide."
        />
        <KartaZbir
          ikona={FileWarning}
          naslov="Nacrti"
          broj={zbir.nacrti}
          opis="Još neposlato - vežbač ih ne vidi."
          tonUpozorenja
        />
        <KartaZbir
          ikona={TriangleAlert}
          naslov="Bez plana"
          broj={zbir.bezPlana}
          opis="Vežbači kojima nijedan plan nije poslat."
          tonUpozorenja
        />
      </div>

      <div className="mb-4">
        <PrikazPrekidac
          prikaz={prikaz}
          onChange={setPrikaz}
          brojPravih={brojPravih}
          brojTest={brojTest}
        />
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
            Nije moguće učitati pregled planova. Pokušaj ponovo.
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
                <SortHead
                  label="Šabloni"
                  col="sabloni"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <SortHead
                  label="Poslato"
                  col="poslato"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <SortHead
                  label="Nacrti"
                  col="nacrti"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <TableHead className="hidden md:table-cell">Vežbači s planom</TableHead>
                <SortHead
                  label="Poslednji plan"
                  col="poslednji"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  className="hidden sm:table-cell"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !rows ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    <TableCell colSpan={6}>
                      <div className="h-8 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    {q ? 'Nema trenera za tu pretragu.' : 'Nema trenera u ovoj grupi.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => {
                  const sabloni = t.sablona_treninga + t.sablona_ishrane
                  const poslato = t.programa_poslato + t.ishrane_poslato
                  const nacrti = t.programa_nacrt + t.ishrane_nacrt
                  const bezPlana = Math.max(0, t.vezbaca - t.vezbaca_sa_planom)
                  return (
                    <TableRow
                      key={t.id}
                      onClick={() => nav(`/planovi/${t.id}`)}
                      className="cursor-pointer"
                    >
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar url={t.avatar_url} name={t.full_name} email={t.email} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-foreground">
                              {t.full_name || 'Bez imena'}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">{t.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Brojka n={sabloni} />
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {t.sablona_treninga}T / {t.sablona_ishrane}I
                        </span>
                      </TableCell>
                      <TableCell>
                        <Brojka n={poslato} />
                      </TableCell>
                      <TableCell>
                        {nacrti > 0 ? (
                          <Badge variant="destructive">{fmtInt(nacrti)}</Badge>
                        ) : (
                          <span className="tabular-nums text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="tabular-nums text-foreground">
                          {fmtInt(t.vezbaca_sa_planom)}
                        </span>
                        <span className="text-muted-foreground"> / {fmtInt(t.vezbaca)}</span>
                        {bezPlana > 0 && (
                          <span className="ml-2 text-xs text-destructive">{bezPlana} bez plana</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {fmtDMY(t.poslednji_plan_at)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
