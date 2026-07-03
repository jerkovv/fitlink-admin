import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { Blocked } from '@/pages/Blocked'

// Route guard:
//  - jos ucitavamo sesiju            -> loader
//  - nema sesije                     -> login
//  - ima sesiju, jos proveravamo     -> loader
//  - ima sesiju ali nije admin       -> blokiran ekran (+ odjava)
//  - admin                           -> app (Outlet)
export function RequireAdmin() {
  const { session, isAdmin, loading } = useAuth()

  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />
  if (isAdmin === null) return <FullScreenLoader />
  if (!isAdmin) return <Blocked />
  return <Outlet />
}
