// 통계 집계 — 05_UI_UX "통계 화면"의 카드 여섯 장을 만드는 계산.
//
// 화면에서 떼어 낸 순수 함수로 둔다. 집계는 눈으로 봐서 맞는지 알기 어렵고
// (평균의 분모, 빈 구간, 소수점), 화면 안에 있으면 확인하려면 로그인부터 해야
// 한다. 여기 있으면 값만 넣어 바로 돌려볼 수 있다.
//
// 서버 집계로 옮기는 건 사용량이 늘 때 검토한다(08_TechStack "통계").

import { daysUntil } from './date';

// 한 자리까지만 — "2.7회"면 충분하고 "2.6666회"는 읽는 데 방해만 된다.
const round1 = (n) => Math.round(n * 10) / 10;

// 기간에 포함된 날짜 수. 양끝을 모두 센다(7일 필터면 오늘 포함 7일).
export const daysInRange = (from, to) => daysUntil(from, to) + 1;

const ofType = (records, type) => records.filter((r) => r.recordType === type);

// "가장 최근"을 배열 순서로 판단하지 않는다. 기간 조회는 오름차순, 항목별
// 조회는 내림차순으로 주기 때문에(repository.js), 순서를 믿으면 어느 쪽으로
// 불렀느냐에 따라 값이 조용히 뒤집힌다. 같은 날 여러 건이면 만든 시각으로 가른다.
const byDateAsc = (a, b) => {
  if (a.recordDate !== b.recordDate) return a.recordDate < b.recordDate ? -1 : 1;
  return String(a.createdAt ?? '') < String(b.createdAt ?? '') ? -1 : 1;
};

// 1. 기록한 날짜 수 — 유형과 무관하게 기록이 하나라도 있는 날을 센다.
// 무엇을 적었는지가 아니라 "적었는가"를 보는 카드라서다.
export function recordedDays(records, from, to) {
  const total = daysInRange(from, to);
  const days = new Set(records.map((r) => r.recordDate)).size;
  return { days, total, ratio: total > 0 ? days / total : 0 };
}

// 2. 컨디션 변화 — 상태별 횟수와 비율, 그리고 가장 최근 상태.
export const CONDITION_LEVELS = ['좋아요', '보통', '안 좋아요'];

export function conditionStats(records) {
  const list = ofType(records, 'condition');
  const counts = Object.fromEntries(CONDITION_LEVELS.map((l) => [l, 0]));
  for (const r of list) {
    const level = r.data?.level;
    if (level in counts) counts[level] += 1;
  }
  const total = list.length;
  return {
    total,
    counts,
    ratios: Object.fromEntries(
      CONDITION_LEVELS.map((l) => [l, total > 0 ? counts[l] / total : 0])
    ),
    latest: [...list].sort(byDateAsc).pop()?.data?.level ?? null,
  };
}

// 3. 배변 상태 및 횟수 — 상태 분류는 빠른 기록 시트의 세 갈래를 그대로 쓴다.
export const STOOL_STATES = ['정상', '설사', '색 이상'];

export function stoolStats(records, from, to) {
  const list = ofType(records, 'stool');
  const counts = Object.fromEntries(STOOL_STATES.map((s) => [s, 0]));
  for (const r of list) {
    const state = r.data?.state;
    if (state in counts) counts[state] += 1;
  }
  return {
    total: list.length,
    counts,
    perDay: round1(list.length / daysInRange(from, to)),
  };
}

// 4. 소변 횟수 — 상태 구분 없이 횟수만 본다(빠른 기록도 "지금 다녀왔어요" 하나뿐).
export function urineStats(records, from, to) {
  const list = ofType(records, 'urine');
  return {
    total: list.length,
    perDay: round1(list.length / daysInRange(from, to)),
  };
}

// 5. 산책 횟수 및 총시간. 회당 평균의 분모는 기간이 아니라 산책 횟수다 —
// 안 나간 날까지 나누면 "한 번에 얼마나 걷나"를 알 수 없다.
export function walkStats(records) {
  const list = ofType(records, 'walk');
  const minutes = list.reduce((sum, r) => sum + (Number(r.data?.minutes) || 0), 0);
  return {
    count: list.length,
    minutes,
    perWalk: list.length > 0 ? Math.round(minutes / list.length) : 0,
  };
}

// 6. 몸무게 변화 — 기간 안의 측정값들과 처음→마지막 변화량.
// 점이 하나뿐이면 변화를 그릴 수 없어 그래프 대신 안내를 띄운다(05_UI_UX).
export function weightStats(records) {
  const points = ofType(records, 'weight')
    .sort(byDateAsc)
    .map((r) => ({ date: r.recordDate, kg: Number(r.data?.kg) }))
    .filter((p) => Number.isFinite(p.kg));

  if (points.length === 0) return { points: [], latest: null, change: null };

  const first = points[0].kg;
  const last = points[points.length - 1].kg;
  return {
    points,
    latest: last,
    // 점이 하나면 비교 대상이 없다 — 0이 아니라 null이어야 "변화 없음"과 구분된다.
    change: points.length >= 2 ? round1(last - first) : null,
  };
}
