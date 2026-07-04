import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Save, Loader2, Trash2, Check, BadgeCheck } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { FoodItem } from '@/lib/types'
import { FOOD_CATEGORIES } from '@/lib/food'
import { fmtDMY } from '@/lib/format'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

type Form = {
  name: string
  category: string
  kcal: string
  protein: string
  carbs: string
  fat: string
  serving_size_g: string
  unit: string
  grams_per_unit: string
  is_vegan: boolean
  is_gluten_free: boolean
  is_posno: boolean
  za_trenera: boolean
  is_global: boolean
}

const s = (v: unknown): string => (v == null ? '' : String(v))

// Prazno/nevalidno -> 0 (sva makro/porcija polja su NOT NULL).
const numOrZero = (v: string): number => {
  const t = v.trim().replace(',', '.')
  if (t === '') return 0
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}

function newForm(): Form {
  return {
    name: '',
    category: '',
    kcal: '0',
    protein: '0',
    carbs: '0',
    fat: '0',
    serving_size_g: '100',
    unit: 'g',
    grams_per_unit: '100',
    is_vegan: false,
    is_gluten_free: false,
    is_posno: false,
    za_trenera: false,
    is_global: true,
  }
}

function fromItem(it: FoodItem): Form {
  return {
    name: s(it.name),
    category: s(it.category),
    kcal: s(it.kcal_per_100g),
    protein: s(it.protein_per_100g),
    carbs: s(it.carbs_per_100g),
    fat: s(it.fat_per_100g),
    serving_size_g: s(it.serving_size_g),
    unit: s(it.unit),
    grams_per_unit: s(it.grams_per_unit),
    is_vegan: it.is_vegan,
    is_gluten_free: it.is_gluten_free,
    is_posno: it.is_posno,
    za_trenera: it.za_trenera,
    is_global: it.is_global,
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-sm font-medium text-foreground">{label}</div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

export function FoodEditSheet({
  item,
  open,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  item: FoodItem | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved: (saved: FoodItem, isNew: boolean) => void
  onDeleted: (id: string) => void
}) {
  const isNew = !item
  const [f, setF] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Init na svako otvaranje (edit iz reda, ili prazna forma za novu).
  useEffect(() => {
    if (!open) return
    setF(item ? fromItem(item) : newForm())
    setConfirmDelete(false)
  }, [item, open])

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setF((prev) => (prev ? { ...prev, [key]: value } : prev))

  const buildPatch = (fm: Form) => ({
    name: fm.name.trim(),
    category: fm.category.trim(),
    kcal_per_100g: numOrZero(fm.kcal),
    protein_per_100g: numOrZero(fm.protein),
    carbs_per_100g: numOrZero(fm.carbs),
    fat_per_100g: numOrZero(fm.fat),
    serving_size_g: numOrZero(fm.serving_size_g),
    unit: fm.unit.trim() || 'g',
    grams_per_unit: numOrZero(fm.grams_per_unit),
    is_vegan: fm.is_vegan,
    is_gluten_free: fm.is_gluten_free,
    is_posno: fm.is_posno,
    za_trenera: fm.za_trenera,
    is_global: fm.is_global,
  })

  const save = async () => {
    if (!f) return
    if (!f.name.trim()) {
      toast.error('Naziv je obavezan.')
      return
    }
    if (!f.category.trim()) {
      toast.error('Kategorija je obavezna.')
      return
    }
    setSaving(true)
    const patch = buildPatch(f)
    if (isNew) {
      const { data, error } = await supabase.from('food_items').insert(patch).select('*').single()
      setSaving(false)
      if (error || !data) {
        toast.error('Greška pri čuvanju.')
        return
      }
      toast.success('Namirnica dodata')
      onSaved(data as FoodItem, true)
    } else {
      const { error } = await supabase.from('food_items').update(patch).eq('id', item!.id)
      setSaving(false)
      if (error) {
        toast.error('Greška pri čuvanju.')
        return
      }
      toast.success('Sačuvano')
      onSaved({ ...item!, ...patch }, false)
    }
  }

  const approve = async () => {
    if (!item) return
    setApproving(true)
    const { error } = await supabase.from('food_items').update({ is_global: true }).eq('id', item.id)
    setApproving(false)
    if (error) {
      toast.error('Greška pri odobravanju.')
      return
    }
    toast.success('Predlog odobren')
    set('is_global', true)
    onSaved({ ...item, is_global: true }, false)
  }

  const doDelete = async () => {
    if (!item) return
    setDeleting(true)
    const { error } = await supabase.from('food_items').delete().eq('id', item.id)
    setDeleting(false)
    if (error) {
      toast.error('Greška pri brisanju.')
      return
    }
    setConfirmDelete(false)
    toast.success('Namirnica obrisana')
    onDeleted(item.id)
  }

  const pending = !isNew && item?.is_global === false

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        {f && (
          <SheetContent
            className="max-w-xl"
            onInteractOutside={(e) => confirmDelete && e.preventDefault()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border p-5 pr-12">
              <div className="min-w-0">
                <SheetTitle className="truncate">
                  {isNew ? 'Nova namirnica' : f.name || 'Namirnica'}
                </SheetTitle>
                <SheetDescription>{isNew ? 'Dodaj namirnicu' : 'Izmena namirnice'}</SheetDescription>
              </div>
              <Button onClick={save} disabled={saving} size="sm" className="shrink-0">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Sačuvaj
              </Button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              {pending && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="text-xs leading-relaxed text-amber-800">
                    <span className="font-semibold">Predlog čeka odobrenje.</span> Odobri da postane
                    globalna, ili obriši (odbij) predlog.
                  </div>
                  <Button size="sm" onClick={approve} disabled={approving}>
                    {approving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <BadgeCheck className="h-4 w-4" />
                    )}
                    Odobri predlog
                  </Button>
                </div>
              )}

              <Section title="Osnovno">
                <Field label="Naziv">
                  <Input value={f.name} onChange={(e) => set('name', e.target.value)} />
                </Field>
                <Field label="Kategorija">
                  <Input
                    value={f.category}
                    onChange={(e) => set('category', e.target.value)}
                    list="food-categories"
                    placeholder="npr. Voće"
                  />
                  <datalist id="food-categories">
                    {FOOD_CATEGORIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </Field>
              </Section>

              <Section title="Makroi (na 100 g)">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Kalorije (kcal)">
                    <Input inputMode="decimal" value={f.kcal} onChange={(e) => set('kcal', e.target.value)} />
                  </Field>
                  <Field label="Proteini (g)">
                    <Input
                      inputMode="decimal"
                      value={f.protein}
                      onChange={(e) => set('protein', e.target.value)}
                    />
                  </Field>
                  <Field label="Ugljeni hidrati (g)">
                    <Input inputMode="decimal" value={f.carbs} onChange={(e) => set('carbs', e.target.value)} />
                  </Field>
                  <Field label="Masti (g)">
                    <Input inputMode="decimal" value={f.fat} onChange={(e) => set('fat', e.target.value)} />
                  </Field>
                </div>
              </Section>

              <Section title="Porcija">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="Veličina porcije (g)">
                    <Input
                      inputMode="decimal"
                      value={f.serving_size_g}
                      onChange={(e) => set('serving_size_g', e.target.value)}
                    />
                  </Field>
                  <Field label="Jedinica">
                    <Input
                      value={f.unit}
                      onChange={(e) => set('unit', e.target.value)}
                      placeholder="g / kom / ml"
                    />
                  </Field>
                  <Field label="Grama po jedinici">
                    <Input
                      inputMode="decimal"
                      value={f.grams_per_unit}
                      onChange={(e) => set('grams_per_unit', e.target.value)}
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Oznake">
                <ToggleRow label="Vegan" checked={f.is_vegan} onChange={(v) => set('is_vegan', v)} />
                <ToggleRow
                  label="Bez glutena"
                  checked={f.is_gluten_free}
                  onChange={(v) => set('is_gluten_free', v)}
                />
                <ToggleRow label="Posno" checked={f.is_posno} onChange={(v) => set('is_posno', v)} />
                <ToggleRow
                  label="Za trenera"
                  checked={f.za_trenera}
                  onChange={(v) => set('za_trenera', v)}
                />
                <ToggleRow
                  label="Odobrena (globalna)"
                  checked={f.is_global}
                  onChange={(v) => set('is_global', v)}
                />
              </Section>

              {!isNew && item && (
                <Section title="Meta">
                  <div className="divide-y divide-border">
                    <div className="flex items-start justify-between gap-4 py-1.5">
                      <span className="shrink-0 text-xs text-muted-foreground">ID</span>
                      <span className="break-all text-right font-mono text-xs text-foreground">
                        {item.id}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4 py-1.5">
                      <span className="shrink-0 text-xs text-muted-foreground">created_by</span>
                      <span className="break-all text-right font-mono text-xs text-foreground">
                        {item.created_by || '-'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4 py-1.5">
                      <span className="shrink-0 text-xs text-muted-foreground">Kreirana</span>
                      <span className="text-right text-sm text-foreground">
                        {fmtDMY(item.created_at)}
                      </span>
                    </div>
                  </div>
                </Section>
              )}

              {!isNew && (
                <div className="border-t border-border pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Obriši namirnicu
                  </Button>
                </div>
              )}
            </div>
          </SheetContent>
        )}
      </Sheet>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(o) => !o && !deleting && setConfirmDelete(false)}
      >
        {confirmDelete && (
          <AlertDialogContent>
            <AlertDialogTitle>Obriši namirnicu</AlertDialogTitle>
            <AlertDialogDescription>
              Ovo trajno briše namirnicu {item?.name ? `"${item.name}"` : ''}. Nastaviti?
            </AlertDialogDescription>
            <AlertDialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Otkaži
              </Button>
              <Button
                size="sm"
                onClick={doDelete}
                disabled={deleting}
                className={cn('bg-red-600 text-white hover:bg-red-700')}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Obriši
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </>
  )
}
