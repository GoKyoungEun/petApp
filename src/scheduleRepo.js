// 건강 일정 데이터 접근 계층 — recordRepo·petRepo와 같은 계약
// (03_DB_Design "Schedule"). 백킹은 Supabase, 소유권은 RLS가 정하므로 조회에
// user_id 조건을 넣지 않는다.
//
// 일정은 "앞으로 할 일"이고 기록은 "이미 한 일"이라 테이블이 나뉘어 있다
// (03_DB_Design "일정과 기록의 관계"). 완료하면 medical_records 행을 만들고
// linked_record_id로 잇는다 — 아래 complete().

import { supabase } from './supabase';
import { scheduleMapper } from './db';
import { medicalRepo } from './medicalRepo';
import { addInterval } from './date';

const TABLE = 'schedules';

// 종류·라벨 같은 표현은 `src/schedules.js`에 있다 — 여기 두면
// medicalRepo와 순환 참조가 된다.

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

  // 완료 처리 — 03_DB_Design "일정 완료 시" 네 단계를 모두 한다:
  // ① 완료 기록 생성 ② 상태 완료 ③ scheduleId로 연결 ④ 반복이면 다음 일정.
  // ③은 ①에서 넣는 medical_records.schedule_id다.
  //
  // `actual`은 완료 시트가 확인받은 "실제로 한 일"이다(시행일·병원·제품·메모).
  // 일정에 적힌 계획값을 그대로 복사하지 않는 이유는, 계획과 실제가 어긋나는
  // 것이 MedicalRecord를 따로 두는 이유 자체이기 때문이다.
  //
  // 실행취소가 되돌려야 할 것을 그대로 돌려준다: 이전 상태, 이번에 만든 완료
  // 기록의 id, 자동 생성한 다음 일정의 id. 이것들이 없으면 되돌릴 때 "완료 전이
  // planned였는지 missed였는지"와 "어느 행이 이번에 생긴 것인지"를 알 수 없다.
  async complete(id, actual = {}) {
    const current = await readOne(id);
    if (!current) return null;

    const medical = await medicalRepo.add({
      petId: current.petId,
      scheduleId: current.id,
      // 직접 입력 일정은 이름이 곧 종류다 — 그러지 않으면 목록에 'custom'만 남는다.
      medicalType:
        current.scheduleType === 'custom'
          ? current.customTypeName || 'custom'
          : current.scheduleType,
      executedDate: actual.executedDate || current.scheduledDate,
      hospitalName: actual.hospitalName ?? current.hospitalName,
      productName: actual.productName ?? current.productName,
      memo: actual.memo ?? current.memo,
    });

    // 여기부터 실패하면 앞 단계만 남는다 — 일정은 예정인데 "했다"는 기록이 따로
    // 떠 있거나, 완료는 됐는데 다음 일정이 없거나. 되감아 없던 일로 만든다.
    // 트랜잭션이 없어서(PostgREST) 손으로 정리하는 수밖에 없다.
    try {
      // linked_record_id는 건드리지 않는다. 3단계의 "scheduleId로 연결"은 위에서
      // 넣은 medical_records.schedule_id이고, linked_record_id는 그 반대 방향
      // 포인터라 없어도 연결이 성립한다. 실제로 넣으면 서버의 외래키가 거부한다
      // (schedules_linked_record_id_fkey) — 그 제약이 medical_records를 가리키지
      // 않는다는 뜻이다. supabase/schema.sql의 해당 제약은 서버와 다르다.
      await this.update(id, { status: 'completed' });
    } catch (e) {
      await medicalRepo.remove(medical.id).catch(() => {});
      throw e;
    }

    let nextId = null;
    try {
      nextId = await createNext(this, current);
    } catch (e) {
      await this.update(id, { status: current.status }).catch(() => {});
      await medicalRepo.remove(medical.id).catch(() => {});
      throw e;
    }

    return { previousStatus: current.status, medicalId: medical.id, nextId };
  },

  async uncomplete(id, { previousStatus, medicalId, nextId } = {}) {
    // 새로 생긴 것들을 먼저 지운다. 순서가 반대면 상태만 되돌아가고 완료 기록과
    // 다음 일정이 남는 중간 상태가 화면에 잠깐 보인다.
    if (nextId) await this.remove(nextId);
    await this.update(id, { status: previousStatus || 'planned' });
    if (medicalId) await medicalRepo.remove(medicalId);
  },
};

// 반복 주기가 있으면 다음 일정을 만든다(03_DB_Design "일정 완료 시" 4단계).
// 없으면 null.
async function createNext(repo, current) {
  if (!hasRepeat(current)) return null;
  const next = await repo.add({
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
  return next.id;
}
