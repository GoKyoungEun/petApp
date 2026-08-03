// Responsive scaling, keyed off device width (10_ReleaseNote v0.3 "반응형
// 스케일링(기기 폭 기준)").
//
// The design prototype was drawn at 375pt wide. Every hardcoded size in the
// StyleSheets is that design's number, so on a 320pt phone the layout overflows
// and on a 430pt phone it looks cramped in the middle. `scaled()` rewrites a
// whole StyleSheet object at once, so each screen only changes one line and no
// value can be missed.
//
// The app is portrait-locked (app.json), so width is fixed for the session and
// reading it once at module load is safe.

import { Dimensions, PixelRatio } from 'react-native';

const BASE_WIDTH = 375;

// Clamped: tablets (supportsTablet) would otherwise get 2.2x everything, which
// reads as a blown-up phone rather than a tablet layout. Small phones keep a
// floor so text stays legible.
const RATIO_MIN = 0.85;
const RATIO_MAX = 1.25;

const { width } = Dimensions.get('window');

// A hidden or not-yet-laid-out container reports width 0 (seen in the web
// preview when the browser pane is collapsed). Without this guard the whole app
// silently renders at RATIO_MIN, which looks like a design bug rather than a
// measurement one — fall back to the design width so the result is 1:1.
const measured = Number.isFinite(width) && width > 0 ? width : BASE_WIDTH;

export const ratio = Math.min(Math.max(measured / BASE_WIDTH, RATIO_MIN), RATIO_MAX);

// Lengths: spacing, radii, icon boxes.
export const s = (n) => PixelRatio.roundToNearestPixel(n * ratio);

// Type scales at half rate — a 1.25x-wide phone wants a bit more text, not 25%
// more. This is the usual "moderate scale" trick.
export const f = (n) => PixelRatio.roundToNearestPixel(n * (1 + (ratio - 1) * 0.5));

// Keys whose numeric values are lengths in design units.
const LENGTH_KEYS = new Set([
  'width', 'height',
  'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'top', 'right', 'bottom', 'left',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'marginHorizontal', 'marginVertical',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'paddingHorizontal', 'paddingVertical',
  'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
  'borderBottomLeftRadius', 'borderBottomRightRadius',
  'gap', 'rowGap', 'columnGap',
]);

const TYPE_KEYS = new Set(['fontSize', 'lineHeight', 'letterSpacing']);

// Deliberately NOT scaled:
// - borderWidth: 1 is a hairline on every device; scaling makes it blurry.
// - flex / opacity / zIndex / fontWeight: not lengths.
// - string values ('92%', 'center'): passed through untouched.

function scaleRule(rule) {
  const out = {};
  for (const key of Object.keys(rule)) {
    const v = rule[key];
    if (typeof v !== 'number') out[key] = v;
    else if (TYPE_KEYS.has(key)) out[key] = f(v);
    else if (LENGTH_KEYS.has(key)) out[key] = s(v);
    else out[key] = v;
  }
  return out;
}

// Wrap a style object before handing it to StyleSheet.create.
export function scaled(sheet) {
  const out = {};
  for (const name of Object.keys(sheet)) out[name] = scaleRule(sheet[name]);
  return out;
}
