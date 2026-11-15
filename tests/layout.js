// Landscape layout selection: which CSS layout each device size gets.
// Evaluates the @media queries in index.html against typical CSS-pixel viewports.
// iPhones and iPads in landscape get the side-by-side layout (board left, controls right);
// iPads also get the larger tablet sizing; desktops and portrait screens are unchanged.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed++; };

// Top-level @media blocks: { query, body, index }.
const blocks = [];
for (let i = css.indexOf('@media'); i >= 0; i = css.indexOf('@media', i + 1)) {
  const open = css.indexOf('{', i);
  let depth = 0, j = open;
  for (; j < css.length; j++) { if (css[j] === '{') depth++; else if (css[j] === '}' && --depth === 0) break; }
  blocks.push({ query: css.slice(i + 6, open).trim(), body: css.slice(open + 1, j), index: i });
}
let depth = 0, balanced = true;
for (const ch of css) { if (ch === '{') depth++; else if (ch === '}' && --depth < 0) balanced = false; }
check(balanced && depth === 0, 'CSS braces are balanced');

const feature = (f, d) => {
  const [k, v] = f.replace(/[()]/g, '').split(':').map(x => x.trim());
  const px = parseFloat(v);
  switch (k) {
    case 'orientation': return v === (d.w > d.h ? 'landscape' : 'portrait');
    case 'max-width': return d.w <= px;
    case 'min-width': return d.w >= px;
    case 'max-height': return d.h <= px;
    case 'min-height': return d.h >= px;
    case 'any-pointer': return v === 'coarse' ? d.touch : !d.touch;
    case 'prefers-color-scheme': case 'prefers-reduced-motion': return false;
    default: throw new Error('unhandled media feature ' + k);
  }
};
const matches = (q, d) => q.split(',').some(part => part.trim().split(/\s+and\s+/).every(t => t === 'screen' || feature(t, d)));
const applied = d => blocks.filter(b => matches(b.query, d));

const sideBySide = b => b.body.includes('grid-template-areas:');
const tablet = b => b.body.includes('#boardWrap{width:min(100%,calc(100dvh - 20px))}');
const rotate = b => b.body.includes('#rotateNotice{') && b.body.includes('display:flex');
check(blocks.filter(sideBySide).length === 1 && blocks.filter(tablet).length === 1 && blocks.filter(rotate).length === 1,
  'one side-by-side layout block, one tablet sizing block, one rotate-notice block');
check(blocks.findIndex(tablet) > blocks.findIndex(sideBySide), 'tablet sizing comes after the shared layout so it overrides it');

// [name, width, height, touch, expect side-by-side, expect tablet sizing, expect rotate notice]
const devices = [
  ['iPhone SE landscape', 667, 375, true, true, false, false],
  ['iPhone 15 landscape', 852, 393, true, true, false, false],
  ['iPhone Pro Max landscape', 932, 430, true, true, false, false],
  ['iPad mini landscape', 1133, 744, true, true, true, false],
  ['iPad mini landscape (Safari toolbars)', 1133, 680, true, true, true, false],
  ['iPad / iPad Air landscape', 1180, 820, true, true, true, false],
  ['iPad / iPad Air landscape (Safari toolbars)', 1180, 740, true, true, true, false],
  ['iPad Pro 11 landscape', 1210, 834, true, true, true, false],
  ['iPad Pro 13 landscape', 1366, 1024, true, true, true, false],
  ['iPad Pro 13 landscape (Safari toolbars)', 1366, 950, true, true, true, false],
  ['iPad portrait', 820, 1180, true, false, false, false],
  ['iPad mini portrait', 744, 1133, true, false, false, false],
  ['iPhone portrait', 393, 852, true, false, false, true],
  ['laptop browser (no touch)', 1366, 768, false, false, false, false],
  ['laptop browser small window (no touch)', 900, 560, false, true, false, false],
  ['desktop browser (no touch)', 1920, 1080, false, false, false, false],
];
for (const [name, w, h, touch, side, tab, rot] of devices) {
  const a = applied({ w, h, touch });
  check(a.some(sideBySide) === side && a.some(tablet) === tab && a.some(rotate) === rot,
    `${name} ${w}x${h}: side-by-side=${side}, tablet sizing=${tab}, rotate notice=${rot}`);
}

// Existing phone layout rules are kept unchanged.
check(css.includes('@media screen and (orientation:landscape) and (max-height:600px) and (max-width:1000px)'),
  'original iPhone landscape query is preserved');
check(css.includes('.card{flex:0 0 clamp(54px,calc((100% - 25px)/6),70px)'), 'iPhone landscape card size is unchanged');

if (failed) { console.log(`${failed} check(s) failed`); process.exit(1); }
console.log('All layout checks passed');
