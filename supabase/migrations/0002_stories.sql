-- Product module: the app's own roadmap as a managed backlog.
-- Column names mirror the StoryRow type in src/data/supabase.ts.

create table stories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  -- [{ "text": string, "done": boolean }]; checked and toggled client-side,
  -- so jsonb beats a child table until criteria need querying in SQL.
  acceptance_criteria jsonb not null default '[]',
  business_value int not null default 3 check (business_value between 1 and 5),
  time_criticality int not null default 3 check (time_criticality between 1 and 5),
  enablement int not null default 3 check (enablement between 1 and 5),
  job_size int not null default 3 check (job_size in (1, 2, 3, 5, 8)),
  status text not null default 'backlog'
    check (status in ('backlog', 'groomed', 'in_progress', 'done', 'later')),
  raw boolean not null default false,
  created_at timestamptz not null default now()
);

create index stories_status_idx on stories (status);

-- Same single-user posture as 0001: permissive RLS until auth lands.
alter table stories enable row level security;
create policy "anon full access" on stories for all using (true) with check (true);
