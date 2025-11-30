-- Enable uuid generation (usually already enabled in Supabase)
create extension if not exists "pgcrypto";

-- Drop tables if they exist --
drop table if exists public.friendships cascade;
drop table if exists public.plants cascade;
drop table if exists public.profiles cascade;


------------------------------------------------------------
-- 1) USERS TABLE (one row per auth user)
--    Mirrors auth.users.id and stores app-specific profile data
------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key
    references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

------------------------------------------------------------
-- 2) PLANTS TABLE (global plant catalog, from Perenual + extras)
------------------------------------------------------------
create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  perenual_id integer,
  common_name text,
  scientific_name text,
  description text,
  watering_general_benchmark text,   -- e.g. "once per week"
  watering_interval_days integer,    -- structured version, e.g. 7
  sunlight text,                     -- e.g. "full_sun", "partial_shade"
  maintenance_category text,         -- e.g. "low", "medium", "high"
  soil_type text,
  poison_human boolean,
  poison_pets boolean,
  default_image_url text,
  care_notes text,
  created_at timestamptz not null default now()
);

------------------------------------------------------------
-- 3) FLOORPLANS TABLE (one row per user floorplan / scan)
------------------------------------------------------------
create table if not exists public.floorplans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.users (id) on delete cascade,
  name text,                          -- e.g. "Living Room", "Apartment"
  roomplan_json jsonb,               -- raw RoomPlan / layout JSON
  created_at timestamptz not null default now()
);

-- Helpful index for queries by user
create index if not exists idx_floorplans_user_id
  on public.floorplans (user_id);

------------------------------------------------------------
-- 4) USER_PLANTS TABLE (plants a user owns, tied to a floorplan)
------------------------------------------------------------
create table if not exists public.user_plants (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.users (id) on delete cascade,

  plant_id uuid
    references public.plants (id) on delete set null,

  floorplan_id uuid not null
    references public.floorplans (id) on delete cascade,

  nickname text,                      -- user-given name for the plant
  notes text,                         -- custom parameters / notes

  -- coordinates & location metadata within the floorplan
  x_coord numeric,
  y_coord numeric,
  location_meta jsonb,                -- e.g. { "room": "Living Room" }

  -- care / reminders
  started_at date,                    -- day added
  watering_frequency_days integer,    -- override default from plants
  last_watered_at date,
  next_water_at date,

  -- photos stored as an array of objects:
  -- [ { "image_url": "...", "taken_at": "...", "notes": "..." }, ... ]
  photos jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_user_plants_user_id
  on public.user_plants (user_id);

create index if not exists idx_user_plants_floorplan_id
  on public.user_plants (floorplan_id);

create index if not exists idx_user_plants_plant_id
  on public.user_plants (plant_id);

------------------------------------------------------------
-- 5) PLANT_RECOMMENDATIONS TABLE (suggested plants/placements)
------------------------------------------------------------
create table if not exists public.plant_recommendations (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.users (id) on delete cascade,

  plant_id uuid
    references public.plants (id) on delete set null,

  floorplan_id uuid not null
    references public.floorplans (id) on delete cascade,

  source text,                        -- e.g. 'gemini', 'perenual', 'manual'
  score numeric,                      -- confidence / ranking
  reason text,                        -- human-readable explanation

  -- e.g. { "x": 10, "y": 42, "room": "Bedroom" }
  recommended_location jsonb,

  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed')),

  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  dismissed_at timestamptz
);

create index if not exists idx_plant_recs_user_id
  on public.plant_recommendations (user_id);

create index if not exists idx_plant_recs_floorplan_id
  on public.plant_recommendations (floorplan_id);

create index if not exists idx_plant_recs_plant_id
  on public.plant_recommendations (plant_id);

------------------------------------------------------------
-- Enable RLS on user-owned tables
------------------------------------------------------------
alter table public.users                 enable row level security;
alter table public.floorplans            enable row level security;
alter table public.user_plants           enable row level security;
alter table public.plant_recommendations enable row level security;

------------------------------------------------------------
-- USERS: only the logged-in user can see/update their row
------------------------------------------------------------
create policy "Users can read own user row"
  on public.users
  for select
  using (id = auth.uid());

create policy "Users can insert their own user row"
  on public.users
  for insert
  with check (id = auth.uid());

create policy "Users can update their own user row"
  on public.users
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- usually you don't want clients deleting their user row, so skip delete
-- or add a delete policy if you really want:

-- create policy "Users can delete their own user row"
--   on public.users
--   for delete
--   using (id = auth.uid());

------------------------------------------------------------
-- FLOORPLANS: user can manage only their own floorplans
------------------------------------------------------------
create policy "Users can read own floorplans"
  on public.floorplans
  for select
  using (user_id = auth.uid());

create policy "Users can insert own floorplans"
  on public.floorplans
  for insert
  with check (user_id = auth.uid());

create policy "Users can update own floorplans"
  on public.floorplans
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own floorplans"
  on public.floorplans
  for delete
  using (user_id = auth.uid());

------------------------------------------------------------
-- USER_PLANTS: user can manage only their own plants
------------------------------------------------------------
create policy "Users can read own user_plants"
  on public.user_plants
  for select
  using (user_id = auth.uid());

create policy "Users can insert own user_plants"
  on public.user_plants
  for insert
  with check (user_id = auth.uid());

create policy "Users can update own user_plants"
  on public.user_plants
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own user_plants"
  on public.user_plants
  for delete
  using (user_id = auth.uid());

------------------------------------------------------------
-- PLANT_RECOMMENDATIONS: user can see/manage only their recs
------------------------------------------------------------
create policy "Users can read own plant_recommendations"
  on public.plant_recommendations
  for select
  using (user_id = auth.uid());

create policy "Users can insert own plant_recommendations"
  on public.plant_recommendations
  for insert
  with check (user_id = auth.uid());

create policy "Users can update own plant_recommendations"
  on public.plant_recommendations
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own plant_recommendations"
  on public.plant_recommendations
  for delete
  using (user_id = auth.uid());

------------------------------------------------------------
-- PLANTS: global catalog
-- Option A: make it read-only to everyone (client side)
------------------------------------------------------------
alter table public.plants enable row level security;

create policy "Anyone can read plants catalog"
  on public.plants
  for select
  using (true);

-- You probably don't want clients inserting/updating/deleting plants
-- Do that from server-side (service role) only, so no extra policies here.
