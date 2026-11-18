create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  business_name text not null,
  address text not null,
  place_id text,
  category text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.keywords (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  keyword text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, keyword)
);

create table if not exists public.rank_scans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  keyword text not null,
  scan_type text not null check (scan_type in ('client','explorer')),
  business_name text not null,
  search_location text,
  status text not null default 'queued' check (status in ('queued','running','completed','partial','failed')),
  average_rank numeric(8,2),
  top_3_count integer not null default 0,
  top_10_count integer not null default 0,
  not_found_count integer not null default 0,
  visibility_percentage numeric(5,2),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.grid_locations (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.rank_scans(id) on delete cascade,
  location_number integer not null check (location_number between 1 and 10),
  latitude double precision not null,
  longitude double precision not null,
  distance_km numeric(8,2) not null,
  unique (scan_id, location_number)
);

create table if not exists public.ranking_results (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.rank_scans(id) on delete cascade,
  grid_location_id uuid not null references public.grid_locations(id) on delete cascade,
  target_place_id text,
  target_business_name text,
  rank_position integer,
  rating numeric(3,2),
  review_count integer,
  result_url text,
  competitors jsonb not null default '[]'::jsonb,
  raw_response jsonb,
  checked_at timestamptz not null default now(),
  unique (scan_id, grid_location_id)
);

create table if not exists public.scan_schedules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  day_of_week integer not null default 1 check (day_of_week between 0 and 6),
  scan_time time not null default '09:00',
  timezone text not null default 'Asia/Kolkata',
  is_active boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id)
);

create table if not exists public.keyword_explorer_scans (
  id uuid primary key references public.rank_scans(id) on delete cascade,
  search_keyword text not null,
  search_location text not null,
  center_latitude double precision not null,
  center_longitude double precision not null,
  radius_km integer not null default 20,
  grid_size integer not null default 10
);

create index if not exists idx_businesses_client on public.businesses(client_id);
create index if not exists idx_keywords_business on public.keywords(business_id);
create index if not exists idx_scans_business_created on public.rank_scans(business_id, created_at desc);
create index if not exists idx_scans_keyword_created on public.rank_scans(keyword, created_at desc);
create index if not exists idx_grid_scan on public.grid_locations(scan_id);
create index if not exists idx_results_scan on public.ranking_results(scan_id);

-- Single-admin MVP: authenticated users can access data. Tighten policies to an explicit admin role before inviting other users.
alter table public.clients enable row level security;
alter table public.businesses enable row level security;
alter table public.keywords enable row level security;
alter table public.rank_scans enable row level security;
alter table public.grid_locations enable row level security;
alter table public.ranking_results enable row level security;
alter table public.scan_schedules enable row level security;
alter table public.keyword_explorer_scans enable row level security;

do $$ declare t text; begin
  foreach t in array array['clients','businesses','keywords','rank_scans','grid_locations','ranking_results','scan_schedules','keyword_explorer_scans'] loop
    execute format('drop policy if exists "authenticated full access" on public.%I', t);
    execute format('create policy "authenticated full access" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
