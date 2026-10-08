-- Run in the Supabase SQL editor. Safe to re-run: every statement is idempotent,
-- so running it again after pulling a new version upgrades an existing install.

-- ---------------------------------------------------------------------------
-- LinkedIn connection (single row)
-- ---------------------------------------------------------------------------
create table if not exists linkedin_connection (
  id int primary key default 1 check (id = 1),
  member_urn text not null,
  name text,
  access_token text not null,
  expires_at timestamptz not null,
  connected_at timestamptz not null default now()
);
alter table linkedin_connection add column if not exists picture text;

-- ---------------------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------------------
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  topics text[] not null default '{}',
  voice text not null default '',
  post_times text[] not null default '{08:00}',          -- local HH:MM slots
  timezone text not null default 'Africa/Johannesburg',  -- IANA zone, DST-aware
  auto_generate boolean not null default false,          -- cron tops up the draft queue
  queue_target int not null default 5
);

-- Upgrade path for installs created with the old fixed `utc_offset_minutes` column.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'settings' and column_name = 'timezone'
  ) then
    alter table settings add column timezone text not null default 'Africa/Johannesburg';
    update settings set timezone = case
      when utc_offset_minutes = 120 then 'Africa/Johannesburg'
      when utc_offset_minutes % 60 = 0 then
        'Etc/GMT' || case when utc_offset_minutes > 0 then '-' else '+' end || abs(utc_offset_minutes / 60)
      else 'UTC'
    end;
  end if;
end $$;

alter table settings add column if not exists post_days int[] not null default '{0,1,2,3,4,5,6}'; -- 0 = Sunday
alter table settings add column if not exists rules text not null default '';            -- always/never instructions
alter table settings add column if not exists max_hashtags int not null default 3;
insert into settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  topic text,
  status text not null default 'draft'
    check (status in ('draft','approved','publishing','published','failed')),
  scheduled_for timestamptz,
  published_at timestamptz,
  linkedin_post_urn text,
  error text,
  created_at timestamptz not null default now()
);
alter table posts add column if not exists source text not null default 'claude';  -- claude | manual
alter table posts add column if not exists attempts int not null default 0;
alter table posts add column if not exists publishing_started_at timestamptz;
alter table posts add column if not exists image_path text;   -- object path in the post-images bucket
alter table posts add column if not exists image_alt text;
alter table posts add column if not exists updated_at timestamptz not null default now();

create index if not exists posts_status_sched_idx on posts (status, scheduled_for);

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists posts_touch on posts;
create trigger posts_touch before update on posts for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Activity log (cron runs, publishes, generations, errors)
-- ---------------------------------------------------------------------------
create table if not exists activity (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null,
  ok boolean not null default true,
  message text not null,
  post_id uuid references posts(id) on delete set null
);
create index if not exists activity_at_idx on activity (at desc);

-- ---------------------------------------------------------------------------
-- Private bucket for post images (served to the dashboard via signed URLs)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Server-only access via the service role key.
-- RLS on with no policies = the anon/authenticated keys get nothing.
-- ---------------------------------------------------------------------------
alter table linkedin_connection enable row level security;
alter table settings enable row level security;
alter table posts enable row level security;
alter table activity enable row level security;
