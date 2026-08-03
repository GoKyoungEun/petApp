// Date helpers. Every date in the app is a *local-calendar* YYYY-MM-DD string —
// that is what `recordDate` stores and what the calendar grid keys off.
//
// Never use `new Date('2026-07-22')`: the ISO-date form is parsed as UTC
// midnight, so `.getDate()` reads back the previous day in any timezone west of
// UTC. Parse with `parseYmd` instead, which builds a local-midnight Date.

const pad = (n) => String(n).padStart(2, '0');

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// Date -> 'YYYY-MM-DD' in the device's local calendar.
export function toYmd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// 'YYYY-MM-DD' -> Date at local midnight.
export function parseYmd(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayYmd() {
  return toYmd(new Date());
}

// Calendar-day arithmetic (handles month/year rollover and DST).
export function addDays(str, n) {
  const d = parseYmd(str);
  d.setDate(d.getDate() + n);
  return toYmd(d);
}

// (year, 0-indexed month, day) -> 'YYYY-MM-DD'. Out-of-range days roll over the
// way Date does, which is what the grid builders below rely on.
export const ymd = (y, m, d) => toYmd(new Date(y, m, d));

// Whole days from `from` to `to`, both 'YYYY-MM-DD'. Positive = `to` is later.
// Drives the schedule list's D-day badge.
//
// Subtracting the two Dates directly would be off by an hour across a DST
// boundary and floor to the wrong day; comparing UTC-normalised midnights isn't
// affected because both sides shift together.
export function daysUntil(from, to) {
  const a = parseYmd(from);
  const b = parseYmd(to);
  const ms =
    Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
    Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.round(ms / 86400000);
}

// Repeat-interval arithmetic for schedules (03_DB_Design repeatIntervalType).
//
// Month and year steps clamp to the end of the target month instead of rolling
// over: a "매월 31일" heartworm dose lands on 2월 28일, not 3월 3일. Date's own
// setMonth does the rollover, which would silently move the schedule past the
// month the user meant.
export function addInterval(dateStr, type, value) {
  const d = parseYmd(dateStr);
  const n = Number(value) || 0;

  if (type === 'day') return ymd(d.getFullYear(), d.getMonth(), d.getDate() + n);
  if (type === 'week') return ymd(d.getFullYear(), d.getMonth(), d.getDate() + n * 7);

  const months = type === 'year' ? n * 12 : n;
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return ymd(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), lastDay));
}

// A month laid out as 6 rows of 7, holding date strings (null = leading or
// trailing blank). Rows hold dates rather than day numbers because a week can
// straddle two months, which a bare number can't express — the calendar's week
// view and the record-date picker both need that.
export function monthRows(year, month) {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(ymd(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

// The Sunday-to-Saturday week holding `dateStr` — one row, never blank.
export function weekRows(dateStr) {
  const d = parseYmd(dateStr);
  const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  return [
    Array.from({ length: 7 }, (_, i) =>
      ymd(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i)
    ),
  ];
}

// Home header: "7월 22일 수"
export function formatHeader(str) {
  const d = parseYmd(str);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}`;
}

// Calendar day panel: "7월 22일 (수)"
export function formatDay(str) {
  const d = parseYmd(str);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

// True only for a real calendar day. The round-trip check rejects rollovers
// like '2026-02-31', which Date happily turns into March 3.
export function isValidYmd(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = parseYmd(str);
  return !isNaN(d.getTime()) && toYmd(d) === str;
}

// Measurement stamp: "2026. 7. 22"
export function formatDot(str) {
  const d = parseYmd(str);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
}
