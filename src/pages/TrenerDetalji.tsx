import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { ListTrainer } from '@/lib/types'
import { fmtDMY, fmtInt } from '@/lib/format'
import { SubBadge } from '@/components/SubBadge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

type TrainerRow = {
  id: string
  city: string | null
  hourly_rate: number | null
  invite_code: string | null
  bio: string | null
  studio_name: string | null
  years_experience: number | null
  instagram_handle: string | null
  bank_recipient: string | null
  bank_account: string | null
  bank_name: string | null
  bank_model: string | null
  bank_reference: string | null
  bank_purpose: string | null
  show_attendees_to_athletes: boolean
  cancel_cutoff_hours: number
  public_slug: string | null
  headline: string | null
  avatar_url: string | null
  public_enabled: boolean
  specialties: string[] | null
  created_at: string
}

type ProfileRow = { id: string; full_name: string | null; phone: string | null }

type Form = {
  full_name: string
  phone: string
  city: string
  avatar_url: string
  headline: string
  bio: string
  studio_name: string
  specialties: string
  years_experience: string
  instagram_handle: string
  hourly_rate: string
  public_enabled: boolean
  public_slug: string
  show_attendees_to_athletes: boolean
  cancel_cutoff_hours: string
  invite_code: string
  bank_recipient: string
  bank_account: string
  bank_name: string
  bank_model: string
  bank_reference: string
  bank_purpose: string
}

const s = (v: unknown): string => (v == null ? '' : String(v))

function initForm(t: TrainerRow, p: ProfileRow | null): Form {
  return {
    full_name: s(p?.full_name),
    phone: s(p?.phone),
    city: s(t.city),
    avatar_url: s(t.avatar_url),
    headline: s(t.headline),
    bio: s(t.bio),
    studio_name: s(t.studio_name),
    specialties: Array.isArray(t.specialties) ? t.specialties.join(', ') : '',
    years_experience: s(t.years_experience),
    instagram_handle: s(t.instagram_handle),
    hourly_rate: s(t.hourly_rate),
    public_enabled: !!t.public_enabled,
    public_slug: s(t.public_slug),
    show_attendees_to_athletes: !!t.show_attendees_to_athletes,
    cancel_cutoff_hours: s(t.cancel_cutoff_hours),
    invite_code: s(t.invite_code),
    bank_recipient: s(t.bank_recipient),
    bank_account: s(t.bank_account),
    bank_name: s(t.bank_name),
    bank_model: s(t.bank_model),
    bank_reference: s(t.bank_reference),
    bank_purpose: s(t.bank_purpose),
  }
}

// Prazan input -> null (tekst). Trim.
const textOrNull = (v: string): string | null => {
  const t = v.trim()
  return t === '' ? null : t
}
// Prazno -> null; inace broj (decimalni, zarez ili tacka); nevalidno -> null.
const numOrNull = (v: string): number | null => {
  const t = v.trim()
  if (t === '') return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
// Prazno -> null; inace ceo broj; nevalidno -> null.
const intOrNull = (v: string): number | null => {
  const t = v.trim()
  if (t === '') return null
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}
// NOT NULL kolona -> prazno/nevalidno -> 0.
const intOrZero = (v: string): number => {
  const t = v.trim()
  if (t === '') return 0
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : 0
}
const parseSpecialties = (v: string): string[] =>
  v
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

const planLabel = (plan: string | null | undefined): string =>
  plan === 'monthly' ? 'Mesečna' : plan === 'yearly' ? 'Godišnja' : '-'

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

export default function TrenerDetalji() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const location = useLocation()
  const passed = (location.state as { trainer?: ListTrainer } | null)?.trainer ?? null

  const [enriched, setEnriched] = useState<ListTrainer | null>(passed)
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
    const [tRes, pRes] = await Promise.all([
      supabase.from('trainers').select('*').eq('id', id).single(),
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
    ])
    if (tRes.error || !tRes.data) {
      setError(true)
      setLoading(false)
      return
    }
    setF(initForm(tRes.data as TrainerRow, (pRes.data as ProfileRow | null) ?? null))
    setLoading(false)

    // Obogaceni RO podaci (email, pretplata, broj vezbaca): iz state-a ako smo dosli sa liste,
    // inace povuci listu i nadji red (radi i na direktan link).
    if (!passed) {
      const { data: list } = await supabase.rpc('admin_list_trainers')
      if (Array.isArray(list)) {
        setEnriched((list as ListTrainer[]).find((r) => r.id === id) ?? null)
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

    const trainersPatch = {
      city: textOrNull(f.city),
      avatar_url: textOrNull(f.avatar_url),
      headline: textOrNull(f.headline),
      bio: textOrNull(f.bio),
      studio_name: textOrNull(f.studio_name),
      specialties: parseSpecialties(f.specialties),
      years_experience: intOrNull(f.years_experience),
      instagram_handle: textOrNull(f.instagram_handle),
      hourly_rate: numOrNull(f.hourly_rate),
      public_enabled: f.public_enabled,
      public_slug: textOrNull(f.public_slug),
      show_attendees_to_athletes: f.show_attendees_to_athletes,
      cancel_cutoff_hours: intOrZero(f.cancel_cutoff_hours),
      invite_code: textOrNull(f.invite_code),
      bank_recipient: textOrNull(f.bank_recipient),
      bank_account: textOrNull(f.bank_account),
      bank_name: textOrNull(f.bank_name),
      bank_model: textOrNull(f.bank_model),
      bank_reference: textOrNull(f.bank_reference),
      bank_purpose: textOrNull(f.bank_purpose),
    }
    const profilesPatch = {
      full_name: textOrNull(f.full_name),
      phone: textOrNull(f.phone),
    }

    const [tRes, pRes] = await Promise.all([
      supabase.from('trainers').update(trainersPatch).eq('id', id),
      supabase.from('profiles').update(profilesPatch).eq('id', id),
    ])
    setSaving(false)

    if (tRes.error || pRes.error) {
      const msg = tRes.error?.message ?? pRes.error?.message ?? ''
      toast.error(
        /public_slug|uniq/i.test(msg) ? 'Taj javni slug je već zauzet.' : 'Greška pri čuvanju.',
      )
      return
    }
    toast.success('Sačuvano')
  }

  const title = f ? f.full_name || 'Trener' : enriched?.full_name || 'Trener'

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => nav('/treneri')} className="shrink-0">
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
          <div className="font-display text-lg font-semibold text-foreground">
            Trener nije pronađen
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Nije moguće učitati podatke ovog trenera.
          </p>
          <Button variant="outline" size="sm" onClick={() => nav('/treneri')}>
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
              <Field label="Grad">
                <Input value={f.city} onChange={(e) => set('city', e.target.value)} />
              </Field>
            </div>
            <Field label="Avatar URL">
              <Input value={f.avatar_url} onChange={(e) => set('avatar_url', e.target.value)} />
            </Field>
          </Section>

          <Section title="Trenerski profil">
            <Field label="Slogan (headline)">
              <Input value={f.headline} onChange={(e) => set('headline', e.target.value)} />
            </Field>
            <Field label="Biografija">
              <Textarea rows={4} value={f.bio} onChange={(e) => set('bio', e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Studio / teretana">
                <Input value={f.studio_name} onChange={(e) => set('studio_name', e.target.value)} />
              </Field>
              <Field label="Instagram">
                <Input
                  value={f.instagram_handle}
                  onChange={(e) => set('instagram_handle', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Specijalnosti" hint="Razdvoji zarezom (npr. Mršavljenje, Snaga, Kondicija).">
              <Input value={f.specialties} onChange={(e) => set('specialties', e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Godine iskustva">
                <Input
                  inputMode="numeric"
                  value={f.years_experience}
                  onChange={(e) => set('years_experience', e.target.value)}
                  placeholder="npr. 5"
                />
              </Field>
              <Field label="Cena po satu (EUR)">
                <Input
                  inputMode="decimal"
                  value={f.hourly_rate}
                  onChange={(e) => set('hourly_rate', e.target.value)}
                  placeholder="npr. 25"
                />
              </Field>
            </div>
          </Section>

          <Section title="Javni profil">
            <ToggleRow
              label="Javna stranica vidljiva"
              desc="Da li je /t/ landing trenera dostupan javnosti."
              checked={f.public_enabled}
              onChange={(v) => set('public_enabled', v)}
            />
            <Field label="Javni slug" hint="Deo adrese: /t/slug">
              <Input value={f.public_slug} onChange={(e) => set('public_slug', e.target.value)} />
            </Field>
          </Section>

          <Section title="Rezervacije">
            <ToggleRow
              label="Prikaži učesnike vežbačima"
              desc="Da li vežbači vide imena drugih na istom terminu."
              checked={f.show_attendees_to_athletes}
              onChange={(v) => set('show_attendees_to_athletes', v)}
            />
            <Field label="Rok za otkazivanje (sati)" hint="0 = bez ograničenja (do početka termina).">
              <Input
                inputMode="numeric"
                value={f.cancel_cutoff_hours}
                onChange={(e) => set('cancel_cutoff_hours', e.target.value)}
                placeholder="0"
              />
            </Field>
          </Section>

          <Section title="Pristupni kod">
            <Field label="Invite kod" hint="Kod kojim se vežbač povezuje sa ovim trenerom.">
              <Input value={f.invite_code} onChange={(e) => set('invite_code', e.target.value)} />
            </Field>
          </Section>

          <Section title="Bankovni podaci">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Primalac">
                <Input
                  value={f.bank_recipient}
                  onChange={(e) => set('bank_recipient', e.target.value)}
                />
              </Field>
              <Field label="Broj računa">
                <Input
                  value={f.bank_account}
                  onChange={(e) => set('bank_account', e.target.value)}
                />
              </Field>
              <Field label="Banka">
                <Input value={f.bank_name} onChange={(e) => set('bank_name', e.target.value)} />
              </Field>
              <Field label="Model">
                <Input value={f.bank_model} onChange={(e) => set('bank_model', e.target.value)} />
              </Field>
              <Field label="Poziv na broj">
                <Input
                  value={f.bank_reference}
                  onChange={(e) => set('bank_reference', e.target.value)}
                />
              </Field>
              <Field label="Svrha uplate">
                <Input
                  value={f.bank_purpose}
                  onChange={(e) => set('bank_purpose', e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section title="Pretplata">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <SubBadge status={enriched?.sub_status} accessUntil={enriched?.sub_access_until} />
              <span className="text-sm text-muted-foreground">
                Plan: <span className="font-medium text-foreground">{planLabel(enriched?.sub_plan)}</span>
              </span>
              <span className="text-sm text-muted-foreground">
                Važi do:{' '}
                <span className="font-medium text-foreground">{fmtDMY(enriched?.sub_access_until)}</span>
              </span>
              <span className="text-sm text-muted-foreground">
                Vežbači:{' '}
                <span className="font-medium tabular-nums text-foreground">
                  {fmtInt(enriched?.athlete_count)}
                </span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Pretplata se menja u modulu Pretplate.</p>
          </Section>

          <Section title="Meta">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="ID">
                <Input value={id ?? ''} disabled className="font-mono text-xs" />
              </Field>
              <Field label="Član od">
                <Input value={fmtDMY(enriched?.created_at)} disabled />
              </Field>
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}
