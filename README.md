# Kisan Samruddhi — Agriculture MIS

A full-stack Monitoring & Information System for an NGO agriculture programme in Khanpur Block, Mahisagar (Gujarat). Built from the uploaded `Kisan_Samruddhi_Agri_MIS.xlsx` workbook and `kisan_samruddhi_agri_mis_schema-Postgress.sql` schema.

Live stack:

- **Frontend** – Next.js 15 (App Router) + Tailwind + shadcn/ui + lucide-react
- **Backend** – Next.js server routes under `/api/[[...path]]/route.js`
- **Database** – Supabase PostgreSQL (service role on the server, publishable key not needed on client)
- **AI** – Emergent LLM key → `gemini-2.5-flash` for the weekly briefing

## Features

- 📊 **Programme overview dashboard** – 1,208 beneficiaries, 12 villages, income bands, seasonal reach
- 🧑‍🌾 **Farmer master register** – search, add, edit (mobile / village / social group), printable farmer card (A4 PDF)
- 🏘️ **Village performance** – clickable cards opening a deep-dive drawer (farmer list, crop mix, groups, income trend)
- 💰 **Income impact report** – baseline vs current per village, top movers, investment totals, CSV export
- 🌾 **Khedut Diary** – season-wise crop records per farmer with add-crop form
- 📦 **Input distributions** – record seed / fertiliser / pesticide with org/govt cost split
- 👥 **FIG & FFS groups** – member register, meeting attendance tracker with per-member %
- 🎯 **Yield performance** – crop-wise achievement vs programme targets with under-performer flagging
- ✨ **AI weekly briefing** – LLM-generated wins / concerns / recommended CRP actions grounded in live Supabase data
- 📑 **CSV exports** – farmer register & income impact

## Local development

```bash
yarn install
yarn dev          # http://localhost:3000
```

### Required env vars (`.env` – never committed)

```
MONGO_URL=              # kept for template compatibility, not used by the MIS
NEXT_PUBLIC_BASE_URL=   # auto-set in Emergent

SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # required for server-side writes (bypasses RLS)

EMERGENT_LLM_KEY=
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash
```

### Database setup

1. Run `data/kisan_schema.sql` (or the SQL you have) in the Supabase SQL editor.
2. Seed reference + master data from the workbook:

```bash
python3 scripts/extract_mis.py           # workbook → data/mis_seed.json
node    scripts/seed_supabase.mjs        # upserts farmers / income / crops / inputs

python3 scripts/extract_groups.py        # workbook → data/mis_groups.json
node    scripts/seed_groups.mjs          # upserts FIG/FFS groups + members
```

### Supabase RLS

The schema does not create policies by default. The server uses `SUPABASE_SERVICE_ROLE_KEY` to read & write safely without exposing user data to the browser.

## Project layout

```
app/
├── api/[[...path]]/route.js   # all /api/mis/* endpoints
├── farmer/[code]/page.js      # A4 printable farmer card
└── page.js                    # Programme Overview, Farmer Register, Village, Impact, Yield views

scripts/                       # workbook → Supabase seed scripts
data/                          # (gitignored) local JSON + workbook copies
```

## Key API endpoints

```
GET  /api/mis/dashboard                     dashboard KPIs + income bands
GET  /api/mis/villages                      village performance summary
GET  /api/mis/villages/:village_id          village deep dive (farmers, crop mix, groups)
GET  /api/mis/farmers                       farmer register (search, paginated)
POST /api/mis/farmers                       create farmer
GET  /api/mis/farmers/:code                 farmer 360 profile
PATCH /api/mis/farmers/:code                update mobile / village / social group
GET  /api/mis/farmers/:code/crops           khedut diary
POST /api/mis/farmers/:code/crops           add crop record
GET  /api/mis/farmers/:code/inputs          input distributions
POST /api/mis/farmers/:code/inputs          record input distribution
GET  /api/mis/groups                        FIG + FFS groups
GET  /api/mis/groups/:code/attendance       per-member attendance %
POST /api/mis/groups/:code/meetings         record meeting + attendance
GET  /api/mis/income-impact                 baseline vs current (village + top movers)
GET  /api/mis/yield-performance             crop yield vs target
POST /api/mis/ai-briefing                   AI weekly briefing
GET  /api/mis/export/farmers.csv            CSV
GET  /api/mis/export/income-impact.csv      CSV
```
