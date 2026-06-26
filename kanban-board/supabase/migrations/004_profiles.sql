-- Public profiles for displaying team member emails on shared boards

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select" on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from team_members tm_me
    join team_members tm_them on tm_me.team_id = tm_them.team_id
    where tm_me.user_id = auth.uid()
      and tm_them.user_id = profiles.id
  )
);

create policy "profiles_update_own" on public.profiles for update using (
  id = auth.uid()
);

-- Sync email from auth.users on sign-up and email changes
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

-- Backfill existing users
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do update set email = excluded.email;
