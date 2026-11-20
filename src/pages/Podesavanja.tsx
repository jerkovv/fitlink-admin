import { useCallback, useEffect, useState } from 'react'
import { Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// Admin podesavanja (tabela admin_podesavanja preko admin_get_podesavanja / admin_set_podesavanje).
// Prvo podesavanje: mejl adminu cim se novi trener registruje (okidac na trainers).

type NoviTrenerMejl = { ukljuceno?: boolean; adresa?: string | null }

export default function Podesavanja() {
  const [ucitano, setUcitano] = useState(false)
  const [greska, setGreska] = useState(false)
  const [ukljuceno, setUkljuceno] = useState(true)
  const [adresa, setAdresa] = useState('')
  const [cuva, setCuva] = useState(false)

  const ucitaj = useCallback(async () => {
    setGreska(false)
    const { data, error } = await supabase.rpc('admin_get_podesavanja')
    if (error) {
      setGreska(true)
      return
    }
    const p = ((data ?? {}) as Record<string, NoviTrenerMejl>)['novi_trener_mejl'] ?? {}
    setUkljuceno(p.ukljuceno !== false)
    setAdresa(p.adresa ?? '')
    setUcitano(true)
  }, [])

  useEffect(() => {
    ucitaj()
  }, [ucitaj])

  const sacuvaj = async (novoUkljuceno: boolean, novaAdresa: string) => {
    setCuva(true)
    const { error } = await supabase.rpc('admin_set_podesavanje', {
      p_kljuc: 'novi_trener_mejl',
      p_vrednost: { ukljuceno: novoUkljuceno, adresa: novaAdresa.trim() || null },
    })
    setCuva(false)
    if (error) {
      toast.error('Podešavanje nije sačuvano.')
      return false
    }
    toast.success('Sačuvano')
    return true
  }

  const prebaci = async () => {
    const novo = !ukljuceno
    setUkljuceno(novo)
    if (!(await sacuvaj(novo, adresa))) setUkljuceno(!novo)
  }

  const adresaIspravna = adresa.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresa.trim())

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Podešavanja</h1>
        <p className="mt-1 text-sm text-muted-foreground">Obaveštenja koja stižu tebi kao adminu.</p>
      </div>

      {greska && !ucitano ? (
        <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <TriangleAlert className="h-6 w-6" />
          </div>
          <div className="font-display text-lg font-semibold text-foreground">Podešavanja nisu učitana</div>
          <Button variant="outline" size="sm" onClick={ucitaj}>
            Pokušaj ponovo
          </Button>
        </Card>
      ) : !ucitano ? (
        <Card className="h-40 animate-pulse bg-muted/40" />
      ) : (
        <Card className="space-y-5 p-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="font-semibold text-foreground">Mejl kad se registruje novi trener</div>
              <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                Stiže čim trener napravi nalog, i pre nego što potvrdi mejl: ime, mejl, vreme registracije i dugme
                za njegov profil u adminu.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={ukljuceno}
              disabled={cuva}
              onClick={prebaci}
              className={cn(
                'relative h-7 w-12 shrink-0 rounded-full transition',
                ukljuceno ? 'bg-violet-600' : 'bg-muted',
                cuva && 'opacity-60',
              )}
            >
              <span
                className={cn(
                  'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all',
                  ukljuceno ? 'left-6' : 'left-1',
                )}
              />
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="adresa">
              Adresa za obaveštenja
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="adresa"
                type="email"
                value={adresa}
                onChange={(e) => setAdresa(e.target.value)}
                placeholder="ime@primer.rs"
                className="sm:max-w-sm"
              />
              <Button
                onClick={() => sacuvaj(ukljuceno, adresa)}
                disabled={cuva || !adresaIspravna}
                className="sm:w-32"
              >
                {cuva ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sačuvaj'}
              </Button>
            </div>
            {!adresaIspravna ? <p className="text-xs text-destructive">Adresa nije ispravna.</p> : null}
            {ukljuceno && adresa.trim() === '' ? (
              <p className="text-xs text-amber-700">Bez adrese mejl ne može da se pošalje.</p>
            ) : null}
          </div>
        </Card>
      )}
    </div>
  )
}
