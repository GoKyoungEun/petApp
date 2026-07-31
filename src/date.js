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
