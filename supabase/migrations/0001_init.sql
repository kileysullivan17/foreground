-- Planner schema. Column names mirror src/data/supabase.ts row types.
-- Items are shaped to map onto Asana tasks later:
--   title→name, notes→notes, hard_deadline→due_on, project_id→projects[0],
--   section→memberships[].section, assignee→assignee, status 'done'→completed.

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text not null check (area in ('work', 'home')),
  goal text not null default '',
  target_date date,
  created_at timestamptz not null default now()
);

create table items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text not null default '',
  area text not null check (area in ('work', 'home')),
  project_id uuid references projects(id) on delete set null,
  section text,
  assignee text,
  effort text not null default 'M' check (effort in ('S', 'M', 'L')),
  hard_deadline date,
  importance int not null default 3 check (importance between 1 and 5),
  -- v1 keeps dependencies as an id array; promote to a join table if
  -- dependency queries ever need to run in SQL.
  depends_on uuid[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'parked')),
  created_at timestamptz not null default now(),
  last_touched_at timestamptz not null default now(),
  last_touch_note text
);

create index items_status_idx on items (status);
create index items_project_idx on items (project_id);

-- Single-user v1: no auth, RLS left permissive on purpose (anon key is only
-- ever used locally). Lock this down when auth lands.
alter table projects enable row level security;
alter table items enable row level security;
create policy "anon full access" on projects for all using (true) with check (true);
create policy "anon full access" on items for all using (true) with check (true);
