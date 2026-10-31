-- Marbles cloud profiles and lifetime statistics.
-- Safe model: each signed-in account can create/update only its own profile
-- and can submit only its own result. Guest/local players are not assigned
-- cloud identities. The browser never supplies another player's profile ID.

create table if not exists public.player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  screen_name text not null,
  avatar text not null default '🎮',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_profiles_screen_name_length check (char_length(screen_name) between 3 and 20),
  constraint player_profiles_screen_name_format check (screen_name ~ '^[A-Za-z0-9_]+$')
);

create unique index if not exists player_profiles_screen_name_ci
  on public.player_profiles (lower(screen_name));

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  completed_at timestamptz not null default now(),
  team_game boolean not null default false,
  unique (created_by, idempotency_key)
);

create table if not exists public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.player_profiles(id) on delete cascade,
  won boolean not null,
  player_name_snapshot text not null,
  primary key (match_id, player_id)
);

create index if not exists match_players_player_id_idx
  on public.match_players(player_id);
create index if not exists matches_completed_at_idx
  on public.matches(completed_at desc);

alter table public.player_profiles enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;

drop policy if exists "Profiles are readable by everyone" on public.player_profiles;
create policy "Profiles are readable by everyone"
  on public.player_profiles for select
  using (true);

drop policy if exists "Players create their own profile" on public.player_profiles;
create policy "Players create their own profile"
  on public.player_profiles for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "Players update their own profile" on public.player_profiles;
create policy "Players update their own profile"
  on public.player_profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Players read their own matches" on public.matches;
create policy "Players read their own matches"
  on public.matches for select to authenticated
  using (auth.uid() = created_by);

drop policy if exists "Players read their own match results" on public.match_players;
create policy "Players read their own match results"
  on public.match_players for select to authenticated
  using (auth.uid() = player_id);

grant select on public.player_profiles to anon, authenticated;
grant insert, update on public.player_profiles to authenticated;
revoke all on public.matches, public.match_players from anon, authenticated;
grant select on public.matches, public.match_players to authenticated;

-- Atomically records only the caller's own result. The idempotency key stops
-- retries/network reconnects from counting the same game twice.
create or replace function public.record_my_match(
  p_won boolean,
  p_idempotency_key uuid,
  p_team_game boolean default false
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_screen_name text;
  v_match_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in required';
  end if;
  if p_won is null or p_idempotency_key is null or p_team_game is null then
    raise exception 'Missing match result information';
  end if;

  select screen_name into v_screen_name
  from public.player_profiles
  where id = v_user_id;

  if v_screen_name is null then
    raise exception 'Create your player profile before recording a game';
  end if;

  insert into public.matches (created_by, idempotency_key, team_game)
  values (v_user_id, p_idempotency_key, p_team_game)
  on conflict (created_by, idempotency_key) do nothing
  returning id into v_match_id;

  if v_match_id is null then
    select id into v_match_id
    from public.matches
    where created_by = v_user_id
      and idempotency_key = p_idempotency_key;
    return v_match_id;
  end if;

  insert into public.match_players (match_id, player_id, won, player_name_snapshot)
  values (v_match_id, v_user_id, p_won, v_screen_name);

  return v_match_id;
end;
$$;

revoke all on function public.record_my_match(boolean, uuid, boolean) from public;
grant execute on function public.record_my_match(boolean, uuid, boolean) to authenticated;

-- Public leaderboard exposes aggregate totals, not private match records.
create or replace view public.player_leaderboard as
select p.id,
       p.screen_name,
       p.avatar,
       count(mp.match_id)::integer as games_played,
       count(*) filter (where mp.won)::integer as wins,
       count(*) filter (where not mp.won)::integer as losses,
       case when count(mp.match_id) = 0 then 0
            else round(100.0 * count(*) filter (where mp.won) / count(mp.match_id), 1)
       end as win_percentage
from public.player_profiles p
left join public.match_players mp on mp.player_id = p.id
group by p.id, p.screen_name, p.avatar;

grant select on public.player_leaderboard to anon, authenticated;
