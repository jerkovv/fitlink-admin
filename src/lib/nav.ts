import {
  LayoutDashboard,
  UserCog,
  Users,
  CreditCard,
  Dumbbell,
  Apple,
  Flag,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
}

// Jedno mesto istine za bocnu navigaciju. Rute u App.tsx prate isti redosled.
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Pregled', icon: LayoutDashboard },
  { to: '/treneri', label: 'Treneri', icon: UserCog },
  { to: '/vezbaci', label: 'Vežbači', icon: Users },
  { to: '/pretplate', label: 'Pretplate', icon: CreditCard },
  { to: '/vezbe', label: 'Vežbe', icon: Dumbbell },
  { to: '/namirnice', label: 'Namirnice', icon: Apple },
  { to: '/prijave', label: 'Prijave', icon: Flag },
]
