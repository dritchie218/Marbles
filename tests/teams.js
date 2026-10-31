// Team rules: 4 players = 2 teams of 2 (across), 6 players = 2 teams of 3 (every other seat).
// A finished player plays for the next unfinished teammate clockwise; a 7 can be split with any teammate.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const js = html.match(/<script>([\s\S]*)<\/script>/)[1].replace(/\ninit\(\);\s*$/, '\n');

const els = {};
let rngSeed = 0x5eed;
Math.random = () => { rngSeed = (Math.imul(rngSeed, 1664525) + 1013904223) >>> 0; return rngSeed / 4294967296; };
const mk = () => ({ value: '4', checked: true, innerHTML: '', textContent: '', setAttribute() {} });
global.document = { getElementById: id => els[id] || (els[id] = mk()) };
global.setTimeout = () => 0;
const api = new Function(js + `
return {init,render,mate,side,ctl,moves,step,fin,ai,act,second,forced,pick,abs,tk,tp,A,
  setPegs(o,v){pegs[o]=v.slice()}, setHand(p,h){hands[p]=h.slice()}, setTurn(p){turn=p}, setStuck(p,n){stuck[p]=n}, setForcedCard(p,i){forcedCard[p]=i},
  setSetup(v){setup=v}, get s(){return {NP,T,E,Y,over,turn,pend,pegs,hands,msg,sel,forcedCard}}}`)();

let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed++; };
const start = (np, teams = true) => {
  els.np = Object.assign(mk(), { value: String(np) });
  els.tm = Object.assign(mk(), { checked: teams });
  els.cl = Object.assign(mk(), { value: 'Green' });
  els.th = Object.assign(mk(), { value: 'vik' });
  api.setSetup(false); api.init();
  return api.s;
};

// --- who is on which team ---
start(4);
check(api.mate(0, 2) && api.mate(1, 3) && !api.mate(0, 1) && !api.mate(0, 3), '4 players: partner sits across');
start(6);
check(String(api.side(0)) === '0,2,4' && String(api.side(1)) === '1,3,5', '6 players: teams of three, every other seat');
check(!api.mate(0, 1) && !api.mate(0, 3) && !api.mate(0, 5), '6 players: neighbours are opponents');
start(6, false);
check([1, 2, 3, 4, 5].every(q => !api.mate(0, q)) && String(api.side(0)) === '0', 'Teams off: nobody is a teammate');

// --- team line under the board ---
const tl = () => els.tl.innerHTML.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
start(6);
check(tl() === 'Your team:YouGoldIndigo · Opponents:RedSkyPink', '6 players: team line lists both teams (' + tl() + ')');
check((els.tl.innerHTML.match(/<i /g) || []).length === 6, '6 players: team line shows a colour dot per player');
start(4);
check(tl() === 'Your team:YouGold · Opponents:RedSky', '4 players: team line lists both pairs (' + tl() + ')');
start(6, false);
check(els.tl.innerHTML === '', 'Teams off: no team line');
start(6);
api.setPegs(0, [1, 2, 3, 4, 5].map(i => api.s.E + i)); api.render();
check(/Playing for Gold$/.test(tl()), 'team line shows who you are playing for once you are home (' + tl() + ')');

// --- the board runs clockwise, so "left" = next seat in turn order ---
start(6);
const ang = p => { const [x, y] = api.tp(api.A(p)); return Math.atan2(y - 200, x - 200); };
const cw = (a, b) => ((b - a + 2 * Math.PI) % (2 * Math.PI)) < Math.PI; // screen y-down: increasing angle = clockwise
check([0, 1, 2, 3, 4, 5].every(p => cw(ang(p), ang((p + 1) % 6))), 'turn order goes clockwise around the board');

// --- playing for teammates when finished ---
let s = start(6);
const E = s.E, HOME = [E + 1, E + 2, E + 3, E + 4, E + 5];
check(api.ctl(0) === 0, 'unfinished player plays their own marbles');
api.setPegs(0, HOME);
check(api.ctl(0) === 2, 'finished player plays for the teammate to the left (clockwise)');
api.setPegs(2, HOME);
check(api.ctl(0) === 4 && api.ctl(2) === 4, 'two finished players both play for the last teammate');
check(api.ctl(1) === 1 && api.ctl(3) === 3, 'opponents still play their own marbles');
api.setPegs(2, [10, s.Y, s.Y, s.Y, s.Y]);
check(api.ctl(0) === 2, 'falls back to the left teammate again if they are not finished');
s = start(4); api.setPegs(0, [1, 2, 3, 4, 5].map(i => s.E + i));
check(api.ctl(0) === 2, '4 players: finished player plays for partner (unchanged)');

// --- 7 must start with your own marble, then may share with teammates ---
s = start(6);
for (let p = 0; p < 6; p++) api.setPegs(p, [3 + p, s.Y, s.Y, s.Y, s.Y]);
let sevenMoves = api.moves(0, '7|♠');
let owners = new Set(sevenMoves.filter(m => !m.rem).map(m => m.o));
check(owners.size === 1 && owners.has(0), '7: a full seven must move your own marble');
const split = sevenMoves.find(m => m.rem && m.o === 0);
check(!!split, '7: own-marble-first split moves are offered when available');
if (split) {
  owners = new Set(api.second({ rem: split.rem, ex: [split.o, split.k] }).map(m => m.o));
  check(owners.has(2) || owners.has(4), '7 split: after moving your marble first, remaining movement can use a teammate');
  check(![1, 3, 5].some(o => owners.has(o)), '7 split: remaining movement cannot use an opponent');
}
const teammateFirst = sevenMoves.find(m => m.rem && (m.o === 2 || m.o === 4));
check(!!teammateFirst, '7 split: can move a teammate first when your marble can move afterward');
if (teammateFirst) {
  const remaining = api.second({ rem: teammateFirst.rem, ex: [teammateFirst.o, teammateFirst.k] });
  check(remaining.some(m => m.o === 0), '7 split: teammate-first move leaves at least one space for your own marble');
  check(remaining.every(m => m.o === 0), '7 split: teammate-first move must finish with your own marble');
}
// Safe-lane marbles are still in play and may contribute to a 7 split.
s = start(4);
for (let p = 0; p < 4; p++) api.setPegs(p, [s.Y, s.Y, s.Y, s.Y, s.Y]);
api.setPegs(0, [s.E + 1, s.Y, s.Y, s.Y, s.Y]); // Green in safe lane
api.setPegs(2, [25, s.Y, s.Y, s.Y, s.Y]); // Gold on track
sevenMoves = api.moves(0, '7|♠');
const safeGreenFirst = sevenMoves.find(m => m.o === 0 && m.to === s.E + 2 && m.rem?.n === 6);
check(!!safeGreenFirst, '7 split: own safe-lane marble can move one before teammate moves six');
if (safeGreenFirst) {
  api.setPegs(0, [s.E + 2, s.Y, s.Y, s.Y, s.Y]);
  check(api.second({ rem: safeGreenFirst.rem, ex: [safeGreenFirst.o, safeGreenFirst.k] })
    .some(m => m.o === 2 && m.to === 31),
    '7 split: safe-lane own move can be followed by teammate six');
}
api.setPegs(0, [s.E + 1, s.Y, s.Y, s.Y, s.Y]);
api.setPegs(2, [25, s.Y, s.Y, s.Y, s.Y]);
sevenMoves = api.moves(0, '7|♠');
const goldFirst = sevenMoves.find(m => m.o === 2 && m.to === 26 && m.rem?.n === 6);
check(!!goldFirst, '7 split: teammate can move six when own safe-lane marble can finish one');
if (goldFirst) {
  api.setPegs(2, [26, s.Y, s.Y, s.Y, s.Y]);
  check(api.second({ rem: goldFirst.rem, ex: [goldFirst.o, goldFirst.k] })
    .some(m => m.o === 0 && m.to === s.E + 2),
    '7 split: teammate six can be followed by own safe-lane one');
}

for (let p = 0; p < 6; p++) api.setPegs(p, [s.Y, s.Y, s.Y, s.Y, s.Y]);
api.setPegs(2, [8, s.Y, s.Y, s.Y, s.Y]);
check(api.moves(0, '7|♠').length === 0, '7: unavailable when you have no marble in play, even if a teammate does');

// --- fourth-card rule: after three unsuccessful discards, any card must bring a marble out ---
s = start(4, false);
for (let p = 0; p < 4; p++) api.setPegs(p, [s.Y, s.Y, s.Y, s.Y, s.Y]);
api.setStuck(0, 3);
let fourthCardMoves = api.moves(0, '7|♠');
check(fourthCardMoves.length === 1 && fourthCardMoves[0].out && fourthCardMoves[0].to === 0,
  'fourth card: a 7 is forced to bring a marble out, not played as a normal 7');
fourthCardMoves = api.moves(0, 'JK|♠');
check(fourthCardMoves.length === 1 && fourthCardMoves[0].out && fourthCardMoves[0].to === 0,
  'fourth card: a Joker is forced to bring a marble out, not played as a swap');

// The forced entry must use the newly drawn fourth card, not any card already in hand.
api.setHand(0, ['2|♠', '3|♠', '4|♠', '5|♠', '6|♠', '7|♠']);
api.setStuck(0, 3); api.setForcedCard(0, 5); api.setTurn(0); api.render();
check(/disabled/.test(els.hand.innerHTML) && (els.hand.innerHTML.match(/disabled/g) || []).length === 5,
  'fourth draw UI: the five cards already in hand are disabled');
check(!els.dc.innerHTML.includes('Any card brings a marble out') && els.dc.innerHTML.includes('Use the newly drawn card'),
  'fourth draw UI: discard tracker does not claim any card can be used');
api.pick(0);
check(api.s.sel == null, 'fourth draw UI: tapping an older card does not select it');
api.pick(5);
check(api.s.sel === 5, 'fourth draw UI: only the newly drawn card can be selected');

// --- Joker needs your own marble in play, but can move a teammate's marble ---
s = start(6);
for (let p = 0; p < 6; p++) api.setPegs(p, [s.Y, s.Y, s.Y, s.Y, s.Y]);
api.setPegs(2, [8, s.Y, s.Y, s.Y, s.Y]);
check(api.moves(0, 'JK|♠').length === 0, 'Joker: unavailable when your own marbles are all at start');
api.setPegs(0, [10, s.Y, s.Y, s.Y, s.Y]);
api.setPegs(2, [15, s.Y, s.Y, s.Y, s.Y]);
api.setPegs(1, [20, s.Y, s.Y, s.Y, s.Y]);
const jokerMoves = api.moves(0, 'JK|♠');
owners = new Set(jokerMoves.map(m => m.o));
check(owners.size === 1 && owners.has(0), 'Joker: moves your own marble while you still have marbles in play');
const teammateTargetRel = ((api.abs(2, 15) - api.A(0) + s.T) % s.T);
const teammateTarget = teammateTargetRel > s.E ? teammateTargetRel - s.T : teammateTargetRel;
check(jokerMoves.some(m => m.o === 0 && m.k === 0 && m.to === teammateTarget), 'Joker: can target a teammate\'s marble with your own marble');

check(![1, 3, 5].some(o => owners.has(o)), 'Joker: only the active player\'s marbles are moved');
api.setPegs(0, [s.E + 1, s.E + 2, s.E + 3, s.E + 4, s.E + 5]);
const playingForTeammate = api.moves(0, 'JK|♠');
owners = new Set(playingForTeammate.map(m => m.o));
check(api.ctl(0) === 2 && owners.size === 1 && owners.has(2), 'Joker: moves teammate\'s marble after you finish and play for them');

// If a Joker displaces a partner to their home gate, an opponent occupying
// that same gate is knocked off the board rather than blocking the partner.
s = start(6);
for (let p = 0; p < 6; p++) api.setPegs(p, [s.Y, s.Y, s.Y, s.Y, s.Y]);
const atGate = (owner, q, spot) => {
  const a = api.abs(owner, spot), t = ((a - api.A(q)) % s.T + s.T) % s.T;
  return t > s.E ? t - s.T : t;
};
api.setPegs(0, [10, s.Y, s.Y, s.Y, s.Y]);
api.setPegs(2, [15, s.Y, s.Y, s.Y, s.Y]);
api.setPegs(1, [atGate(2, 1, s.E), s.Y, s.Y, s.Y, s.Y]);
api.setHand(0, ['JK|♠']);
api.setTurn(0);
const targetRel = ((api.abs(2, 15) - api.A(0) + s.T) % s.T);
const target = targetRel > s.E ? targetRel - s.T : targetRel;
const collisionMove = api.moves(0, 'JK|♠').find(m => m.o === 0 && m.k === 0 && m.to === target);
check(!!collisionMove, 'Joker: partner target move is available for home-gate collision test');
if (collisionMove) {
  api.act(0, 0, collisionMove);
  check(api.s.pegs[2][0] === s.E, 'Joker: displaced partner goes to their home gate');
  check(api.s.pegs[1][0] === s.Y, 'Joker: opponent occupying partner home gate is sent off the board');
}

api.setPegs(0, [3, 20, s.Y, s.Y, s.Y]); // a 9 needs two of your own marbles out
owners = new Set(api.moves(0, '9|♠').map(m => m.o));
check(owners.size === 1 && owners.has(0), '9: own marbles only (not shared)');

// --- landing on teammates vs opponents ---
s = start(6);
for (let p = 0; p < 6; p++) api.setPegs(p, [s.Y, s.Y, s.Y, s.Y, s.Y]);
const at = (o, q, u) => { // place marble of q on the same hole as owner o's relative spot u
  const a = api.abs(o, u), t = ((a - api.A(q)) % s.T + s.T) % s.T; return t > s.E ? t - s.T : t; };
api.setPegs(0, [10, s.Y, s.Y, s.Y, s.Y]);
api.setPegs(2, [at(0, 2, 12), s.Y, s.Y, s.Y, s.Y]);
api.setPegs(4, [at(0, 4, 13), s.Y, s.Y, s.Y, s.Y]);
api.setPegs(1, [at(0, 1, 14), s.Y, s.Y, s.Y, s.Y]);
api.setTurn(0);
api.step(0, 0, 12); check(api.s.pegs[2][0] === E, 'landing on a teammate (seat 2) sends them to their home gate');
api.step(0, 0, 13); check(api.s.pegs[4][0] === E, 'landing on a teammate (seat 4) sends them to their home gate');
api.step(0, 0, 14); check(api.s.pegs[1][0] === s.Y, 'landing on an opponent sends them to start');

// If a teammate's home gate is full, don't bump their other marble backward.
s = start(6);
for (let p = 0; p < 6; p++) api.setPegs(p, [s.Y, s.Y, s.Y, s.Y, s.Y]);
const partnerTrackTarget = 12;
const partnerTrackRel = at(0, 2, partnerTrackTarget);
api.setPegs(0, [partnerTrackTarget - 2, s.Y, s.Y, s.Y, s.Y]);
api.setPegs(2, [partnerTrackRel, s.E, s.Y, s.Y, s.Y]);
const gateLandingMoves = api.moves(0, '2|♠');
check(!gateLandingMoves.some(m => m.o === 0 && m.to === partnerTrackTarget),
  'movement: cannot bump a teammate backward when their home gate is full');
api.setPegs(0, [10, s.Y, s.Y, s.Y, s.Y]);
const gateJokerMoves = api.moves(0, 'JK|♠');
check(!gateJokerMoves.some(m => m.o === 0 && m.to === partnerTrackTarget),
  'Joker: cannot bump a teammate backward when their home gate is full');

// --- winning needs the whole team ---
s = start(6);
api.setPegs(0, HOME); api.setPegs(2, HOME); api.setPegs(4, [10, s.Y, s.Y, s.Y, s.Y]);
api.setHand(0, ['2|♠', '3|♠']); api.fin(0, 0);
check(!api.s.over, '6 players: two of three home is not a win');
s = start(6);
api.setPegs(1, HOME); api.setPegs(3, HOME); api.setPegs(5, HOME);
api.setHand(0, ['2|♠', '3|♠']); api.fin(0, 0);
check(api.s.over && api.s.msg === 'Red, Sky and Pink win.', '6 players: all three home wins (' + api.s.msg + ')');
s = start(6);
api.setPegs(0, HOME); api.setPegs(2, HOME); api.setPegs(4, HOME);
api.setHand(0, ['2|♠', '3|♠']); api.fin(0, 0);
check(api.s.over && /Your team wins/.test(api.s.msg), '6 players: your team of three wins');
s = start(4);
const HOME4 = [1, 2, 3, 4, 5].map(i => s.E + i);
api.setPegs(1, HOME4); api.setPegs(3, HOME4);
api.setHand(0, ['2|♠', '3|♠']); api.fin(0, 0);
check(api.s.over && api.s.msg === 'Red and Sky win.', '4 players: pair wins (' + api.s.msg + ')');

// --- full simulated 6-player team games: no two marbles on one hole, every game ends ---
let bad = 0, unfinished = 0, finishedHelpers = 0;
for (let g = 0; g < 60; g++) {
  rngSeed = 123456789;
  s = start(6);
  let t = 0;
  while (!api.s.over && t++ < 20000) {
    if (api.s.turn === 0) {
      const h = api.s.hands[0], ci = h.findIndex(c => api.moves(0, c).length);
      if (ci < 0) api.forced(0, 0);
      else {
        api.act(0, ci, api.moves(0, h[ci])[0]);
        const p = api.s.pend;
        if (p) { const l = api.second(p); api.step(l[0].o, l[0].k, l[0].to); api.fin(0, p.ci); }
      }
    } else api.ai();
    const occ = {};
    api.s.pegs.forEach((P, p) => P.forEach(u => { if (api.tk(u)) { const a = api.abs(p, u); if (occ[a] !== undefined) bad++; occ[a] = p; } }));
    for (let p = 0; p < 6; p++) if (api.ctl(p) !== p) finishedHelpers++;
  }
  if (!api.s.over) unfinished++;
}
check(bad === 0, '60 six-player team games: never two marbles on one hole');
check(unfinished === 0, '60 six-player team games: every game finished');
check(finishedHelpers > 0, 'finished players actually played for teammates during games');

if (failed) { console.log(`${failed} check(s) failed`); process.exit(1); }
console.log('All team checks passed');
