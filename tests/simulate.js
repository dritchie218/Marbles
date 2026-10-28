// Loads the game script from index.html with a stub DOM and plays full games.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const js = html.match(/<script>([\s\S]*)<\/script>/)[1].replace(/\ninit\(\);\s*$/, '\n');

const els = {};
const mk = () => ({ value: '4', checked: true, innerHTML: '', textContent: '', setAttribute() {} });
global.document = { getElementById: id => els[id] || (els[id] = mk()) };
global.setTimeout = () => 0;

const api = new Function(js + `
return {init,render,tp,W,A,moves,act,ai,forced,second,step,fin,
  get s(){return {NP,T,E,CI,over,turn,pend,hands,SD,N}}}`)();

let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed++; };

for (const [np, color, theme] of [['4', 'Green', 'mid'], ['6', 'Gold', 'oak'], ['4', 'Red', 'vik'], ['6', 'Pink', 'wild'], ['4', 'Sky', 'twn']]) {
  els.np = Object.assign(mk(), { value: np });
  els.cl = Object.assign(mk(), { value: color });
  els.th = Object.assign(mk(), { value: theme });
  api.init();
  let s = api.s;
  const d = [];
  for (let a = 0; a < s.T; a++) {
    const [x0, y0] = api.tp(a), [x1, y1] = api.tp((a + 1) % s.T);
    d.push(Math.hypot(x1 - x0, y1 - y0));
  }
  check(Math.max(...d) - Math.min(...d) < 0.3, `${np} players: track holes evenly spaced`);
  check(s.T === 18 * Number(np), `${np} players: ${s.T} track holes`);
  const sideX = [];
  for (let t = 0; t <= 18; t++) sideX.push(api.W(0, t, 0)[0]);
  const co = api.tp(api.A(0))[0];
  const sorted = [...sideX].sort((a, b) => a - b);
  const i = sorted.findIndex(x => Math.abs(x - co) < 0.6);
  check(i === 10 && sorted.length - 1 - i === 8, `${np} players: 10 holes left, 8 holes right of come-out`);
  let guard = 0;
  while (!api.s.over && guard++ < 4000) {
    s = api.s;
    if (s.turn === 0) {
      const ci = s.hands[0].findIndex(c => api.moves(0, c).length);
      if (ci < 0) api.forced(0, 0);
      else {
        api.act(0, ci, api.moves(0, s.hands[0][ci])[0]);
        const p = api.s.pend;
        if (p) {
          const l = api.second(p);
          if (!l.length) { check(false, 'split move left no second step'); break; }
          api.step(l[0].o, l[0].k, l[0].to);
          api.fin(0, p.ci);
        }
      }
    } else api.ai();
  }
  check(api.s.over, `${np} players (${color}, ${theme}): game finished`);
  api.render();
}
if (failed) { console.log(`${failed} check(s) failed`); process.exit(1); }
console.log('All checks passed');
