// 회원 탈퇴 — 계정과 그 계정의 모든 데이터를 지운다.
//
// 순서가 중요하다. **Storage를 먼저, 그다음 표, 마지막에 계정**이다. 계정을
// 먼저 지우면 RLS가 곧바로 나머지를 막아 버려서 남은 데이터에 손이 닿지 않는다.
//
// 표를 cascade에 맡기지 않고 하나씩 지우는 이유: 서버의 외래키 설정을 앱에서
// 확인할 방법이 없다. `supabase/schema.sql`은 서버의 사본일 뿐이고 실제로 한 번
// 어긋난 적이 있다(schedules.linked_record_id — 09_Todo). 명시적으로 지우면
// 설정이 어떻든 결과가 같다.
//
// 중간에 실패하면 지운 데까지는 되돌릴 수 없다. 그래서 지우는 순서를 "덜
// 중요한 것부터"로 잡았다 — 사진, 완료 기록, 일정, 기록, 펫, 계정. 어디서
// 멈추든 남은 것은 계정과 그 아래 데이터라 다시 로그인해 이어서 지울 수 있다.

import { supabase } from './supabase';
import { currentUserId } from './auth';
import { petRepo } from './petRepo';
import { recordRepo } from './repository';

const BUCKET = 'record-photos';

// 이 계정이 올린 사진을 전부 찾는다. DB의 경로 목록을 믿지 않고 Storage를 직접
// 훑는 이유: 업로드는 됐는데 행 저장이 실패해 떠 있는 파일이 있을 수 있다.
// 탈퇴는 "이 사람 것을 남기지 않는다"가 목적이라 그런 것까지 걷어야 한다.
async function listAllPhotos(userId) {
  const paths = [];

  const listDir = async (prefix) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 1000 });
    if (error || !data) return;
    for (const entry of data) {
      const full = `${prefix}/${entry.name}`;
      // id가 없으면 파일이 아니라 폴더다 — 한 겹 더 들어간다.
      if (entry.id) paths.push(full);
      else await listDir(full);
    }
  };

  await listDir(userId);
  return paths;
}

export async function deleteAccount() {
  const userId = await currentUserId();

  // 0. 마지막 단계가 될지 먼저 확인한다.
  //
  // 계정 삭제 함수는 대시보드에서 따로 만들어야 하는데(anon key로는 auth.users를
  // 못 지운다), 그걸 빠뜨린 채 탈퇴를 누르면 아래에서 데이터만 지워지고 계정이
  // 남는다. 실제로 한 번 그렇게 기록을 날렸다. 아무것도 지우기 전에 찔러 본다.
  const { error: probeError } = await supabase.rpc('delete_current_user', { dry_run: true });
  if (probeError) {
    if (probeError.code === 'PGRST202') {
      throw new Error(
        '서버에 계정 삭제 함수가 없습니다. supabase/schema.sql "회원 탈퇴"를 ' +
          'SQL 편집기에서 실행한 뒤 다시 시도해 주세요. (데이터는 그대로입니다)'
      );
    }
    throw probeError;
  }

  // 1. 사진. 계정을 지운 뒤에는 Storage 정책이 막아 손댈 수 없다.
  const photos = await listAllPhotos(userId);
  if (photos.length) {
    // remove는 한 번에 받는 개수에 한계가 있어 나눠 보낸다.
    for (let i = 0; i < photos.length; i += 100) {
      await supabase.storage.from(BUCKET).remove(photos.slice(i, i + 100));
    }
  }

  // 2. 표. 참조하는 쪽부터 — medical_records가 schedules를, health_records가
  //    pets를 가리킨다.
  const pets = await petRepo.list();
  for (const pet of pets) {
    await supabase.from('medical_records').delete().eq('pet_id', pet.id);
    await supabase.from('schedules').delete().eq('pet_id', pet.id);
    // 기록은 사진 경로도 들고 있지만 파일은 위에서 이미 지웠다.
    await recordRepo.removeByPet(pet.id);
  }
  const { error: petError } = await supabase
    .from('pets')
    .delete()
    .eq('user_id', userId);
  if (petError) throw petError;

  // 3. 계정. 0단계에서 이미 확인한 함수라 여기서 없을 리는 없다.
  const { error } = await supabase.rpc('delete_current_user', { dry_run: false });
  if (error) throw error;

  // 세션 정리. 계정이 사라졌으므로 서버 호출은 실패할 수 있다 — 로컬만 비운다.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}
