// Pass-and-play: each seat (other than You) can be a Person or a Computer, chosen before the game.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let rngSeed = 123456789;
Math.random = () => { rngSeed = (Math.imul(rngSeed, 1664525) + 1013904223) >>> 0; return rngSeed / 4294967296; };
const js = html.match(/<script>([\s\S]*)<\/script>/)[1].replace(/\ninit\(\);\s*$/, '\n');

const els = {};
const mk = () => ({ value: '4', checked: true, innerHTML: '', textContent: '', setAttribute() {} });
global.document = { getElementById: id => els[id] || (els[id] = mk()) };
const timers = [];
global.setTimeout = f => { timers.push(f); return timers.length; };
const api = new Function(js + `
return {init,newGame,seat,start,ready,pick,act,ai,fin,step,second,forced,moves,render,hu,
  setWho(w){who=w.slice()}, setHand(p,h){hands[p]=h.slice()}, setPegs(o,v){pegs[o]=v.slice()},
  get s(){return {NP,E,T,turn,vw,cover,setup,HN,NAME,who,hands,pegs,over,msg,pend,gid,log,stuck,forcedCard}}}`)();

let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed++; };
const opts = (np, teams = true) => {
  els.np = Object.assign(mk(), { value: String(np) });
  els.tm = Object.assign(mk(), { checked: teams });
  els.cl = Object.assign(mk(), { value: 'Green' });
  els.th = Object.assign(mk(), { value: 'vik' });
};
const text = id => els[id].innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// --- setup card: shown before the game, one row per seat, You is always a Person ---
opts(4); api.newGame();
check(api.s.setup && /Who.s playing\?/.test(els.su.innerHTML), 'setup card shown before the game starts');
check(text('su') === "Who’s playing? Green (you) Person Red Computer Person Gold Computer Person Sky Computer Person Start game",
  '4 players: You plus 3 seats with Computer/Person choice (' + text('su') + ')');
check((els.su.innerHTML.match(/class="tg on"/g) || []).length === 4, 'defaults: You = Person, others = Computer');
check(els.hand.innerHTML === '' && /Choose who is playing/.test(els.st.textContent), 'no cards shown and status asks to choose while setup is open');
api.pick(0);
check(api.s.hands[0].length === 6, 'cards cannot be played while setup is open');
api.seat(2, 1); api.seat(0, 0);
check(api.s.who[2] === true && api.s.who[0] === true, 'tapping Person sets the seat; You cannot be switched to Computer');
api.start();
check(!api.s.setup && api.s.HN === 2 && els.su.innerHTML === '', 'Start game closes setup and starts with the chosen people');
check(api.s.NAME.join() === 'Green,Red,Gold,Sky', 'with several people, everyone is called by colour (no "You")');
// Deterministic legal move: a random opening hand can contain no playable card.
api.setHand(0, ['A|♠', '2|♠', '3|♠', '4|♠', '5|♠', '6|♠']); api.render();
check(/^Green’s turn: pick a card\.$/.test(els.st.textContent), 'status names whose turn it is (' + els.st.textContent + ')');
opts(6); api.newGame();
check((els.su.innerHTML.match(/class="sr"/g) || []).length === 6, '6 players: six seat rows');
api.start();

// --- pass-the-phone between people, computers still play themselves ---
opts(4); api.setWho([true, true, false, false, false, false]); api.init();
let s = api.s;
check(s.HN === 2 && s.turn === 0 && !s.cover, 'game starts on Green (a person) with no pass screen');
const g0 = s.gid, before = timers.length;
// Green plays any legal card
let ci = s.hands[0].findIndex(c => api.moves(0, c).length);
if (ci < 0) api.forced(0, 0); else {
  api.act(0, ci, api.moves(0, s.hands[0][ci]).find(m => !m.rem) || api.moves(0, s.hands[0][ci])[0]);
  const p = api.s.pend; if (p) { const l = api.second(p); api.step(l[0].o, l[0].k, l[0].to); api.fin(0, p.ci); }
}
s = api.s;
check(s.turn === 1 && s.cover && timers.length === before, 'Red is a person: pass screen shown, no computer timer');
check(/Pass to Red/.test(els.hand.innerHTML) && !/class="card/.test(els.hand.innerHTML), 'pass screen hides the cards and says who to pass to');
check(els.st.textContent === 'Pass the phone to Red.', 'status says to pass the phone');
const r6 = s.hands[1].slice();
api.pick(0);
check(api.s.hands[1].join() === r6.join(), 'cards cannot be played until Red taps ready');
api.ai();
check(api.s.turn === 1 && api.s.hands[1].join() === r6.join(), 'the computer never plays for a person');
api.ready();
s = api.s;
check(s.vw === 1 && !s.cover && (els.hand.innerHTML.match(/class="card/g) || []).length === 6, 'after ready, Red sees their own 6 cards');
// Red plays; Gold is a computer → timer scheduled, Red's cards stay on screen (Red holds the phone)
ci = s.hands[1].findIndex(c => api.moves(1, c).length);
if (ci < 0) api.forced(1, 0); else {
  api.act(1, ci, api.moves(1, s.hands[1][ci]).find(m => !m.rem) || api.moves(1, s.hands[1][ci])[0]);
  const p = api.s.pend; if (p) { const l = api.second(p); api.step(l[0].o, l[0].k, l[0].to); api.fin(1, p.ci); }
}
check(api.s.turn === 2 && !api.s.cover && timers.length === before + 1, 'Gold is a computer: plays on a timer, no pass screen');
check(/Gold is playing/.test(els.st.textContent), 'status shows the computer is playing');
// a stale timer from an old game must not play in a new game
api.init();
const t = timers[timers.length - 1]; const h0 = api.s.hands[0].join(); t();
check(api.s.turn === 0 && api.s.hands[0].join() === h0, 'old computer timer is ignored after a new game starts');

// --- one person (default): unchanged behaviour ---
opts(4); api.setWho([true, false, false, false, false, false]); api.init();
check(api.s.HN === 1 && api.s.NAME[0] === 'You' && !api.s.cover, 'one person: "You", no pass screens');

// --- win messages ---
opts(4); api.setWho([true, true, false, true, false, false]); api.init();
let E = api.s.E, HOME = [1, 2, 3, 4, 5].map(i => E + i);
api.setPegs(1, HOME); api.setPegs(3, HOME); api.setHand(0, ['2|♠', '3|♠']); api.fin(0, 0);
check(api.s.over && api.s.msg === 'Red and Sky win! 🎉', 'people team win message (' + api.s.msg + ')');
opts(4, false); api.setWho([true, false, true, false, false, false]); api.init();
E = api.s.E; HOME = [1, 2, 3, 4, 5].map(i => E + i);
api.setPegs(2, HOME); api.setHand(0, ['2|♠', '3|♠']); api.fin(0, 0);
check(api.s.over && api.s.msg === 'Gold wins! 🎉', 'individual person win message (' + api.s.msg + ')');

// --- full simulated games with a mix of people and computers ---
const mixes = [['4', true, [1, 1, 0, 0]], ['4', true, [1, 1, 1, 1]], ['6', true, [1, 0, 1, 1, 0, 0]], ['6', false, [1, 1, 1, 1, 1, 1]], ['4', false, [1, 0, 1, 0]]];
let unfinished = 0, peeks = 0, games = 0; const unfinishedDetails = [];
for (const [np, tm, w] of mixes) for (let g = 0; g < 12; g++) {
  // Use a distinct deterministic seed for every game so 60 runs exercise different card orders.
  rngSeed = (123456789 + Math.imul(games + 1, 0x9e3779b1)) >>> 0;
  opts(np, tm); api.setWho([...w, 0, 0, 0, 0, 0, 0].slice(0, 6).map(Boolean)); api.init(); games++;
  const gameStarted = process.hrtime.bigint();
  console.log(`[SIM] Game ${games}/60 START — players=${np}, teams=${tm}, mix=${w.join('')}`);
  let n = 0, failure = null;
  // Keep a bounded recent-state window: an unbounded Map can consume huge memory
  // on long games. Exact game-state repeats inside this window indicate a loop.
  const seenStates = new Set();
  const stateOrder = [];
  const MAX_REMEMBERED_STATES = 10000;
  const signature = z => JSON.stringify({
    turn: z.turn, hands: z.hands, pegs: z.pegs, stuck: z.stuck,
    forcedCard: z.forcedCard, pend: z.pend, cover: z.cover, over: z.over
  });
  const details = reason => {
    const z = api.s;
    return {np,teams:tm,who:w,game:g,turn:z.turn,steps:n,reason,
      stuck:z.stuck,forcedCard:z.forcedCard,pegs:z.pegs,
      hands:z.hands.map(h=>h.map(c=>c.split('|')[0]))};
  };
  while (!api.s.over && n < 2000000) {
    s = api.s;
    const key = signature(s);
    if (seenStates.has(key)) { failure = 'repeated game state (loop detected)'; break; }
    seenStates.add(key);
    stateOrder.push(key);
    if (stateOrder.length > MAX_REMEMBERED_STATES) {
      seenStates.delete(stateOrder.shift());
    }
    n++;
    if (!api.hu(s.turn)) {
      api.ai();
      if (api.s.over) break;
      continue;
    }
    if (s.cover) api.ready();
    s = api.s;
    if (s.vw !== s.turn) peeks++;
    const h = s.hands[s.turn], i = h.findIndex((c, ci) => (s.stuck[s.turn] < 3 || ci === s.forcedCard[s.turn]) && api.moves(s.turn, c).length);
    if (i < 0) {
      if (s.stuck[s.turn] >= 3) { failure = 'three failed draws with no forced legal move'; break; }
      api.pick(0);
      if (api.s.over) break;
      continue;
    }
    const ms = api.moves(s.turn, h[i]);
    api.act(s.turn, i, ms[Math.random() * ms.length | 0]);
    if (api.s.over) break;
    const p = api.s.pend;
    if (p) {
      const l = api.second(p), b = l[Math.random() * l.length | 0];
      api.step(b.o, b.k, b.to);
      if (api.s.over) break;
      api.fin(api.s.turn, p.ci);
      if (api.s.over) break;
    }
  }
  const elapsedMs = Number(process.hrtime.bigint() - gameStarted) / 1e6;
  if (!api.s.over) {
    failure = failure || (n >= 2000000 ? 'step safety limit reached' : 'simulation ended without a win');
    unfinished++;
    const diagnostic = details(failure);
    unfinishedDetails.push(diagnostic);
    console.log(`[SIM] Game ${games}/60 FAIL — ${failure}; steps=${n}; elapsed=${elapsedMs.toFixed(0)}ms; turn=${diagnostic.turn}`);
  } else {
    console.log(`[SIM] Game ${games}/60 PASS — winner=${api.s.msg}; steps=${n}; elapsed=${elapsedMs.toFixed(0)}ms`);
  }
  console.log(`[SIM] Progress: ${games}/60 games processed; ${games - unfinished}/${games} completed; ${unfinished} failed`);
}
console.log(`[SIM] FINAL: ${games - unfinished}/${games} games completed; ${unfinished} unfinished; ${peeks} privacy violations`);
check(games === 60 && unfinished === 0, `${games}/60 mixed person/computer games all finished${unfinishedDetails.length ? ' :: '+JSON.stringify(unfinishedDetails) : ''}`);
check(peeks === 0, 'a person never plays while showing another person\'s cards');

if (failed) { console.log(`${failed} check(s) failed`); process.exit(1); }
console.log('All player checks passed');
