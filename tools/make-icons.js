// Draws the Marbles app icons (purple & gold board, cat-eye marble) and writes them as PNGs.
// No dependencies: plain Node (zlib for PNG compression). Run: npm run icons
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');
const hex = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
const mix = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);
const PUR1 = hex('#5a2d9c'), PUR2 = hex('#26104a'), GOLD = hex('#ffc62f'), GOLD_RIM = hex('#d9a826');
const HOLE = hex('#12061f'), MARBLE = hex('#f4b41a'), WHITE = [255, 255, 255], BLACK = [0, 0, 0];
const LIGHT = mix(MARBLE, WHITE, 0.6), DARK = mix(MARBLE, BLACK, 0.5), PUPIL = mix(MARBLE, BLACK, 0.55);
const ANG = 35 * Math.PI / 180, CA = Math.cos(ANG), SA = Math.sin(ANG);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const over = (c, col, a) => { for (let i = 0; i < 3; i++) c[i] = c[i] * (1 - a) + col[i] * a; };

// Colour of one point (u, v in 0..1). k shrinks the artwork for "maskable" icons.
function shade(u, v, k) {
  const c = mix(PUR1, PUR2, clamp(Math.hypot(u - 0.5, v - 0.45) / 0.75, 0, 1));
  const dx = u - 0.5, dy = v - 0.5, d = Math.hypot(dx, dy);
  // gold board ring
  const ringR = 0.385 * k;
  if (d <= ringR && d >= ringR - 0.006 * k) over(c, GOLD, 1);
  // 18 track holes
  const hr = 0.021 * k, hR = 0.435 * k;
  for (let i = 0; i < 18; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / 18, hd = Math.hypot(u - 0.5 - hR * Math.cos(a), v - 0.5 - hR * Math.sin(a));
    if (hd <= hr) { over(c, hd >= hr - 0.004 * k ? GOLD_RIM : HOLE, 1); break; }
  }
  // soft shadow under the marble
  const R = 0.28 * k, b = 0.02 * k, sd = Math.hypot(dx, dy - 0.03 * k);
  let s = clamp((R + 2 * b - sd) / (4 * b), 0, 1); s = s * s * (3 - 2 * s);
  over(c, BLACK, s * 150 / 255);
  if (d > R) return c;
  // marble body (same radial gradient as the in-game marbles)
  const gx = 0.5 - R + 2 * R * 0.36, gy = 0.5 - R + 2 * R * 0.30;
  const t = clamp(Math.hypot(u - gx, v - gy) / (2 * R * 0.78), 0, 1);
  over(c, t < 0.5 ? mix(LIGHT, MARBLE, t / 0.5) : mix(MARBLE, DARK, (t - 0.5) / 0.5), 1);
  // cat-eye: two lens shapes, rotated
  const x = dx * CA + dy * SA, y = -dx * SA + dy * CA;
  const lens = (w, h) => Math.abs(y) < h && Math.abs(x) < (w / 2) * (1 - (y / h) ** 2);
  if (lens(0.78 * R, 0.84 * R)) over(c, WHITE, 224 / 255);
  if (lens(0.34 * R, 0.68 * R)) over(c, PUPIL, 1);
  // shine + white outline
  if (Math.hypot(dx + 0.4 * R, dy + 0.44 * R) <= 0.2 * R) over(c, WHITE, 205 / 255);
  if (d >= R - 0.008 * k) over(c, WHITE, 215 / 255);
  return c;
}

function render(size, k, ss = 4) {
  const px = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const acc = [0, 0, 0];
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
      const c = shade((x + (i + 0.5) / ss) / size, (y + (j + 0.5) / ss) / size, k);
      acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
    }
    const o = (y * size + x) * 3;
    for (let n = 0; n < 3; n++) px[o + n] = Math.round(acc[n] / (ss * ss));
  }
  return px;
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const ICONS = [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, 0.8], // artwork kept inside the safe zone for Android shape masks
  ['apple-touch-icon.png', 180, 1],
];
function build() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, size, k] of ICONS) fs.writeFileSync(path.join(OUT, name), png(size, render(size, k)));
}
if (require.main === module) { build(); console.log('wrote ' + ICONS.map(i => 'icons/' + i[0]).join(', ')); }
module.exports = { ICONS, OUT, build };
