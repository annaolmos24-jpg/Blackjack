-- Player profiles for Blackjack.
--
-- One row per signed-in user, created by the player from the Profile tab
-- (not automatically), so "no row yet" means "hasn't set up a profile".
--
-- Run this once in Supabase → SQL Editor → New query → Run.
-- It is safe to re-run.

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text not null,
  display_name  text not null,
  bio           text not null default '',
  favorite_suit text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint username_format     check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  constraint display_name_length check (char_length(btrim(display_name)) between 1 and 40),
  constraint bio_length          check (char_length(bio) <= 160),
  constraint favorite_suit_valid check (favorite_suit is null or favorite_suit in ('spades', 'hearts', 'diamonds', 'clubs')),
  constraint avatar_url_https    check (avatar_url is null or avatar_url ~ '^https://')
);

comment on table public.profiles is 'Public player profile for each signed-in Blackjack player.';

-- Usernames are unique regardless of case ("Anna" and "anna" can't both exist).
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

-- Keep updated_at current on every edit.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Row Level Security: signed-in players can see every profile, but can only
-- create, edit or delete their own. Signed-out visitors see nothing.
alter table public.profiles enable row level security;

drop policy if exists "Signed-in players can view profiles" on public.profiles;
create policy "Signed-in players can view profiles"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Players can create their own profile" on public.profiles;
create policy "Players can create their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Players can update their own profile" on public.profiles;
create policy "Players can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Players can delete their own profile" on public.profiles;
create policy "Players can delete their own profile"
  on public.profiles for delete
  to authenticated
  using ((select auth.uid()) = id);

revoke all on public.profiles from anon;
grant select, insert, update, delete on public.profiles to authenticated;
