import { useState } from 'react'
import { FlaskConical, Loader2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type Prikaz = 'pravi' | 'test'

/**
 * Prebacivanje izmedju pravih i test naloga.
 *
 * Podrazumevano se gledaju PRAVI: test nalozi su tu samo kad ih trazis, a broj
 * pored svake grupe kaze koliko ih ima, da prelazak ne bude nagadjanje.
 */
export function PrikazPrekidac({
  prikaz,
  onChange,
  brojPravih,
  brojTest,
}: {
  prikaz: Prikaz
  onChange: (p: Prikaz) => void
  brojPravih: number
  brojTest: number
}) {
  const dugme = (vrednost: Prikaz, tekst: string, broj: number) => (
    <button
      type="button"
      onClick={() => onChange(vrednost)}
      aria-pressed={prikaz === vrednost}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
        prikaz === vrednost
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {vrednost === 'test' && <FlaskConical className="h-3.5 w-3.5" />}
      {tekst}
      <span className="tabular-nums text-xs text-muted-foreground">{broj}</span>
    </button>
  )

  return (
    <div className="inline-flex rounded-lg bg-muted p-1">
      {dugme('pravi', 'Pravi korisnici', brojPravih)}
      {dugme('test', 'Test nalozi', brojTest)}
    </div>
  )
}

/**
 * Dugme koje nalog premesta u drugu grupu.
 *
 * Jedini upis je red u admin_test_accounts - nalog se NE dira: ne brise se, ne
 * menja mu se mejl, ne gasi se. Zato je i povratno u oba smera bez posledica.
 */
export function OznakaDugme({
  userId,
  isTest,
  onDone,
}: {
  userId: string
  isTest: boolean
  onDone: () => void
}) {
  const [salje, setSalje] = useState(false)

  const prebaci = async () => {
    setSalje(true)
    const { error } = await supabase.rpc('admin_set_test_account', {
      p_user_id: userId,
      p_is_test: !isTest,
    })
    setSalje(false)
    if (error) {
      toast.error('Nije uspelo: ' + error.message)
      return
    }
    toast.success(isTest ? 'Vraćen među prave korisnike' : 'Označen kao test nalog')
    onDone()
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={(e) => {
        // Red je klikabilan (vodi na detalje), pa ovo dugme mora da zaustavi klik.
        e.stopPropagation()
        void prebaci()
      }}
      disabled={salje}
      title={isTest ? 'Vrati među prave korisnike' : 'Označi kao test nalog'}
      className="h-8 px-2 text-muted-foreground hover:text-foreground"
    >
      {salje ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isTest ? (
        <Undo2 className="h-3.5 w-3.5" />
      ) : (
        <FlaskConical className="h-3.5 w-3.5" />
      )}
    </Button>
  )
}
