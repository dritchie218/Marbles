// Regression: forward moves that cross a player's own home gate.
// If the safe-lane route is blocked, the marble must still be able to continue around the outer track,
// and the UI must show a landing spot after the marble is tapped.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const js = html.match(/<script>([\s\S]*)<\/script>/)[1].replace(/\ninit\(\);\s*$/, '\n');

const els = {};
let rngSeed = 0x6a7e;
Math.random = () => { rngSeed = (Math.imul(rngSeed, 1664525) + 1013904223) >>> 0; return rngSeed / 4294967296; };
const mk = () => ({ value: '4', checked: false, innerHTML: '', textContent: '', style: {}, hidden: true, setAttribute() {} });
global.document = { getElementById: id => els[id] || (els[id] = mk()) };
global.setTimeout = () => 0;
const api = new Function(js + `
return {init,render,moves,act,step,pick,tap,go,abs,A,val,begin,noMoves,second,
  setPegs(o,v){pegs[o]=v.slice()}, setHand(p,h){hands[p]=h.slice()}, setTurn(p){turn=p}, setSetup(v){setup=v},
  setStuck(p,n){stuck[p]=n}, setForcedCard(p,i){forcedCard[p]=i},
  get history(){return gameHistory},
  get s(){return {NP,T,E,Y,pegs,hands,selPeg,turn,msg,moveNotice,trailFX,forcedCard}}}`)();

let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed++; };
const start = (np, teams) => {
  els.np = Object.assign(mk(), { value: String(np) });
  els.tm = Object.assign(mk(), { checked: teams });
  els.cl = Object.assign(mk(), { value: 'Green' });
  els.th = Object.assign(mk(), { value: 'mid' });
  api.setSetup(false); api.init();
  const s = api.s;
  for (let p = 0; p < s.NP; p++) api.setPegs(p, [s.Y, s.Y, s.Y, s.Y, s.Y]);
  api.setTurn(0);
  return s;
};
// Relative spot for player q that is the same hole as player o's relative spot u.
const at = (o, q, u) => { const s = api.s, t = ((api.abs(o, u) - api.A(q)) % s.T + s.T) % s.T; return t > s.E ? t - s.T : t; };
const fwdTo = (c, k = 0) => api.moves(0, c).filter(m => m.o === 0 && m.k === k).map(m => m.to);

for (const np of [4, 6]) {
  let s = start(np, false);
  const { E, T, Y } = s;
  const tag = `${np} players:`;

  // Jack 11 crossing the gate, safe lane blocked by own marbles -> continues on the outer track.
  api.setPegs(0, [E - 7, E + 4, E + 5, Y, Y]);
  check(String(fwdTo('J|♠')) === String(E - 7 + 11 - T), `${tag} Jack 11 crosses the home gate onto the outer track when the safe lane is blocked`);
  // Queen 12 crossing the gate, safe lane blocked.
  api.setPegs(0, [E - 8, E + 3, Y, Y, Y]);
  check(String(fwdTo('Q|♠')) === String(E - 8 + 12 - T), `${tag} Queen 12 crosses the home gate onto the outer track when the safe lane is blocked`);
  // Queen 12 overshooting the lane entirely still wraps.
  api.setPegs(0, [E - 3, Y, Y, Y, Y]);
  check(String(fwdTo('Q|♠')) === String(E - 3 + 12 - T), `${tag} Queen 12 past the end of the lane continues around the track`);
  // A 10 crossing the gate, safe lane blocked.
  api.setPegs(0, [E - 6, E + 2, Y, Y, Y]);
  check(String(fwdTo('10|♠')) === String(E - 6 + 10 - T), `${tag} a 10 crosses the home gate onto the outer track when the safe lane is blocked`);

  // Legal home-lane entry is still taken (and is the only option) when the lane route is clear.
  api.setPegs(0, [E - 7, Y, Y, Y, Y]);
  check(String(fwdTo('J|♠')) === String(E + 4), `${tag} Jack enters the safe lane when that route is legal`);
  api.setPegs(0, [E - 8, E + 5, Y, Y, Y]);
  check(String(fwdTo('Q|♠')) === String(E + 4), `${tag} Queen enters the safe lane short of an own lane marble`);

  // Same-colour marble near the gate.
  api.setPegs(0, [E - 7, E - 2, E + 5, Y, Y]);
  check(fwdTo('J|♠', 0).length === 0, `${tag} own marble on the track before the gate blocks the Jack`);
  api.setPegs(0, [E - 7, E + 4, -2, Y, Y]);
  check(fwdTo('J|♠', 0).length === 0, `${tag} own marble on the outer track past the gate blocks the wrap route`);
  api.setPegs(0, [E - 7, -2, Y, Y, Y]);
  check(String(fwdTo('J|♠', 0)) === String(E + 4), `${tag} own marble past the gate does not block a clear safe-lane entry`);
  api.setPegs(0, [E - 5, E + 1, Y, Y, Y]);
  check(String(fwdTo('A|♠', 0)) === String(E - 4) && String(fwdTo('5|♠', 0)) === String(E), `${tag} short moves up to the gate are unaffected`);
  // Marbles already in the safe lane still cannot wrap out.
  api.setPegs(0, [E + 2, Y, Y, Y, Y]);
  check(fwdTo('J|♠', 0).length === 0 && fwdTo('4|♠', 0).length === 0 && String(fwdTo('3|♠', 0)) === String(E + 5), `${tag} a safe-lane marble can never wrap back onto the track`);

  // Opponent on the destination: move is offered and sends them to start.
  s = start(np, false);
  const dest = E - 7 + 11 - T;
  api.setPegs(0, [E - 7, E + 4, Y, Y, Y]);
  api.setPegs(1, [at(0, 1, dest), Y, Y, Y, Y]);
  const oppMove = api.moves(0, 'J|♠').find(m => m.o === 0 && m.k === 0);
  check(!!oppMove && oppMove.to === dest, `${tag} Jack across the gate may land on an opponent`);
  if (oppMove) {
    api.setHand(0, ['J|♠']); api.act(0, 0, oppMove);
    check(api.s.pegs[0][0] === dest && api.s.pegs[1][0] === Y, `${tag} opponent on the post-gate destination is sent to start`);
  }

  // Friendly/team marble on the destination: sent to their home gate.
  s = start(np, true);
  const mateSeat = 2;
  api.setPegs(0, [E - 7, E + 4, Y, Y, Y]);
  api.setPegs(mateSeat, [at(0, mateSeat, dest), Y, Y, Y, Y]);
  const mateMove = api.moves(0, 'J|♠').find(m => m.o === 0 && m.k === 0);
  check(!!mateMove && mateMove.to === dest, `${tag} Jack across the gate may land on a teammate`);
  if (mateMove) {
    api.setHand(0, ['J|♠']); api.act(0, 0, mateMove);
    check(api.s.pegs[0][0] === dest && api.s.pegs[mateSeat][0] === E, `${tag} teammate on the post-gate destination goes to their home gate`);
  }

  // UI flow from the bug report: pick Jack, tap the eligible marble, a landing spot appears and works.
  s = start(np, false);
  api.setPegs(0, [E - 7, E + 4, E + 5, Y, Y]);
  api.setHand(0, ['J|♠', '2|♣', '3|♣', '4|♣', '6|♣']);
  api.render(); api.pick(0);
  check(/onclick="tap\(0,0\)"/.test(els.b.innerHTML), `${tag} UI: the gate-crossing marble pulses after picking the Jack`);
  api.tap(0, 0);
  if (api.s.pegs[0][0] === E - 7) {
    const landing = (els.b.innerHTML.match(/onclick="go\((\d+)\)"/g) || []);
    check(landing.length > 0, `${tag} UI: tapping the marble shows a landing spot`);
    if (landing.length) api.go(+landing[0].match(/\d+/)[0]);
  }
  check(api.s.pegs[0][0] === dest, `${tag} UI: the Jack move completes past the home gate`);
}

// --- follow-on logic for marbles that wrap past the gate (positions -4..0 are normal track holes) ---
{
  const s = start(4, false), { E, T, Y } = s;
  // Move announcement / history distance for a wrap move: +11, not -61.
  api.setPegs(0, [E - 7, E + 4, E + 5, Y, Y]);
  api.setHand(0, ['J|♠', '2|♣', '3|♣', '4|♣', '6|♣']);
  const wrapMove = api.moves(0, 'J|♠').find(m => m.k === 0);
  check(!!wrapMove, 'Jack wrap move is available for the follow-on checks');
  if (wrapMove) api.act(0, 0, wrapMove);
  check(/ moved 11 spaces/.test(api.s.moveNotice), `move notice reports 11 spaces for a Jack past the gate (${api.s.moveNotice})`);
  check(/moved 11/.test(api.s.msg) && !/backed/.test(api.s.msg), `move log says "moved 11", not "backed" (${api.s.msg})`);
  const hist = api.history.at(-1).events.filter(e => e.type === 'marble-move').at(-1);
  check(hist && hist.distance === 11 && hist.to === E - 7 + 11 - T, 'game history records distance 11 for the wrap move');
  const trail = api.s.trailFX.map(f => f.u);
  check(trail.length === 10 && trail.includes(E) && trail.includes(-4) && trail.every(u => u <= E && u > -50),
    `move trail follows the outer track past the gate (${trail})`);
  // AI scoring treats the wrap as forward progress, not a 61-space loss.
  api.setPegs(0, [E - 7, E + 4, E + 5, Y, Y]);
  check(api.val({ o: 0, k: 0, to: E - 7 + 11 - T }) > 0, 'AI scores a gate-crossing wrap move as forward progress');
  // Back-8 that wraps behind the come-out is still described as backing 8.
  api.setTurn(0); api.setPegs(0, [2, Y, Y, Y, Y]);
  api.setHand(0, ['8|♠', '2|♣', '3|♣', '4|♣', '6|♣']);
  const back = api.moves(0, '8|♠')[0];
  if (back) api.act(0, 0, back);
  check(back && back.to === 2 - 8 + T && /backed 8/.test(api.s.msg), `back 8 across the come-out is logged as "backed 8" (${api.s.msg})`);

  // A marble sitting just behind its come-out (relative -2) is a normal track marble.
  start(4, true);
  api.setPegs(0, [-2, Y, Y, Y, Y]);
  check(String(api.moves(0, '7|♠').filter(m => !m.rem).map(m => m.to)) === '5', '7: a marble at relative -2 can move seven');
  api.setPegs(2, [20, Y, Y, Y, Y]);
  check(api.moves(0, '7|♠').some(m => m.o === 2 && m.rem), '7 split: marble at relative -2 counts as "in play" for sharing with a teammate');
  api.setPegs(1, [10, Y, Y, Y, Y]);
  check(api.moves(0, 'JK|♠').some(m => m.o === 0 && m.k === 0), 'Joker: a marble at relative -2 can swap onto another marble');
  api.setPegs(0, [10, Y, Y, Y, Y]); api.setPegs(2, [Y, Y, Y, Y, Y]);
  api.setPegs(1, [-2, Y, Y, Y, Y]);
  const tgt = at(1, 0, -2);
  check(api.moves(0, 'JK|♠').some(m => m.o === 0 && m.to === tgt), 'Joker: an opponent at their relative -2 can be targeted');
}

// --- a teammate occupying their home gate cannot be landed on, by any kind of move ---
for (const np of [4, 6]) {
  const tag = `${np} players:`;
  const s = start(np, true), { E, Y } = s;
  const mateSeat = 2;
  // Teammate has one marble on their home gate and one on the hole Green would land on.
  const setup = (greenPegs, mateTarget) => {
    for (let p = 0; p < s.NP; p++) api.setPegs(p, [Y, Y, Y, Y, Y]);
    api.setPegs(0, greenPegs);
    api.setPegs(mateSeat, [at(0, mateSeat, mateTarget), E, Y, Y, Y]);
    api.setStuck(0, 0); api.setForcedCard(0, null); api.setTurn(0);
  };
  // Bring-out onto a teammate on your start hole while the teammate occupies their home gate.
  setup([Y, Y, Y, Y, Y], 0);
  check(['A', 'K', 'Q', 'J'].every(r => !api.moves(0, r + '|♠').some(m => m.out)),
    `${tag} A/K/Q/J cannot bring a marble out onto a teammate who occupies their home gate`);
  // Same, but the teammate's home gate is free: bring-out is legal and sends the teammate to their gate.
  for (let p = 0; p < s.NP; p++) api.setPegs(p, [Y, Y, Y, Y, Y]);
  api.setPegs(mateSeat, [at(0, mateSeat, 0), Y, Y, Y, Y]);
  api.setHand(0, ['K|♠']);
  const okOut = api.moves(0, 'K|♠').find(m => m.out);
  check(!!okOut, `${tag} bring-out onto a teammate is legal when their home gate is free`);
  if (okOut) { api.act(0, 0, okOut); check(api.s.pegs[mateSeat][0] === E, `${tag} that teammate goes to their home gate`); }
  // Fourth-card forced entry blocked by the same rule: no forced card is assigned, so the player can discard.
  setup([Y, Y, Y, Y, Y], 0);
  api.setHand(0, ['2|♠', '3|♠', '4|♠', '5|♠', '6|♠']); api.setStuck(0, 3);
  api.begin();
  check(api.s.forcedCard[0] == null && api.moves(0, api.s.hands[0][5]).length === 0 && api.noMoves(),
    `${tag} fourth card: blocked entry is not forced, so the player can discard instead of getting stuck`);
  // Normal move onto the teammate marble that sits ON their home gate.
  for (let p = 0; p < s.NP; p++) api.setPegs(p, [Y, Y, Y, Y, Y]);
  const mateGateAbsRel = ((api.abs(mateSeat, E) - api.A(0)) % s.T + s.T) % s.T;
  api.setPegs(0, [mateGateAbsRel - 2, Y, Y, Y, Y]); api.setPegs(mateSeat, [E, Y, Y, Y, Y]);
  check(!api.moves(0, '2|♠').some(m => m.to === mateGateAbsRel),
    `${tag} a normal move cannot land on a teammate sitting on their home gate`);
  check(!api.moves(0, 'JK|♠').some(m => m.to === mateGateAbsRel),
    `${tag} a Joker cannot swap onto a teammate sitting on their home gate`);
  check(!api.moves(0, '7|♠').some(m => m.o === 0 && m.to === mateGateAbsRel),
    `${tag} a 7 cannot land on a teammate sitting on their home gate`);
  // Normal move onto a different teammate marble while that teammate occupies their gate.
  setup([10, Y, Y, Y, Y], 12);
  check(!api.moves(0, '2|♠').some(m => m.to === 12),
    `${tag} a normal move cannot land on any teammate marble while that teammate occupies their home gate`);
}

if (failed) { console.log(`${failed} check(s) failed`); process.exit(1); }
console.log('All home-gate checks passed');
