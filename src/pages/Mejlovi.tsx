import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import DnevnikMejlova from '@/pages/DnevnikMejlova'

// Mejlovi povratka: trener je potvrdio nalog a nije pokrenuo pretplatu.
// Mejl 1 ide 3 sata posle potvrde, mejl 2 tri dana kasnije. Podaci dolaze iz
// RPC-a admin_recovery_emails (tabela trainer_recovery_emails).

type Red = {
  trainer_id: string
  full_name: string | null
  email: string | null
  potvrdio_at: string | null
  poslednji: string
  m1_poslat: string | null
  m1_otvoren: string | null
  m1_klik: string | null
  m1_bez_potvrde: boolean | null
  m1_greska: string | null
  m2_poslat: string | null
  m2_otvoren: string | null
  m2_klik: string | null
  m2_bez_potvrde: boolean | null
  m2_greska: string | null
  odjavljen: boolean
  status: string | null
  pokrenuo: boolean
  trial_ends_at: string | null
  access_until: string | null
  last_payment_at: string | null
  platio: boolean
  test_nalog: boolean
}

type Tone = 'gray' | 'amber' | 'green' | 'red' | 'violet'
const TONES: Record<Tone, string> = {
  gray: 'bg-muted text-muted-foreground',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  green: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200',
  red: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  violet: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200',
}

function Znacka({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', TONES[tone])}>
      {children}
    </span>
  )
}

// Datum i vreme kao dd.mm. hh:mm (bez godine, lista je sveza).
function fmtDT(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}. ${p(d.getHours())}:${p(d.getMinutes())}`
}

const procenat = (deo: number, celo: number) => (celo > 0 ? `${Math.round((deo / celo) * 100)}%` : '-')

// Stanje jednog mejla za jednog trenera: najdalji korak do kog je stigao.
function StanjeMejla({
  poslat,
  otvoren,
  klik,
  bezPotvrde,
  greska,
}: {
  poslat: string | null
  otvoren: string | null
  klik: string | null
  bezPotvrde: boolean | null
  greska: string | null
}) {
  if (!poslat) return <span className="text-sm text-muted-foreground">Nije poslat</span>
  let znacka = <Znacka tone="gray">Poslat</Znacka>
  if (greska) znacka = <Znacka tone="red">Greška</Znacka>
  else if (klik) znacka = <Znacka tone="green">Kliknuo</Znacka>
  else if (otvoren) znacka = <Znacka tone="violet">Otvorio</Znacka>
  else if (bezPotvrde) znacka = <Znacka tone="amber">Bez potvrde</Znacka>
  return (
    <div className="flex flex-col items-start gap-1">
      {znacka}
      <span className="text-xs tabular-nums text-muted-foreground">
        {greska ? greska : `poslat ${fmtDT(poslat)}`}
      </span>
      {klik ? (
        <span className="text-xs tabular-nums text-muted-foreground">klik {fmtDT(klik)}</span>
      ) : otvoren ? (
        <span className="text-xs tabular-nums text-muted-foreground">otvoren {fmtDT(otvoren)}</span>
      ) : null}
    </div>
  )
}

function Ishod({ r }: { r: Red }) {
  if (r.platio) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Znacka tone="green">Platio</Znacka>
        <span className="text-xs tabular-nums text-muted-foreground">{fmtDMY(r.last_payment_at)}</span>
      </div>
    )
  }
  if (r.pokrenuo) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Znacka tone="amber">Pokrenuo probu</Znacka>
        {r.trial_ends_at && (
          <span className="text-xs tabular-nums text-muted-foreground">proba do {fmtDMY(r.trial_ends_at)}</span>
        )}
      </div>
    )
  }
  if (r.odjavljen) return <Znacka tone="red">Odjavio se</Znacka>
  return <span className="text-sm text-muted-foreground">Nije se vratio</span>
}

function Zbir({ naziv, broj, deo }: { naziv: string; broj: number; deo?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{naziv}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-2xl font-bold tabular-nums text-foreground">{broj}</span>
        {deo && <span className="text-xs tabular-nums text-muted-foreground">{deo}</span>}
      </div>
    </Card>
  )
}

function PovratakTrenera() {
  const [rows, setRows] = useState<Red[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saTestom, setSaTestom] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const { data, error: err } = await supabase.rpc('admin_recovery_emails')
    if (err) {
      setError(true)
    } else {
      setRows((data ?? []) as Red[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const imaTest = useMemo(() => (rows ?? []).some((r) => r.test_nalog), [rows])
  const vidljivi = useMemo(
    () => (rows ?? []).filter((r) => saTestom || !r.test_nalog),
    [rows, saTestom],
  )

  const z = useMemo(() => {
    const poslato = vidljivi.length
    return {
      poslato,
      otvorilo: vidljivi.filter((r) => r.m1_otvoren || r.m2_otvoren).length,
      kliknulo: vidljivi.filter((r) => r.m1_klik || r.m2_klik).length,
      pokrenulo: vidljivi.filter((r) => r.pokrenuo).length,
      platilo: vidljivi.filter((r) => r.platio).length,
      odjavilo: vidljivi.filter((r) => r.odjavljen).length,
    }
  }, [vidljivi])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Mejlovi povratka</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Treneri koji su potvrdili nalog a nisu pokrenuli pretplatu. Prvi mejl ide 3 sata posle potvrde
            naloga, drugi tri dana kasnije.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Osveži
        </Button>
      </div>

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
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Zbir naziv="Dobilo mejl" broj={z.poslato} />
            <Zbir naziv="Otvorilo" broj={z.otvorilo} deo={procenat(z.otvorilo, z.poslato)} />
            <Zbir naziv="Kliknulo" broj={z.kliknulo} deo={procenat(z.kliknulo, z.poslato)} />
            <Zbir naziv="Pokrenulo probu" broj={z.pokrenulo} deo={procenat(z.pokrenulo, z.poslato)} />
            <Zbir naziv="Platilo" broj={z.platilo} deo={procenat(z.platilo, z.poslato)} />
            <Zbir naziv="Odjavilo se" broj={z.odjavilo} deo={procenat(z.odjavilo, z.poslato)} />
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-3xl text-xs text-muted-foreground">
              Otvaranje je približno: Apple Mail sam učita slike, pa deo mejlova izgleda otvoren i kad nije.
              Klik, pokrenuta proba i naplata su tačni.
            </p>
            {imaTest && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={saTestom}
                  onChange={(e) => setSaTestom(e.target.checked)}
                />
                Prikaži i probne naloge
              </label>
            )}
          </div>

          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Trener</TableHead>
                  <TableHead className="hidden md:table-cell">Potvrdio nalog</TableHead>
                  <TableHead>Mejl 1</TableHead>
                  <TableHead>Mejl 2</TableHead>
                  <TableHead>Ishod</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !rows ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      <TableCell>
                        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : vidljivi.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-16 text-center text-sm text-muted-foreground">
                      Još nijedan mejl nije poslat. Prvi ide trener koji potvrdi nalog a za 3 sata ne pokrene
                      pretplatu.
                    </TableCell>
                  </TableRow>
                ) : (
                  vidljivi.map((r) => (
                    <TableRow key={r.trainer_id} className="align-top hover:bg-transparent">
                      <TableCell>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-foreground">{r.full_name || 'Bez imena'}</span>
                            {r.test_nalog && <Znacka tone="gray">Proba</Znacka>}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{r.email || '-'}</div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums text-muted-foreground">
                        {fmtDT(r.potvrdio_at)}
                      </TableCell>
                      <TableCell>
                        <StanjeMejla
                          poslat={r.m1_poslat}
                          otvoren={r.m1_otvoren}
                          klik={r.m1_klik}
                          bezPotvrde={r.m1_bez_potvrde}
                          greska={r.m1_greska}
                        />
                      </TableCell>
                      <TableCell>
                        <StanjeMejla
                          poslat={r.m2_poslat}
                          otvoren={r.m2_otvoren}
                          klik={r.m2_klik}
                          bezPotvrde={r.m2_bez_potvrde}
                          greska={r.m2_greska}
                        />
                      </TableCell>
                      <TableCell>
                        <Ishod r={r} />
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

// Stranica Mejlovi: "Svi mejlovi" (dnevnik svega sto FitLink salje, sa otvaranjem i klikom) i
// "Povratak trenera" (stari pregled mejlova povratka sa probom i naplatom).
export default function Mejlovi() {
  const [deo, setDeo] = useState<'svi' | 'povratak'>('svi')
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Mejlovi</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Svaki mejl koji FitLink pošalje: kome, kada, da li je otvoren i da li je kliknut.
        </p>
        <div className="mt-4 inline-flex rounded-lg bg-muted p-1">
          {([['svi', 'Svi mejlovi'], ['povratak', 'Povratak trenera']] as const).map(([k, t]) => (
            <button
              key={k}
              type="button"
              onClick={() => setDeo(k)}
              aria-pressed={deo === k}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition',
                deo === k ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {deo === 'svi' ? <DnevnikMejlova /> : <PovratakTrenera />}
    </div>
  )
}
