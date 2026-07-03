// Jedan trener iz admin_list_trainers() RPC-a (obogacen red: profil + auth email + pretplata + broj vezbaca).
export type ListTrainer = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  city: string | null
  studio_name: string | null
  hourly_rate: number | null
  invite_code: string | null
  bio: string | null
  created_at: string
  years_experience: number | null
  instagram_handle: string | null
  avatar_url: string | null
  public_enabled: boolean | null
  sub_status: string | null
  sub_plan: string | null
  sub_access_until: string | null
  athlete_count: number | null
}
