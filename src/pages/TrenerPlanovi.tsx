import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw, TriangleAlert, UserCog } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { TrainerPlansDetail } from '@/lib/types'
import { fmtDMY, fmtInt } from '@/lib/format'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

function Sekcija({
  title,
  count,
  hint,
  children,
}: {
  title: string
  count: number
  hint?: string
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
          <span className="ml-2 tabular-nums text-foreground">{fmtInt(count)}</span>
        </div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      {count === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">Nema stavki.</div>
      ) : (
        children
      )}
    </Card>
  )
}

/**
 * Poslat vs nacrt. Ovo je jedina oznaka koja stvarno govori da li vezbac vidi
 * plan - sve ostalo (dani, vezbe) postoji i kod nacrta koji niko ne vidi.
 */
function StatusZnak({ publishedAt }: { publishedAt: string | null }) {
  if (publishedAt) {
    return <Badge variant="soft">Poslat</Badge>
  }
  return <Badge variant="destructive">Nacrt</Badge>
}

function Poreklo({ izSablona, sablon }: { izSablona: boolean; sablon: string | null }) {
  if (!izSablona) {
    return <span className="text-xs text-muted-foreground">Od nule</span>
  }
  return (
    <span className="truncate text-xs text-muted-foreground" title={sablon ?? undefined}>
      {sablon || 'Šablon obrisan'}
    </span>
  )
}

export default function TrenerPlanovi() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [data, setData] = useState<TrainerPlansDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(false)
    const { data: res, error: err } = await supabase.rpc('admin_trainer_plans_detail', {
      p_trainer_id: id,
    })
    const d = res as TrainerPlansDetail | null
    if (err || !d?.success) setError(true)
    else setData(d)
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const naslov = data?.trainer.full_name || 'Trener'

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => nav('/planovi')} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
            Nazad
          </Button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-bold tracking-tight text-foreground">
              {loading && !data ? 'Učitavam...' : `Planovi - ${naslov}`}
            </h1>
            {data?.trainer.email && (
              <div className="truncate text-xs text-muted-foreground">{data.trainer.email}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {id && (
            <Button variant="outline" size="sm" onClick={() => nav(`/treneri/${id}`)}>
              <UserCog className="h-4 w-4" />
              Profil trenera
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Osveži
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <TriangleAlert className="h-6 w-6" />
          </div>
          <div className="font-display text-lg font-semibold text-foreground">
            Planovi nisu učitani
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Nije moguće učitati planove ovog trenera.
          </p>
          <Button variant="outline" size="sm" onClick={() => nav('/planovi')}>
            Nazad na listu
          </Button>
        </Card>
      ) : !data ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6">
              <div className="mb-4 h-3.5 w-32 animate-pulse rounded bg-muted" />
              <div className="space-y-3">
                <div className="h-9 w-full animate-pulse rounded bg-muted" />
                <div className="h-9 w-full animate-pulse rounded bg-muted" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <Sekcija
            title="Dodeljeni programi treninga"
            count={data.assigned_programs.length}
            hint="Vežbač vidi samo poslate."
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Plan</TableHead>
                  <TableHead>Vežbač</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Poreklo</TableHead>
                  <TableHead className="hidden sm:table-cell">Dana / vežbi</TableHead>
                  <TableHead className="hidden lg:table-cell">Odrađeno</TableHead>
                  <TableHead className="hidden sm:table-cell">Dodeljen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.assigned_programs.map((p) => (
                  <TableRow key={p.id} className="hover:bg-transparent">
                    <TableCell className="max-w-[220px] truncate text-sm font-medium text-foreground">
                      {p.name}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => nav(`/vezbaci/${p.athlete_id}`)}
                        className="truncate text-sm text-foreground underline-offset-4 hover:underline"
                      >
                        {p.athlete_name || 'Bez imena'}
                      </button>
                    </TableCell>
                    <TableCell>
                      <StatusZnak publishedAt={p.published_at} />
                    </TableCell>
                    <TableCell className="hidden max-w-[180px] md:table-cell">
                      <Poreklo izSablona={p.iz_sablona} sablon={p.sablon_naziv} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell tabular-nums text-sm text-muted-foreground">
                      {fmtInt(p.dana)} / {fmtInt(p.vezbi)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {p.treninga > 0 ? (
                        <>
                          <span className="tabular-nums text-foreground">{fmtInt(p.treninga)}</span>
                          <span className="ml-1.5 text-xs">
                            posl. {fmtDMY(p.poslednji_trening_at)}
                          </span>
                        </>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {fmtDMY(p.assigned_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Sekcija>

          <Sekcija
            title="Dodeljeni planovi ishrane"
            count={data.assigned_nutrition.length}
            hint="Vežbač vidi samo poslate."
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Plan</TableHead>
                  <TableHead>Vežbač</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Poreklo</TableHead>
                  <TableHead className="hidden sm:table-cell">Dana / obroka</TableHead>
                  <TableHead className="hidden lg:table-cell">kcal</TableHead>
                  <TableHead className="hidden sm:table-cell">Dodeljen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.assigned_nutrition.map((p) => (
                  <TableRow key={p.id} className="hover:bg-transparent">
                    <TableCell className="max-w-[220px] truncate text-sm font-medium text-foreground">
                      {p.name}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => nav(`/vezbaci/${p.athlete_id}`)}
                        className="truncate text-sm text-foreground underline-offset-4 hover:underline"
                      >
                        {p.athlete_name || 'Bez imena'}
                      </button>
                    </TableCell>
                    <TableCell>
                      <StatusZnak publishedAt={p.published_at} />
                    </TableCell>
                    <TableCell className="hidden max-w-[180px] md:table-cell">
                      <Poreklo izSablona={p.iz_sablona} sablon={p.sablon_naziv} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell tabular-nums text-sm text-muted-foreground">
                      {fmtInt(p.dana)} / {fmtInt(p.obroka)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell tabular-nums text-sm text-muted-foreground">
                      {p.target_kcal ? fmtInt(p.target_kcal) : '-'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {fmtDMY(p.assigned_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Sekcija>

          <Sekcija
            title="Šabloni treninga"
            count={data.program_templates.length}
            hint="Zaliha trenera - iz njih se dodeljuje."
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Šablon</TableHead>
                  <TableHead className="hidden md:table-cell">Cilj / nivo</TableHead>
                  <TableHead className="hidden sm:table-cell">Dana / vežbi</TableHead>
                  <TableHead>Puta dodeljen</TableHead>
                  <TableHead className="hidden sm:table-cell">Napravljen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.program_templates.map((t) => (
                  <TableRow key={t.id} className="hover:bg-transparent">
                    <TableCell className="max-w-[260px] truncate text-sm font-medium text-foreground">
                      {t.name}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {[t.goal, t.level].filter(Boolean).join(' / ') || '-'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell tabular-nums text-sm text-muted-foreground">
                      {fmtInt(t.dana)} / {fmtInt(t.vezbi)}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      <span className={t.puta_dodeljen === 0 ? 'text-muted-foreground' : 'text-foreground'}>
                        {fmtInt(t.puta_dodeljen)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {fmtDMY(t.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Sekcija>

          <Sekcija
            title="Šabloni ishrane"
            count={data.nutrition_templates.length}
            hint="Zaliha trenera - iz njih se dodeljuje."
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Šablon</TableHead>
                  <TableHead className="hidden md:table-cell">Cilj</TableHead>
                  <TableHead className="hidden sm:table-cell">Dana / obroka</TableHead>
                  <TableHead className="hidden lg:table-cell">kcal</TableHead>
                  <TableHead>Puta dodeljen</TableHead>
                  <TableHead className="hidden sm:table-cell">Napravljen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.nutrition_templates.map((t) => (
                  <TableRow key={t.id} className="hover:bg-transparent">
                    <TableCell className="max-w-[260px] truncate text-sm font-medium text-foreground">
                      {t.name}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {t.goal || '-'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell tabular-nums text-sm text-muted-foreground">
                      {fmtInt(t.dana)} / {fmtInt(t.obroka)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell tabular-nums text-sm text-muted-foreground">
                      {t.target_kcal ? fmtInt(t.target_kcal) : '-'}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      <span className={t.puta_dodeljen === 0 ? 'text-muted-foreground' : 'text-foreground'}>
                        {fmtInt(t.puta_dodeljen)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {fmtDMY(t.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Sekcija>
        </div>
      )}
    </div>
  )
}
