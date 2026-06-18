-- ============================================================================
-- Daily dashboard — full schema
-- ============================================================================
-- Covers: Whoop data, Google Calendar OAuth tokens, goals, tasks, and a
-- daily_scores table that stores the computed health/recovery/productivity
-- ratings once per day (so the dashboard doesn't recompute them from raw
-- data on every page load, and so you can see how scores trended over time).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Whoop OAuth credentials
-- ----------------------------------------------------------------------------
create table if not exists whoop_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- ----------------------------------------------------------------------------
-- Google Calendar OAuth credentials
-- ----------------------------------------------------------------------------
create table if not exists google_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- ----------------------------------------------------------------------------
-- Whoop data tables (same shapes as verified against Whoop's live API docs)
-- ----------------------------------------------------------------------------
create table if not exists recovery_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  whoop_cycle_id bigint not null,
  date date not null,
  recovery_score numeric,
  hrv_ms numeric,
  resting_heart_rate numeric,
  skin_temp_celsius numeric,
  spo2_percentage numeric,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, whoop_cycle_id)
);
create index if not exists idx_recovery_user_date on recovery_metrics (user_id, date desc);

create table if not exists sleep_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  whoop_sleep_uuid text not null,
  whoop_cycle_id bigint,
  is_nap boolean not null default false,
  date date not null,
  start_time timestamptz,
  end_time timestamptz,
  sleep_performance_percentage numeric,
  sleep_consistency_percentage numeric,
  sleep_efficiency_percentage numeric,
  respiratory_rate numeric,
  total_sleep_minutes numeric,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, whoop_sleep_uuid)
);
create index if not exists idx_sleep_user_date on sleep_metrics (user_id, date desc);

create table if not exists strain_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  whoop_cycle_id bigint not null,
  date date not null,
  day_strain numeric,
  average_heart_rate numeric,
  max_heart_rate numeric,
  kilojoules numeric,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, whoop_cycle_id)
);
create index if not exists idx_strain_user_date on strain_metrics (user_id, date desc);

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  whoop_workout_uuid text not null,
  sport_name text,
  start_time timestamptz,
  end_time timestamptz,
  strain numeric,
  average_heart_rate numeric,
  max_heart_rate numeric,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, whoop_workout_uuid)
);
create index if not exists idx_workouts_user_time on workouts (user_id, start_time desc);

create table if not exists sync_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('whoop', 'google_calendar')),
  synced_at timestamptz not null default now(),
  status text not null check (status in ('success', 'error')),
  records_synced integer default 0,
  error_message text
);
create index if not exists idx_sync_log_user_time on sync_log (user_id, synced_at desc);

-- ----------------------------------------------------------------------------
-- Goals — entered once on first run, editable afterward
-- ----------------------------------------------------------------------------
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_goals_user_status on goals (user_id, status);

-- ----------------------------------------------------------------------------
-- Tasks — the daily to-do list, optionally linked to a goal
-- ----------------------------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  title text not null,
  due_date date,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  effort_level integer check (effort_level between 1 and 5),
  source text not null default 'manual' check (source in ('manual', 'suggested')), -- did the user add this, or did the assistant suggest it
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_tasks_user_status on tasks (user_id, status);
create index if not exists idx_tasks_user_due on tasks (user_id, due_date);

-- ----------------------------------------------------------------------------
-- Daily scores — one row per day, computed once and cached
-- ----------------------------------------------------------------------------
create table if not exists daily_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  health_score numeric,       -- 0-100, from strain/HR/SpO2/skin temp
  recovery_score numeric,     -- 0-100, from sleep + Whoop recovery + HRV
  productivity_score numeric, -- 0-100, from task/goal completion rate
  computed_at timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists idx_daily_scores_user_date on daily_scores (user_id, date desc);

-- ----------------------------------------------------------------------------
-- User preferences — tracks whether first-run goal setup has happened
-- ----------------------------------------------------------------------------
create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarded boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table whoop_credentials enable row level security;
alter table google_credentials enable row level security;
alter table recovery_metrics enable row level security;
alter table sleep_metrics enable row level security;
alter table strain_metrics enable row level security;
alter table workouts enable row level security;
alter table sync_log enable row level security;
alter table goals enable row level security;
alter table tasks enable row level security;
alter table daily_scores enable row level security;
alter table user_preferences enable row level security;

create policy "own rows" on whoop_credentials for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on google_credentials for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on recovery_metrics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on sleep_metrics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on strain_metrics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on workouts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on sync_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on daily_scores for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on user_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_whoop_credentials_updated before update on whoop_credentials for each row execute function set_updated_at();
create trigger trg_google_credentials_updated before update on google_credentials for each row execute function set_updated_at();
create trigger trg_goals_updated before update on goals for each row execute function set_updated_at();
