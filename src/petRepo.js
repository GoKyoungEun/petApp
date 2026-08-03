// 반려동물 데이터 접근 계층 — recordRepo와 같은 계약(03_DB_Design "Pet").
// 백킹은 Supabase. 소유권은 RLS가 정하므로 조회에 user_id 조건을 넣지 않는다.
//
// 로컬(AsyncStorage)에 남는 것은 "선택된 펫" 하나뿐이다. 이건 서버에 둘 이유가
// 없는 기기별 UI 상태다 — 폰에서 보던 펫과 태블릿에서 보던 펫이 달라도 된다.
// 계정이 바뀌면 다른 값이어야 하므로 키에 user_id를 붙인다(08_TechStack).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { petMapper } from './db';
import { currentUserId } from './auth';
import { savePetPhoto, signPath, removePaths } from './photoStore';

const TABLE = 'pets';
const selectedKey = (userId) => `petapp:selectedPet:${userId}`;

// photo_url에는 Storage 경로가 들어 있다 — 화면에 넘기기 전에 서명 URL로 바꾼다.
async function signPet(pet) {
  if (!pet?.photoUrl) return pet;
  return { ...pet, photoUrl: (await signPath(pet.photoUrl)) ?? pet.photoUrl };
}

export const petRepo = {
  // 계정의 반려동물(최대 5마리 — 02_MVP_Requirement §2, 상한은 화면이 막는다).
  // 등록순 고정: 펫 전환 메뉴의 순서가 조회할 때마다 바뀌면 안 된다.
  async list() {
    const { data, error } = await supabase
      .from(TABLE)
      .select(petMapper.select)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return Promise.all((data ?? []).map((row) => signPet(petMapper.toApp(row))));
  },

  async get(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(petMapper.select)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? signPet(petMapper.toApp(data)) : null;
  },

  async add(data) {
    // user_id는 쓰기에서만 세션을 읽는 두 곳 중 하나다(다른 하나는 Storage 경로).
    const userId = await currentUserId();

    // 사진 경로에 pet_id가 들어가서 행을 먼저 만든다 — recordRepo.add와 같은 이유.
    const { photoUrl, ...rest } = data;
    const { data: row, error } = await supabase
      .from(TABLE)
      .insert({ ...petMapper.toRow(rest), user_id: userId })
      .select(petMapper.select)
      .single();
    if (error) throw error;

    if (!photoUrl) return petMapper.toApp(row);

    try {
      const path = await savePetPhoto(userId, row.id, photoUrl);
      const { data: updated, error: updateError } = await supabase
        .from(TABLE)
        .update({ photo_url: path })
        .eq('id', row.id)
        .select(petMapper.select)
        .single();
      if (updateError) throw updateError;
      return signPet(petMapper.toApp(updated));
    } catch (e) {
      // 사진만 실패했다고 등록을 통째로 되돌리지는 않는다 — 이름·종·생일은
      // 사용자가 방금 입력한 것이고, 사진은 수정에서 다시 넣으면 된다.
      return petMapper.toApp(row);
    }
  },

  async update(id, patch) {
    const next = { ...patch };

    if (patch.photoUrl !== undefined) {
      const userId = await currentUserId();
      const before = (await this.get(id))?.photoUrl;
      next.photoUrl = await savePetPhoto(userId, id, patch.photoUrl);
      // get()이 서명 URL을 돌려주므로 removePaths가 경로로 환원해 비교한다.
      if (before && next.photoUrl !== before) await removePaths([before]);
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update(petMapper.toRow(next))
      .eq('id', id)
      .select(petMapper.select)
      .single();
    if (error) throw error;
    return signPet(petMapper.toApp(data));
  },

  async remove(id) {
    const pet = await this.get(id);
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
    if (pet?.photoUrl) await removePaths([pet.photoUrl]);
  },

  // --- 선택된 펫 (기기 로컬) ------------------------------------------------
  //
  // 실패해도 던지지 않는다. 선택 복원은 편의 기능이라, 못 읽으면 첫 번째 펫으로
  // 여는 것으로 충분하다(store.js).

  async getSelectedId() {
    try {
      return await AsyncStorage.getItem(selectedKey(await currentUserId()));
    } catch (e) {
      return null;
    }
  },

  async setSelectedId(id) {
    try {
      const key = selectedKey(await currentUserId());
      if (id) await AsyncStorage.setItem(key, id);
      else await AsyncStorage.removeItem(key);
    } catch (e) {
      // 비필수
    }
  },
};
