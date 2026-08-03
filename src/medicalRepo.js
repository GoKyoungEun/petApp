// 완료 기록(MedicalRecord) 데이터 접근 계층 — 03_DB_Design "MedicalRecord".
//
// 일정이 "앞으로 할 일"이라면 이건 "실제로 한 일"이다. 둘을 나눠 두는 이유는
// 계획과 실제가 어긋나기 때문이다 — 3일 늦게 갔거나, 다른 병원에 갔거나,
// 계획 없이 그냥 다녀왔거나. `scheduleId`가 null이면 마지막 경우다.
//
// 백킹은 Supabase. 소유권은 RLS가 정하므로 조회에 user_id 조건을 넣지 않는다.

import { supabase } from './supabase';
import { medicalMapper } from './db';

const TABLE = 'medical_records';

export const medicalRepo = {
  // 최근에 한 일이 위로. 일정 탭의 "완료 기록" 섹션이 이 순서로 낸다.
  async listByPet(petId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(medicalMapper.select)
      .eq('pet_id', petId)
      .order('executed_date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => medicalMapper.toApp(row));
  },

  async add(data) {
    const { data: row, error } = await supabase
      .from(TABLE)
      .insert({ ...medicalMapper.toRow(data), pet_id: data.petId })
      .select(medicalMapper.select)
      .single();
    if (error) throw error;
    return medicalMapper.toApp(row);
  },

  async update(id, patch) {
    const { data, error } = await supabase
      .from(TABLE)
      .update(medicalMapper.toRow(patch))
      .eq('id', id)
      .select(medicalMapper.select)
      .single();
    if (error) throw error;
    return medicalMapper.toApp(data);
  },

  async remove(id) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },
};
