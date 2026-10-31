// Loads the game script from index.html with a stub DOM and plays full games.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let rngSeed = 123456789;
Math.random = () => { rngSeed = (Math.imul(rngSeed, 1664525) + 1013904223) >>> 0; return rngSeed / 4294967296; };
const js = html.match(/<script>([\s\S]*)<\/script>/)[1].replace(/\ninit\(\);\s*$/, '\n');

const els = {};
const mk = () => ({ value: '4', checked: true, innerHTML: '', textContent: '', style: {}, hidden: true, setAttribute() {} });
global.document = { getElementById: id => els[id] || (els[id] = mk()) };
global.setTimeout = () => 0;

const api = new Function(js + `
return {init,render,tp,W,A,moves,act,ai,forced,second,step,fin,setSpeed,speedDelay,speedDuration,cardSvg,
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
const completedGameSnapshot = { winner: api.winner, hidden: els.winner.hidden, display: els.winner.style.display, title: els.winnerTitle.textContent, names: els.winnerNames.textContent };

// --- single standard playing-card design ---
// The deck uses one consistent face design for every board and player count.
check(!html.includes('cardTheme') && !html.includes('CARD_THEMES') && !html.includes('marbles-card-theme'),
  'there is no card-theme selector, theme state, or theme persistence');
const aceCard = api.cardSvg('A|♠');
const tenCard = api.cardSvg('10|♥');
const queenCard = api.cardSvg('Q|♦');
const jokerCard = api.cardSvg('JK|b');
check(aceCard.includes('viewBox="0 0 60 84"') && aceCard.includes('>A</text>') && aceCard.includes('>♠</text>'),
  'standard ace keeps its readable rank and suit');
check(tenCard.includes('>10</text>') && tenCard.includes('>♥</text>') && tenCard.includes('font-size="13"'),
  'standard ten keeps its rank, red suit, and pip layout');
check(queenCard.includes('>Q</text>') && queenCard.includes('>♦</text>'),
  'standard face card keeps its rank and suit');
check(jokerCard.includes('JOKER') && jokerCard.includes('viewBox="0 0 60 84"'),
  'standard Joker keeps its identifying label and card frame');
check(html.includes('flex:0 0 clamp(54px') && html.includes('overflow-x:auto'),
  'hand cards remain readable and horizontally scroll on narrow screens');


check(aceCard.includes('font-size="40"'), 'ace center suit is enlarged for quick recognition');
check(tenCard.includes('font-size="15"') && tenCard.includes('font-size="12"'), 'number cards use larger pips and corner ranks');
check(queenCard.includes('font-size="27"') && queenCard.includes('font-size="13"'), 'face cards use larger central rank and suit');
check(jokerCard.includes('font-size="9"') && jokerCard.includes('font-size="14"'), 'Joker label and corner marker are enlarged');
check(html.includes('flex:0 0 clamp(64px,calc((100vw - 48px)/5),88px)') && html.includes('min-height:112px'),
  'hand cards are larger on phones while retaining horizontal scrolling');

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
check(completedGameSnapshot.display === 'flex',
  'completed game explicitly displays the winner overlay instead of relying only on the hidden attribute');
