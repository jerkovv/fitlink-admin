import { createClient } from '@supabase/supabase-js'

// Publishable (anon) key - bezbedan za frontend. Sav pristup kontrolisu RLS politike +
// is_admin() RPC na bazi. Isti Supabase projekat kao fitlinkbalkan.
const SUPABASE_URL = 'https://iyvvskywmqtudafapxdk.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rYwv3BX4sTnL8w0GXmCF1Q_Zpxm0rxE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
