import { Routes, Route, Navigate } from 'react-router-dom'
import { RequireAdmin } from '@/components/RequireAdmin'
import { AdminLayout } from '@/components/layout/AdminLayout'
import Login from '@/pages/Login'
import Pregled from '@/pages/Pregled'
import Treneri from '@/pages/Treneri'
import TrenerDetalji from '@/pages/TrenerDetalji'
import Vezbaci from '@/pages/Vezbaci'
import Pretplate from '@/pages/Pretplate'
import Vezbe from '@/pages/Vezbe'
import Namirnice from '@/pages/Namirnice'
import Prijave from '@/pages/Prijave'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Sve ostalo je iza admin guard-a + app ljuske */}
      <Route element={<RequireAdmin />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Pregled />} />
          <Route path="/treneri" element={<Treneri />} />
          <Route path="/treneri/:id" element={<TrenerDetalji />} />
          <Route path="/vezbaci" element={<Vezbaci />} />
          <Route path="/pretplate" element={<Pretplate />} />
          <Route path="/vezbe" element={<Vezbe />} />
          <Route path="/namirnice" element={<Namirnice />} />
          <Route path="/prijave" element={<Prijave />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
