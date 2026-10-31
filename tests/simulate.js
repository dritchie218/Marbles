// Loads the game script from index.html with a stub DOM and plays full games.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let rngSeed = 123456789;
Math.random = () => { rngSeed = (Math.imul(rngSeed, 1664525) + 1013904223) >>> 0; return rngSeed / 4294967296; };
const js = html.match(/<script>([\s\S]*)<\/script>/)[1].replace(/\ninit\(\);\s*$/, '\n');

const els = {};
const mk = () => ({ value: '4', checked: true, innerHTML: '', textContent: '', setAttribute() {} });
global.document = { getElementById: id => els[id] || (els[id] = mk()) };
global.setTimeout = () => 0;

const api = new Function(js + `
return {init,render,tp,W,A,moves,act,ai,forced,second,step,fin,setSpeed,speedDelay,speedDuration,cardSvg,activeCardTheme,CARD_THEMES,
  get speed(){return moveSpeed},
  get winner(){return {title:winnerTitle,names:winnerNames,players:winnerPlayers.slice()}},
  get s(){return {NP,T,E,CI,over,turn,pend,hands,pegs,SD,N,stuck,forcedCard}}}`)();

let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed++; };

// --- animation speed controls ---
check(html.includes('id="speed"') && html.includes('>Slow</option>') && html.includes('>Normal</option>') && html.includes('>Fast</option>'), 'move speed selector offers Slow, Normal and Fast');
check(html.includes('<animateMotion path="${movePath}"') && html.includes('const movingTrack=') && html.includes("marble(0,0,lastMove.o,lastMove.k,'active-move')"), 'marble animates along intermediate track spaces with a moving highlight');
check(html.includes('id="mv" aria-live="polite"') && html.includes('moveNotice'), 'move announcement is exposed to screen readers');
api.setSpeed('slow'); check(api.speed === 'slow' && api.speedDelay() > 0.3 && api.speedDuration() === 5000, 'Slow mode gives space markers and announcements more time');
api.setSpeed('normal'); check(api.speed === 'normal' && api.speedDelay() < 0.2 && api.speedDuration() === 2800, 'Normal mode uses default move timing');
api.setSpeed('fast'); check(api.speed === 'fast' && api.speedDelay() < 0.1 && api.speedDuration() === 1000, 'Fast mode shortens move timing');
api.setSpeed('normal');

for (const [np, color, theme] of [['4', 'Green', 'mid'], ['6', 'Gold', 'oak'], ['4', 'Red', 'vik'], ['6', 'Pink', 'wild'], ['4', 'Sky', 'twn']]) {
  rngSeed = 123456789;
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
  // A card that carries the only active marble across its own home gate is legal.
  s.pegs.forEach(P => P.fill(-99));
  s.pegs[0][0] = s.E - 2;
  const gateCrossing = api.moves(0, '3|♠');
  check(gateCrossing.length === 1 && gateCrossing[0].to === s.E + 1,
    `${np} players: only legal move can cross own home gate into the safe lane`);
  s.pegs[0][0] = -99;
  const sideX = [];
  for (let t = 0; t <= 18; t++) sideX.push(api.W(0, t, 0)[0]);
  const co = api.tp(api.A(0))[0];
  const sorted = [...sideX].sort((a, b) => a - b);
  const i = sorted.findIndex(x => Math.abs(x - co) < 0.6);
  check(i === 10 && sorted.length - 1 - i === 8, `${np} players: 10 holes left, 8 holes right of come-out`);
  let guard = 0;
  while (!api.s.over && guard++ < 8000) {
    s = api.s;
    if (s.turn === 0) {
      const ci = s.hands[0].findIndex((c, i) => (s.stuck[0] < 3 || i === s.forcedCard[0]) && api.moves(0, c).length);
      if (ci < 0) { if (s.stuck[0] >= 3) { check(false, `${np} players: forced fourth card has no entry move`); break; } api.forced(0, 0); }
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
const completedGameSnapshot = { winner: api.winner, hidden: els.winner.hidden, title: els.winnerTitle.textContent, names: els.winnerNames.textContent };

// --- themed playing-card rendering ---
// Exercise the actual renderer, not just the presence of theme names in the HTML.
const expectedThemes = {
 classic:['#8b8172','#d4cbbb','classic'],royal:['#b58a2b','#f0d88e','royal'],
 west:['#8b542b','#d7ad70','west'],fantasy:['#a98be8','#e0d0ff','fantasy'],
 world:['#187d83','#9ed9d4','world'],neon:['#00e5ff','#ff4fd8','neon'],
 championship:['#244f91','#d5ad50','championship']
};
check(Object.keys(api.CARD_THEMES).sort().join(',') === Object.keys(expectedThemes).sort().join(','),
  'all seven selectable card themes have renderer palettes');
check(['auto','classic','royal','west','fantasy','world','neon','championship'].every(v =>
  html.includes('<option value="' + v + '"')),
  'card theme selector exposes Auto and every supported theme');

const themeSamples = [];
for (const [name, [edge, accent, kind]] of Object.entries(expectedThemes)) {
  els.cardTheme = Object.assign(mk(), { value: name });
  check(api.activeCardTheme() === name, name + ': manual theme selection is respected');
  const ace = api.cardSvg('A|♠');
  const ten = api.cardSvg('10|♥');
  const queen = api.cardSvg('Q|♦');
  const joker = api.cardSvg('JK|b');
  themeSamples.push(ace);
  check(ace.includes('viewBox="0 0 60 84"') && ace.includes('stroke="' + edge + '"') &&
    ace.includes('stroke="' + accent + '"') && ace.includes('>A</text>') && ace.includes('>♠</text>'),
    name + ': ace retains readable rank and black suit inside the card frame');
  check(ten.includes('>10</text>') && ten.includes('>♥</text>') &&
    ten.includes('#d1332e') && ten.includes('font-size="13"'),
    name + ': ten of hearts retains red suit and pip layout');
  check(queen.includes('>Q</text>') && queen.includes('>♦</text>') &&
    queen.includes(mark) && queen.includes('fill="' + api.CARD_THEMES[name].panel + '"'),
    name + ': face card keeps rank, suit and theme artwork');
  check(joker.includes('JOKER') && joker.includes(mark) && joker.includes('viewBox="0 0 60 84"'),
    name + ': Joker renders with theme decoration inside the card frame');\n  check(ace.includes('stroke="' + accent + '"') || ace.includes('stroke="' + edge + '"'), name + ': distinctive frame treatment is present');
}

\ncheck(new Set(themeSamples).size === 7, 'all seven card themes render visibly different artwork and backgrounds');\n// Auto mode must follow board size, while explicit choices override it.
els.np = Object.assign(mk(), { value: '4' });
els.cl = Object.assign(mk(), { value: 'Green' });
els.th = Object.assign(mk(), { value: 'mid' });
els.cardTheme = Object.assign(mk(), { value: 'auto' });
api.init();
check(api.activeCardTheme() === 'royal', 'Auto selects Royal Casino on a four-player board');
check(api.cardSvg('K|♣').includes('#b38a32'), 'four-player auto theme is applied to rendered cards');
els.np.value = '6';
api.init();
check(api.activeCardTheme() === 'world', 'Auto selects World Tour on a six-player board');
check(api.cardSvg('K|♣').includes('#287d86'), 'six-player auto theme is applied to rendered cards');
els.cardTheme.value = 'fantasy';
check(api.activeCardTheme() === 'fantasy' && api.cardSvg('K|♣').includes('#7650a8'),
  'manual theme overrides the automatic board theme');

if (failed) { console.log(`${failed} check(s) failed`); process.exit(1); }
console.log('All checks passed');


// --- end-of-game winner announcement ---
check(html.includes('<div id="boardWrap">') && html.includes('id="winner" role="status" aria-live="assertive"'),
  'winner announcement is layered over the existing board and announced accessibly');
check(html.includes('id="winnerTitle"') && html.includes('id="winnerNames"') &&
  html.includes('onclick="newGame()">New Game</button>'),
  'winner overlay identifies the winner and offers a new-game action');
check(html.includes("if(over){$('winnerTitle').textContent=winnerTitle;$('winnerNames').textContent=winnerNames}"),
  'winner overlay content is populated when the game ends');
check(completedGameSnapshot.winner.title && completedGameSnapshot.winner.names && completedGameSnapshot.winner.players.length > 0,
  'completed simulated game records a visible winner and winning player names');
check(completedGameSnapshot.hidden === false && completedGameSnapshot.title === completedGameSnapshot.winner.title &&
  completedGameSnapshot.names === completedGameSnapshot.winner.names,
  'completed game renders the winner announcement over the board');
