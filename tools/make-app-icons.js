// Draws the app mark — a heart with a paw print knocked out of it — and writes
// the six files Expo ships as the launcher icon, adaptive icon, favicon and
// splash image.
//
//   node tools/make-app-icons.js
//
// Why the mark is drawn in code rather than kept as a source PNG: unlike the 27
// illustrated record icons (tools/make-icons.js), which are 27 different
// drawings going to one common size, this is one drawing going to six different
// specs. The sizes span 64px to 1024px; the framing differs three ways (iOS
// bleeds to the edge, Android has to stay inside the adaptive safe circle, the
// splash fills its own file); and the colour treatment differs two ways (full
// colour, and a flat silhouette whose paw is punched out of the *alpha* channel
// for Android themed icons). Cropping one bitmap six ways softens the edges at
// the small end and cannot produce the monochrome layer at all. Describing the
// shape as distance fields renders every variant at its native size with exact
// anti-aliasing, and leaves something that can actually be edited.
//
// Geometry lives in "mark space": y points down, the shape is centred near the
// origin and roughly two units across. render() measures the actual extent and
// fits it to each output, so the constants below can be nudged without having
// to re-derive any offsets.

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const OUT = path.join(__dirname, '..', 'assets');

// ---------------------------------------------------------------- palette

// From src/theme.js. peachLight is also app.json android.adaptiveIcon.backgroundColor,
// so the Android foreground and background layers meet on the same colour.
const PALETTE = {
  primary: '#B85C2E',
  accent: '#FFBE91',
  peachLight: '#FFEFD6',
};

function hex(s) {
  return [
    parseInt(s.slice(1, 3), 16),
    parseInt(s.slice(3, 5), 16),
    parseInt(s.slice(5, 7), 16),
  ];
}

function mix(a, b, t) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}

const PEACH = hex(PALETTE.peachLight);
// A short vertical gradient across the heart. Flat primary reads fine but goes
// slightly flat and dark at icon size; lifting the top toward accent keeps the
// warmth of the palette without weakening the silhouette.
const HEART_TOP = mix(hex(PALETTE.primary), hex(PALETTE.accent), 0.35);
const HEART_BOTTOM = hex(PALETTE.primary);

// ---------------------------------------------------------------- geometry

// Heart = a diamond (a square stood on its corner) unioned with a circle on
// each of its two upper edges. Putting each circle at an edge's midpoint with
// the radius set to half that edge makes it pass through both of the diamond's
// side corners *tangent to the lower edge*, so the two boundaries meet without
// a kink and the outline needs no smoothing to clean up. Every other split of
// the same shape leaves a visible corner on the shoulders.
//
// DIAMOND is the half-diagonal, i.e. the diamond is |x| + |y| <= DIAMOND. It
// sets the whole mark: the heart ends up 2.41x wide and 2.21x tall.
const DIAMOND = 0.744;
// Softens the bottom point. It rounds the two side corners as well, but those
// sit inside the lobes where the circle is already the outer boundary, so all
// it costs is a sub-pixel step where the two cross.
const TIP_ROUND = 0.09;
const LOBE = { dx: DIAMOND / 2, cy: -DIAMOND / 2, r: DIAMOND / Math.SQRT2 };

// Paw = one pad plus four toes, all ellipses.
//
// Everything here is set by one number: the narrowest bridge of colour left
// anywhere in the mark, currently ~0.094 units. Two places hit it at once — the
// pad against the heart's lower edge, and each inner toe against the outer toe
// beside it. That works out to 1.4px when a browser shows the favicon at 32px,
// which is about as thin as a gap can get and still read; below ~0.08 the pad
// breaks through the outline and the toes fuse into blobs.
//
// Watch the pad in particular: the heart's lower edge runs at 45 degrees, so
// what binds is the *perpendicular* distance, and comparing widths at equal
// height makes the pad look like it has half again as much room as it does.
// Measure after changing any of this — erode the rendered monochrome layer and
// check the five holes stay separate from each other and from the outside.
const PAD = { cx: 0, cy: 0.245, a: 0.29, b: 0.22, rot: 0 };
const TOES = [
  { cx: -0.185, cy: -0.31, a: 0.131, b: 0.17, rot: -0.12 },
  { cx: 0.185, cy: -0.31, a: 0.131, b: 0.17, rot: 0.12 },
  { cx: -0.45, cy: -0.055, a: 0.124, b: 0.163, rot: -0.42 },
  { cx: 0.45, cy: -0.055, a: 0.124, b: 0.163, rot: 0.42 },
];

function sdCircle(x, y, cx, cy, r) {
  return Math.hypot(x - cx, y - cy) - r;
}

// Rounded diamond. The four edges of |x| + |y| = a are all at 45 degrees, so
// the distance to them is just (|x| + |y| - a) / sqrt(2). Shrinking by
// round * sqrt(2) before inflating by round puts the edges back where they
// started and rounds only the corners.
function sdDiamond(x, y, a, round) {
  return (Math.abs(x) + Math.abs(y) - (a - round * Math.SQRT2)) / Math.SQRT2 - round;
}

// Ellipses have no closed-form distance, so this uses the first-order estimate
// f / |grad f|. It is exact on the outline and correctly signed everywhere,
// which is all the coverage calculation needs.
function sdEllipse(px, py, { cx, cy, a, b, rot }) {
  const co = Math.cos(rot);
  const si = Math.sin(rot);
  const dx = px - cx;
  const dy = py - cy;
  const x = dx * co + dy * si;
  const y = -dx * si + dy * co;

  const f = (x / a) ** 2 + (y / b) ** 2 - 1;
  const g = Math.hypot((2 * x) / (a * a), (2 * y) / (b * b));
  return g < 1e-9 ? -Math.min(a, b) : f / g;
}

function sdHeart(x, y) {
  return Math.min(
    sdDiamond(x, y, DIAMOND, TIP_ROUND),
    sdCircle(x, y, -LOBE.dx, LOBE.cy, LOBE.r),
    sdCircle(x, y, LOBE.dx, LOBE.cy, LOBE.r)
  );
}

function sdPaw(x, y) {
  let d = sdEllipse(x, y, PAD);
  for (const toe of TOES) d = Math.min(d, sdEllipse(x, y, toe));
  return d;
}

// ---------------------------------------------------------------- rendering

const SS = 3; // subsamples per axis

// Smallest box containing the heart, found by sampling rather than derived, so
// the constants above stay independently editable.
function markBounds() {
  const N = 512;
  const SPAN = 1.3;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let j = 0; j <= N; j++) {
    const y = -SPAN + (2 * SPAN * j) / N;
    for (let i = 0; i <= N; i++) {
      const x = -SPAN + (2 * SPAN * i) / N;
      if (sdHeart(x, y) <= 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1 };
}

const BOUNDS = markBounds();

// Coverage of a half-plane at signed distance d, for a sample footprint of
// width `px`. Clamped rather than smoothstepped — over a 3x3 grid the average
// is already smooth, and the linear ramp keeps edges from softening.
function coverage(d, px) {
  return Math.min(1, Math.max(0, 0.5 - d / px));
}

// mode: 'color' — gradient heart with the paw filled in peachLight
//       'mono'  — flat black heart with the paw as alpha holes (Android themed icons)
//       'none'  — background only
function render({ size, fit, bg, mode }) {
  const png = new PNG({ width: size, height: size });
  const data = png.data;

  const bgPixel = bg ? [...bg, 255] : [0, 0, 0, 0];
  for (let i = 0; i < size * size; i++) {
    data.set(bgPixel, i * 4);
  }
  if (mode === 'none') return png;

  const markW = BOUNDS.x1 - BOUNDS.x0;
  const markH = BOUNDS.y1 - BOUNDS.y0;
  const scale = (size * fit) / Math.max(markW, markH);
  const midX = (BOUNDS.x0 + BOUNDS.x1) / 2;
  const midY = (BOUNDS.y0 + BOUNDS.y1) / 2;

  // pixel centre -> mark space
  const toMarkX = (p) => (p + 0.5 - size / 2) / scale + midX;
  const toMarkY = (p) => (p + 0.5 - size / 2) / scale + midY;

  const step = 1 / (scale * SS); // subsample spacing in mark units
  const half = (SS - 1) / 2;

  // Everything outside the mark's pixel box is already background.
  const pad = 2;
  const px0 = Math.max(0, Math.floor(size / 2 + (BOUNDS.x0 - midX) * scale) - pad);
  const px1 = Math.min(size - 1, Math.ceil(size / 2 + (BOUNDS.x1 - midX) * scale) + pad);
  const py0 = Math.max(0, Math.floor(size / 2 + (BOUNDS.y0 - midY) * scale) - pad);
  const py1 = Math.min(size - 1, Math.ceil(size / 2 + (BOUNDS.y1 - midY) * scale) + pad);

  for (let py = py0; py <= py1; py++) {
    for (let px = px0; px <= px1; px++) {
      let heart = 0;
      let paw = 0;
      for (let sy = 0; sy < SS; sy++) {
        const my = toMarkY(py) + (sy - half) * step;
        for (let sx = 0; sx < SS; sx++) {
          const mx = toMarkX(px) + (sx - half) * step;
          const dh = sdHeart(mx, my);
          heart += coverage(dh, step);
          // The paw is fully inside the heart, so it only matters where the
          // heart already covers; skipping it outside saves five ellipses.
          if (dh < step) paw += coverage(sdPaw(mx, my), step);
        }
      }
      const n = SS * SS;
      heart /= n;
      paw /= n;
      if (heart <= 0) continue;

      const o = (py * size + px) * 4;
      if (mode === 'mono') {
        // One flat silhouette: Android tints this by alpha, so the paw has to
        // be a hole rather than a lighter colour.
        const a = heart * (1 - paw);
        data[o] = data[o + 1] = data[o + 2] = 0;
        data[o + 3] = Math.round(a * 255);
        continue;
      }

      const t = (toMarkY(py) - BOUNDS.y0) / markH;
      const fill = mix(HEART_TOP, HEART_BOTTOM, Math.min(1, Math.max(0, t)));
      const rgb = mix(fill, PEACH, paw);

      // Composite over whatever the background already is, so the opaque
      // outputs stay opaque and the transparent ones keep a clean edge.
      const dstA = data[o + 3] / 255;
      const outA = heart + dstA * (1 - heart);
      for (let c = 0; c < 3; c++) {
        data[o + c] = Math.round(
          (rgb[c] * heart + data[o + c] * dstA * (1 - heart)) / outA
        );
      }
      data[o + 3] = Math.round(outA * 255);
    }
  }
  return png;
}

// ---------------------------------------------------------------- outputs

// `fit` is the fraction of the canvas the mark's longer side takes up.
//
// 0.52 on the two Android layers keeps the whole mark inside the adaptive
// icon's guaranteed-visible circle (66dp of the 108dp canvas), which every
// launcher mask respects. iOS applies its own rounded-rect mask and no safe
// circle, so the icon can sit larger. The splash image is scaled by
// expo-splash-screen's imageWidth, so it just fills its own file.
const OUTPUTS = [
  { file: 'icon.png', size: 1024, fit: 0.62, bg: PEACH, mode: 'color' },
  { file: 'android-icon-foreground.png', size: 1024, fit: 0.52, bg: null, mode: 'color' },
  { file: 'android-icon-background.png', size: 1024, fit: 0, bg: PEACH, mode: 'none' },
  { file: 'android-icon-monochrome.png', size: 1024, fit: 0.52, bg: null, mode: 'mono' },
  // 64px so a browser showing it at 32 gets a clean halving. Pushed a little
  // larger in frame than the others — at 16px every unit of mark width counts.
  { file: 'favicon.png', size: 64, fit: 0.84, bg: PEACH, mode: 'color' },
  { file: 'splash-icon.png', size: 1024, fit: 0.86, bg: null, mode: 'color' },
];

let total = 0;
for (const spec of OUTPUTS) {
  const buf = PNG.sync.write(render(spec), { deflateLevel: 9 });
  fs.writeFileSync(path.join(OUT, spec.file), buf);
  total += buf.length;
  console.log(
    `${spec.file.padEnd(30)} ${String(spec.size).padStart(4)}px  ${spec.mode.padEnd(5)}  ${(
      buf.length / 1024
    ).toFixed(1)}KB`
  );
}

console.log(`\n${OUTPUTS.length} files  ${(total / 1024).toFixed(0)}KB`);
