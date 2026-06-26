-- Kanban Board : Supabase Database Schema


-- ENUMS
create type task_status as enum ('todo', 'in_progress', 'in_review', 'done');
create type task_priority as enum ('low', 'medium', 'high');

-- TABLES
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

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  updated_at timestamptz not null default now()
);

-- INDEXES
create index tasks_user_id_idx on tasks(user_id);
create index tasks_team_id_idx on tasks(team_id);
create index tasks_status_idx on tasks(status);
create index task_comments_task_id_idx on task_comments(task_id);
create index task_activity_task_id_idx on task_activity(task_id);
create index team_members_user_id_idx on team_members(user_id);
create index team_invites_email_idx on team_invites(email);

-- RLS HELPER FUNCS
create or replace function is_team_member(p_team_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from team_members
    where team_id = p_team_id and user_id = auth.uid()
  );
$$;

create or replace function is_upgraded_user()
returns boolean language sql stable set search_path = public as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    or nullif(trim(auth.jwt() ->> 'email'), '') is not null;
$$;

create or replace function can_access_task(p_task_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
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
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from team_members
    where team_id = p_team_id and user_id = auth.uid() and role = 'owner'
  );
$$;

-- EMAIL/PROFILE FUNCS
create or replace function user_email(p_user_id uuid)
returns text language sql security definer stable set search_path = public as $$
  select coalesce(
    (select email from public.profiles where id = p_user_id),
    (select email::text from auth.users where id = p_user_id)
  );
$$;

create or replace function activity_metadata(p_user_id uuid)
returns jsonb language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'actor_email',
    nullif(trim(coalesce(public.user_email(p_user_id), '')), '')
  );
$$;

create or replace function sync_profile_from_auth()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, updated_at)
  values (new.id, new.email, now())
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

-- FUNCS CALLED FROM APP
create or replace function create_team_with_owner(p_name text)
returns teams language plpgsql security definer set search_path = public as $$
declare
  new_team teams;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = true
     and nullif(trim(coalesce(auth.jwt() ->> 'email', '')), '') is null then
    raise exception 'Sign in or upgrade your account to create a team';
  end if;
  if nullif(trim(p_name), '') is null then raise exception 'Team name is required'; end if;
  insert into teams (name, owner_id) values (trim(p_name), uid) returning * into new_team;
  insert into team_members (team_id, user_id, role) values (new_team.id, uid, 'owner');
  return new_team;
end;
$$;

create or replace function get_team_member_emails(p_team_id uuid)
returns table (user_id uuid, email text)
language plpgsql security definer stable set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not is_team_member(p_team_id) then raise exception 'Not a team member'; end if;
  return query
  select tm.user_id, nullif(trim(coalesce(public.user_email(tm.user_id), '')), '')
  from team_members tm where tm.team_id = p_team_id;
end;
$$;

create or replace function get_task_activity_with_authors(p_task_id uuid)
returns table (
  id uuid, task_id uuid, actor_id uuid, actor_email text,
  action text, from_value text, to_value text, metadata jsonb, created_at timestamptz
) language sql security definer stable set search_path = public as $$
  select ta.id, ta.task_id, ta.actor_id,
    coalesce(nullif(trim(ta.metadata->>'actor_email'), ''), nullif(trim(public.user_email(ta.actor_id)), '')),
    ta.action, ta.from_value, ta.to_value, ta.metadata, ta.created_at
  from task_activity ta
  where ta.task_id = p_task_id and can_access_task(p_task_id)
  order by ta.created_at desc;
$$;

create or replace function get_task_comments_with_authors(p_task_id uuid)
returns table (
  id uuid, task_id uuid, user_id uuid, author_email text, body text, created_at timestamptz
) language sql security definer stable set search_path = public as $$
  select tc.id, tc.task_id, tc.user_id,
    nullif(trim(public.user_email(tc.user_id)), ''), tc.body, tc.created_at
  from task_comments tc
  where tc.task_id = p_task_id and can_access_task(p_task_id)
  order by tc.created_at asc;
$$;

-- ACTIVITY TRIGGERS
create or replace function log_task_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    insert into task_activity (task_id, actor_id, action, to_value, metadata)
    values (NEW.id, NEW.user_id, 'created', NEW.status::text, activity_metadata(NEW.user_id));
    return NEW;
  elsif TG_OP = 'UPDATE' then
    if OLD.status is distinct from NEW.status then
      insert into task_activity (task_id, actor_id, action, from_value, to_value, metadata)
      values (NEW.id, auth.uid(), 'status_changed', OLD.status::text, NEW.status::text, activity_metadata(auth.uid()));
    end if;
    if OLD.priority is distinct from NEW.priority then
      insert into task_activity (task_id, actor_id, action, from_value, to_value, metadata)
      values (NEW.id, auth.uid(), 'priority_changed', OLD.priority::text, NEW.priority::text, activity_metadata(auth.uid()));
    end if;
    if OLD.assignee_id is distinct from NEW.assignee_id then
      insert into task_activity (task_id, actor_id, action, from_value, to_value, metadata)
      values (NEW.id, auth.uid(), 'assignee_changed', coalesce(OLD.assignee_id::text, ''), coalesce(NEW.assignee_id::text, ''), activity_metadata(auth.uid()));
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
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into task_activity (task_id, actor_id, action, metadata)
  values (NEW.task_id, NEW.user_id, 'comment_added',
    activity_metadata(NEW.user_id) || jsonb_build_object('comment_id', NEW.id));
  return NEW;
end;
$$;

create trigger task_comments_activity_trigger
  after insert on task_comments
  for each row execute function log_comment_activity();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function sync_profile_from_auth();

create trigger on_auth_user_updated
  after update of email on auth.users
  for each row execute function sync_profile_from_auth();

-- RLS
alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_invites enable row level security;
alter table tasks enable row level security;
alter table task_comments enable row level security;
alter table task_activity enable row level security;
alter table profiles enable row level security;

create policy "teams_select" on teams for select using (owner_id = auth.uid() or is_team_member(id));
create policy "teams_insert" on teams for insert with check (owner_id = auth.uid() and is_upgraded_user());
create policy "teams_update" on teams for update using (is_team_owner(id));
create policy "teams_delete" on teams for delete using (owner_id = auth.uid());

create policy "team_members_select" on team_members for select using (is_team_member(team_id));
create policy "team_members_insert" on team_members for insert with check (
  is_team_owner(team_id)
  or (user_id = auth.uid() and exists (select 1 from teams t where t.id = team_members.team_id and t.owner_id = auth.uid()))
  or (user_id = auth.uid() and exists (select 1 from team_invites ti where ti.team_id = team_members.team_id and lower(ti.email) = lower(auth.jwt() ->> 'email') and ti.status = 'pending'))
);
create policy "team_members_delete" on team_members for delete using (is_team_owner(team_id) or user_id = auth.uid());

create policy "team_invites_select" on team_invites for select using (is_team_owner(team_id) or lower(email) = lower(auth.jwt() ->> 'email'));
create policy "team_invites_insert" on team_invites for insert with check (is_team_owner(team_id) and is_upgraded_user());
create policy "team_invites_update" on team_invites for update using (is_team_owner(team_id) or lower(email) = lower(auth.jwt() ->> 'email'));
create policy "team_invites_delete" on team_invites for delete using (is_team_owner(team_id));

create policy "tasks_select" on tasks for select using (
  (team_id is null and user_id = auth.uid()) or (team_id is not null and is_team_member(team_id))
);
create policy "tasks_insert" on tasks for insert with check (
  user_id = auth.uid() and (team_id is null or (team_id is not null and is_team_member(team_id)))
);
create policy "tasks_update" on tasks for update using (
  (team_id is null and user_id = auth.uid()) or (team_id is not null and is_team_member(team_id))
);
create policy "tasks_delete" on tasks for delete using (
  (team_id is null and user_id = auth.uid()) or (team_id is not null and is_team_member(team_id))
);

create policy "task_comments_select" on task_comments for select using (can_access_task(task_id));
create policy "task_comments_insert" on task_comments for insert with check (user_id = auth.uid() and can_access_task(task_id));
create policy "task_comments_delete" on task_comments for delete using (user_id = auth.uid());

create policy "task_activity_select" on task_activity for select using (can_access_task(task_id));

create policy "profiles_select" on profiles for select using (
  id = auth.uid() or exists (
    select 1 from team_members tm_me
    join team_members tm_them on tm_me.team_id = tm_them.team_id
    where tm_me.user_id = auth.uid() and tm_them.user_id = profiles.id
  )
);
create policy "profiles_update_own" on profiles for update using (id = auth.uid());

-- REALTIME
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table task_comments;
alter publication supabase_realtime add table task_activity;
alter publication supabase_realtime add table team_members;

-- GRANTS
revoke all on function create_team_with_owner(text) from public;
grant execute on function create_team_with_owner(text) to authenticated;
revoke all on function get_team_member_emails(uuid) from public;
grant execute on function get_team_member_emails(uuid) to authenticated;
revoke all on function get_task_activity_with_authors(uuid) from public;
grant execute on function get_task_activity_with_authors(uuid) to authenticated;
revoke all on function get_task_comments_with_authors(uuid) from public;
grant execute on function get_task_comments_with_authors(uuid) to authenticated;
