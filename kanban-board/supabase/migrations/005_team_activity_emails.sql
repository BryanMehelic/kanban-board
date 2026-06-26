-- Fix team-wide visibility of actor emails on activity and comments.

-- Resolve email from profiles or auth.users (security definer bypasses RLS)
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

-- Reliable team email lookup for all members (callable only by teammates)
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

revoke all on function public.get_team_member_emails(uuid) from public;
grant execute on function public.get_team_member_emails(uuid) to authenticated;

-- Store actor email on every activity row so realtime updates are self-describing
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

-- Backfill actor_email on existing activity rows where we can resolve it
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
