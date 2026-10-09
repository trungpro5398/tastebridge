-- TasteBridge schema. Run once in the Supabase SQL editor.
-- The app talks to these tables only from server routes using the service-role key,
-- so RLS is enabled with no public policies (anon key gets nothing).

create table if not exists huddles (
  id          text primary key,
  title       text not null,
  kind        text not null check (kind in ('place','movie','tv_show')),
  location    text,
  notes       text,
  result      jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists members (
  id          uuid primary key,
  huddle_id   text not null references huddles(id) on delete cascade,
  name        text not null,
  picks       jsonb not null default '[]',
  joined_at   timestamptz not null default now()
);

create index if not exists members_huddle_idx on members(huddle_id);

alter table huddles enable row level security;
alter table members enable row level security;

-- Budget guard for the Claude agent: one row per agent run (IP stored only as a salted hash).
create table if not exists agent_runs (
  id          bigint generated always as identity primary key,
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists agent_runs_created_idx on agent_runs(created_at);
create index if not exists agent_runs_ip_idx on agent_runs(ip_hash, created_at);
alter table agent_runs enable row level security;

-- Optional one-tap feedback after a decision (no personal data).
alter table huddles add column if not exists feedback jsonb not null default '[]';

-- Small server-side cache (e.g. resolved demo favourites) so judges' demo clicks don't spend Qloo quota.
create table if not exists kv (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
alter table kv enable row level security;

-- Separate demo huddles from real ones on the impact page.
alter table huddles add column if not exists is_demo boolean not null default false;

-- One row per answer (append-only, so concurrent answers never overwrite each other).
create table if not exists feedback (
  id          bigint generated always as identity primary key,
  huddle_id   text not null references huddles(id) on delete cascade,
  q           text not null check (q in ('worked','clear','went')),
  a           text not null check (a in ('yes','no')),
  at          timestamptz not null default now()
);
create index if not exists feedback_huddle_idx on feedback(huddle_id);
alter table feedback enable row level security;

-- Secret per-member edit token (returned once to the member's browser; never in public reads).
alter table members add column if not exists edit_token text;
-- One answer per question per browser network per huddle (keeps /impact honest).
alter table feedback add column if not exists ip_hash text;
create unique index if not exists feedback_once on feedback(huddle_id, q, ip_hash);
