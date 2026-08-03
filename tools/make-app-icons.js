// assets/icon-src/app-mark.png 한 장에서 Expo가 쓰는 아이콘 여섯 개를 만든다.
//
//   node tools/make-app-icons.js
//
// 원본은 청록 배경의 둥근 사각형 안에 하트·청진기·강아지·고양이가 그려진
// 일러스트다. 앱 팔레트가 주황 계열이라 그대로 쓰면 홈 화면과 앱 안이 따로
// 놀아서, 배경 색만 바꾸고 그림은 그대로 둔다.
//
// 순서가 중요하다. **청록을 먼저 파내고 그다음에 배경을 깐다.** 반대로 색을
// 먼저 옮기면 배경이 주황(약 22도)이 되면서 강아지 갈색 귀(20~40도)와 같은
// 대역에 들어가 배경만 골라낼 방법이 없어진다 — 실제로 먼저 해 보고 귀가
// 통째로 날아갔다.
//
// 만드는 것
//   icon.png                     iOS 런처. 모서리까지 꽉 찬 정사각형(OS가 깎는다)
//   android-icon-background.png  적응형 배경 — 단색
//   android-icon-foreground.png  적응형 전경 — 그림만, 안전 영역 안에
//   android-icon-monochrome.png  테마 아이콘 — 흰 윤곽선을 알파로
//   favicon.png                  웹
//   splash-icon.png              스플래시 — 둥근 사각형, 바깥은 투명

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const SRC = path.join(__dirname, '..', 'assets', 'icon-src', 'app-mark.png');
const OUT = path.join(__dirname, '..', 'assets');

// 원본에서 배경으로 쓰인 색상 대역. 그림의 다른 요소와 겹치지 않는다 —
// 갈색 귀 20~40도, 분홍 귀 0~10도, 회색·크림·흰색은 무채색에 가깝다.
const TEAL = [140, 200];

// 파낼 만큼 진하지는 않지만 청록기가 남은 경계 픽셀까지 훑는 범위. 넉넉히 잡아도
// 안전하다 — 그림에 이 대역의 색이 따로 없다.
const FRINGE = [110, 220];

// src/theme.js의 primary. 아이콘 배경을 앱 주색과 같은 값으로 두면 홈 화면에서
// 앱을 열 때 색이 이어진다. app.json의 android.adaptiveIcon.backgroundColor도
// 이 값이어야 전경과 배경 레이어가 같은 색에서 만난다.
const BG = [0xb8, 0x5c, 0x2e];

// 마크의 긴 변이 캔버스에서 차지하는 비율.
//
// 안드로이드 0.52 — 적응형 아이콘은 108dp 중 가운데 66dp만 어떤 런처에서도
// 보이는데, 그 원 안에 바운딩 박스의 모서리까지 들어가려면 이 정도여야 한다.
// favicon 0.84 — 16px로 줄었을 때 한 픽셀이 아쉬워 크게 잡는다.
const FIT = { android: 0.52, favicon: 0.84 };

// ------------------------------------------------------------------ 색 변환

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2, d = mx - mn;
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

function hsl2rgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(f(h + 1 / 3) * 255),
    Math.round(f(h) * 255),
    Math.round(f(h - 1 / 3) * 255),
  ];
}

// ------------------------------------------------------------------ 전처리

// 원본은 둥근 사각형 둘레에 흰 여백과 옅은 글로우가 있다. iOS는 정사각형을
// 받아 스스로 모서리를 깎으므로, 그 여백을 배경색으로 메워 두지 않으면 깎은
// 자리에 흰 조각이 남는다.
//
// 모서리에서 흰색을 따라 흘려보내 바깥을 찾는다. 그림 안의 흰 윤곽선은
// 청록에 둘러싸여 테두리와 이어지지 않으므로 걸리지 않는다.
function fillOutside(png) {
  const { width: W, height: H, data } = png;
  const idx = (x, y) => (W * y + x) << 2;
  const near = (i) => data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240;
  const outside = new Uint8Array(W * H);
  const stack = [];

  for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) {
    if (near(idx(x, y))) { outside[W * y + x] = 1; stack.push(x, y); }
  }
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const p = W * ny + nx;
      if (outside[p] || !near(idx(nx, ny))) continue;
      outside[p] = 1; stack.push(nx, ny);
    }
  }

  // 글로우는 순백이 아니라 위 판정에 안 걸린다. 마스크를 안쪽으로 더 넓혀야
  // 다음 단계에서 글로우가 아니라 진짜 배경색을 집는다.
  for (let k = 0; k < 10; k++) {
    const add = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (outside[W * y + x]) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (outside[W * ny + nx]) { add.push(W * y + x); break; }
        }
      }
    }
    for (const p of add) outside[p] = 1;
  }

  // 안쪽 색을 바깥으로 번지게 한다. 단색으로 칠하면 그라데이션과 만나는 자리에
  // 이음매가 보인다.
  let remaining = outside.reduce((a, b) => a + b, 0);
  while (remaining > 0) {
    const pairs = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = W * y + x;
        if (!outside[p]) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (outside[W * ny + nx]) continue;
          pairs.push(p, idx(nx, ny));
          break;
        }
      }
    }
    if (!pairs.length) break;
    for (let i = 0; i < pairs.length; i += 2) {
      const d = pairs[i] << 2, s = pairs[i + 1];
      data[d] = data[s]; data[d + 1] = data[s + 1]; data[d + 2] = data[s + 2]; data[d + 3] = 255;
    }
    for (let i = 0; i < pairs.length; i += 2) outside[pairs[i]] = 0;
    remaining -= pairs.length / 2;
  }
}

// 배경(청록)을 투명하게. 남는 것은 흰 윤곽선·십자·강아지·고양이다. 하트 안쪽과
// 청진기 안쪽도 배경색이라 함께 뚫리는데, 그 아래에 같은 색 배경이 깔리므로
// 결과는 같다.
//
// 흰 윤곽선과 배경이 만나는 자리에는 둘이 섞인 안티앨리어싱 픽셀이 한 줄 있다.
// **0이냐 1이냐로 끊으면 안 된다** — 처음에 그렇게 했더니 획에 구멍이 뚫려
// 하트 선이 부슬부슬해졌다. 얼마나 배경에 가까운지를 채도로 재서 알파를 그만큼
// 깎으면 경계가 원본처럼 매끈하게 남는다.
//
// 남는 색은 여전히 청록기를 띠므로 색상만 배경 쪽으로 돌린다. 밝기·채도를
// 건드리지 않아 경계의 부드러움은 그대로다.
function knockoutBackground(png, bgHue) {
  const out = new PNG({ width: png.width, height: png.height });
  png.data.copy(out.data);
  for (let i = 0; i < out.data.length; i += 4) {
    const [h, s, l] = rgb2hsl(out.data[i], out.data[i + 1], out.data[i + 2]);
    if (h < FRINGE[0] || h > FRINGE[1]) continue;

    // 얼마나 배경에 가까운지는 **크로마(최대−최소 채널)**로 잰다. HSL의 채도를
    // 쓰면 안 된다 — 아주 밝은 색에서 분모가 작아져 값이 부풀려진다. 획
    // 가장자리의 248,252,251은 사실상 흰색인데 채도가 0.40으로 나와 배경으로
    // 판정됐고, 그래서 하트 선에 구멍이 뚫렸다. 같은 픽셀의 크로마는 0.016,
    // 진짜 배경은 0.357로 확실히 갈린다.
    const mx = Math.max(out.data[i], out.data[i + 1], out.data[i + 2]);
    const mn = Math.min(out.data[i], out.data[i + 1], out.data[i + 2]);
    const chroma = (mx - mn) / 255;

    const C_NONE = 0.04, C_FULL = 0.18;
    const inTeal = h >= TEAL[0] && h <= TEAL[1];
    const w = inTeal
      ? Math.min(1, Math.max(0, (chroma - C_NONE) / (C_FULL - C_NONE)))
      : 0;

    const [r, g, b] = hsl2rgb(bgHue, s, l);
    out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b;
    out.data[i + 3] = Math.round(out.data[i + 3] * (1 - w));
  }
  return out;
}

// 흰 부분만 남긴 실루엣. 안드로이드 테마 아이콘은 알파만 보고 색은 시스템이
// 정하므로, 색은 흰색으로 채우고 모양은 알파로 준다.
//
// 그림 전체를 실루엣으로 만들지 않는 이유: 배경까지 포함돼 둥근 사각형 덩어리가
// 될 뿐이다. 흰 윤곽선만 뽑으면 하트·십자·청진기가 남아 그 자체로 읽힌다.
function whiteSilhouette(png) {
  const out = new PNG({ width: png.width, height: png.height });
  for (let i = 0; i < out.data.length; i += 4) {
    const white = png.data[i] > 235 && png.data[i + 1] > 235 && png.data[i + 2] > 235;
    out.data[i] = 255; out.data[i + 1] = 255; out.data[i + 2] = 255;
    out.data[i + 3] = white ? 255 : 0;
  }
  return out;
}

// ------------------------------------------------------------------ 출력

function bbox(png) {
  let x0 = png.width, y0 = png.height, x1 = -1, y1 = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (png.data[((png.width * y + x) << 2) + 3] < 8) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1 };
}

// 그림을 정사각형 캔버스 가운데에 앉힌다. `fit`이 null이면 원본 액자를 그대로
// 쓰고(원본이 이미 아이콘 구도다), 값이 있으면 실제로 그려진 영역 기준으로
// 그 비율에 맞춘다 — 원본 여백을 기준 삼으면 기기마다 크기가 들쭉날쭉해진다.
//
// 알파를 가중치로 평균낸다. 그냥 평균내면 투명한 픽셀의 색까지 섞여 가장자리에
// 검은 테가 생긴다.
function resample(png, size, fit) {
  let k, offX, offY;
  if (fit == null) {
    k = size / png.width;
    offX = 0;
    offY = 0;
  } else {
    const b = bbox(png);
    const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
    k = (size * fit) / Math.max(w, h);
    offX = (size - w * k) / 2 - b.x0 * k;
    offY = (size - h * k) / 2 - b.y0 * k;
  }

  const out = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx0 = (x - offX) / k, sx1 = (x + 1 - offX) / k;
      const sy0 = (y - offY) / k, sy1 = (y + 1 - offY) / k;
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let j = Math.floor(sy0); j < Math.ceil(sy1); j++) {
        for (let i = Math.floor(sx0); i < Math.ceil(sx1); i++) {
          n++;
          if (i < 0 || j < 0 || i >= png.width || j >= png.height) continue;
          const p = (png.width * j + i) << 2;
          const w = png.data[p + 3];
          r += png.data[p] * w; g += png.data[p + 1] * w; b += png.data[p + 2] * w;
          a += w;
        }
      }
      const q = (size * y + x) << 2;
      out.data[q] = a ? r / a : 0;
      out.data[q + 1] = a ? g / a : 0;
      out.data[q + 2] = a ? b / a : 0;
      out.data[q + 3] = n ? a / n : 0;
    }
  }
  return out;
}

function over(png, bg) {
  const out = new PNG({ width: png.width, height: png.height });
  for (let i = 0; i < png.data.length; i += 4) {
    const a = png.data[i + 3] / 255;
    out.data[i] = png.data[i] * a + bg[0] * (1 - a);
    out.data[i + 1] = png.data[i + 1] * a + bg[1] * (1 - a);
    out.data[i + 2] = png.data[i + 2] * a + bg[2] * (1 - a);
    out.data[i + 3] = 255;
  }
  return out;
}

function solid(size, color) {
  const out = new PNG({ width: size, height: size });
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = color[0]; out.data[i + 1] = color[1];
    out.data[i + 2] = color[2]; out.data[i + 3] = 255;
  }
  return out;
}

// 스플래시는 밝은 배경 위에 놓인다. 그림만 얹으면 흰 하트 윤곽이 배경에 묻히기
// 때문에, 아이콘처럼 둥근 사각형 판을 유지한다.
function roundRect(png, radiusRatio) {
  const S = png.width;
  const r = S * radiusRatio;
  const out = new PNG({ width: S, height: S });
  png.data.copy(out.data);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = Math.max(r - (x + 0.5), (x + 0.5) - (S - r), 0);
      const dy = Math.max(r - (y + 0.5), (y + 0.5) - (S - r), 0);
      const d = Math.hypot(dx, dy);
      // 경계 1px을 부드럽게 — 계단이 눈에 띈다.
      const a = d <= r ? 1 : d >= r + 1 ? 0 : r + 1 - d;
      const q = (S * y + x) << 2;
      out.data[q + 3] = Math.round(out.data[q + 3] * a);
    }
  }
  return out;
}

// ------------------------------------------------------------------ 실행

if (!fs.existsSync(SRC)) {
  console.error('원본이 없습니다:', SRC);
  console.error('assets/icon-src/는 저장소에 없다 — AGENTS.md "저장소에 없는 것" 참고.');
  process.exit(1);
}

const src = PNG.sync.read(fs.readFileSync(SRC));
console.log('원본', src.width + 'x' + src.height);

fillOutside(src);
const art = knockoutBackground(src, rgb2hsl(BG[0], BG[1], BG[2])[0]);
const mono = whiteSilhouette(src);

let total = 0;
function write(name, png) {
  const buf = PNG.sync.write(png, { deflateLevel: 9 });
  fs.writeFileSync(path.join(OUT, name), buf);
  total += buf.length;
  console.log(`  ${name.padEnd(30)} ${String(png.width).padStart(4)}px  ${(buf.length / 1024).toFixed(1)}KB`);
}

console.log('생성:');
write('icon.png', over(resample(art, 1024, null), BG));
write('android-icon-background.png', solid(1024, BG));
write('android-icon-foreground.png', resample(art, 1024, FIT.android));
write('android-icon-monochrome.png', resample(mono, 1024, FIT.android));
write('favicon.png', over(resample(art, 64, FIT.favicon), BG));
write('splash-icon.png', roundRect(over(resample(art, 512, null), BG), 0.22));

console.log(`\n6개  ${(total / 1024).toFixed(0)}KB`);
