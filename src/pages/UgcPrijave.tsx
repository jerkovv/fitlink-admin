import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, TriangleAlert, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { fmtDMY } from '@/lib/format'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

// Prijave UGC kreatora sa fitlink.rs/ugc-kreatori (tabela ugc_prijave).
// Citanje i promena statusa idu direktno kroz RLS (is_admin()); anon ima samo insert.

type UgcStatus = 'novo' | 'u_razmatranju' | 'odbijeno' | 'prihvaceno'

type UgcPrijava = {
  id: string
  created_at: string
  status: UgcStatus
  ime_prezime: string
  telefon: string
  email: string
  grad_drzava: string
  instagram: string
  tiktok: string | null
  portfolio_link: string | null
  linkovi_klipova: string[]
  upload_link: string | null
  fitness_pozadina: string
  cena_1_klip: number
  cena_paket_3: number | null
  cena_paket_5: number | null
  sta_ulazi_u_cenu: string
  rok_isporuke_dana: number
  oprema: string | null
  dostupnost: string
  napomena: string | null
}

type Tone = 'gray' | 'amber' | 'green' | 'red'
const TONES: Record<Tone, string> = {
  gray: 'bg-muted text-muted-foreground',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  green: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200',
  red: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
}

const STATUSI: { value: UgcStatus; label: string; tone: Tone }[] = [
  { value: 'novo', label: 'Novo', tone: 'amber' },
  { value: 'u_razmatranju', label: 'U razmatranju', tone: 'gray' },
  { value: 'prihvaceno', label: 'Prihvaćeno', tone: 'green' },
  { value: 'odbijeno', label: 'Odbijeno', tone: 'red' },
]
const statusInfo = (s: UgcStatus) => STATUSI.find((x) => x.value === s) ?? STATUSI[1]

type FilterKey = 'all' | UgcStatus
const FILTERS: { value: FilterKey; label: string }[] = [
  { value: 'all', label: 'Sve' },
  ...STATUSI.map((s) => ({ value: s.value as FilterKey, label: s.label })),
]

const selectCls =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

const eur = (n: number | null | undefined) =>
  n === null || n === undefined ? '-' : `${Number(n).toLocaleString('sr-Latn-RS')} EUR`

const handleUrl = (prefix: string, h: string | null) =>
  h ? `${prefix}${h.replace(/^@/, '')}` : null

function Ext({ href, children }: { href: string; children?: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 break-all text-primary underline-offset-2 hover:underline"
    >
      {children ?? href}
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  )
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-2 text-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="min-w-0 whitespace-pre-wrap break-words text-foreground">{children}</div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

// Inline promena statusa u tabeli i u detalju.
function StatusSelect({
  row,
  busy,
  onChange,
}: {
  row: UgcPrijava
  busy: boolean
  onChange: (id: string, s: UgcStatus) => void
}) {
  const info = statusInfo(row.status)
  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <select
        value={row.status}
        disabled={busy}
        onChange={(e) => onChange(row.id, e.target.value as UgcStatus)}
        aria-label="Status prijave"
        className={cn(
          'h-8 rounded-full border-0 px-2.5 pr-7 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          TONES[info.tone],
        )}
      >
        {STATUSI.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </div>
  )
}

export default function UgcPrijave() {
  const [rows, setRows] = useState<UgcPrijava[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const { data, error: err } = await supabase
      .from('ugc_prijave')
      .select('*')
      .order('created_at', { ascending: false })
    if (err || !Array.isArray(data)) setError(true)
    else setRows(data as UgcPrijava[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const base = rows ?? []
    return filter === 'all' ? base : base.filter((r) => r.status === filter)
  }, [rows, filter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows?.length ?? 0 }
    for (const r of rows ?? []) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [rows])

  const selected = selectedId ? (rows ?? []).find((r) => r.id === selectedId) ?? null : null

  const setStatus = async (id: string, status: UgcStatus) => {
    const prev = rows
    setBusyId(id)
    // Optimisticki, pa vrati ako padne.
    setRows((r) => (r ? r.map((x) => (x.id === id ? { ...x, status } : x)) : r))
    const { error: err } = await supabase.from('ugc_prijave').update({ status }).eq('id', id)
    setBusyId(null)
    if (err) {
      setRows(prev)
      toast.error('Promena statusa nije uspela.')
      return
    }
    toast.success(`Status: ${statusInfo(status).label}`)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            UGC prijave
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prijave kreatora sa fitlink.rs/ugc-kreatori. Status se menja direktno u tabeli.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Osveži
        </Button>
      </div>

      <div className="mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterKey)}
          className={cn(selectCls, 'w-auto min-w-[180px]')}
          aria-label="Filter po statusu"
        >
          {FILTERS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label} ({counts[o.value] ?? 0})
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
            Nije moguće učitati prijave. Pokušaj ponovo.
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
                <TableHead>Kreator</TableHead>
                <TableHead className="hidden md:table-cell">Instagram</TableHead>
                <TableHead className="hidden lg:table-cell">Grad</TableHead>
                <TableHead className="hidden sm:table-cell">1 klip</TableHead>
                <TableHead className="hidden lg:table-cell">Dostupnost</TableHead>
                <TableHead className="hidden sm:table-cell">Datum</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !rows ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j} className={cn(j > 0 && j < 6 && 'hidden sm:table-cell')}>
                        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                    Nema prijava.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelectedId(r.id)}>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{r.ime_prezime}</div>
                        <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Ext href={handleUrl('https://instagram.com/', r.instagram)!}>@{r.instagram}</Ext>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {r.grad_drzava}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell tabular-nums">{eur(r.cena_1_klip)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {r.dostupnost}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {fmtDMY(r.created_at)}
                    </TableCell>
                    <TableCell>
                      <StatusSelect row={r} busy={busyId === r.id} onChange={setStatus} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        {selected && (
          <SheetContent>
            <div className="border-b border-border p-5 pr-12">
              <SheetTitle>{selected.ime_prezime}</SheetTitle>
              <SheetDescription>
                {selected.grad_drzava} · poslato {fmtDMY(selected.created_at)}
              </SheetDescription>
              <div className="mt-3">
                <StatusSelect row={selected} busy={busyId === selected.id} onChange={setStatus} />
              </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <Group title="Osnovno">
                <KV label="Telefon">
                  <a href={`tel:${selected.telefon}`} className="text-primary">
                    {selected.telefon}
                  </a>
                </KV>
                <KV label="Email">
                  <a href={`mailto:${selected.email}`} className="text-primary">
                    {selected.email}
                  </a>
                </KV>
                <KV label="Grad i država">{selected.grad_drzava}</KV>
              </Group>

              <Group title="Profili">
                <KV label="Instagram">
                  <Ext href={handleUrl('https://instagram.com/', selected.instagram)!}>
                    @{selected.instagram}
                  </Ext>
                </KV>
                <KV label="TikTok">
                  {selected.tiktok ? (
                    <Ext href={handleUrl('https://tiktok.com/@', selected.tiktok)!}>@{selected.tiktok}</Ext>
                  ) : (
                    '-'
                  )}
                </KV>
                <KV label="Portfolio">
                  {selected.portfolio_link ? <Ext href={selected.portfolio_link} /> : '-'}
                </KV>
              </Group>

              <Group title="Sadržaj">
                <KV label="Klipovi">
                  <ol className="list-decimal space-y-1 pl-4">
                    {selected.linkovi_klipova.map((u, i) => (
                      <li key={i}>
                        <Ext href={u} />
                      </li>
                    ))}
                  </ol>
                </KV>
                <KV label="Fajlovi">{selected.upload_link ? <Ext href={selected.upload_link} /> : '-'}</KV>
                <KV label="Veza sa fitnesom">{selected.fitness_pozadina}</KV>
              </Group>

              <Group title="Cenovnik">
                <KV label="1 klip">{eur(selected.cena_1_klip)}</KV>
                <KV label="Paket od 3">{eur(selected.cena_paket_3)}</KV>
                <KV label="Paket od 5">{eur(selected.cena_paket_5)}</KV>
                <KV label="Šta ulazi u cenu">{selected.sta_ulazi_u_cenu}</KV>
                <KV label="Rok isporuke">{selected.rok_isporuke_dana} dana</KV>
                <KV label="Oprema">{selected.oprema || '-'}</KV>
                <KV label="Dostupnost">{selected.dostupnost}</KV>
              </Group>

              <Group title="Ostalo">
                <KV label="Napomena">{selected.napomena || '-'}</KV>
                <KV label="ID">
                  <span className="font-mono text-xs">{selected.id}</span>
                </KV>
              </Group>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  )
}
