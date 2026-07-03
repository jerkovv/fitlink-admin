# FitLink Admin

Interni admin panel za FitLink (planiran domen: admin.fitlink.rs). Desktop-first web app,
odvojen repo od `fitlinkbalkan` (mobilna app) i `fitlink-landing` (marketing sajt).

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4 + shadcn/ui (Button, Card, Table, Input, Badge)
- react-router-dom
- @supabase/supabase-js (isti Supabase projekat kao mobilna app)
- lucide-react

## Pristup

Samo admini. Prijava ide preko email + sifra (`supabase.auth.signInWithPassword`), a onda se
proverava `is_admin()` RPC. Obican korisnik se odmah odjavi uz poruku "Nemas admin pristup".
Route guard (`RequireAdmin`) drzi ceo panel iza te provere.

Publishable (anon) Supabase kljuc stoji u `src/lib/supabase.ts` - bezbedan je za frontend jer
sav pristup kontrolisu RLS politike na bazi.

## Razvoj

```bash
npm install
npm run dev      # lokalni dev server
npm run build    # tsc + produkcijski build
npm run lint     # oxlint
```

## Status

Faza 0: skafold + admin auth + app ljuska sa praznim modulima (Pregled, Treneri, Vezbaci,
Pretplate, Vezbe, Namirnice, Prijave). Moduli se pune sadrzajem u narednim fazama.
