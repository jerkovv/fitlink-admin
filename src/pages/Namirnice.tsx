import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, RefreshCw, Plus, TriangleAlert, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { FoodItem } from '@/lib/types'
import { fmtG } from '@/lib/food'
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
import { FoodEditSheet } from '@/components/FoodEditSheet'
import { cn } from '@/lib/utils'

const PAGE = 50

const selectCls =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

type Status = 'all' | 'pending' | 'approved'

async function queryFoods(category: string, status: Status, q: string, pageIdx: number) {
  const from = pageIdx * PAGE
  let qb = supabase.from('food_items').select('*')
  if (category) qb = qb.eq('category', category)
  if (status === 'pending') qb = qb.eq('is_global', false)
  else if (status === 'approved') qb = qb.eq('is_global', true)
  const safe = q.trim()
  if (safe) qb = qb.ilike('name', `%${safe}%`)
  return qb.order('name').range(from, from + PAGE - 1)
}

function MacroChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
      {label} {fmtG(value)}
    </span>
  )
}

function Tag({ children, muted }: { children: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
        muted ? 'bg-muted text-muted-foreground' : 'bg-accent text-accent-foreground',
      )}
    >
      {children}
    </span>
  )
}

export default function Namirnice() {
  const [rows, setRows] = useState<FoodItem[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)

  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')

  const [categories, setCategories] = useState<string[]>([])
  const [pendingCount, setPendingCount] = useState(0)

  const [editItem, setEditItem] = useState<FoodItem | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const reqRef = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  // Distinct kategorije (za filter; ukljucuje i eventualne typo-e) - jednom na mount.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await supabase.from('food_items').select('category').order('category')
      if (!alive || !data) return
      const set = new Set<string>()
      for (const r of data as { category: string }[]) if (r.category) set.add(r.category)
      setCategories([...set].sort((a, b) => a.localeCompare(b, 'sr')))
    })()
    return () => {
      alive = false
    }
  }, [])

  const refreshPending = useCallback(async () => {
    const { count } = await supabase
      .from('food_items')
      .select('id', { count: 'exact', head: true })
      .eq('is_global', false)
    setPendingCount(count ?? 0)
  }, [])

  useEffect(() => {
    refreshPending()
  }, [refreshPending])

  const reload = useCallback(async () => {
    const my = ++reqRef.current
    setLoading(true)
    setError(false)
    const { data, error: err } = await queryFoods(category, status, debouncedQ, 0)
    if (my !== reqRef.current) return
    if (err || !data) {
      // Ocisti redove da error card zaista pukne (gejt je error && rows.length===0) i da ne
      // ostanu stari redovi prethodnog filtera + zaostalo "Ucitaj jos".
      setRows([])
      setPage(0)
      setHasMore(false)
      setError(true)
      setLoading(false)
      return
    }
    setRows(data as FoodItem[])
    setPage(0)
    setHasMore((data as FoodItem[]).length === PAGE)
    setLoading(false)
  }, [category, status, debouncedQ])

  useEffect(() => {
    reload()
  }, [reload])

  const loadMore = async () => {
    const my = reqRef.current
    setLoadingMore(true)
    const { data, error: err } = await queryFoods(category, status, debouncedQ, page + 1)
    if (my !== reqRef.current) {
      setLoadingMore(false)
      return
    }
    setLoadingMore(false)
    if (err || !data) return
    setRows((prev) => [...prev, ...(data as FoodItem[])])
    setPage((p) => p + 1)
    setHasMore((data as FoodItem[]).length === PAGE)
  }

  const matches = (it: FoodItem) =>
    (!category || it.category === category) &&
    (status === 'all' || (status === 'pending' ? !it.is_global : it.is_global))

  const handleSaved = (saved: FoodItem, isNew: boolean) => {
    refreshPending()
    if (isNew) {
      setSheetOpen(false)
      reload()
      return
    }
    setRows((prev) => {
      if (!prev) return prev
      if (!matches(saved)) return prev.filter((r) => r.id !== saved.id)
      return prev.map((r) => (r.id === saved.id ? saved : r))
    })
    if (matches(saved)) setEditItem(saved)
    else setSheetOpen(false)
  }

  const handleDeleted = (id: string) => {
    setSheetOpen(false)
    setRows((prev) => prev.filter((r) => r.id !== id))
    refreshPending()
  }

  const openAdd = () => {
    setEditItem(null)
    setSheetOpen(true)
  }
  const openEdit = (it: FoodItem) => {
    setEditItem(it)
    setSheetOpen(true)
  }

  const statusOptions = useMemo(
    () => [
      { value: 'all' as Status, label: 'Sve' },
      { value: 'pending' as Status, label: `Na čekanju${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
      { value: 'approved' as Status, label: 'Odobrene' },
    ],
    [pendingCount],
  )

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Namirnice</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Baza namirnica i moderacija predloga.
            {pendingCount > 0 ? ` ${pendingCount} na čekanju.` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Osveži
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Dodaj namirnicu
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={cn(selectCls, 'w-auto min-w-[160px] max-w-[220px]')}
          aria-label="Kategorija"
        >
          <option value="">Sve kategorije</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className={cn(selectCls, 'w-auto min-w-[150px]')}
          aria-label="Status"
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="relative min-w-[180px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pretraga po nazivu"
            className="pl-9"
          />
        </div>
      </div>

      {error && rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <TriangleAlert className="h-6 w-6" />
          </div>
          <div className="font-display text-lg font-semibold text-foreground">Greška pri učitavanju</div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Nije moguće učitati namirnice. Pokušaj ponovo.
          </p>
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCw className="h-4 w-4" />
            Pokušaj ponovo
          </Button>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Naziv</TableHead>
                  <TableHead className="hidden md:table-cell">Kategorija</TableHead>
                  <TableHead>Makroi / 100 g</TableHead>
                  <TableHead className="hidden lg:table-cell">Oznake</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      <TableCell>
                        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-16 text-center text-sm text-muted-foreground">
                      {status === 'pending' ? 'Nema namirnica na čekanju.' : 'Nema namirnica za taj filter.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((it) => (
                    <TableRow key={it.id} className="cursor-pointer" onClick={() => openEdit(it)}>
                      <TableCell>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">{it.name}</div>
                          <div className="truncate text-xs text-muted-foreground md:hidden">
                            {it.category}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {it.category}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium tabular-nums text-foreground">
                            {fmtG(it.kcal_per_100g)}{' '}
                            <span className="text-xs font-normal text-muted-foreground">kcal</span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            <MacroChip label="P" value={it.protein_per_100g} />
                            <MacroChip label="UH" value={it.carbs_per_100g} />
                            <MacroChip label="M" value={it.fat_per_100g} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {it.is_vegan && <Tag>Vegan</Tag>}
                          {it.is_gluten_free && <Tag>Bez glutena</Tag>}
                          {it.is_posno && <Tag>Posno</Tag>}
                          {it.za_trenera && <Tag muted>Trener</Tag>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {it.is_global ? (
                          <span className="inline-flex items-center whitespace-nowrap rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-200">
                            Odobrena
                          </span>
                        ) : (
                          <span className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                            Na čekanju
                          </span>
                        )}
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

      <FoodEditSheet
        item={editItem}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </div>
  )
}
