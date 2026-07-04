import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, Loader2, ImageOff, ExternalLink, Check, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { ListMediaReport } from '@/lib/types'
import { muscleLabel } from '@/lib/exercise'
import { fmtDMY } from '@/lib/format'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const textOrNull = (v: string): string | null => {
  const t = v.trim()
  return t === '' ? null : t
}

function KV({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  )
}

export function MediaReportDetailSheet({
  report,
  open,
  onOpenChange,
  onMediaSaved,
  onResolved,
}: {
  report: ListMediaReport | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onMediaSaved: (exerciseId: string, thumbnailUrl: string | null, videoUrl: string | null) => void
  onResolved: () => void
}) {
  const nav = useNavigate()
  const [thumb, setThumb] = useState('')
  const [video, setVideo] = useState('')
  const [note, setNote] = useState('')
  const [savingMedia, setSavingMedia] = useState(false)
  const [action, setAction] = useState<'resolved' | 'dismissed' | null>(null)
  const [imgError, setImgError] = useState(false)
  const [videoError, setVideoError] = useState(false)

  // Init iz prijave na SVAKO otvaranje (i kad se ista prijava ponovo otvori bez cuvanja) -
  // da se ne zadrze stara neupisana polja. `open` u deps re-okida na false->true.
  useEffect(() => {
    if (!open || !report) return
    setThumb(report.thumbnail_url ?? '')
    setVideo(report.video_url ?? '')
    setNote('')
  }, [report, open])

  useEffect(() => {
    setImgError(false)
  }, [thumb])
  useEffect(() => {
    setVideoError(false)
  }, [video])

  const saveMedia = async () => {
    if (!report) return
    setSavingMedia(true)
    const patch = { thumbnail_url: textOrNull(thumb), video_url: textOrNull(video) }
    const { error } = await supabase.from('exercises').update(patch).eq('id', report.exercise_id)
    setSavingMedia(false)
    if (error) {
      toast.error('Greška pri čuvanju medija.')
      return
    }
    toast.success('Medij ažuriran')
    onMediaSaved(report.exercise_id, patch.thumbnail_url, patch.video_url)
  }

  const resolve = async (status: 'resolved' | 'dismissed') => {
    if (!report) return
    setAction(status)
    const { error } = await supabase.rpc('admin_resolve_media_report', {
      p_id: report.id,
      p_status: status,
      p_note: textOrNull(note),
    })
    setAction(null)
    if (error) {
      toast.error('Greška pri obradi prijave.')
      return
    }
    toast.success(status === 'resolved' ? 'Prijava rešena' : 'Prijava odbačena')
    onOpenChange(false)
    onResolved()
  }

  const openInEditor = () => {
    if (!report) return
    onOpenChange(false)
    nav('/vezbe', { state: { group: report.primary_muscle, openId: report.exercise_id } })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {report && (
        <SheetContent className="max-w-xl">
          <div className="border-b border-border p-5 pr-12">
            <SheetTitle className="truncate">{report.exercise_name || 'Vežba'}</SheetTitle>
            <SheetDescription>
              {report.exercise_name_en || 'Prijava slomljenog medija'}
            </SheetDescription>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            <section>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Prijava
              </div>
              <div className="divide-y divide-border">
                <KV label="Grupa" value={muscleLabel(report.primary_muscle)} />
                <KV label="Razlog" value={report.reason || '-'} />
                <KV label="Prijavio" value={report.reporter_name || '-'} />
                <KV label="Datum" value={fmtDMY(report.created_at)} />
                {report.admin_note && <KV label="Napomena" value={report.admin_note} />}
              </div>
            </section>

            <section>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Trenutni medij
              </div>
              <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
                {thumb && !imgError ? (
                  <img
                    src={thumb}
                    alt=""
                    onError={() => setImgError(true)}
                    className="max-h-64 w-full object-contain"
                  />
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImageOff className="h-6 w-6" />
                    <span className="text-xs">{thumb ? 'Slika se ne učitava' : 'Nema slike'}</span>
                  </div>
                )}
              </div>
              {video ? (
                videoError ? (
                  <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    Video se ne učitava.
                  </div>
                ) : (
                  <video
                    key={video}
                    src={video}
                    controls
                    onError={() => setVideoError(true)}
                    className="mt-3 max-h-64 w-full rounded-lg bg-black"
                  />
                )
              ) : null}
            </section>

            <section>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Popravka medija
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Thumbnail URL</Label>
                  <Input value={thumb} onChange={(e) => setThumb(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Video URL</Label>
                  <Input value={video} onChange={(e) => setVideo(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={saveMedia} disabled={savingMedia}>
                    {savingMedia ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Sačuvaj medij
                  </Button>
                  <Button variant="outline" size="sm" onClick={openInEditor}>
                    <ExternalLink className="h-4 w-4" />
                    Otvori u Vežbe editoru
                  </Button>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Rešavanje
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Napomena (opciono)</Label>
                  <Textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Kratka napomena o obradi..."
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => resolve('resolved')}
                    disabled={action !== null}
                    className={cn(action === 'resolved' && 'opacity-80')}
                  >
                    {action === 'resolved' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Reši
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resolve('dismissed')}
                    disabled={action !== null}
                  >
                    {action === 'dismissed' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Ban className="h-4 w-4" />
                    )}
                    Odbaci
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </SheetContent>
      )}
    </Sheet>
  )
}
