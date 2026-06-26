-- Fix: team owner could not insert themselves into team_members on team creation
-- because is_team_owner() requires an existing membership row.

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

-- Also treat users with a verified email as upgraded (covers anonymous -> permanent conversion)
create or replace function is_upgraded_user()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    or nullif(trim(auth.jwt() ->> 'email'), '') is not null;
$$;
