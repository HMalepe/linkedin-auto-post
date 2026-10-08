-- Run once in the Supabase SQL editor.

create table if not exists linkedin_connection (
  id int primary key default 1 check (id = 1),
  member_urn text not null,
  name text,
  access_token text not null,
  expires_at timestamptz not null,
  connected_at timestamptz not null default now()
);

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  topics text[] not null default '{}',
  voice text not null default '',
  post_times text[] not null default '{08:00}',   -- local HH:MM slots
  utc_offset_minutes int not null default 120,    -- SAST = +120
  auto_generate boolean not null default false,   -- cron tops up the draft queue
  queue_target int not null default 5
);
insert into settings (id) values (1) on conflict do nothing;

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
create index if not exists posts_status_sched_idx on posts (status, scheduled_for);

-- Server-only access via the service role key. RLS on, no policies = anon/authenticated get nothing.
alter table linkedin_connection enable row level security;
alter table settings enable row level security;
alter table posts enable row level security;
