// Turns the 1024x1024 source illustrations in assets/icon-src into the icon
// sheet the app ships (assets/icon).
//
// Why this exists: the sources are ~1.35MB each (36MB total) and each drawing
// sits in a different amount of empty canvas, so rendering them raw would both
// bloat the bundle and make the set look inconsistent — a wide drawing like the
// dog would read much smaller than a square one like the walk icon.
//
// Steps per file: trim to the drawn content, re-centre it in a square with a
// uniform margin, then area-average down to SIZE.
//
//   node tools/make-icons.js

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const SRC = path.join(__dirname, '..', 'assets', 'icon-src');
const OUT = path.join(__dirname, '..', 'assets', 'icon');

const SIZE = 128; // largest on-screen use is 30pt, so this covers @3x with room
const ALPHA_FLOOR = 8; // ignore the faint outer glow when measuring content
const MARGIN = 0.06; // keep the art off the edge

// Smallest rectangle containing every pixel above the alpha floor.
function contentBox(png) {
  const { width: W, height: H, data } = png;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > ALPHA_FLOOR) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

// Area-average from a square window of the source into a SIZE x SIZE buffer.
// Colour is weighted by alpha (premultiplied) — averaging raw RGB would pull in
// the colour of fully transparent pixels and leave dark fringes.
function resample(png, sx, sy, side) {
  const { width: W, height: H, data } = png;
  const out = new PNG({ width: SIZE, height: SIZE });
  const step = side / SIZE;

  for (let oy = 0; oy < SIZE; oy++) {
    for (let ox = 0; ox < SIZE; ox++) {
      const bx0 = Math.floor(sx + ox * step);
      const by0 = Math.floor(sy + oy * step);
      const bx1 = Math.max(bx0 + 1, Math.floor(sx + (ox + 1) * step));
      const by1 = Math.max(by0 + 1, Math.floor(sy + (oy + 1) * step));

      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = by0; y < by1; y++) {
        for (let x = bx0; x < bx1; x++) {
          n++;
          if (x < 0 || y < 0 || x >= W || y >= H) continue; // outside = transparent
          const i = (y * W + x) * 4;
          const av = data[i + 3];
          r += data[i] * av;
          g += data[i + 1] * av;
          b += data[i + 2] * av;
          a += av;
        }
      }

      const o = (oy * SIZE + ox) * 4;
      if (a === 0 || n === 0) {
        out.data[o] = out.data[o + 1] = out.data[o + 2] = out.data[o + 3] = 0;
      } else {
        out.data[o] = Math.round(r / a);
        out.data[o + 1] = Math.round(g / a);
        out.data[o + 2] = Math.round(b / a);
        out.data[o + 3] = Math.round(a / n);
      }
    }
  }
  return out;
}

fs.mkdirSync(OUT, { recursive: true });

let before = 0, after = 0, count = 0;
for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith('.png')).sort()) {
  const raw = fs.readFileSync(path.join(SRC, file));
  before += raw.length;

  const png = PNG.sync.read(raw);
  const box = contentBox(png);
  if (!box) {
    console.log(`skip ${file} — no visible pixels`);
    continue;
  }

  const w = box.x1 - box.x0 + 1;
  const h = box.y1 - box.y0 + 1;
  // Square window centred on the drawing; may extend past the source edge,
  // which resample() fills with transparency.
  const side = Math.round(Math.max(w, h) * (1 + MARGIN * 2));
  const sx = Math.round(box.x0 + w / 2 - side / 2);
  const sy = Math.round(box.y0 + h / 2 - side / 2);

  const buf = PNG.sync.write(resample(png, sx, sy, side), { deflateLevel: 9 });
  fs.writeFileSync(path.join(OUT, file), buf);
  after += buf.length;
  count++;
  console.log(`${file.padEnd(44)} ${w}x${h} -> ${SIZE}x${SIZE}  ${(buf.length / 1024).toFixed(1)}KB`);
}

console.log(
  `\n${count} icons  ${(before / 1024 / 1024).toFixed(1)}MB -> ${(after / 1024).toFixed(0)}KB`
);
