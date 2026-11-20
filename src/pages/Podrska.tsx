import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCheck,
  ExternalLink,
  Info,
  Loader2,
  MessagesSquare,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Send,
} from 'lucide-react'
import {
  luno,
  CONV_SELECT,
  MSG_SELECT,
  FITLINK_SLUGOVI,
  SLUG_APLIKACIJA,
  SLUG_SAJT,
  fileUrl,
  imePosetioca,
  jeOnline,
  kadaKratko,
  sat,
  dan,
  bezbedanUrl,
  type LunoAgent,
  type LunoConversation,
  type LunoMessage,
  type LunoSite,
  type LunoVisitor,
} from '@/lib/luno'
import { fmtDMYHM, initials } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

// Podrška: cetovi iz Luno Chat-a za FitLink aplikaciju (sajt fitlink-app) i fitlink.rs (sajt fitlink).
// Citanje i odgovaranje ide direktno u Luno bazu, sa Luno nalogom vlasnika (agent). FitLink admin
// sesija se ovde ne koristi; Luno sesija ima svoj kljuc u storage-u (lib/luno.ts).

const AGENT_SELECT = 'id,name,email,role,color'
const POLL_MS = 5000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

type Izvor = 'app' | 'sajt' | 'sve'
type Status = 'open' | 'solved'

type Faza =
  | { faza: 'ucitava' }
  | { faza: 'prijava' }
  | { faza: 'greska'; email: string | null }
  | { faza: 'spreman'; ja: LunoAgent; email: string | null }

export default function Podrska() {
  const [stanje, setStanje] = useState<Faza>({ faza: 'ucitava' })
  // Poruka na kartici za prijavu (npr. nalog nije agent). Ne brise je dogadjaj odjave.
  const [porukaPrijave, setPorukaPrijave] = useState<string | null>(null)

  const proveriAgenta = useCallback(async (uid: string, email: string | null) => {
    const { data, error } = await luno.from('agents').select(AGENT_SELECT).eq('id', uid).maybeSingle()
    if (error) {
      setStanje({ faza: 'greska', email })
      return false
    }
    if (!data) {
      await luno.auth.signOut()
      setPorukaPrijave('Ovaj nalog nije agent u Luno-u.')
      setStanje({ faza: 'prijava' })
      return false
    }
    setPorukaPrijave(null)
    setStanje({ faza: 'spreman', ja: data as LunoAgent, email })
    return true
  }, [])

  useEffect(() => {
    let alive = true
    luno.auth.getSession().then(({ data: { session } }) => {
      if (!alive) return
      if (!session) setStanje({ faza: 'prijava' })
      else proveriAgenta(session.user.id, session.user.email ?? null)
    })
    const {
      data: { subscription },
    } = luno.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && alive) setStanje({ faza: 'prijava' })
    })
    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [proveriAgenta])

  const odjaviLuno = useCallback(async () => {
    await luno.auth.signOut()
    setStanje({ faza: 'prijava' })
  }, [])

  if (stanje.faza === 'ucitava') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Učitava se" />
      </div>
    )
  }

  if (stanje.faza === 'prijava') {
    return <PrijavaNaLuno poruka={porukaPrijave} onPrijava={proveriAgenta} />
  }

  if (stanje.faza === 'greska') {
    return (
      <div className="mx-auto max-w-sm pt-10">
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <div>
              <h1 className="font-display text-lg font-bold text-foreground">Luno nije dostupan</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Nije uspela provera naloga. Proveri internet i pokušaj ponovo.
              </p>
            </div>
            <Button
              onClick={async () => {
                setStanje({ faza: 'ucitava' })
                const { data } = await luno.auth.getSession()
                if (!data.session) setStanje({ faza: 'prijava' })
                else proveriAgenta(data.session.user.id, data.session.user.email ?? null)
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Pokušaj ponovo
            </Button>
            <button
              type="button"
              className="self-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={odjaviLuno}
            >
              Odjavi Luno
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <Inbox ja={stanje.ja} email={stanje.email} onOdjava={odjaviLuno} />
}

/* ------------------------------------------------------------------ */
/* Prijava                                                              */
/* ------------------------------------------------------------------ */

function PrijavaNaLuno({
  poruka,
  onPrijava,
}: {
  poruka: string | null
  onPrijava: (uid: string, email: string | null) => Promise<boolean>
}) {
  const [email, setEmail] = useState('')
  const [lozinka, setLozinka] = useState('')
  const [salje, setSalje] = useState(false)
  const [greska, setGreska] = useState<string | null>(null)

  const posalji = async (e: FormEvent) => {
    e.preventDefault()
    if (salje) return
    setGreska(null)
    setSalje(true)
    const { data, error } = await luno.auth.signInWithPassword({ email: email.trim(), password: lozinka })
    // Lozinka se ne cuva nigde: brise se iz forme odmah posle pokusaja.
    setLozinka('')
    if (error || !data.user) {
      setGreska('Pogrešan email ili šifra.')
      setSalje(false)
      return
    }
    await onPrijava(data.user.id, data.user.email ?? null)
    setSalje(false)
  }

  const prikaz = greska || poruka

  return (
    <div className="mx-auto max-w-sm pt-6 lg:pt-10">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <MessagesSquare className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Podrška</h1>
          <p className="text-sm text-muted-foreground">Poruke iz aplikacije i sa fitlink.rs</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="font-display text-base font-semibold text-foreground">Prijava na Luno</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Četovi podrške žive u Luno Chat-u. Prijavi se svojim Luno nalogom, sesija ostaje zapamćena na ovom
            uređaju.
          </p>
          <form onSubmit={posalji} className="mt-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="luno-email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                id="luno-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="luno-lozinka" className="text-sm font-medium text-foreground">
                Šifra
              </label>
              <Input
                id="luno-lozinka"
                type="password"
                autoComplete="current-password"
                required
                value={lozinka}
                onChange={(e) => setLozinka(e.target.value)}
              />
            </div>

            {prikaz && (
              <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-red-600">
                {prikaz}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={salje}>
              {salje && <Loader2 className="h-4 w-4 animate-spin" />}
              Prijavi se na Luno
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Inbox                                                                */
/* ------------------------------------------------------------------ */

function Inbox({ ja, email, onOdjava }: { ja: LunoAgent; email: string | null; onOdjava: () => void }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const izabranId = params.get('razgovor')

  const [sajtovi, setSajtovi] = useState<LunoSite[] | null>(null)
  const [tim, setTim] = useState<Map<string, LunoAgent>>(new Map())
  const [izvor, setIzvor] = useState<Izvor>('app')
  const [status, setStatus] = useState<Status>('open')
  const [razgovori, setRazgovori] = useState<LunoConversation[]>([])
  const [ucitava, setUcitava] = useState(true)
  const [greska, setGreska] = useState(false)
  const [neprocitano, setNeprocitano] = useState<Record<string, number>>({})
  const [uzivo, setUzivo] = useState(false)
  const [detaljiOtvoreni, setDetaljiOtvoreni] = useState(false)
  const [, setTik] = useState(0)
  const gurnuto = useRef(false)

  // Sajtovi i tim jednom. Samo FitLink slugovi, nista drugo iz Luno-a.
  const ucitajOsnovno = useCallback(async () => {
    const [s, t] = await Promise.all([
      luno.from('sites').select('id,slug,name,color').in('slug', FITLINK_SLUGOVI),
      luno.from('agents').select(AGENT_SELECT),
    ])
    if (s.error) {
      setGreska(true)
      setUcitava(false)
      return
    }
    setSajtovi(((s.data ?? []) as LunoSite[]).filter((x) => FITLINK_SLUGOVI.includes(x.slug)))
    setTim(new Map(((t.data ?? []) as LunoAgent[]).map((a) => [a.id, a])))
  }, [])
  useEffect(() => {
    ucitajOsnovno()
  }, [ucitajOsnovno])

  const sajtApp = sajtovi?.find((s) => s.slug === SLUG_APLIKACIJA) ?? null
  const sajtWeb = sajtovi?.find((s) => s.slug === SLUG_SAJT) ?? null
  const sviId = useMemo(() => (sajtovi ?? []).map((s) => s.id), [sajtovi])
  const filterId = useMemo(() => {
    if (izvor === 'app') return sajtApp ? [sajtApp.id] : []
    if (izvor === 'sajt') return sajtWeb ? [sajtWeb.id] : []
    return sviId
  }, [izvor, sajtApp, sajtWeb, sviId])

  const ucitaj = useCallback(async () => {
    if (!sajtovi) return
    if (!sviId.length) {
      setRazgovori([])
      setNeprocitano({})
      setUcitava(false)
      return
    }
    const listaP = filterId.length
      ? luno
          .from('conversations')
          .select(CONV_SELECT)
          .eq('status', status)
          .in('site_id', filterId)
          .order('last_message_at', { ascending: false })
          .limit(300)
      : Promise.resolve({ data: [] as unknown[], error: null })
    const brojP = luno
      .from('conversations')
      .select('site_id,unread_for_agent')
      .eq('status', 'open')
      .gt('unread_for_agent', 0)
      .in('site_id', sviId)
      .limit(1000)
    const [lista, broj] = await Promise.all([listaP, brojP])
    if (lista.error) {
      setGreska(true)
    } else {
      setGreska(false)
      // Naziv sajta uvek iz poznatih FitLink sajtova, i kad ugnjezdeni sites izostane.
      const poId = new Map((sajtovi ?? []).map((x) => [x.id, x]))
      setRazgovori(
        ((lista.data ?? []) as unknown as LunoConversation[]).map((c) => (c.sites ? c : { ...c, sites: poId.get(c.site_id) ?? null })),
      )
    }
    if (!broj.error) {
      const m: Record<string, number> = {}
      for (const r of (broj.data ?? []) as { site_id: string; unread_for_agent: number }[]) {
        m[r.site_id] = (m[r.site_id] ?? 0) + (r.unread_for_agent || 0)
      }
      setNeprocitano(m)
    }
    setUcitava(false)
  }, [sajtovi, sviId, filterId, status])

  useEffect(() => {
    setUcitava(true)
    ucitaj()
  }, [ucitaj])

  // Uzivo: promene razgovora na FitLink sajtovima. Ako realtime ne radi, lista se osvezava na 5 s.
  const ucitajRef = useRef(ucitaj)
  ucitajRef.current = ucitaj
  const sviKljuc = sviId.join(',')
  useEffect(() => {
    if (!sviKljuc) return
    let tajmer: number | undefined
    const ch = luno
      .channel(`fitlink-podrska-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `site_id=in.(${sviKljuc})` },
        () => {
          clearTimeout(tajmer)
          tajmer = window.setTimeout(() => ucitajRef.current(), 250)
        },
      )
      .subscribe((s) => setUzivo(s === 'SUBSCRIBED'))
    return () => {
      clearTimeout(tajmer)
      setUzivo(false)
      luno.removeChannel(ch)
    }
  }, [sviKljuc])
  useEffect(() => {
    if (uzivo || !sviKljuc) return
    const t = window.setInterval(() => ucitajRef.current(), POLL_MS)
    return () => clearInterval(t)
  }, [uzivo, sviKljuc])

  // Relativna vremena u listi ostaju sveza.
  useEffect(() => {
    const t = window.setInterval(() => setTik((x) => x + 1), 30000)
    return () => clearInterval(t)
  }, [])

  // Izabran razgovor koji nije u trenutnoj listi (link, drugi filter, upravo resen).
  const [dodatni, setDodatni] = useState<LunoConversation | null>(null)
  useEffect(() => {
    if (!izabranId || !sviId.length || razgovori.some((c) => c.id === izabranId)) {
      setDodatni(null)
      return
    }
    let alive = true
    luno
      .from('conversations')
      .select(CONV_SELECT)
      .eq('id', izabranId)
      .in('site_id', sviId)
      .maybeSingle()
      .then(({ data }) => {
        const c = (data as unknown as LunoConversation) ?? null
        if (alive) setDodatni(c && !c.sites ? { ...c, sites: (sajtovi ?? []).find((x) => x.id === c.site_id) ?? null } : c)
      })
    return () => {
      alive = false
    }
  }, [izabranId, razgovori, sviId, sajtovi])

  const izabran = (izabranId && (razgovori.find((c) => c.id === izabranId) ?? (dodatni?.id === izabranId ? dodatni : null))) || null

  const izaberi = (id: string) => {
    if (id === izabranId) return
    const vecOtvoren = !!izabranId
    setParams({ razgovor: id }, { replace: vecOtvoren })
    if (!vecOtvoren) gurnuto.current = true
  }
  const nazad = () => {
    if (gurnuto.current) {
      gurnuto.current = false
      navigate(-1)
    } else {
      setParams({}, { replace: true })
    }
  }

  const promeniStatus = async (c: LunoConversation, s: Status) => {
    const { error } = await luno.from('conversations').update({ status: s }).eq('id', c.id)
    if (error) {
      toast.error('Promena nije sačuvana. Pokušaj ponovo.')
      return
    }
    toast.success(s === 'solved' ? 'Razgovor je rešen.' : 'Razgovor je ponovo otvoren.')
    nazad()
    ucitaj()
  }

  const nemaFitlinkSajta = sajtovi !== null && !sviId.length
  const nemaIzabranogSajta = sajtovi !== null && sviId.length > 0 && !filterId.length

  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] min-h-[460px] max-w-7xl flex-col lg:h-[calc(100dvh-8rem)]">
      <div className={cn('mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1', izabran && 'hidden md:flex')}>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Podrška</h1>
          <p className="mt-1 text-sm text-muted-foreground">Poruke iz aplikacije i sa fitlink.rs, preko Luno Chat-a.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn('h-1.5 w-1.5 rounded-full', uzivo ? 'bg-green-500' : 'bg-amber-500')}
            aria-hidden
          />
          <span>{uzivo ? 'Uživo' : 'Osvežava se na 5 s'}</span>
          <span aria-hidden>·</span>
          <span className="max-w-[12rem] truncate" title={email ?? undefined}>
            {ja.name || email || 'Luno'}
          </span>
          <button
            type="button"
            onClick={onOdjava}
            className="rounded underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Odjavi Luno
          </button>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 overflow-hidden">
        {/* Lista */}
        <section
          aria-label="Razgovori"
          className={cn(
            'flex min-h-0 w-full flex-col border-r border-border md:w-80 md:shrink-0',
            izabran && 'hidden md:flex',
          )}
        >
          <div className="flex flex-col gap-2 border-b border-border p-3">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Izvor">
              <Cip on={izvor === 'app'} onClick={() => setIzvor('app')} broj={sajtApp ? neprocitano[sajtApp.id] : 0}>
                Aplikacija
              </Cip>
              <Cip on={izvor === 'sajt'} onClick={() => setIzvor('sajt')} broj={sajtWeb ? neprocitano[sajtWeb.id] : 0}>
                Sajt
              </Cip>
              <Cip on={izvor === 'sve'} onClick={() => setIzvor('sve')}>
                Sve
              </Cip>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Status">
              <Segment on={status === 'open'} onClick={() => setStatus('open')}>
                Otvoreni
              </Segment>
              <Segment on={status === 'solved'} onClick={() => setStatus('solved')}>
                Rešeni
              </Segment>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {ucitava && razgovori.length === 0 ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Učitava se" />
              </div>
            ) : greska && razgovori.length === 0 ? (
              <Prazno>
                Nije uspelo učitavanje.{' '}
                <button type="button" className="text-brand underline-offset-4 hover:underline" onClick={ucitaj}>
                  Pokušaj ponovo
                </button>
              </Prazno>
            ) : nemaFitlinkSajta ? (
              <Prazno>FitLink sajtovi još ne postoje u Luno-u.</Prazno>
            ) : nemaIzabranogSajta ? (
              <Prazno>
                Sajt {izvor === 'app' ? SLUG_APLIKACIJA : SLUG_SAJT} još ne postoji u Luno-u.
              </Prazno>
            ) : razgovori.length === 0 ? (
              <Prazno>{status === 'open' ? 'Nema otvorenih razgovora.' : 'Nema rešenih razgovora.'}</Prazno>
            ) : (
              <ul>
                {razgovori.map((c) => (
                  <li key={c.id}>
                    <RedRazgovora
                      c={c}
                      aktivan={c.id === izabranId}
                      saSajtom={izvor === 'sve'}
                      onClick={() => izaberi(c.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Cet */}
        {izabran ? (
          <>
            <Razgovor
              key={izabran.id}
              conv={izabran}
              ja={ja}
              tim={tim}
              onNazad={nazad}
              onDetalji={() => setDetaljiOtvoreni(true)}
              onPromena={ucitaj}
              onStatus={(s) => promeniStatus(izabran, s)}
            />
            <aside
              aria-label="Detalji posetioca"
              className="hidden w-72 shrink-0 overflow-y-auto border-l border-border xl:block"
            >
              <Detalji conv={izabran} />
            </aside>
            <Sheet open={detaljiOtvoreni} onOpenChange={setDetaljiOtvoreni}>
              <SheetContent className="max-w-sm overflow-y-auto xl:hidden">
                <div className="border-b border-border px-5 py-4 pr-12">
                  <SheetTitle>Detalji</SheetTitle>
                  <SheetDescription>{imePosetioca(izabran.visitors)}</SheetDescription>
                </div>
                <Detalji conv={izabran} />
              </SheetContent>
            </Sheet>
          </>
        ) : izabranId && dodatni === null && sviId.length > 0 && !ucitava ? (
          <div className="hidden flex-1 items-center justify-center p-6 text-sm text-muted-foreground md:flex">
            Razgovor nije pronađen.
          </div>
        ) : (
          <div className="hidden flex-1 flex-col items-center justify-center gap-2 p-6 text-center md:flex">
            <MessagesSquare className="h-8 w-8 text-muted-foreground/60" aria-hidden />
            <p className="text-sm text-muted-foreground">Izaberi razgovor sa leve strane.</p>
          </div>
        )}
      </Card>
    </div>
  )
}

function Cip({
  on,
  onClick,
  broj,
  children,
}: {
  on: boolean
  onClick: () => void
  broj?: number
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        on
          ? 'border-transparent bg-accent text-accent-foreground'
          : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
      {!!broj && (
        <span className="min-w-[1.125rem] rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-[1.125rem] text-white tabular-nums">
          {broj > 99 ? '99+' : broj}
        </span>
      )}
    </button>
  )
}

function Segment({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'h-7 rounded-md text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        on ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Prazno({ children }: { children: ReactNode }) {
  return <div className="px-6 py-10 text-center text-sm text-muted-foreground">{children}</div>
}

function Avatar({ v, velicina = 'md' }: { v: LunoVisitor | null; velicina?: 'md' | 'lg' }) {
  const ime = imePosetioca(v)
  const slova = ime === 'Posetilac' ? 'P' : initials(ime.split('·')[0], v?.email)
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-accent-foreground',
        velicina === 'lg' ? 'h-14 w-14 text-base' : 'h-9 w-9 text-xs',
      )}
      aria-hidden
    >
      {slova}
      {jeOnline(v) && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full bg-green-500 ring-2 ring-card',
            velicina === 'lg' ? 'h-3 w-3' : 'h-2.5 w-2.5',
          )}
        />
      )}
    </span>
  )
}

function nazivSajta(s: LunoSite | null): string {
  if (!s) return ''
  if (s.slug === SLUG_APLIKACIJA) return 'Aplikacija'
  if (s.slug === SLUG_SAJT) return 'Sajt'
  return s.name
}

function RedRazgovora({
  c,
  aktivan,
  saSajtom,
  onClick,
}: {
  c: LunoConversation
  aktivan: boolean
  saSajtom: boolean
  onClick: () => void
}) {
  const ime = imePosetioca(c.visitors)
  const neproc = c.unread_for_agent || 0
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={aktivan ? 'true' : undefined}
      className={cn(
        'flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        aktivan ? 'bg-accent' : 'hover:bg-muted',
      )}
    >
      <Avatar v={c.visitors} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn('min-w-0 flex-1 truncate text-sm', neproc ? 'font-semibold text-foreground' : 'font-medium text-foreground')}>
            {ime}
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{kadaKratko(c.last_message_at)}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className={cn('min-w-0 flex-1 truncate text-xs', neproc ? 'text-foreground' : 'text-muted-foreground')}>
            {c.last_message_preview || 'Bez poruka'}
          </span>
          {neproc > 0 && (
            <span
              className="min-w-[1.25rem] shrink-0 rounded-full bg-primary px-1.5 text-center text-[11px] font-semibold leading-5 text-white tabular-nums"
              aria-label={`${neproc} nepročitano`}
            >
              {neproc > 99 ? '99+' : neproc}
            </span>
          )}
        </span>
        {saSajtom && c.sites && (
          <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {nazivSajta(c.sites)}
          </span>
        )}
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Razgovor                                                             */
/* ------------------------------------------------------------------ */

function Razgovor({
  conv,
  ja,
  tim,
  onNazad,
  onDetalji,
  onPromena,
  onStatus,
}: {
  conv: LunoConversation
  ja: LunoAgent
  tim: Map<string, LunoAgent>
  onNazad: () => void
  onDetalji: () => void
  onPromena: () => void
  onStatus: (s: Status) => Promise<void>
}) {
  const [poruke, setPoruke] = useState<LunoMessage[]>([])
  const [ucitano, setUcitano] = useState(false)
  const [greska, setGreska] = useState(false)
  const [uzivo, setUzivo] = useState(false)
  const [kuca, setKuca] = useState('')
  const [menja, setMenja] = useState(false)
  const teloRef = useRef<HTMLDivElement>(null)
  const blizuDna = useRef(true)
  const oznacava = useRef(false)
  const promenaRef = useRef(onPromena)
  promenaRef.current = onPromena

  const dodaj = useCallback((m: LunoMessage) => {
    setPoruke((xs) => (xs.some((x) => x.id === m.id) ? xs : [...xs, m]))
  }, [])

  // Procitano: brojac u razgovoru na 0 (lista i bedzevi padaju odmah), kao Luno inbox.
  const oznaciProcitano = useCallback(() => {
    if (document.hidden) return
    luno
      .from('conversations')
      .update({ unread_for_agent: 0 })
      .eq('id', conv.id)
      .then(({ error }) => {
        if (!error) promenaRef.current()
      })
  }, [conv.id])

  // Poruke posetioca su vidjene kad je razgovor otvoren u vidljivom jezicku.
  const oznaciVidjeno = useCallback(() => {
    if (document.hidden || oznacava.current) return
    oznacava.current = true
    const sada = new Date().toISOString()
    luno
      .from('messages')
      .update({ read_at: sada })
      .eq('conversation_id', conv.id)
      .eq('sender_type', 'visitor')
      .is('read_at', null)
      .then(({ error }) => {
        oznacava.current = false
        if (!error) {
          setPoruke((xs) => xs.map((x) => (x.sender_type === 'visitor' && !x.read_at ? { ...x, read_at: sada } : x)))
        }
      })
  }, [conv.id])

  const ucitajPoruke = useCallback(async () => {
    const { data, error } = await luno
      .from('messages')
      .select(MSG_SELECT)
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
      .limit(500)
    if (error) {
      setGreska(true)
    } else {
      setGreska(false)
      const nove = (data ?? []) as LunoMessage[]
      setPoruke((xs) => {
        // Spoji sa porukama koje su vec stigle uzivo ili su upravo poslate.
        const ids = new Set(nove.map((m) => m.id))
        const visak = xs.filter((m) => !ids.has(m.id))
        return visak.length ? [...nove, ...visak].sort((a, b) => a.created_at.localeCompare(b.created_at)) : nove
      })
    }
    setUcitano(true)
  }, [conv.id])

  useEffect(() => {
    ucitajPoruke()
    if (conv.unread_for_agent > 0) oznaciProcitano()
    let kucaTajmer: number | undefined
    const ch = luno
      .channel(`conv:${conv.id}`, { config: { broadcast: { self: false } } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conv.id}` },
        (p) => {
          const m = p.new as LunoMessage
          dodaj(m)
          if (m.sender_type === 'visitor') {
            setKuca('')
            oznaciProcitano()
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conv.id}` },
        (p) => {
          const m = p.new as Partial<LunoMessage> & { id: string }
          setPoruke((xs) => xs.map((x) => (x.id === m.id ? { ...x, ...m } : x)))
        },
      )
      .on('broadcast', { event: 'visitor_typing' }, (p) => {
        const t = String((p.payload as { text?: unknown } | undefined)?.text ?? '')
        setKuca(t)
        clearTimeout(kucaTajmer)
        if (t) kucaTajmer = window.setTimeout(() => setKuca(''), 8000)
      })
      .subscribe((s) => setUzivo(s === 'SUBSCRIBED'))
    const naVidljivost = () => {
      if (!document.hidden) {
        oznaciProcitano()
        oznaciVidjeno()
      }
    }
    document.addEventListener('visibilitychange', naVidljivost)
    return () => {
      clearTimeout(kucaTajmer)
      luno.removeChannel(ch)
      document.removeEventListener('visibilitychange', naVidljivost)
    }
    // Samo pri otvaranju razgovora; unread_for_agent se ne prati ovde.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.id, ucitajPoruke, oznaciProcitano, oznaciVidjeno, dodaj])

  // Bez realtime veze: poruke na 5 s.
  useEffect(() => {
    if (uzivo) return
    const t = window.setInterval(() => ucitajPoruke(), POLL_MS)
    return () => clearInterval(t)
  }, [uzivo, ucitajPoruke])

  // Nova poruka posetioca dok je razgovor otvoren (uzivo ili kroz osvezavanje): procitano i vidjeno.
  const imaNevidjenih = poruke.some((m) => m.sender_type === 'visitor' && !m.read_at)
  useEffect(() => {
    if (!imaNevidjenih) return
    oznaciVidjeno()
    oznaciProcitano()
  }, [imaNevidjenih, oznaciVidjeno, oznaciProcitano])

  // Skrol prati nove poruke samo ako je vec bio pri dnu.
  useLayoutEffect(() => {
    const el = teloRef.current
    if (el && blizuDna.current) el.scrollTop = el.scrollHeight
  }, [poruke, kuca, ucitano])
  const naSkrol = () => {
    const el = teloRef.current
    if (el) blizuDna.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const v = conv.visitors
  const resen = conv.status === 'solved'

  return (
    <section aria-label="Razgovor" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={onNazad}
          className="-ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          aria-label="Nazad na razgovore"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar v={v} />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 break-words text-sm font-semibold leading-snug text-foreground">{imePosetioca(v)}</div>
          <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {[
              nazivSajta(conv.sites) && <span key="s">{nazivSajta(conv.sites)}</span>,
              jeOnline(v) && (
                <span key="o" className="text-green-500">
                  na mreži
                </span>
              ),
              resen && <span key="r">rešen</span>,
            ]
              .filter(Boolean)
              .map((x, i) => (
                <Fragment key={i}>
                  {i > 0 && <span aria-hidden>·</span>}
                  {x}
                </Fragment>
              ))}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="xl:hidden" onClick={onDetalji} aria-label="Detalji posetioca">
          <Info className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          aria-label={resen ? 'Ponovo otvori' : 'Rešeno'}
          disabled={menja}
          onClick={async () => {
            setMenja(true)
            await onStatus(resen ? 'open' : 'solved')
            setMenja(false)
          }}
        >
          {menja ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : resen ? (
            <RotateCcw className="h-4 w-4" />
          ) : (
            <CheckCheck className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{resen ? 'Ponovo otvori' : 'Rešeno'}</span>
        </Button>
      </header>

      <div ref={teloRef} onScroll={naSkrol} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        {!ucitano ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Učitava se" />
          </div>
        ) : greska && poruke.length === 0 ? (
          <Prazno>
            Poruke nisu učitane.{' '}
            <button type="button" className="text-brand underline-offset-4 hover:underline" onClick={ucitajPoruke}>
              Pokušaj ponovo
            </button>
          </Prazno>
        ) : poruke.length === 0 ? (
          <Prazno>Još nema poruka.</Prazno>
        ) : (
          <Poruke poruke={poruke} tim={tim} />
        )}
        {kuca && (
          <div className="mt-3 flex justify-start" aria-live="polite">
            <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-dashed border-border px-3.5 py-2 text-sm italic text-muted-foreground">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase not-italic tracking-wider">Kuca</span>
              {kuca}
            </div>
          </div>
        )}
      </div>

      <Pisanje conv={conv} ja={ja} onPoslato={(m) => { blizuDna.current = true; dodaj(m) }} />
    </section>
  )
}

const URL_RE = /https?:\/\/[^\s<>"']+/gi

// http(s) linkovi postaju klikabilni, sve ostalo ostaje obican tekst (React ga escape-uje).
function SaLinkovima({ tekst }: { tekst: string }) {
  const out: ReactNode[] = []
  let posl = 0
  let i = 0
  for (const m of tekst.matchAll(URL_RE)) {
    let sirov = m[0]
    const pocetak = m.index ?? 0
    while (/[.,!?;:)\]]$/.test(sirov)) sirov = sirov.slice(0, -1)
    const href = bezbedanUrl(sirov)
    if (!href) continue
    if (pocetak > posl) out.push(tekst.slice(posl, pocetak))
    out.push(
      <a key={i++} href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
        {sirov}
      </a>,
    )
    posl = pocetak + sirov.length
  }
  if (posl < tekst.length) out.push(tekst.slice(posl))
  return <>{out}</>
}

function velicina(b: number | undefined): string {
  const n = Number(b) || 0
  if (!n) return ''
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

function Poruke({ poruke, tim }: { poruke: LunoMessage[]; tim: Map<string, LunoAgent> }) {
  let posledniDan = ''
  const strana = (m: LunoMessage | undefined) =>
    !m || m.sender_type === 'system' || m.kind === 'email_card' ? 'sys' : m.sender_type === 'visitor' ? 'on' : `ja:${m.agent_id ?? m.sender_type}`
  const istaGrupa = (a: LunoMessage | undefined, b: LunoMessage | undefined) =>
    !!a &&
    !!b &&
    strana(a) !== 'sys' &&
    strana(a) === strana(b) &&
    dan(a.created_at) === dan(b.created_at) &&
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime() < 5 * 60 * 1000

  return (
    <div className="flex flex-col">
      {poruke.map((m, idx) => {
        const d = dan(m.created_at)
        const razdelnik =
          d !== posledniDan ? (
            ((posledniDan = d),
            (
              <div className="my-3 flex justify-center">
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground first-letter:uppercase">
                  {d}
                </span>
              </div>
            ))
          ) : null

        if (m.kind === 'email_card' || m.sender_type === 'system') {
          return (
            <Fragment key={m.id}>
              {razdelnik}
              <div className="my-2 text-center text-xs text-muted-foreground">
                {m.kind === 'email_card' ? (
                  <>
                    Posetilac je ostavio email: <span className="font-medium text-foreground">{m.body}</span>
                  </>
                ) : (
                  m.body
                )}
              </div>
            </Fragment>
          )
        }

        const moja = m.sender_type === 'agent' || m.sender_type === 'bot'
        const prva = !istaGrupa(poruke[idx - 1], m)
        const poslednja = !istaGrupa(m, poruke[idx + 1])
        const autor = m.sender_type === 'bot' ? 'Bot' : m.agent_id ? tim.get(m.agent_id)?.name || 'Agent' : 'Agent'
        const fajlovi = Array.isArray(m.attachments) ? m.attachments.filter((a) => a && a.path) : []

        return (
          <Fragment key={m.id}>
            {razdelnik}
            <div className={cn('flex flex-col', moja ? 'items-end' : 'items-start', prva ? 'mt-3' : 'mt-1')}>
              {moja && prva && <span className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">{autor}</span>}
              {m.kind === 'file' && fajlovi.length ? (
                fajlovi.map((a, i) => {
                  const ime = a.name || m.body || 'fajl'
                  return (
                    <a
                      key={i}
                      href={fileUrl(a.path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'mb-1 flex max-w-[85%] items-center gap-2.5 rounded-xl border border-border px-3 py-2 text-sm transition-colors hover:bg-muted sm:max-w-[70%]',
                        moja ? 'bg-accent' : 'bg-card',
                      )}
                    >
                      <Paperclip className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">{ime}</span>
                        {velicina(a.size) && <span className="block text-[11px] text-muted-foreground">{velicina(a.size)}</span>}
                      </span>
                    </a>
                  )
                })
              ) : (
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed sm:max-w-[70%]',
                    moja ? 'bg-primary text-white' : 'bg-secondary text-foreground',
                    moja ? (poslednja ? 'rounded-br-md' : '') : poslednja ? 'rounded-bl-md' : '',
                  )}
                >
                  <SaLinkovima tekst={m.body || ''} />
                </div>
              )}
              {poslednja && (
                <span className="mt-1 px-1 text-[10px] tabular-nums text-muted-foreground">
                  {sat(m.created_at)}
                  {moja && m.read_at ? ' · viđeno' : ''}
                </span>
              )}
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

function Pisanje({ conv, ja, onPoslato }: { conv: LunoConversation; ja: LunoAgent; onPoslato: (m: LunoMessage) => void }) {
  const [tekst, setTekst] = useState('')
  const [salje, setSalje] = useState(false)
  const [greska, setGreska] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const ta = ref.current
    if (!ta) return
    ta.style.height = 'auto'
    const h = Math.min(ta.scrollHeight + 2, 180)
    ta.style.height = `${h}px`
    ta.style.overflowY = ta.scrollHeight + 2 > 180 ? 'auto' : 'hidden'
  }, [tekst])

  const posalji = async () => {
    const body = tekst.trim()
    if (!body || salje) return
    setSalje(true)
    setGreska(null)
    const { data, error } = await luno
      .from('messages')
      .insert({ conversation_id: conv.id, sender_type: 'agent', agent_id: ja.id, body })
      .select(MSG_SELECT)
      .single()
    if (error) {
      setGreska('Poruka nije poslata. Pokušaj ponovo.')
    } else {
      setTekst('')
      onPoslato(data as LunoMessage)
    }
    setSalje(false)
    ref.current?.focus()
  }

  const naTaster = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      posalji()
    }
  }

  const id = `podrska-odgovor-${conv.id}`
  return (
    <footer className="border-t border-border p-3">
      <div className="flex items-end gap-2 rounded-xl border border-input bg-background p-1.5 focus-within:ring-2 focus-within:ring-ring">
        <label htmlFor={id} className="sr-only">
          Odgovor
        </label>
        <textarea
          id={id}
          ref={ref}
          rows={1}
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          onKeyDown={naTaster}
          placeholder="Napiši odgovor"
          className="max-h-[180px] min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <Button size="icon" onClick={posalji} disabled={!tekst.trim() || salje} aria-label="Pošalji">
          {salje ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
        {greska ? (
          <p role="alert" className="text-xs text-red-600">
            {greska}
          </p>
        ) : (
          <p className="hidden text-[11px] text-muted-foreground sm:block">Enter šalje, Shift+Enter novi red</p>
        )}
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------------ */
/* Detalji                                                              */
/* ------------------------------------------------------------------ */

function tekstMete(v: unknown): string {
  if (v === null || v === undefined || v === '') return '-'
  if (typeof v === 'boolean') return v ? 'Da' : 'Ne'
  if (typeof v === 'string' || typeof v === 'number') {
    const s = String(v)
    return s.length > 300 ? s.slice(0, 297) + '...' : s
  }
  try {
    const s = JSON.stringify(v)
    return s.length > 300 ? s.slice(0, 297) + '...' : s
  } catch {
    return '-'
  }
}

// Uloga iz mete ("Trener" ili "Klijent"), a ako je nema, iz imena ("Ana · Klijent").
function ulogaPosetioca(v: LunoVisitor | null): 'trener' | 'vezbac' | null {
  const meta = v?.meta ?? {}
  const izvor = `${typeof meta['Uloga'] === 'string' ? meta['Uloga'] : ''} ${v?.name?.split('·').slice(1).join(' ') ?? ''}`
    .toLowerCase()
  if (izvor.includes('trener')) return 'trener'
  if (izvor.includes('klijent') || izvor.includes('vežbač') || izvor.includes('vezbac')) return 'vezbac'
  return null
}

function Detalji({ conv }: { conv: LunoConversation }) {
  const v = conv.visitors
  const meta = v?.meta && typeof v.meta === 'object' && !Array.isArray(v.meta) ? v.meta : {}
  const stavke = Object.entries(meta).filter(([, x]) => x !== null && x !== undefined && x !== '')
  const fitlinkId = typeof meta['FitLink ID'] === 'string' ? meta['FitLink ID'].trim() : ''
  const uloga = ulogaPosetioca(v)
  const adminLink = fitlinkId && UUID_RE.test(fitlinkId) && uloga ? `/${uloga === 'trener' ? 'treneri' : 'vezbaci'}/${fitlinkId}` : null
  const strana = bezbedanUrl(v?.current_url)
  const mesto = [v?.city, v?.country].filter(Boolean).join(', ')
  const email = v?.email?.trim() || ''

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <Avatar v={v} velicina="lg" />
        <div className="min-w-0 max-w-full">
          <div className="break-words font-display text-base font-semibold text-foreground">{imePosetioca(v)}</div>
          <div className="text-xs text-muted-foreground">
            {[nazivSajta(conv.sites), jeOnline(v) ? 'na mreži' : v?.last_seen ? `viđen ${kadaKratko(v.last_seen)}` : '']
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        {adminLink && (
          <Button asChild variant="outline" size="sm" className="mt-1">
            <Link to={adminLink}>
              <ExternalLink className="h-4 w-4" />
              Otvori u adminu
            </Link>
          </Button>
        )}
      </div>

      <dl className="flex flex-col gap-3 text-sm">
        <Polje naziv="Email">
          {email ? (
            EMAIL_RE.test(email) ? (
              <a href={`mailto:${email}`} className="break-all text-brand underline-offset-4 hover:underline">
                {email}
              </a>
            ) : (
              <span className="break-all">{email}</span>
            )
          ) : (
            <span className="text-muted-foreground">Nije uneto</span>
          )}
        </Polje>
        {v?.phone && <Polje naziv="Telefon">{v.phone}</Polje>}
        {mesto && <Polje naziv="Mesto">{mesto}</Polje>}
        {v?.device && <Polje naziv="Pregledač">{v.device}</Polje>}
        {strana && (
          <Polje naziv="Stranica">
            <a href={strana} target="_blank" rel="noopener noreferrer" className="break-all text-brand underline-offset-4 hover:underline">
              {strana.replace(/^https?:\/\//, '')}
            </a>
          </Polje>
        )}
        {v?.first_seen && <Polje naziv="Prvi put">{fmtDMYHM(v.first_seen)}</Polje>}
      </dl>

      {stavke.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {conv.sites?.slug === SLUG_APLIKACIJA ? 'Iz aplikacije' : 'Dodatno'}
          </h3>
          <dl className="divide-y divide-border rounded-lg border border-border">
            {stavke.map(([k, x]) => {
              const t = tekstMete(x)
              const dug = t.length > 24
              return (
                <div
                  key={k}
                  className={cn('px-3 py-2 text-sm', dug ? 'flex flex-col gap-0.5' : 'flex items-start justify-between gap-3')}
                >
                  <dt className={cn('shrink-0 text-muted-foreground', dug && 'text-xs')}>{k}</dt>
                  <dd
                    className={cn(
                      'min-w-0 text-foreground',
                      dug ? 'break-all' : 'break-words text-right',
                      dug && UUID_RE.test(t) && 'text-xs tabular-nums',
                    )}
                  >
                    {t}
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
      )}
    </div>
  )
}

function Polje({ naziv, children }: { naziv: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{naziv}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  )
}
