-- Marbles cloud player profiles and lifetime statistics
create extension if not exists pgcrypto;

create table if not exists public.player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  screen_name text not null,
  avatar text not null default '🎮',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint screen_name_length check (char_length(screen_name) between 3 and 20),
  constraint screen_name_format check (screen_name ~ '^[A-Za-z0-9_]+$')
);
create unique index if not exists player_profiles_screen_name_ci
  on public.player_profiles (lower(screen_name));

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  completed_at timestamptz not null default now(),
  team_game boolean not null default false,
  winning_team integer,
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.player_profiles(id) on delete restrict,
  team_number integer not null,
  won boolean not null,
  player_name_snapshot text not null,
  primary key (match_id, player_id)
);
create index if not exists match_players_player_id_idx on public.match_players(player_id);
create index if not exists matches_completed_at_idx on public.matches(completed_at desc);

alter table public.player_profiles enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;

drop policy if exists "Profiles are readable by everyone" on public.player_profiles;
create policy "Profiles are readable by everyone"
  on public.player_profiles for select using (true);
drop policy if exists "Players create their own profile" on public.player_profiles;
create policy "Players create their own profile"
  on public.player_profiles for insert with check (auth.uid() = id);
drop policy if exists "Players update their own profile" on public.player_profiles;
create policy "Players update their own profile"
  on public.player_profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Authenticated users read matches" on public.matches;
create policy "Authenticated users read matches"
  on public.matches for select to authenticated using (true);
drop policy if exists "Authenticated users read match players" on public.match_players;
create policy "Authenticated users read match players"
  on public.match_players for select to authenticated using (true);

-- Match creation and lifetime-stat updates happen atomically.
create or replace function public.record_completed_match(
  p_team_game boolean,
  p_players jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_item jsonb;
  v_player_id uuid;
  v_team integer;
  v_won boolean;
  v_name text;
  v_count integer := 0;
  v_winners integer := 0;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if jsonb_typeof(p_players) <> 'array' or jsonb_array_length(p_players) < 2 then
    raise exception 'A match must include at least two players';
  end if;

  for v_item in select value from jsonb_array_elements(p_players) loop
    v_player_id := (v_item->>'player_id')::uuid;
    v_team := (v_item->>'team_number')::integer;
    v_won := (v_item->>'won')::boolean;
    if v_player_id is null or v_team is null or v_won is null then
      raise exception 'Invalid player result';
    end if;
    if not exists (select 1 from public.player_profiles where id = v_player_id) then
      raise exception 'Unknown player profile';
    end if;
    if v_won then v_winners := v_winners + 1; end if;
    v_count := v_count + 1;
  end loop;

  if v_winners = 0 or v_winners = v_count then
    raise exception 'Match must have both winners and non-winners';
  end if;

  insert into public.matches(team_game, created_by)
  values (p_team_game, auth.uid()) returning id into v_match_id;

  for v_item in select value from jsonb_array_elements(p_players) loop
    v_player_id := (v_item->>'player_id')::uuid;
    v_team := (v_item->>'team_number')::integer;
    v_won := (v_item->>'won')::boolean;
    select screen_name into v_name from public.player_profiles where id = v_player_id;
    insert into public.match_players(match_id, player_id, team_number, won, player_name_snapshot)
    values (v_match_id, v_player_id, v_team, v_won, v_name);
  end loop;

  return v_match_id;
end;
$$;

revoke all on function public.record_completed_match(boolean, jsonb) from public;
grant execute on function public.record_completed_match(boolean, jsonb) to authenticated;

create or replace view public.player_leaderboard
with (security_invoker = true) as
select p.id, p.screen_name, p.avatar,
       count(mp.match_id)::integer as games_played,
       count(*) filter (where mp.won)::integer as wins,
       count(*) filter (where not mp.won)::integer as losses,
       case when count(mp.match_id) = 0 then 0
            else round(100.0 * count(*) filter (where mp.won) / count(mp.match_id), 1)
       end as win_percentage
from public.player_profiles p
left join public.match_players mp on mp.player_id = p.id
group by p.id, p.screen_name, p.avatar;
