// Checks the installable-app files: manifest, icons, service worker and the links in index.html.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed++; };

const icons = require('../tools/make-icons.js');
icons.build();

const m = JSON.parse(read('manifest.json'));
check(m.name && m.short_name && m.start_url && m.display === 'standalone', 'manifest has name, short_name, start_url, standalone');
for (const size of ['192x192', '512x512']) check(m.icons.some(i => i.sizes === size && i.purpose !== 'maskable'), `manifest has a ${size} icon`);
for (const i of m.icons) {
  const f = path.join(root, i.src), ok = fs.existsSync(f);
  check(ok, `icon ${i.src} exists`);
  if (!ok) continue;
  const b = fs.readFileSync(f), [w, h] = i.sizes.split('x').map(Number);
  check(b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(16) === w && b.readUInt32BE(20) === h, `icon ${i.src} is a ${i.sizes} PNG`);
}

const html = read('index.html');
for (const ref of ['manifest.json', 'icons/apple-touch-icon.png', "register('sw.js')"]) check(html.includes(ref), `index.html references ${ref}`);
check(fs.existsSync(path.join(root, 'icons/apple-touch-icon.png')), 'apple-touch-icon exists');
check(html.includes('href="Marbles-Home-Screen-Directions.pdf"'), 'index.html links the home-screen directions PDF');
const wf = read('.github/workflows/pages.yml');
check(fs.existsSync(path.join(root, 'tools/make-guide.py')) && wf.includes('python tools/make-guide.py') &&
  wf.indexOf('npm run icons') < wf.indexOf('make-guide.py') && wf.indexOf('make-guide.py') < wf.indexOf('upload-pages-artifact'),
  'deploy builds the directions PDF after the icons and before upload');

const sw = read('sw.js');
let parsed = true; try { new Function(sw); } catch (e) { parsed = false; }
check(parsed, 'sw.js parses');
const listed = [...sw.matchAll(/'\.\/([^']+)'/g)].map(x => x[1]);
for (const f of listed) check(fs.existsSync(path.join(root, f)), `sw.js offline file ${f} exists`);

if (failed) { console.log(`${failed} check(s) failed`); process.exit(1); }
console.log('All app checks passed');
