import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  RefreshCw,
  GripVertical,
  Lock,
  Image as ImageIcon,
  ImageOff,
  Video,
  TriangleAlert,
  Loader2,
  ArrowUpDown,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Exercise } from '@/lib/types'
import { MUSCLE_OPTIONS, equipLabel, muscleLabel } from '@/lib/exercise'
import { fmtInt } from '@/lib/format'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { ExerciseEditSheet } from '@/components/ExerciseEditSheet'
import { cn } from '@/lib/utils'

const PAGE = 50
const DEFAULT_GROUP = 'grudi'

const selectCls =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

// Server-side upit: uvek scope-ovan na grupu (nikad svih 4699), pretraga po name/name_en.
async function queryExercises(group: string, q: string, pageIdx: number) {
  const from = pageIdx * PAGE
  let qb = supabase.from('exercises').select('*').eq('primary_muscle', group)
  // Skloni znakove koji lome PostgREST .or() sintaksu (zapete, zagrade).
  const safe = q.replace(/[,()]/g, ' ').trim()
  if (safe) qb = qb.or(`name.ilike.%${safe}%,name_en.ilike.%${safe}%`)
  return qb.order('popularity', { ascending: false }).order('name').range(from, from + PAGE - 1)
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

function MediaStatus({ ex }: { ex: Exercise }) {
  return (
    <div className="flex items-center gap-1.5">
      <ImageIcon
        className={cn('h-4 w-4', ex.thumbnail_url ? 'text-primary' : 'text-muted-foreground/30')}
      />
      <Video className={cn('h-4 w-4', ex.video_url ? 'text-primary' : 'text-muted-foreground/30')} />
    </div>
  )
}

function SortableRow({ ex }: { ex: Exercise }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ex.id,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border bg-background p-2.5',
        isDragging && 'z-10 shadow-lg',
      )}
    >
      <button
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Prevuci"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Thumb url={ex.thumbnail_url} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{ex.name}</div>
        <div className="truncate text-xs text-muted-foreground">{equipLabel(ex.equipment)}</div>
      </div>
      <div className="flex items-center gap-1.5 tabular-nums text-xs text-muted-foreground">
        {ex.popularity_locked && <Lock className="h-3.5 w-3.5 text-primary" />}
        {fmtInt(ex.popularity)}
      </div>
    </div>
  )
}

export default function Vezbe() {
  const [group, setGroup] = useState(DEFAULT_GROUP)
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [rows, setRows] = useState<Exercise[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)

  const [selected, setSelected] = useState<Exercise | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const [reorder, setReorder] = useState(false)
  const [orderIds, setOrderIds] = useState<string[]>([])
  const [savingOrder, setSavingOrder] = useState(false)

  // Sekvenca upita: samo najsvezija reload/loadMore sme da upise (spreca out-of-order
  // rezultate i dodavanje stare grupe kad se brzo menja grupa/pretraga).
  const reqRef = useRef(0)

  // Debounce pretrage (300ms).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  const reload = useCallback(async () => {
    const my = ++reqRef.current
    setLoading(true)
    setError(false)
    setReorder(false)
    const { data, error: err } = await queryExercises(group, debouncedQ, 0)
    if (my !== reqRef.current) return // superseded novijim upitom
    if (err || !data) {
      setError(true)
      setLoading(false)
      return
    }
    setRows(data as Exercise[])
    setPage(0)
    setHasMore((data as Exercise[]).length === PAGE)
    setLoading(false)
  }, [group, debouncedQ])

  useEffect(() => {
    reload()
  }, [reload])

  const loadMore = async () => {
    const my = reqRef.current
    setLoadingMore(true)
    const { data, error: err } = await queryExercises(group, debouncedQ, page + 1)
    // Ako je u medjuvremenu bio reload (druga grupa/pretraga), odbaci ove rezultate.
    if (my !== reqRef.current) {
      setLoadingMore(false)
      return
    }
    setLoadingMore(false)
    if (err || !data) return
    setRows((prev) => [...prev, ...(data as Exercise[])])
    setPage((p) => p + 1)
    setHasMore((data as Exercise[]).length === PAGE)
  }

  const onSaved = (updated: Exercise) => {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    setSelected(updated)
  }

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setOrderIds((ids) => {
      const oldI = ids.indexOf(active.id as string)
      const newI = ids.indexOf(over.id as string)
      if (oldI < 0 || newI < 0) return ids
      return arrayMove(ids, oldI, newI)
    })
  }

  const enterReorder = () => {
    setOrderIds(rows.map((r) => r.id))
    setReorder(true)
  }

  const saveOrder = async () => {
    setSavingOrder(true)
    const { error: err } = await supabase.rpc('admin_reorder_exercises', {
      p_ordered_ids: orderIds,
    })
    setSavingOrder(false)
    if (err) {
      toast.error('Greška pri čuvanju redosleda.')
      return
    }
    toast.success('Redosled sačuvan')
    setReorder(false)
    reload()
  }

  const groupLabel = muscleLabel(group)

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Vežbe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? 'Učitavanje...'
              : `${groupLabel}: ${fmtInt(rows.length)}${hasMore ? '+' : ''} vežbi učitano.`}
          </p>
        </div>
        {!reorder && (
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Osveži
          </Button>
        )}
      </div>

      {reorder ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="text-xs leading-relaxed text-amber-800">
            <span className="font-semibold">Režim preuređivanja - {groupLabel}.</span> Prevuci vežbe;
            sačuvane pozicije se zaključavaju (🔒) i ostaju iznad auto-rangiranih. Zaključane vežbe
            zadržavaju ručnu poziciju; ostale se auto-rangiraju po korišćenju.
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setReorder(false)} disabled={savingOrder}>
              Otkaži
            </Button>
            <Button size="sm" onClick={saveOrder} disabled={savingOrder}>
              {savingOrder && <Loader2 className="h-4 w-4 animate-spin" />}
              Sačuvaj redosled
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className={cn(selectCls, 'w-auto min-w-[160px]')}
            aria-label="Mišićna grupa"
          >
            {MUSCLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Pretraga u grupi ${groupLabel}`}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={enterReorder}
            disabled={loading || rows.length === 0 || !!debouncedQ}
            title={debouncedQ ? 'Isprazni pretragu da preurediš grupu' : undefined}
          >
            <ArrowUpDown className="h-4 w-4" />
            Preuredi redosled
          </Button>
        </div>
      )}

      {error ? (
        <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <TriangleAlert className="h-6 w-6" />
          </div>
          <div className="font-display text-lg font-semibold text-foreground">Greška pri učitavanju</div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Nije moguće učitati vežbe. Pokušaj ponovo.
          </p>
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCw className="h-4 w-4" />
            Pokušaj ponovo
          </Button>
        </Card>
      ) : reorder ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {orderIds.map((id) => {
                const ex = byId.get(id)
                return ex ? <SortableRow key={id} ex={ex} /> : null
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-14">Slika</TableHead>
                  <TableHead>Naziv</TableHead>
                  <TableHead className="hidden md:table-cell">Oprema</TableHead>
                  <TableHead>Popularnost</TableHead>
                  <TableHead className="hidden lg:table-cell">Media</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      <TableCell>
                        <div className="h-10 w-10 animate-pulse rounded-md bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-16 text-center text-sm text-muted-foreground">
                      {debouncedQ ? 'Nema vežbi za tu pretragu.' : 'Nema vežbi u ovoj grupi.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((ex) => (
                    <TableRow
                      key={ex.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelected(ex)
                        setSheetOpen(true)
                      }}
                    >
                      <TableCell>
                        <Thumb url={ex.thumbnail_url} />
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">{ex.name}</div>
                          {ex.name_en && (
                            <div className="truncate text-xs text-muted-foreground">{ex.name_en}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {equipLabel(ex.equipment)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 tabular-nums text-muted-foreground">
                          {ex.popularity_locked && <Lock className="h-3.5 w-3.5 text-primary" />}
                          {fmtInt(ex.popularity)}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <MediaStatus ex={ex} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {hasMore && !loading && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Učitaj još
              </Button>
            </div>
          )}
        </>
      )}

      <ExerciseEditSheet
        exercise={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={onSaved}
      />
    </div>
  )
}
