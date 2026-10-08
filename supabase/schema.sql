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
