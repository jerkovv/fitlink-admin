import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'

// Prikazuje se kad postoji sesija ali nalog NIJE admin (is_admin() = false).
// Jedina akcija je odjava.
export function Blocked() {
  const { user, signOut } = useAuth()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="w-full max-w-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
          <ShieldAlert className="h-7 w-7 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Nemaš admin pristup
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {user?.email ? (
            <>
              Nalog <span className="font-medium text-foreground">{user.email}</span> nema admin
              dozvolu za ovaj panel.
            </>
          ) : (
            'Ovaj nalog nema admin dozvolu za ovaj panel.'
          )}
        </p>
        <Button variant="outline" className="mt-6 w-full" onClick={signOut}>
          Odjava
        </Button>
      </div>
    </div>
  )
}
