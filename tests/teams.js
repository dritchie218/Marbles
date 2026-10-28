// Team rules: 4 players = 2 teams of 2 (across), 6 players = 2 teams of 3 (every other seat).
// A finished player plays for the next unfinished teammate clockwise; a 7 can be split with any teammate.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const js = html.match(/<script>([\s\S]*)<\/script>/)[1].replace(/\ninit\(\);\s*$/, '\n');

const els = {};
const mk = () => ({ value: '4', checked: true, innerHTML: '', textContent: '', setAttribute() {} });
global.document = { getElementById: id => els[id] || (els[id] = mk()) };
global.setTimeout = () => 0;
const api = new Function(js + `
return {init,mate,side,ctl,moves,step,fin,ai,act,second,forced,abs,tk,tp,A,
  setPegs(o,v){pegs[o]=v.slice()}, setHand(p,h){hands[p]=h.slice()}, setTurn(p){turn=p},
  get s(){return {NP,T,E,Y,over,turn,pend,pegs,hands,msg}}}`)();

let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed++; };
const start = (np, teams = true) => {
  els.np = Object.assign(mk(), { value: String(np) });
  els.tm = Object.assign(mk(), { checked: teams });
  els.cl = Object.assign(mk(), { value: 'Green' });
  els.th = Object.assign(mk(), { value: 'vik' });
  api.init();
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

// --- a 7 can be split with any teammate, never an opponent ---
s = start(6);
for (let p = 0; p < 6; p++) api.setPegs(p, [3 + p, s.Y, s.Y, s.Y, s.Y]);
let owners = new Set(api.moves(0, '7|♠').map(m => m.o));
check([0, 2, 4].every(o => owners.has(o)) && ![1, 3, 5].some(o => owners.has(o)), '7: moves offered for all three teammates, no opponents');
const split = api.moves(0, '7|♠').find(m => m.rem);
owners = new Set(api.second({ rem: split.rem, ex: [split.o, split.k] }).map(m => m.o));
check(owners.size > 0 && ![1, 3, 5].some(o => owners.has(o)), '7 split: second part can go to teammates only');
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
