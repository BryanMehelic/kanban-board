-- Atomic team creation (bypasses team_members RLS chicken-and-egg issue)
-- Also re-applies the team_members insert policy fix from 002.

drop policy if exists "team_members_insert" on team_members;

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

create or replace function is_upgraded_user()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    or nullif(trim(auth.jwt() ->> 'email'), '') is not null;
$$;

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
