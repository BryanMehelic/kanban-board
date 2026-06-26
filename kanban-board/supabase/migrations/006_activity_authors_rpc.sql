-- Self-contained migration: profiles table + team author emails on activity/comments.
-- Run this if 004/005 were skipped. Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE).

-- ---------------------------------------------------------------------------
-- 1. Profiles table (from 004 — required for email lookup cache)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from team_members tm_me
    join team_members tm_them on tm_me.team_id = tm_them.team_id
    where tm_me.user_id = auth.uid()
      and tm_them.user_id = profiles.id
  )
);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (
  id = auth.uid()
);

create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, updated_at)
  values (new.id, new.email, now())
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.sync_profile_from_auth();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email on auth.users
  for each row execute function public.sync_profile_from_auth();

insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do update set email = excluded.email;

-- ---------------------------------------------------------------------------
-- 2. Email helpers + RPCs for activity/comments with author names
-- ---------------------------------------------------------------------------
create or replace function public.user_email(p_user_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select email from public.profiles where id = p_user_id),
    (select email::text from auth.users where id = p_user_id)
  );
$$;

create or replace function public.activity_metadata(p_user_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'actor_email',
    nullif(trim(coalesce(public.user_email(p_user_id), '')), '')
  );
$$;

create or replace function public.get_team_member_emails(p_team_id uuid)
returns table (user_id uuid, email text)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not is_team_member(p_team_id) then
    raise exception 'Not a team member';
  end if;

  return query
  select
    tm.user_id,
    nullif(trim(coalesce(public.user_email(tm.user_id), '')), '')
  from team_members tm
  where tm.team_id = p_team_id;
end;
$$;

create or replace function public.get_task_activity_with_authors(p_task_id uuid)
returns table (
  id uuid,
  task_id uuid,
  actor_id uuid,
  actor_email text,
  action text,
  from_value text,
  to_value text,
  metadata jsonb,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    ta.id,
    ta.task_id,
    ta.actor_id,
    coalesce(
      nullif(trim(ta.metadata->>'actor_email'), ''),
      nullif(trim(public.user_email(ta.actor_id)), '')
    ) as actor_email,
    ta.action,
    ta.from_value,
    ta.to_value,
    ta.metadata,
    ta.created_at
  from task_activity ta
  where ta.task_id = p_task_id
    and public.can_access_task(p_task_id)
  order by ta.created_at desc;
$$;

create or replace function public.get_task_comments_with_authors(p_task_id uuid)
returns table (
  id uuid,
  task_id uuid,
  user_id uuid,
  author_email text,
  body text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    tc.id,
    tc.task_id,
    tc.user_id,
    nullif(trim(public.user_email(tc.user_id)), '') as author_email,
    tc.body,
    tc.created_at
  from task_comments tc
  where tc.task_id = p_task_id
    and public.can_access_task(p_task_id)
  order by tc.created_at asc;
$$;

revoke all on function public.get_team_member_emails(uuid) from public;
revoke all on function public.get_task_activity_with_authors(uuid) from public;
revoke all on function public.get_task_comments_with_authors(uuid) from public;

grant execute on function public.get_team_member_emails(uuid) to authenticated;
grant execute on function public.get_task_activity_with_authors(uuid) to authenticated;
grant execute on function public.get_task_comments_with_authors(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Activity triggers — store actor email on each new row
-- ---------------------------------------------------------------------------
create or replace function log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into task_activity (task_id, actor_id, action, to_value, metadata)
    values (
      NEW.id,
      NEW.user_id,
      'created',
      NEW.status::text,
      public.activity_metadata(NEW.user_id)
    );
    return NEW;
  elsif TG_OP = 'UPDATE' then
    if OLD.status is distinct from NEW.status then
      insert into task_activity (task_id, actor_id, action, from_value, to_value, metadata)
      values (
        NEW.id,
        auth.uid(),
        'status_changed',
        OLD.status::text,
        NEW.status::text,
        public.activity_metadata(auth.uid())
      );
    end if;
    if OLD.priority is distinct from NEW.priority then
      insert into task_activity (task_id, actor_id, action, from_value, to_value, metadata)
      values (
        NEW.id,
        auth.uid(),
        'priority_changed',
        OLD.priority::text,
        NEW.priority::text,
        public.activity_metadata(auth.uid())
      );
    end if;
    if OLD.assignee_id is distinct from NEW.assignee_id then
      insert into task_activity (task_id, actor_id, action, from_value, to_value, metadata)
      values (
        NEW.id,
        auth.uid(),
        'assignee_changed',
        coalesce(OLD.assignee_id::text, ''),
        coalesce(NEW.assignee_id::text, ''),
        public.activity_metadata(auth.uid())
      );
    end if;
    return NEW;
  end if;
  return null;
end;
$$;

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
    public.activity_metadata(NEW.user_id)
      || jsonb_build_object('comment_id', NEW.id)
  );
  return NEW;
end;
$$;

-- Backfill actor_email on existing activity rows
update task_activity ta
set metadata = coalesce(ta.metadata, '{}'::jsonb)
  || jsonb_build_object('actor_email', public.user_email(ta.actor_id))
where ta.actor_id is not null
  and public.user_email(ta.actor_id) is not null
  and (
    ta.metadata is null
    or ta.metadata->>'actor_email' is null
    or ta.metadata->>'actor_email' = ''
  );
