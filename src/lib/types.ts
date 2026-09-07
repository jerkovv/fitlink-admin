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
  /** Oznacen u admin_test_accounts. Nalog se time ne dira - samo se prikazuje odvojeno. */
  is_test: boolean
}

// Jedan red iz admin_list_subscriptions() RPC-a (svi treneri + stanje pretplate).
export type ListSubscription = {
  trainer_id: string
  full_name: string | null
  email: string | null
  has_sub: boolean
  plan: string | null
  status: string | null
  access_until: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  last_payment_at: string | null
  admin_note: string | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

// Jedan vezbac iz admin_list_athletes() RPC-a (profil + trener + agregati aktivnosti).
export type ListAthlete = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
  trainer_id: string | null
  trainer_name: string | null
  goal: string | null
  height_cm: number | null
  weight_kg: number | null
  notes: string | null
  birth_year: number | null
  gender: string | null
  signup_source: string | null
  joined_at: string
  workouts_done: number | null
  last_workout: string | null
  programs_count: number | null
  /** Oznacen u admin_test_accounts. Nalog se time ne dira - samo se prikazuje odvojeno. */
  is_test: boolean
}

// Jedna vezba iz exercises tabele (select *). Admin cita/menja direktno (admin RLS).
export type Exercise = {
  id: string
  name: string
  name_en: string | null
  description: string | null
  instructions: string | null
  primary_muscle: string
  secondary_muscles: string[] | null
  equipment: string
  category: string | null
  is_global: boolean
  is_duration_based: boolean
  thumbnail_url: string | null
  video_url: string | null
  popularity: number
  popularity_locked: boolean
  created_at: string
  created_by: string | null
}

// Jedna prijava slomljenog medija iz admin_list_media_reports() RPC-a (prijava + vezba + prijavilac).
export type ListMediaReport = {
  id: string
  exercise_id: string
  status: string
  reason: string | null
  admin_note: string | null
  created_at: string
  resolved_at: string | null
  exercise_name: string | null
  exercise_name_en: string | null
  primary_muscle: string | null
  thumbnail_url: string | null
  video_url: string | null
  reported_by: string | null
  reporter_name: string | null
}

// Jedna namirnica iz food_items (select *). Admin CRUD direktno (admin RLS).
export type FoodItem = {
  id: string
  name: string
  category: string
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  serving_size_g: number
  unit: string
  grams_per_unit: number
  is_vegan: boolean
  is_gluten_free: boolean
  is_posno: boolean
  za_trenera: boolean
  is_global: boolean
  created_by: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Planovi (admin_list_trainer_plans / admin_trainer_plans_detail)
// ---------------------------------------------------------------------------

/**
 * Jedan red liste "Planovi" - zbirovi po treneru.
 *
 * "Poslato" vs "nacrt" je vazna razlika, ne kozmetika: vezbac vidi SAMO planove
 * sa published_at. Nacrt je plan koji trener jos gradi - ali gomila nacrta kod
 * jednog trenera je znak da dodela puca, pa se broji odvojeno.
 */
export type PlanTrainerRow = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  created_at: string
  is_test: boolean
  sablona_treninga: number
  sablona_ishrane: number
  programa_poslato: number
  programa_nacrt: number
  ishrane_poslato: number
  ishrane_nacrt: number
  vezbaca: number
  /** Koliko vezbaca stvarno ima bar jedan plan koji vidi. */
  vezbaca_sa_planom: number
  poslednji_plan_at: string | null
  planova_ukupno: number
}

export type PlanProgramTemplate = {
  id: string
  name: string
  goal: string | null
  level: string | null
  created_at: string
  dana: number
  vezbi: number
  puta_dodeljen: number
}

export type PlanNutritionTemplate = {
  id: string
  name: string
  goal: string | null
  target_kcal: number | null
  created_at: string
  dana: number
  obroka: number
  puta_dodeljen: number
}

export type PlanAssignedProgram = {
  id: string
  name: string
  athlete_id: string
  athlete_name: string | null
  assigned_at: string
  published_at: string | null
  iz_sablona: boolean
  sablon_naziv: string | null
  dana: number
  vezbi: number
  treninga: number
  poslednji_trening_at: string | null
}

export type PlanAssignedNutrition = {
  id: string
  name: string
  athlete_id: string
  athlete_name: string | null
  assigned_at: string
  published_at: string | null
  target_kcal: number | null
  is_active: boolean | null
  iz_sablona: boolean
  sablon_naziv: string | null
  dana: number
  obroka: number
}

export type TrainerPlansDetail = {
  success: boolean
  error?: string
  trainer: { id: string; full_name: string | null; email: string | null; avatar_url: string | null }
  program_templates: PlanProgramTemplate[]
  nutrition_templates: PlanNutritionTemplate[]
  assigned_programs: PlanAssignedProgram[]
  assigned_nutrition: PlanAssignedNutrition[]
}
