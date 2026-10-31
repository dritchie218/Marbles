# Marbles cloud profiles setup

## One-time Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor → New query**.
3. Copy the complete contents of `supabase/migrations/202610310001_player_profiles.sql` from this repository into the query.
4. Run it once. It is safe to rerun for this initial schema.
5. In **Authentication → URL Configuration**, add the deployed Marbles site URL to the allowed redirect URLs when the sign-in flow is configured.

## What this creates

- `player_profiles`: one screen name and avatar per authenticated account.
- `matches` and `match_players`: private game-result records.
- `record_my_match`: records only the signed-in caller's own win/loss result.
- `player_leaderboard`: public aggregate games, wins, losses, and win percentage.

## Security and current limitations

The browser must use only the Supabase publishable key; never put a service-role key in the app. Row-level security prevents a player from editing another account's profile or match records. The match RPC accepts no player IDs, so a client cannot submit results on behalf of other accounts. Like any client-side casual game, an account owner can still falsify their own result; this is not an anti-cheat system.

This migration creates the database only. Authentication, profile UI, result submission, and cross-device synchronization must still be integrated into the game and tested before cloud profiles are live. Guest players remain local and do not receive cloud statistics unless they sign in with their own account.
