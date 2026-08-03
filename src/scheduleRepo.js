// 건강 일정 데이터 접근 계층 — recordRepo·petRepo와 같은 계약
// (03_DB_Design "Schedule"). 백킹은 Supabase, 소유권은 RLS가 정하므로 조회에
// user_id 조건을 넣지 않는다.
//
// 일정은 "앞으로 할 일"이고 기록은 "이미 한 일"이라 테이블이 나뉘어 있다
// (03_DB_Design "일정과 기록의 관계"). 완료했을 때 medical_records 행을 만들어
// linked_record_id로 잇는 단계는 아직 없다 — 09_Todo 우선순위 3.

import { supabase } from './supabase';
import { scheduleMapper } from './db';
import { addInterval } from './date';

const TABLE = 'schedules';

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

const hasRepeat = (s) => !!s?.repeatIntervalType && Number(s?.repeatIntervalValue) > 0;

async function readOne(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(scheduleMapper.select)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? scheduleMapper.toApp(data) : null;
}

export const scheduleRepo = {
  // 예정일 오름차순 — 일정 탭이 예정·지난으로 가르고 각각 가까운 순으로 낸다.
  async listByPet(petId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(scheduleMapper.select)
      .eq('pet_id', petId)
      .order('scheduled_date', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => scheduleMapper.toApp(row));
  },

  async add(data) {
    const { data: row, error } = await supabase
      .from(TABLE)
      .insert({ ...scheduleMapper.toRow(data), pet_id: data.petId })
      .select(scheduleMapper.select)
      .single();
    if (error) throw error;
    return scheduleMapper.toApp(row);
  },

  async update(id, patch) {
    const { data, error } = await supabase
      .from(TABLE)
      .update(scheduleMapper.toRow(patch))
      .eq('id', id)
      .select(scheduleMapper.select)
      .single();
    if (error) throw error;
    return scheduleMapper.toApp(data);
  },

  async remove(id) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },

  // 완료 처리 — 상태를 바꾸고, 반복 주기가 있으면 다음 일정을 만든다
  // (03_DB_Design "일정 완료 시" 2·4단계).
  //
  // 실행취소가 되돌려야 할 것을 그대로 돌려준다: 이전 상태와, 이번에 새로 만든
  // 일정의 id. 이 둘이 없으면 되돌릴 때 "완료 전이 planned였는지 missed였는지"와
  // "어느 일정이 자동 생성분인지"를 알 수 없다.
  async complete(id) {
    const current = await readOne(id);
    if (!current) return null;

    await this.update(id, { status: 'completed' });

    let nextId = null;
    if (hasRepeat(current)) {
      const next = await this.add({
        petId: current.petId,
        scheduleType: current.scheduleType,
        customTypeName: current.customTypeName,
        scheduledDate: addInterval(
          current.scheduledDate,
          current.repeatIntervalType,
          current.repeatIntervalValue
        ),
        status: 'planned',
        hospitalName: current.hospitalName,
        productName: current.productName,
        memo: current.memo,
        repeatIntervalType: current.repeatIntervalType,
        repeatIntervalValue: current.repeatIntervalValue,
        notificationSetting: current.notificationSetting,
      });
      nextId = next.id;
    }

    return { previousStatus: current.status, nextId };
  },

  async uncomplete(id, previousStatus, nextId) {
    // 자동 생성분을 먼저 지운다. 순서가 반대면 상태만 되돌아가고 다음 일정이
    // 남는 중간 상태가 화면에 잠깐 보인다.
    if (nextId) await this.remove(nextId);
    await this.update(id, { status: previousStatus || 'planned' });
  },
};
