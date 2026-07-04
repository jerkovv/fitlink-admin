import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, ImageOff, TriangleAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ListMediaReport } from '@/lib/types'
import { muscleLabel } from '@/lib/exercise'
import { fmtDMY } from '@/lib/format'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { MediaReportDetailSheet } from '@/components/MediaReportDetailSheet'
import { cn } from '@/lib/utils'

type Tone = 'gray' | 'amber' | 'green'
const TONES: Record<Tone, string> = {
  gray: 'bg-muted text-muted-foreground',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  green: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200',
}

function statusInfo(status: string): { label: string; tone: Tone } {
  if (status === 'open') return { label: 'Otvorena', tone: 'amber' }
  if (status === 'resolved') return { label: 'Rešena', tone: 'green' }
  if (status === 'dismissed') return { label: 'Odbačena', tone: 'gray' }
  return { label: status, tone: 'gray' }
}

function StatusPill({ status }: { status: string }) {
  const { label, tone } = statusInfo(status)
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold',
        TONES[tone],
      )}
    >
      {label}
    </span>
  )
}

function Thumb({ url }: { url: string | null }) {
  const [err, setErr] = useState(false)
  if (!url || err) {
    return (
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        title={url ? 'Slika se ne učitava' : 'Nema slike'}
      >
        <ImageOff className="h-4 w-4" />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setErr(true)}
      className="h-10 w-10 shrink-0 rounded-md bg-muted object-cover"
    />
  )
}

type FilterKey = 'open' | 'resolved' | 'dismissed' | 'all'
const FILTERS: { value: FilterKey; label: string }[] = [
  { value: 'open', label: 'Otvorene' },
  { value: 'resolved', label: 'Rešene' },
  { value: 'dismissed', label: 'Odbačene' },
  { value: 'all', label: 'Sve' },
]

const selectCls =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

export default function Prijave() {
  const [rows, setRows] = useState<ListMediaReport[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<FilterKey>('open')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const { data, error: err } = await supabase.rpc('admin_list_media_reports')
    if (err || !Array.isArray(data)) setError(true)
    else setRows(data as ListMediaReport[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const base = rows ?? []
    if (filter === 'all') return base
    return base.filter((r) => r.status === filter)
  }, [rows, filter])

  const selected = selectedId ? (rows ?? []).find((r) => r.id === selectedId) ?? null : null

  // Posle popravke medija: azuriraj sve prijave iste vezbe (da se thumbnail u listi osvezi).
  const onMediaSaved = (exerciseId: string, thumbnailUrl: string | null, videoUrl: string | null) => {
    setRows((prev) =>
      prev
        ? prev.map((r) =>
            r.exercise_id === exerciseId
              ? { ...r, thumbnail_url: thumbnailUrl, video_url: videoUrl }
              : r,
          )
        : prev,
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Prijave</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prijave slomljenog medija vežbi. Popravi medij i reši prijavu.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Osveži
        </Button>
      </div>

      <div className="mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterKey)}
          className={cn(selectCls, 'w-auto min-w-[160px]')}
          aria-label="Filter po statusu"
        >
          {FILTERS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error && !rows ? (
        <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <TriangleAlert className="h-6 w-6" />
          </div>
          <div className="font-display text-lg font-semibold text-foreground">Greška pri učitavanju</div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Nije moguće učitati prijave. Pokušaj ponovo.
          </p>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" />
            Pokušaj ponovo
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-14">Slika</TableHead>
                <TableHead>Vežba</TableHead>
                <TableHead className="hidden md:table-cell">Razlog</TableHead>
                <TableHead className="hidden lg:table-cell">Prijavio</TableHead>
                <TableHead className="hidden sm:table-cell">Datum</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !rows ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    <TableCell>
                      <div className="h-10 w-10 animate-pulse rounded-md bg-muted" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell>
                      <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-16 text-center text-sm text-muted-foreground">
                    {filter === 'open' ? 'Nema otvorenih prijava.' : 'Nema prijava.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedId(r.id)
                      setSheetOpen(true)
                    }}
                  >
                    <TableCell>
                      <Thumb url={r.thumbnail_url} />
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {r.exercise_name || 'Vežba'}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {[r.exercise_name_en, muscleLabel(r.primary_muscle)]
                            .filter(Boolean)
                            .join(' • ')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-[220px]">
                      <div className="truncate text-muted-foreground">{r.reason || '-'}</div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {r.reporter_name || '-'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell tabular-nums text-muted-foreground">
                      {fmtDMY(r.created_at)}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={r.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <MediaReportDetailSheet
        report={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onMediaSaved={onMediaSaved}
        onResolved={load}
      />
    </div>
  )
}
