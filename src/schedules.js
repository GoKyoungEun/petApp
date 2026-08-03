// 일정·완료 기록의 표현용 상수와 라벨 — `src/pets.js`와 같은 자리다.
//
// repo에 두지 않는 이유는 순환 참조 때문이다: scheduleRepo가 완료 기록을
// 만들려면 medicalRepo를 부르고, medicalRepo는 종류 라벨이 필요하다. 표현을
// 양쪽 바깥으로 빼면 그 고리가 생기지 않는다.

// 03_DB_Design "Schedule" scheduleType
export const SCHEDULE_TYPES = [
  { key: 'vaccination', label: '예방접종', icon: 'vaccine' },
  { key: 'heartworm', label: '심장사상충', icon: 'schedule-heartworm' },
  { key: 'deworming', label: '구충', icon: 'pill' },
  { key: 'healthCheck', label: '건강검진', icon: 'schedule-checkup' },
  { key: 'hospitalVisit', label: '병원 방문', icon: 'hospital' },
  { key: 'custom', label: '직접 입력', icon: 'schedule-custom' },
];

export const REPEAT_TYPES = [
  { key: 'month', label: '개월' },
  { key: 'week', label: '주' },
  { key: 'day', label: '일' },
  { key: 'year', label: '년' },
];

export function scheduleTitle(schedule) {
  if (schedule?.scheduleType === 'custom') return schedule.customTypeName || '일정';
  return SCHEDULE_TYPES.find((t) => t.key === schedule?.scheduleType)?.label || '일정';
}

export function scheduleIcon(schedule) {
  return SCHEDULE_TYPES.find((t) => t.key === schedule?.scheduleType)?.icon || 'calendar';
}

// medicalType에는 일정 종류 키(vaccination 등)가 들어가고, 직접 입력 일정에서
// 온 것은 사용자가 적은 이름이 그대로 들어간다. 키면 라벨로 바꾸고 아니면
// 적힌 그대로 낸다 — 그러지 않으면 목록에 'vaccination'이 그대로 보인다.
export function medicalTypeLabel(medicalType) {
  const known = SCHEDULE_TYPES.find((t) => t.key === medicalType);
  return known ? known.label : medicalType || '기록';
}

export function medicalTypeIcon(medicalType) {
  return SCHEDULE_TYPES.find((t) => t.key === medicalType)?.icon || 'hospital';
}
