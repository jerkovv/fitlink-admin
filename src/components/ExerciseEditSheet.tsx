import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Save, Loader2, ImageOff } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Exercise } from '@/lib/types'
import { MUSCLE_OPTIONS, EQUIP_OPTIONS } from '@/lib/exercise'
import { fmtDMY } from '@/lib/format'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

const selectCls =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

const textOrNull = (v: string): string | null => {
  const t = v.trim()
  return t === '' ? null : t
}
const intOrZero = (v: string): number => {
  const t = v.trim()
  if (t === '') return 0
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : 0
}

type Form = {
  name: string
  name_en: string
  primary_muscle: string
  secondary_muscles: string[]
  equipment: string
  category: string
  description: string
  instructions: string
  thumbnail_url: string
  video_url: string
  is_duration_based: boolean
  popularity: string
  popularity_locked: boolean
  is_global: boolean
}

function initForm(ex: Exercise): Form {
  return {
    name: ex.name ?? '',
    name_en: ex.name_en ?? '',
    primary_muscle: ex.primary_muscle,
    secondary_muscles: Array.isArray(ex.secondary_muscles) ? ex.secondary_muscles : [],
    equipment: ex.equipment,
    category: ex.category ?? '',
    description: ex.description ?? '',
    instructions: ex.instructions ?? '',
    thumbnail_url: ex.thumbnail_url ?? '',
    video_url: ex.video_url ?? '',
    is_duration_based: ex.is_duration_based,
    popularity: String(ex.popularity ?? 0),
    popularity_locked: ex.popularity_locked,
    is_global: ex.is_global,
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

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string
  desc?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {desc && <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

export function ExerciseEditSheet({
  exercise,
  open,
  onOpenChange,
  onSaved,
}: {
  exercise: Exercise | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved: (updated: Exercise) => void
}) {
  const [f, setF] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [videoError, setVideoError] = useState(false)

  useEffect(() => {
    if (exercise) setF(initForm(exercise))
  }, [exercise])

  // Reset preview greske kad se URL promeni (da nova slika/video dobiju sansu).
  useEffect(() => {
    setImgError(false)
  }, [f?.thumbnail_url])
  useEffect(() => {
    setVideoError(false)
  }, [f?.video_url])

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setF((prev) => (prev ? { ...prev, [key]: value } : prev))

  const toggleSecondary = (v: string) =>
    setF((prev) =>
      prev
        ? {
            ...prev,
            secondary_muscles: prev.secondary_muscles.includes(v)
              ? prev.secondary_muscles.filter((x) => x !== v)
              : [...prev.secondary_muscles, v],
          }
        : prev,
    )

  const save = async () => {
    if (!exercise || !f) return
    const name = f.name.trim()
    if (!name) {
      toast.error('Naziv je obavezan.')
      return
    }
    setSaving(true)
    const patch = {
      name,
      name_en: textOrNull(f.name_en),
      primary_muscle: f.primary_muscle,
      secondary_muscles: f.secondary_muscles,
      equipment: f.equipment,
      category: textOrNull(f.category),
      description: textOrNull(f.description),
      instructions: textOrNull(f.instructions),
      thumbnail_url: textOrNull(f.thumbnail_url),
      video_url: textOrNull(f.video_url),
      is_duration_based: f.is_duration_based,
      popularity: intOrZero(f.popularity),
      popularity_locked: f.popularity_locked,
      is_global: f.is_global,
    }
    const { error } = await supabase.from('exercises').update(patch).eq('id', exercise.id)
    setSaving(false)
    if (error) {
      toast.error('Greška pri čuvanju.')
      return
    }
    toast.success('Sačuvano')
    onSaved({ ...exercise, ...patch })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {f && exercise && (
        <SheetContent className="max-w-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-border p-5 pr-12">
            <div className="min-w-0">
              <SheetTitle className="truncate">{f.name || 'Vežba'}</SheetTitle>
              <SheetDescription>Izmena vežbe</SheetDescription>
            </div>
            <Button onClick={save} disabled={saving} size="sm" className="shrink-0">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Sačuvaj
            </Button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            <Section title="Media">
              <Field label="Thumbnail URL">
                <Input value={f.thumbnail_url} onChange={(e) => set('thumbnail_url', e.target.value)} />
              </Field>
              <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
                {f.thumbnail_url && !imgError ? (
                  <img
                    src={f.thumbnail_url}
                    alt=""
                    onError={() => setImgError(true)}
                    className="max-h-64 w-full object-contain"
                  />
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImageOff className="h-6 w-6" />
                    <span className="text-xs">
                      {f.thumbnail_url ? 'Slika se ne učitava' : 'Nema slike'}
                    </span>
                  </div>
                )}
              </div>

              <Field label="Video URL">
                <Input value={f.video_url} onChange={(e) => set('video_url', e.target.value)} />
              </Field>
              {f.video_url ? (
                videoError ? (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    Video se ne učitava.
                  </div>
                ) : (
                  <video
                    key={f.video_url}
                    src={f.video_url}
                    controls
                    onError={() => setVideoError(true)}
                    className="max-h-64 w-full rounded-lg bg-black"
                  />
                )
              ) : null}

              <ToggleRow
                label="Vremenska vežba"
                desc="Kardio / vežbe merene vremenom umesto ponavljanjima."
                checked={f.is_duration_based}
                onChange={(v) => set('is_duration_based', v)}
              />
            </Section>

            <Section title="Osnovno">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Naziv">
                  <Input value={f.name} onChange={(e) => set('name', e.target.value)} />
                </Field>
                <Field label="Naziv (engleski)">
                  <Input value={f.name_en} onChange={(e) => set('name_en', e.target.value)} />
                </Field>
                <Field label="Primarna grupa">
                  <select
                    value={f.primary_muscle}
                    onChange={(e) => set('primary_muscle', e.target.value)}
                    className={selectCls}
                  >
                    {MUSCLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Oprema">
                  <select
                    value={f.equipment}
                    onChange={(e) => set('equipment', e.target.value)}
                    className={selectCls}
                  >
                    {EQUIP_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Kategorija">
                  <Input value={f.category} onChange={(e) => set('category', e.target.value)} />
                </Field>
              </div>
              <Field label="Sekundarne grupe" hint="Klikni da dodaš ili ukloniš.">
                <div className="flex flex-wrap gap-1.5">
                  {MUSCLE_OPTIONS.map((o) => {
                    const on = f.secondary_muscles.includes(o.value)
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => toggleSecondary(o.value)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                          on
                            ? 'border-transparent bg-primary text-primary-foreground'
                            : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                        )}
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </Field>
            </Section>

            <Section title="Opis">
              <Field label="Opis">
                <Textarea rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} />
              </Field>
              <Field label="Instrukcije">
                <Textarea
                  rows={4}
                  value={f.instructions}
                  onChange={(e) => set('instructions', e.target.value)}
                />
              </Field>
            </Section>

            <Section title="Pozicija">
              <Field label="Popularnost" hint="Veci broj = vise pri vrhu grupe.">
                <Input
                  inputMode="numeric"
                  value={f.popularity}
                  onChange={(e) => set('popularity', e.target.value)}
                />
              </Field>
              <ToggleRow
                label="Zaključaj poziciju"
                desc="Kad je uključeno, auto-rangiranje (cron) ne dira popularnost ove vežbe."
                checked={f.popularity_locked}
                onChange={(v) => set('popularity_locked', v)}
              />
            </Section>

            <Section title="Ostalo">
              <ToggleRow
                label="Globalna vežba"
                desc="Vidljiva svim trenerima u biblioteci."
                checked={f.is_global}
                onChange={(v) => set('is_global', v)}
              />
            </Section>

            <Section title="Meta">
              <div className="divide-y divide-border">
                <div className="flex items-start justify-between gap-4 py-1.5">
                  <span className="shrink-0 text-xs text-muted-foreground">ID</span>
                  <span className="break-all text-right font-mono text-xs text-foreground">
                    {exercise.id}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 py-1.5">
                  <span className="shrink-0 text-xs text-muted-foreground">Kreiran</span>
                  <span className="text-right text-sm text-foreground">
                    {fmtDMY(exercise.created_at)}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 py-1.5">
                  <span className="shrink-0 text-xs text-muted-foreground">created_by</span>
                  <span className="break-all text-right font-mono text-xs text-foreground">
                    {exercise.created_by || '-'}
                  </span>
                </div>
              </div>
            </Section>
          </div>
        </SheetContent>
      )}
    </Sheet>
  )
}
