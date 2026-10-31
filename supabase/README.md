# Marbles cloud profiles setup

The cloud database migration is in `supabase/migrations/202610310001_player_profiles.sql`.

## Required one-time setup
1. Create a Supabase project.
2. In the Supabase SQL Editor, run the migration file.
3. Enable Email OTP or password authentication in Supabase Auth.
4. Set the app's Supabase project URL and publishable/anon key as public frontend configuration. Never put a service-role key in the browser.
5. Configure allowed redirect URLs for the deployed GitHub Pages site.

## Data model
- `player_profiles`: one screen name and avatar per authenticated account.
- `matches` and `match_players`: immutable completed-match history.
- `record_completed_match`: atomic, authenticated match recording.
- `player_leaderboard`: lifetime games, wins, losses and win percentage.

## Important integration note
This migration establishes the secure cloud schema only. The game UI, authentication flow, account linking, match-result hook, and cross-device sync still need to be connected and tested before cloud profiles are live. Do not display cloud-sync success until a real authenticated round trip succeeds.
