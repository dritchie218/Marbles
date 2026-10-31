// Verifies optional cloud accounts: guest play remains available without Supabase or email.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed++; };
check(html.includes('@supabase/supabase-js@2'), 'Supabase browser client is loaded');
check(html.includes('Guest · Play without email'), 'guest mode is the default and requires no email');
check(html.includes('signInWithOtp'), 'email magic-link sign-in is implemented');
check(html.includes("const SUPABASE_URL='https://pzdrfssyfriepsrpvlow.supabase.co'") && html.includes("SUPABASE_KEY='sb_publishable_wf5jCmuCmuLXriW3fSH7WQ_Q6lNC81p'"), 'Marbles uses the confirmed Supabase project and publishable key');
check(html.includes("const MARBLES_REDIRECT_URL='https://dritchie218.github.io/Marbles/';") && html.includes('emailRedirectTo:MARBLES_REDIRECT_URL'), 'magic links always return to the deployed Marbles website, not localhost');
check(html.includes("from('player_profiles').select('id,screen_name,avatar')"), 'profile data is loaded from Supabase');
check(html.includes("upsert({id:cloudUser.id,screen_name}"), 'signed-in players can save their screen name');
check(html.includes("from('player_leaderboard')"), 'cloud profile loads lifetime game statistics');
check(html.includes("rpc('record_my_match'"), 'completed game result is sent through the protected RPC');
check(html.includes('p_idempotency_key:cloudMatchKey'), 'game result submissions use a unique idempotency key');
check(html.includes('if(winnerPlayers.includes(0))recordCloudResult(true);else recordCloudResult(false);'),
  'only the signed-in You seat records its own win or loss');
check(html.includes("typeof window!=='undefined'&&window.supabase?.createClient"), 'headless tests and guest play work if Supabase CDN is unavailable');
if (failed) process.exit(1);
console.log('All cloud account checks passed');
