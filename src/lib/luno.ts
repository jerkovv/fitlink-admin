import { createClient } from '@supabase/supabase-js'

// Luno Chat je nas sopstveni cet za podrsku (odvojen Supabase projekat). Ovo su JAVNE vrednosti
// iz Luno dashboarda: anon kljuc je namenjen pregledacu, a cetove sme da cita samo prijavljen
// agent (red u tabeli agents) kroz RLS. Sesija ima svoj kljuc u storage-u, pa se nikad ne mesa
// sa FitLink admin sesijom.
export const LUNO_URL = 'https://yljhtjnilptvnhcwrihq.supabase.co'
const LUNO_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlsamh0am5pbHB0dm5oY3dyaWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NzQ1OTMsImV4cCI6MjEwNzA1MDU5M30.n4k74vmRhrlqeX88NRVbt7v5y0S8bf5OlJ-buR8Pi3M'

export const luno = createClient(LUNO_URL, LUNO_ANON_KEY, {
  auth: {
    storageKey: 'fitlink-admin-luno',
    persistSession: true,
    autoRefreshToken: true,
    // Adresa admina pripada FitLink sesiji; Luno klijent ne sme da cita tokene iz nje.
    detectSessionInUrl: false,
  },
})

// Samo FitLink sajtovi u Luno-u. Ostali sajtovi (apgrejd, pozivnica...) se ovde nikad ne prikazuju.
export const SLUG_APLIKACIJA = 'fitlink-app'
export const SLUG_SAJT = 'fitlink'
export const FITLINK_SLUGOVI = [SLUG_APLIKACIJA, SLUG_SAJT]

export type LunoSite = { id: string; slug: string; name: string; color: string | null }

export type LunoAgent = {
  id: string
  name: string | null
  email: string | null
  role: 'owner' | 'agent'
  color: string | null
}

export type LunoAttachment = { path: string; name?: string; type?: string; size?: number }

export type LunoVisitor = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  device: string | null
  source: string | null
  current_url: string | null
  city: string | null
  country: string | null
  first_seen: string
  last_seen: string
  banned: boolean
  meta: Record<string, unknown> | null
}

export type LunoConversation = {
  id: string
  status: 'open' | 'solved'
  last_message_at: string
  last_message_preview: string | null
  unread_for_agent: number
  site_id: string
  visitor_id: string
  assignee_id: string | null
  tags: string[] | null
  visitors: LunoVisitor | null
  sites: LunoSite | null
}

export type LunoMessage = {
  id: string
  conversation_id: string
  sender_type: 'visitor' | 'agent' | 'bot' | 'system'
  kind: 'text' | 'email_card' | 'file'
  body: string
  created_at: string
  agent_id: string | null
  attachments?: LunoAttachment[] | null
  read_at?: string | null
}

// Isti select stringovi kao u Luno web inboxu (apps/dashboard/src/lib.ts).
export const MSG_SELECT = 'id,conversation_id,sender_type,kind,body,created_at,agent_id,attachments,read_at'
export const CONV_SELECT =
  'id,status,last_message_at,last_message_preview,unread_for_agent,site_id,visitor_id,assignee_id,tags,' +
  'visitors(id,name,email,phone,device,source,current_url,city,country,first_seen,last_seen,banned,meta),sites(id,slug,name,color)'

// Javna adresa fajla iz bucket-a chat-files (javno citanje).
export function fileUrl(path: string): string {
  return `${LUNO_URL}/storage/v1/object/public/chat-files/${path.split('/').map(encodeURIComponent).join('/')}`
}

export function imePosetioca(v: LunoVisitor | null): string {
  if (!v) return 'Posetilac'
  if (v.name && v.name.trim()) return v.name.trim()
  if (v.email && v.email.trim()) return v.email.trim()
  return 'Posetilac'
}

export function jeOnline(v: LunoVisitor | null): boolean {
  return !!v && Date.now() - new Date(v.last_seen).getTime() < 3 * 60 * 1000
}

// Kratko relativno vreme za listu: "sada", "5 min", "3 h", "juče", "12. nov".
export function kadaKratko(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 45) return 'sada'
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`
  if (s < 86400) return `${Math.round(s / 3600)} h`
  if (s < 172800) return 'juče'
  return new Date(iso).toLocaleDateString('sr-Latn', { day: 'numeric', month: 'short' })
}

export function sat(iso: string): string {
  return new Date(iso).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' })
}

export function dan(iso: string): string {
  const d = new Date(iso)
  const danas = new Date()
  const juce = new Date()
  juce.setDate(danas.getDate() - 1)
  if (d.toDateString() === danas.toDateString()) return 'Danas'
  if (d.toDateString() === juce.toDateString()) return 'Juče'
  return d.toLocaleDateString('sr-Latn', { weekday: 'long', day: 'numeric', month: 'long' })
}

// Samo http(s) linkovi iz podataka posetioca smeju da postanu klikabilni.
export function bezbedanUrl(u: string | null | undefined): string | null {
  if (!u) return null
  try {
    const x = new window.URL(u)
    return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : null
  } catch {
    return null
  }
}
