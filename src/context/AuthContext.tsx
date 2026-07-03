import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type AuthState = {
  session: Session | null
  user: User | null
  // null = jos ne znamo (nema sesije, ili se is_admin proverava); true/false = rezultat.
  isAdmin: boolean | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  isAdmin: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    // Sekvenca: samo NAJNOVIJA provera sme da upise rezultat (spreca out-of-order RPC odgovore
    // koji bi ostavili isAdmin za pogresnu sesiju).
    let reqId = 0
    // Identitet za koji trenutno vazi isAdmin; menja se samo kad se korisnik promeni.
    let currentUserId: string | null = null

    // Proveri admin status za datu sesiju preko is_admin() RPC-a (SECURITY DEFINER na bazi).
    const resolveAdmin = async (s: Session | null) => {
      const myReq = ++reqId
      const uid = s?.user?.id ?? null

      // Kad se identitet promeni (drugi korisnik ili odjava), ODMAH ponisti isAdmin -> guard
      // pada na loader (a ne na app), pa ne-admin nikad ne vidi sadrzaj modula ni na tren.
      // Isti korisnik (npr. token refresh) zadrzava isAdmin bez treptaja; samo se u pozadini
      // ponovo potvrdi.
      if (uid !== currentUserId) {
        currentUserId = uid
        if (alive) setIsAdmin(null)
      }
      if (!s) return

      const { data, error } = await supabase.rpc('is_admin')
      // Zastareo odgovor (novija auth promena je vec startovala svoju proveru) -> ignorisi.
      if (!alive || myReq !== reqId) return
      setIsAdmin(error ? false : data === true)
    }

    // Inicijalna sesija (cold start).
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!alive) return
      setSession(s)
      await resolveAdmin(s)
      if (alive) setLoading(false)
    })

    // Reaguj na login/logout/refresh - uvek ponovo proveri admin status.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      resolveAdmin(s)
    })

    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setIsAdmin(null)
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, isAdmin, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
