import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

// Kostur modula za Fazu 0: naslov + "Uskoro" prazno stanje. Pravi sadrzaj se dodaje po fazama.
export function PagePlaceholder({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string
  subtitle?: string
  icon: LucideIcon
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div className="font-display text-lg font-semibold text-foreground">Uskoro</div>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ovaj modul je u pripremi. Sadržaj dodajemo u sledećoj fazi.
        </p>
      </Card>
    </div>
  )
}
