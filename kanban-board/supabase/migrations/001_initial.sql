-- Kanban Board initial schema

-- Enums
create type task_status as enum ('todo', 'in_progress', 'in_review', 'done');
create type task_priority as enum ('low', 'medium', 'high');

-- Teams (created before tasks due to FK)
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table team_members (
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (team_id, email)
);

-- Tasks
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status task_status not null default 'todo',
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  description text,
  due_date date,
  assignee_id uuid references auth.users(id),
  priority task_priority not null default 'medium',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  from_value text,
  to_value text,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- Indexes
create index tasks_user_id_idx on tasks(user_id);
create index tasks_team_id_idx on tasks(team_id);
create index tasks_status_idx on tasks(status);
create index task_comments_task_id_idx on task_comments(task_id);
create index task_activity_task_id_idx on task_activity(task_id);
create index team_members_user_id_idx on team_members(user_id);
create index team_invites_email_idx on team_invites(email);

-- Helper functions
create or replace function is_team_member(p_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from team_members
    where team_id = p_team_id and user_id = auth.uid()
  );
$$;

create or replace function is_upgraded_user()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    or nullif(trim(auth.jwt() ->> 'email'), '') is not null;
$$;

create or replace function can_access_task(p_task_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from tasks t
    where t.id = p_task_id
    and (
      (t.team_id is null and t.user_id = auth.uid())
      or (t.team_id is not null and is_team_member(t.team_id))
    )
  );
$$;

create or replace function is_team_owner(p_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from team_members
    where team_id = p_team_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- Activity logging triggers
create or replace function log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into task_activity (task_id, actor_id, action, to_value)
    values (NEW.id, NEW.user_id, 'created', NEW.status::text);
    return NEW;
  elsif TG_OP = 'UPDATE' then
    if OLD.status is distinct from NEW.status then
      insert into task_activity (task_id, actor_id, action, from_value, to_value)
      values (NEW.id, auth.uid(), 'status_changed', OLD.status::text, NEW.status::text);
    end if;
    if OLD.priority is distinct from NEW.priority then
      insert into task_activity (task_id, actor_id, action, from_value, to_value)
      values (NEW.id, auth.uid(), 'priority_changed', OLD.priority::text, NEW.priority::text);
    end if;
    if OLD.assignee_id is distinct from NEW.assignee_id then
      insert into task_activity (task_id, actor_id, action, from_value, to_value)
      values (
        NEW.id,
        auth.uid(),
        'assignee_changed',
        coalesce(OLD.assignee_id::text, ''),
        coalesce(NEW.assignee_id::text, '')
      );
    end if;
    return NEW;
  end if;
  return null;
end;
$$;

create trigger tasks_activity_trigger
  after insert or update on tasks
  for each row execute function log_task_activity();

create or replace function log_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into task_activity (task_id, actor_id, action, metadata)
  values (
    NEW.task_id,
    NEW.user_id,
    'comment_added',
    jsonb_build_object('comment_id', NEW.id)
  );
  return NEW;
end;
$$;

create trigger task_comments_activity_trigger
  after insert on task_comments
  for each row execute function log_comment_activity();

-- Row Level Security
alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_invites enable row level security;
alter table tasks enable row level security;
alter table task_comments enable row level security;
alter table task_activity enable row level security;

-- Teams policies
create policy "teams_select" on teams for select using (
  owner_id = auth.uid() or is_team_member(id)
);

create policy "teams_insert" on teams for insert with check (
  owner_id = auth.uid() and is_upgraded_user()
);

create policy "teams_update" on teams for update using (
  is_team_owner(id)
);

create policy "teams_delete" on teams for delete using (
  owner_id = auth.uid()
);

-- Team members policies
create policy "team_members_select" on team_members for select using (
  is_team_member(team_id)
);

create policy "team_members_insert" on team_members for insert with check (
  is_team_owner(team_id)
  or (
    user_id = auth.uid()
    and exists (
      select 1 from teams t
      where t.id = team_members.team_id
        and t.owner_id = auth.uid()
    )
  )
  or (
    user_id = auth.uid()
    and exists (
      select 1 from team_invites ti
      where ti.team_id = team_members.team_id
        and lower(ti.email) = lower(auth.jwt() ->> 'email')
        and ti.status = 'pending'
    )
  )
);

create policy "team_members_delete" on team_members for delete using (
  is_team_owner(team_id) or user_id = auth.uid()
);

-- Team invites policies
create policy "team_invites_select" on team_invites for select using (
  is_team_owner(team_id)
  or lower(email) = lower(auth.jwt() ->> 'email')
);

create policy "team_invites_insert" on team_invites for insert with check (
  is_team_owner(team_id) and is_upgraded_user()
);

create policy "team_invites_update" on team_invites for update using (
  is_team_owner(team_id)
  or lower(email) = lower(auth.jwt() ->> 'email')
);

create policy "team_invites_delete" on team_invites for delete using (
  is_team_owner(team_id)
);

-- Tasks policies
create policy "tasks_select" on tasks for select using (
  (team_id is null and user_id = auth.uid())
  or (team_id is not null and is_team_member(team_id))
);

create policy "tasks_insert" on tasks for insert with check (
  user_id = auth.uid()
  and (
    team_id is null
    or (team_id is not null and is_team_member(team_id))
  )
);

create policy "tasks_update" on tasks for update using (
  (team_id is null and user_id = auth.uid())
  or (team_id is not null and is_team_member(team_id))
);

create policy "tasks_delete" on tasks for delete using (
  (team_id is null and user_id = auth.uid())
  or (team_id is not null and is_team_member(team_id))
);

-- Task comments policies
create policy "task_comments_select" on task_comments for select using (
  can_access_task(task_id)
);

create policy "task_comments_insert" on task_comments for insert with check (
  user_id = auth.uid() and can_access_task(task_id)
);

create policy "task_comments_delete" on task_comments for delete using (
  user_id = auth.uid()
);

-- Task activity policies
create policy "task_activity_select" on task_activity for select using (
  can_access_task(task_id)
);

-- Realtime publication
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table task_comments;
alter publication supabase_realtime add table task_activity;
alter publication supabase_realtime add table team_members;

-- Atomic team creation (avoids team_members RLS chicken-and-egg on first insert)
create or replace function public.create_team_with_owner(p_name text)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  new_team public.teams;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = true
     and nullif(trim(coalesce(auth.jwt() ->> 'email', '')), '') is null then
    raise exception 'Sign in or upgrade your account to create a team';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Team name is required';
  end if;

  insert into public.teams (name, owner_id)
  values (trim(p_name), uid)
  returning * into new_team;

  insert into public.team_members (team_id, user_id, role)
  values (new_team.id, uid, 'owner');

  return new_team;
end;
$$;

revoke all on function public.create_team_with_owner(text) from public;
grant execute on function public.create_team_with_owner(text) to authenticated;
