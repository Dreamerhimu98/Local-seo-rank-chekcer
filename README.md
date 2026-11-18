# Digigyapan Local Rank Tracker

A React + TypeScript local SEO workspace with client/business management, a 10-point / 20 KM geo-grid, manual rank scans, weekly tracking configuration, an independent keyword explorer, scan history, and Supabase Edge Function integration.

## 1. Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually http://localhost:5173).

The app can be explored in local mode without API credentials. Client, business, and scan-history UI data are stored in the current browser's localStorage. When Supabase is configured, the app shows an admin sign-in screen and synchronises client, business and keyword records with Supabase. Actual ranking scans do not use mock data: they require Supabase and DataForSEO setup.

## 2. Configure Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Install Supabase CLI and log in:

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

If `supabase db push` does not detect the migration, run `supabase/migrations/202611180001_initial_schema.sql` in the Supabase SQL Editor.

## 3. Configure DataForSEO securely

Create DataForSEO API credentials. Do not put these credentials in `.env.local`, frontend code, GitHub, or any `VITE_` variable.

```bash
supabase secrets set DATAFORSEO_LOGIN=YOUR_LOGIN
supabase secrets set DATAFORSEO_PASSWORD=YOUR_PASSWORD
supabase secrets set SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Deploy the scan function:

```bash
supabase functions deploy scan-rank
```

The function calls the DataForSEO Google Maps Live Advanced endpoint with one keyword and each of the 10 supplied coordinates. It matches the target listing by Google Place ID. Without a Place ID, a result cannot be reliably identified and the business may be reported as not found.

## 4. Enable weekly scheduled scans

Weekly scheduling is configured in the app UI, but live recurring execution must be provisioned in Supabase. The default target is Monday at 09:00 Asia/Kolkata.

Set a strong random scheduler secret and deploy the function:

```bash
supabase secrets set WEEKLY_SCAN_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET
supabase functions deploy weekly-scan --no-verify-jwt
```

Create a `scan_schedules` row for each business you want scheduled. `day_of_week` uses PostgreSQL numbering: Sunday=0, Monday=1, ..., Saturday=6. `scan_time` is the local wall-clock time. The included scheduler function currently processes active schedules whenever invoked and prevents a duplicate scan for the same business+keyword in the preceding six days. For production, configure Supabase Cron to invoke the function at the desired cadence and ensure the cron timezone matches the intended IST schedule. Example using `pg_cron` and `pg_net` (store the secret in Vault; do not hardcode it in a public migration):

```sql
select cron.schedule(
  'digigyapan-weekly-rank-scan',
  '30 3 * * 1', -- 09:00 Asia/Kolkata = 03:30 UTC, Monday
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/weekly-scan',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-weekly-scan-secret',(select decrypted_secret from vault.decrypted_secrets where name='weekly_scan_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Before using the cron example, enable the Supabase Cron and Vault extensions and add a Vault secret named `weekly_scan_secret`. Confirm the cron schedule in UTC. The included UI schedule preference is not yet automatically written to `scan_schedules`; add/manage schedule rows in Supabase until that settings form is connected to the database.

## 5. Important implementation notes

- This is a single-admin starter. The SQL enables RLS and grants authenticated users full access to these tables. Do not invite other users until you replace this with a strict admin-role policy.
- The frontend currently persists CRUD data in browser localStorage. Supabase schema and scan Edge Functions are included, but full client/business CRUD synchronisation and schedule-form persistence are follow-on integration work.
- The scan Edge Function stores scan records, grid locations, ranking results, competitors, and raw DataForSEO responses in Supabase. The current frontend displays returned scan summaries and stores a local history copy.
- DataForSEO API usage is paid after any trial credit. Ten grid points means ten SERP requests per keyword scan. Five weekly keywords means 50 requests per business per weekly run.
- Google Maps rankings vary by time, location, language, device, and search context. Results are a location-specific SERP snapshot, not a guarantee of what every user sees.
- A target business not present in the first 20 returned results is marked as not found in top 20; it is not assigned rank 21.
- Geo-grid points are deterministic and lie inside the 20 KM radius. Point 1 is the business centre; the other points are distributed on 6 KM and 13 KM rings.
- The independent Keyword Explorer uses the same scan service but records `scan_type='explorer'` and does not create a client/business record.

## 6. Build and deploy

```bash
npm run build
```

Deploy `dist/` to Netlify, or connect the repository to Netlify. `netlify.toml` includes the SPA fallback rewrite.

## 7. GitHub

```bash
git init
git add .
git commit -m "Initial Digigyapan Local Rank Tracker"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/digigyapan-local-rank-tracker.git
git push -u origin main
```

Never commit `.env.local` or API credentials.
