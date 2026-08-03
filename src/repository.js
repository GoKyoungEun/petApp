// 기록 데이터 접근 계층. 화면과 store는 **여기**를 부른다 — supabase를 직접
// 만지지 않는다. 화면은 그중에서도 TanStack Query 훅(src/queries/records.js)을
// 거친다.
//
// 기록은 이벤트 기반 HealthRecord 형태다(03_DB_Design):
//   { id, petId, recordType, recordDate, data, memo, createdAt, updatedAt }
// recordType: meal | stool | urine | vomit | walk | condition | weight |
//             healthPhoto | medicalRecord | note
// `data`에는 유형별 필드가 들어간다 (state / minutes / kg / level / symptoms /
// category / photos).
//
// 백킹은 Supabase(PostgREST)다. 인터페이스가 async라 화면 코드는 백킹이 바뀌어도
// 그대로다 — 2026-07-30 교체 때 실제로 한 줄도 바뀌지 않았다(08_TechStack).
//
// 조회에 user_id 조건을 넣지 않는다. 소유권은 RLS가 정한다(supabase/schema.sql).
// 캐시도 두지 않는다 — Query 하나로 통일했다(src/queryClient.js).

import { supabase } from './supabase';
import { recordMapper } from './db';
import { currentUserId } from './auth';
import { saveRecordPhotos, signPaths, removePaths } from './photoStore';

const TABLE = 'health_records';

// 03_DB_Design "사진 제한" — 6장이면 전체 기록보기의 3열 격자에 2행으로
// 떨어진다 (2026-07-29에 5→6, 11_ChangeLog).
export const MAX_PHOTOS = 6;

// 한 펫의 기록을 한 번에 읽는 상한. 통계·몸무게 화면이 기간 전체를 훑기 때문에
// 페이지네이션 없이 가고 있다. 넘으면 조용히 잘리므로 09_Todo에 남겨 뒀다.
const MAX_ROWS = 5000;

const photosOf = (rec) => rec?.data?.photos ?? [];

// DB에는 Storage 경로가 들어 있다. 화면은 <Image source={{uri}}>에 그대로 넣을
// 수 있는 값을 원하므로 서명 URL로 바꿔서 넘긴다.
//
// 목록 전체의 경로를 모아 한 번에 서명한다 — 기록 하나마다 부르면 전체
// 기록보기 한 화면에 수십 번의 왕복이 생긴다.
async function signRecords(records) {
  const flat = records.flatMap(photosOf);
  if (!flat.length) return records;

  const urls = await signPaths(flat);
  // 길이가 어긋나면 어느 사진이 어느 기록 것인지 알 수 없다. 잘못 붙이느니
  // 경로 그대로 두는 편이 낫다(개수 표시는 살아 있다).
  if (urls.length !== flat.length) return records;

  let i = 0;
  return records.map((rec) => {
    const photos = photosOf(rec);
    if (!photos.length) return rec;
    return { ...rec, data: { ...rec.data, photos: photos.map(() => urls[i++]) } };
  });
}

async function signRecord(record) {
  const [signed] = await signRecords([record]);
  return signed;
}

function rowsToApp(rows) {
  return (rows ?? []).map((row) => recordMapper.toApp(row));
}

async function readOne(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(recordMapper.select)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? recordMapper.toApp(data) : null;
}

export const recordRepo = {
  async add({ petId, recordType, recordDate, data = {}, memo = null }) {
    const { photos, ...rest } = data;

    // 사진 경로에 record_id가 들어가서(08_TechStack "이미지 저장") 행을 먼저
    // 만들어야 한다. 그래서 사진이 있는 기록은 insert → 업로드 → update 순이다.
    const { data: row, error } = await supabase
      .from(TABLE)
      .insert({
        pet_id: petId,
        record_type: recordType,
        record_date: recordDate,
        data: rest,
        memo,
      })
      .select(recordMapper.select)
      .single();
    if (error) throw error;

    if (!photos?.length) return recordMapper.toApp(row);

    try {
      const userId = await currentUserId();
      const paths = await saveRecordPhotos(userId, row.id, photos);
      const { data: updated, error: updateError } = await supabase
        .from(TABLE)
        .update({ data: { ...rest, photos: paths } })
        .eq('id', row.id)
        .select(recordMapper.select)
        .single();
      if (updateError) throw updateError;
      return signRecord(recordMapper.toApp(updated));
    } catch (e) {
      // 사진 없는 건강사진 기록이 남으면 사용자가 고칠 방법이 없다. 만들다 만
      // 행을 걷어 내고 실패를 그대로 올려, 시트가 열린 채 메시지를 띄우게 한다.
      await supabase.from(TABLE).delete().eq('id', row.id);
      throw e;
    }
  },

  // 홈 "오늘 기록"과 캘린더 날짜 패널. 등록순으로 준다 — 컨디션·몸무게 요약이
  // "마지막 기록"을 배열 끝에서 읽는다(store.js summarizeType).
  async listByDate(petId, recordDate) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(recordMapper.select)
      .eq('pet_id', petId)
      .eq('record_date', recordDate)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return signRecords(rowsToApp(data));
  },

  // 전체 기록보기의 항목 탭 — 최신 날짜가 위다.
  async listByType(petId, recordType) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(recordMapper.select)
      .eq('pet_id', petId)
      .eq('record_type', recordType)
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS);
    if (error) throw error;
    return signRecords(rowsToApp(data));
  },

  // 한 기간의 모든 유형 — 통계 화면이 카드 여섯 장을 이 한 번의 조회로 만든다.
  //
  // 사진 서명 URL을 만들지 않는다. 통계는 사진을 쓰지 않는데, 1년치를 읽으면
  // 수백 장에 서명하느라 왕복만 늘어난다(08_TechStack "이미지 저장").
  async listByRange(petId, from, to) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(recordMapper.select)
      .eq('pet_id', petId)
      .gte('record_date', from)
      .lte('record_date', to)
      .order('record_date', { ascending: true })
      .limit(MAX_ROWS);
    if (error) throw error;
    return rowsToApp(data);
  },

  async update(id, patch) {
    const current = await readOne(id);
    if (!current) return null;

    const next = { ...patch };

    if (patch.data) {
      // 기존 동작 그대로 병합한다 — 수정 시트는 건드린 필드만 보낸다.
      const merged = { ...(current.data ?? {}), ...patch.data };

      if (patch.data.photos) {
        const userId = await currentUserId();
        // 그대로 둔 사진은 서명 URL로 돌아온다 → 경로로 환원되고, 새로 고른
        // 사진(data URI)만 실제로 올라간다.
        const kept = await saveRecordPhotos(userId, id, patch.data.photos);
        const removed = photosOf(current).filter((p) => !kept.includes(p));
        merged.photos = kept;
        await removePaths(removed);
      }
      next.data = merged;
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update(recordMapper.toRow(next))
      .eq('id', id)
      .select(recordMapper.select)
      .single();
    if (error) throw error;
    return signRecord(recordMapper.toApp(data));
  },

  async remove(id) {
    const current = await readOne(id);
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
    // DB는 cascade가 있지만 Storage는 없다 — 행을 지웠으면 파일도 걷는다.
    if (current) await removePaths(photosOf(current));
  },

  // 기록이 하나 이상 있는 날짜(YYYY-MM-DD) — 캘린더 마커.
  // PostgREST에 distinct가 없어 날짜 컬럼만 받아 앱에서 추린다.
  async datesWithRecords(petId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('record_date')
      .eq('pet_id', petId)
      .limit(MAX_ROWS);
    if (error) throw error;
    return [...new Set((data ?? []).map((r) => r.record_date))];
  },

  // 펫을 지우기 **전에** 부른다. 행은 pets의 cascade로도 지워지지만, 그러면
  // 사진 경로를 읽을 기회가 사라져 Storage에 파일만 남는다(store.js removePet).
  async removeByPet(petId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(recordMapper.select)
      .eq('pet_id', petId)
      .limit(MAX_ROWS);
    if (error) throw error;

    const records = rowsToApp(data);
    if (!records.length) return;

    const { error: deleteError } = await supabase.from(TABLE).delete().eq('pet_id', petId);
    if (deleteError) throw deleteError;

    await removePaths(records.flatMap(photosOf));
  },
};
