import { Users, UserCog, CreditCard, Flag } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const STATS: { label: string; icon: LucideIcon }[] = [
  { label: 'Treneri', icon: UserCog },
  { label: 'Vežbači', icon: Users },
  { label: 'Aktivne pretplate', icon: CreditCard },
  { label: 'Otvorene prijave', icon: Flag },
]

export default function Pregled() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Pregled</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ključne metrike i stanje platforme.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display text-2xl font-bold tracking-tight text-muted-foreground/40">
                  -
                </div>
                <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 flex flex-col items-center justify-center gap-2 border-dashed py-16 text-center">
        <div className="font-display text-lg font-semibold text-foreground">Uskoro</div>
        <p className="max-w-sm text-sm text-muted-foreground">
          Dashboard sa podacima stiže u sledećoj fazi.
        </p>
      </Card>
    </div>
  )
}
