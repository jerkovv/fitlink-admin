import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { ListAthlete } from '@/lib/types'
import { fmtDMY, fmtInt } from '@/lib/format'
import { GOAL_OPTIONS } from '@/lib/goals'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type AthleteRow = {
  id: string
  trainer_id: string | null
  goal: string | null
  height_cm: number | null
  weight_kg: number | null
  notes: string | null
  birth_year: number | null
  gender: string | null
  joined_at: string
  signup_source: string | null
}
type ProfileRow = { id: string; full_name: string | null; phone: string | null }
type TrainerOpt = { id: string; full_name: string | null }

type Form = {
  full_name: string
  phone: string
  gender: string
  birth_year: string
  goal: string
  height_cm: string
  weight_kg: string
  trainer_id: string
  notes: string
}

const selectCls =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

const s = (v: unknown): string => (v == null ? '' : String(v))

function initForm(a: AthleteRow, p: ProfileRow | null): Form {
  return {
    full_name: s(p?.full_name),
    phone: s(p?.phone),
    gender: s(a.gender),
    birth_year: s(a.birth_year),
    goal: s(a.goal),
    height_cm: s(a.height_cm),
    weight_kg: s(a.weight_kg),
    trainer_id: s(a.trainer_id),
    notes: s(a.notes),
  }
}

const textOrNull = (v: string): string | null => {
  const t = v.trim()
  return t === '' ? null : t
}
const numOrNull = (v: string): number | null => {
  const t = v.trim()
  if (t === '') return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const intOrNull = (v: string): number | null => {
  const t = v.trim()
  if (t === '') return null
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
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

export default function VezbacDetalji() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const location = useLocation()
  const passed = (location.state as { athlete?: ListAthlete } | null)?.athlete ?? null

  const [enriched, setEnriched] = useState<ListAthlete | null>(passed)
  const [athlete, setAthlete] = useState<AthleteRow | null>(null)
  const [trainers, setTrainers] = useState<TrainerOpt[]>([])
  const [f, setF] = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!id) {
      setError(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(false)
    const [aRes, pRes, tRes] = await Promise.all([
      supabase.from('athletes').select('*').eq('id', id).single(),
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.rpc('admin_list_trainers'),
    ])
    if (aRes.error || !aRes.data) {
      setError(true)
      setLoading(false)
      return
    }
    setAthlete(aRes.data as AthleteRow)
    setF(initForm(aRes.data as AthleteRow, (pRes.data as ProfileRow | null) ?? null))
    if (Array.isArray(tRes.data)) {
      setTrainers(
        (tRes.data as { id: string; full_name: string | null }[]).map((x) => ({
          id: x.id,
          full_name: x.full_name,
        })),
      )
    }
    setLoading(false)

    if (!passed) {
      const { data: list } = await supabase.rpc('admin_list_athletes')
      if (Array.isArray(list)) {
        setEnriched((list as ListAthlete[]).find((r) => r.id === id) ?? null)
      }
    }
  }, [id, passed])

  useEffect(() => {
    load()
  }, [load])

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setF((prev) => (prev ? { ...prev, [key]: value } : prev))

  const save = async () => {
    if (!id || !f) return
    setSaving(true)

    const athletesPatch = {
      trainer_id: f.trainer_id === '' ? null : f.trainer_id,
      goal: f.goal === '' ? null : f.goal,
      height_cm: numOrNull(f.height_cm),
      weight_kg: numOrNull(f.weight_kg),
      notes: textOrNull(f.notes),
      birth_year: intOrNull(f.birth_year),
      gender: textOrNull(f.gender),
    }
    const profilesPatch = {
      full_name: textOrNull(f.full_name),
      phone: textOrNull(f.phone),
    }

    const [aRes, pRes] = await Promise.all([
      supabase.from('athletes').update(athletesPatch).eq('id', id),
      supabase.from('profiles').update(profilesPatch).eq('id', id),
    ])
    setSaving(false)

    if (aRes.error || pRes.error) {
      toast.error('Greška pri čuvanju.')
      return
    }
    toast.success('Sačuvano')
  }

  const title = f ? f.full_name || 'Vežbač' : enriched?.full_name || 'Vežbač'

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => nav('/vezbaci')} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
            Nazad
          </Button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {enriched?.email && (
              <div className="truncate text-xs text-muted-foreground">{enriched.email}</div>
            )}
          </div>
        </div>
        <Button onClick={save} disabled={saving || loading || !f}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Sačuvaj
        </Button>
      </div>

      {error ? (
        <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <TriangleAlert className="h-6 w-6" />
          </div>
          <div className="font-display text-lg font-semibold text-foreground">Vežbač nije pronađen</div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Nije moguće učitati podatke ovog vežbača.
          </p>
          <Button variant="outline" size="sm" onClick={() => nav('/vezbaci')}>
            Nazad na listu
          </Button>
        </Card>
      ) : !f ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6">
              <div className="mb-4 h-3.5 w-28 animate-pulse rounded bg-muted" />
              <div className="space-y-3">
                <div className="h-9 w-full animate-pulse rounded bg-muted" />
                <div className="h-9 w-full animate-pulse rounded bg-muted" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <Section title="Osnovno">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Ime i prezime">
                <Input value={f.full_name} onChange={(e) => set('full_name', e.target.value)} />
              </Field>
              <Field label="Email" hint="Menja se kroz autentifikaciju, ne ovde.">
                <Input value={enriched?.email ?? ''} disabled />
              </Field>
              <Field label="Telefon">
                <Input value={f.phone} onChange={(e) => set('phone', e.target.value)} />
              </Field>
              <Field label="Pol">
                <Input
                  value={f.gender}
                  onChange={(e) => set('gender', e.target.value)}
                  placeholder="npr. Muški / Ženski / Drugo"
                />
              </Field>
              <Field label="Godina rođenja">
                <Input
                  inputMode="numeric"
                  value={f.birth_year}
                  onChange={(e) => set('birth_year', e.target.value)}
                  placeholder="npr. 1992"
                />
              </Field>
            </div>
          </Section>

          <Section title="Fitnes">
            <Field label="Cilj">
              <select value={f.goal} onChange={(e) => set('goal', e.target.value)} className={selectCls}>
                <option value="">Nije postavljeno</option>
                {GOAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Visina (cm)">
                <Input
                  inputMode="decimal"
                  value={f.height_cm}
                  onChange={(e) => set('height_cm', e.target.value)}
                  placeholder="npr. 178"
                />
              </Field>
              <Field label="Težina (kg)">
                <Input
                  inputMode="decimal"
                  value={f.weight_kg}
                  onChange={(e) => set('weight_kg', e.target.value)}
                  placeholder="npr. 74"
                />
              </Field>
            </div>
          </Section>

          <Section title="Trener">
            <Field label="Dodeljen trener" hint="Promena trenera (reassign) ili bez trenera.">
              <select
                value={f.trainer_id}
                onChange={(e) => set('trainer_id', e.target.value)}
                className={selectCls}
              >
                <option value="">Bez trenera</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name || 'Bez imena'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Beleške o vežbaču">
              <Textarea rows={4} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </Section>

          <Section title="Aktivnost">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <div className="font-display text-2xl font-bold tabular-nums text-foreground">
                  {fmtInt(enriched?.workouts_done)}
                </div>
                <div className="text-xs text-muted-foreground">Treninga</div>
              </div>
              <div>
                <div className="font-display text-2xl font-bold tabular-nums text-foreground">
                  {fmtInt(enriched?.programs_count)}
                </div>
                <div className="text-xs text-muted-foreground">Programa</div>
              </div>
              <div>
                <div className="font-display text-lg font-semibold text-foreground">
                  {fmtDMY(enriched?.last_workout)}
                </div>
                <div className="text-xs text-muted-foreground">Poslednji trening</div>
              </div>
            </div>
          </Section>

          <Section title="Meta">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="ID">
                <Input value={id ?? ''} disabled className="font-mono text-xs" />
              </Field>
              <Field label="Član od">
                <Input value={fmtDMY(athlete?.joined_at)} disabled />
              </Field>
              <Field label="Izvor prijave">
                <Input value={athlete?.signup_source ?? '-'} disabled />
              </Field>
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}
