import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtDMYHM } from '@/lib/format'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { cn } from '@/lib/utils'

// Svi mejlovi koje FitLink salje, iz RPC-a admin_email_log: mejlovi aplikacije (clanarina,
// pretplata), mejlovi probe, mejlovi povratka i pozivnice vezbacima. Otvaranje se meri slikom
// 1x1, a za pozivnice (salje ih Supabase Auth) se vidi samo da su poslate i da li su prihvacene.

type Mejl = {
  id: string
  izvor: 'aplikacija' | 'proba' | 'povratak' | 'pozivnica'
  vrsta: string
  naziv: string
  primalac: string | null
  ime: string | null
  email: string | null
  uloga: string | null
  poslato: string
  uspeh: boolean
  greska: string | null
  opened_at: string | null
  open_count: number
  clicked_at: string | null
  click_count: number
  meri_otvaranje: boolean
  odjavljen: boolean
  test: boolean
}

type Filter = 'svi' | 'proba' | 'aplikacija' | 'povratak' | 'pozivnica'
const FILTERI: { kljuc: Filter; naziv: string }[] = [
  { kljuc: 'svi', naziv: 'Svi' },
  { kljuc: 'proba', naziv: 'Proba i pretplata' },
  { kljuc: 'aplikacija', naziv: 'Članarine i podsetnici' },
  { kljuc: 'povratak', naziv: 'Povratak trenera' },
  { kljuc: 'pozivnica', naziv: 'Pozivnice' },
]

function Znacka({ tone, children }: { tone: 'gray' | 'green' | 'violet' | 'red' | 'amber'; children: React.ReactNode }) {
  const t = {
    gray: 'bg-muted text-muted-foreground',
    green: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200',
    violet: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200',
    red: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
    amber: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  }[tone]
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', t)}>{children}</span>
}

function Zbir({ naziv, broj, deo }: { naziv: string; broj: number; deo?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-muted-foreground">{naziv}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-2xl font-bold tabular-nums text-foreground">{broj}</span>
        {deo ? <span className="text-xs text-muted-foreground">{deo}</span> : null}
      </div>
    </Card>
  )
}

const procenat = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '')
const nazivUloge = (u: string | null) => (u === 'trainer' ? 'Trener' : u === 'athlete' ? 'Vežbač' : u === 'admin' ? 'Admin' : '')

export default function DnevnikMejlova() {
  const [rows, setRows] = useState<Mejl[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<Filter>('svi')
  const [samoNeotvoreni, setSamoNeotvoreni] = useState(false)
  const [saTestom, setSaTestom] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const { data, error: err } = await supabase.rpc('admin_email_log', { p_limit: 2000 })
    if (err) setError(true)
    else setRows((data ?? []) as Mejl[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const imaTest = useMemo(() => (rows ?? []).some((r) => r.test), [rows])
  const vidljivi = useMemo(
    () =>
      (rows ?? []).filter(
        (r) =>
          (saTestom || !r.test) &&
          (filter === 'svi' || r.izvor === filter) &&
          (!samoNeotvoreni || (r.meri_otvaranje && !r.opened_at)),
      ),
    [rows, saTestom, filter, samoNeotvoreni],
  )

  const z = useMemo(() => {
    const mereni = vidljivi.filter((r) => r.meri_otvaranje)
    return {
      poslato: vidljivi.length,
      greske: vidljivi.filter((r) => !r.uspeh).length,
      mereni: mereni.length,
      otvoreno: mereni.filter((r) => r.opened_at).length,
      kliknuto: mereni.filter((r) => r.clicked_at).length,
    }
  }, [vidljivi])

  return (
    <div>
      {error && !rows ? (
        <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <TriangleAlert className="h-6 w-6" />
          </div>
          <div className="font-display text-lg font-semibold text-foreground">Greška pri učitavanju</div>
          <p className="max-w-sm text-sm text-muted-foreground">Nije moguće učitati mejlove. Pokušaj ponovo.</p>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" />
            Pokušaj ponovo
          </Button>
        </Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Zbir naziv="Poslato" broj={z.poslato} />
            <Zbir naziv="Otvoreno" broj={z.otvoreno} deo={procenat(z.otvoreno, z.mereni)} />
            <Zbir naziv="Kliknuto" broj={z.kliknuto} deo={procenat(z.kliknuto, z.mereni)} />
            <Zbir naziv="Nije poslato" broj={z.greske} />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            {FILTERI.map((f) => (
              <button
                key={f.kljuc}
                type="button"
                onClick={() => setFilter(f.kljuc)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-medium transition',
                  filter === f.kljuc ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {f.naziv}
              </button>
            ))}
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" className="h-4 w-4 rounded border-input" checked={samoNeotvoreni} onChange={(e) => setSamoNeotvoreni(e.target.checked)} />
              Samo neotvoreni
            </label>
            {imaTest && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" className="h-4 w-4 rounded border-input" checked={saTestom} onChange={(e) => setSaTestom(e.target.checked)} />
                Prikaži i probne naloge
              </label>
            )}
          </div>

          <p className="mb-4 max-w-3xl text-xs text-muted-foreground">
            Otvaranje je približno: Apple Mail sam učita slike, pa deo mejlova izgleda otvoren i kad nije. Klik je tačan.
            Pozivnice šalje Supabase, pa se za njih vidi samo da su poslate i da li ih je vežbač prihvatio. Mejlovi o
            članarini i pretplati se beleže od 20. novembra 2026.
          </p>

          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Poslato</TableHead>
                  <TableHead>Primalac</TableHead>
                  <TableHead>Mejl</TableHead>
                  <TableHead>Otvoren</TableHead>
                  <TableHead className="hidden md:table-cell">Klik</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !rows ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      {Array.from({ length: 5 }).map((__, j) => (
                        <TableCell key={j} className={j === 4 ? 'hidden md:table-cell' : undefined}>
                          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : vidljivi.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-16 text-center text-sm text-muted-foreground">
                      Nema mejlova za ovaj izbor.
                    </TableCell>
                  </TableRow>
                ) : (
                  vidljivi.map((r) => (
                    <TableRow key={`${r.izvor}-${r.id}`}>
                      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{fmtDMYHM(r.poslato)}</TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{r.ime || r.email || '-'}</div>
                        <div className="text-xs text-muted-foreground">
                          {[nazivUloge(r.uloga), r.ime ? r.email : null].filter(Boolean).join(' · ')}
                          {r.odjavljen ? ' · odjava od podsetnika' : ''}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-foreground">{r.naziv}</div>
                        {!r.uspeh ? <Znacka tone="red">{r.greska || 'nije poslat'}</Znacka> : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {!r.meri_otvaranje ? (
                          <span className="text-xs text-muted-foreground">ne meri se</span>
                        ) : r.opened_at ? (
                          <div>
                            <Znacka tone="green">Otvoren</Znacka>
                            <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                              {fmtDMYHM(r.opened_at)}
                              {r.open_count > 1 ? ` · ${r.open_count} puta` : ''}
                            </div>
                          </div>
                        ) : (
                          <Znacka tone="gray">Nije otvoren</Znacka>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell whitespace-nowrap">
                        {r.clicked_at ? (
                          <div>
                            <Znacka tone="violet">Kliknut</Znacka>
                            <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                              {fmtDMYHM(r.clicked_at)}
                              {r.click_count > 1 ? ` · ${r.click_count} puta` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  )
}
