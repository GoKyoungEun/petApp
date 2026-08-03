// 사진 저장 — Supabase Storage `record-photos`(비공개) 담당.
//
// 화면은 사진을 URI 문자열 배열로만 다룬다(<Image source={{uri}}>). DB에는
// URL이 아니라 **경로**를 넣고, 읽을 때 서명 URL로 바꿔 넘긴다. 그래서 이
// 파일이 하는 일은 결국 두 방향의 변환이다:
//
//   저장: data URI(새 사진) → 업로드 → 경로 / 서명 URL(그대로 둔 사진) → 경로
//   조회: 경로 → 서명 URL(24시간)
//
// base64를 jsonb에 그대로 넣지 않는 이유는 08_TechStack "이미지 저장" 참고 —
// 기록당 6장이면 "펫 전체 기록"을 읽는 통계·몸무게 화면이 매번 수 MB를 끈다.

import { supabase } from './supabase';

const BUCKET = 'record-photos';

// 서명 URL 수명. 화면을 열어 둔 채 하루를 넘기는 경우는 사실상 없고, 다음
// 조회에서 새로 발급된다.
const SIGN_TTL_SECONDS = 60 * 60 * 24;

const SIGN_MARKER = `/object/sign/${BUCKET}/`;

// ---------------------------------------------------------------------------
// base64 → 바이트
//
// Hermes에는 atob이 없다. 업로드 본문으로 Blob/FormData 대신 Uint8Array를 쓰는
// 것도 같은 이유로, 셋 중 플랫폼 차이가 가장 적다(08_TechStack).
// ---------------------------------------------------------------------------

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(128);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;

function base64ToBytes(base64) {
  // 패딩(=)과 줄바꿈을 털어 낸다. 남은 글자 수 × 6비트가 곧 데이터 길이다.
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));

  let bits = 0;
  let bitCount = 0;
  let out = 0;
  for (let i = 0; i < clean.length; i++) {
    bits = (bits << 6) | LOOKUP[clean.charCodeAt(i)];
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes[out++] = (bits >> bitCount) & 0xff;
    }
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// 값 판별
// ---------------------------------------------------------------------------

const isNewPhoto = (v) => typeof v === 'string' && v.startsWith('data:');

// 수정 시트는 화면에 띄웠던 값을 그대로 되돌려 준다 — 그중 그대로 둔 사진은
// 서명 URL이다. 저장할 때 경로로 환원한다.
//
// 여기 걸리는 값은 세 가지뿐이어야 한다: 우리 서명 URL, 이미 경로, 그리고
// 아무것도 아닌 것. 마지막은 버린다 — 압축이 실패했을 때 photo.js가 원본
// `file://` URI를 그대로 돌려주는 경로가 있는데(폰 안에서만 유효한 주소다),
// 그걸 DB에 넣으면 다른 기기에서 깨진 사진으로 남는다. 사진 한 장을 잃는 대신
// 못 쓰는 값이 서버에 남지 않게 한다.
function toPath(value) {
  if (typeof value !== 'string' || !value) return null;

  const i = value.indexOf(SIGN_MARKER);
  if (i >= 0) return decodeURIComponent(value.slice(i + SIGN_MARKER.length).split('?')[0]);

  // 경로에는 scheme이 없다 — {user_id}/{record_id}/{시각}-{n}.jpg
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;

  return value;
}

// ---------------------------------------------------------------------------
// 업로드
// ---------------------------------------------------------------------------

async function upload(path, dataUri) {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, base64ToBytes(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

// 기록 사진. 경로는 {user_id}/{record_id}/{시각}-{n}.jpg — 첫 폴더가 소유자
// 검증 기준이다(schema.sql의 storage 정책).
//
// 배열 순서가 곧 표시 순서라(03_DB_Design "사진 제한") 순서를 지켜 돌려준다.
// 이미 올라가 있는 사진은 다시 올리지 않는다.
export async function saveRecordPhotos(userId, recordId, photos) {
  if (!photos?.length) return [];
  const stamp = Date.now();
  const out = [];
  for (let i = 0; i < photos.length; i++) {
    const value = photos[i];
    if (isNewPhoto(value)) {
      out.push(await upload(`${userId}/${recordId}/${stamp}-${i}.jpg`, value));
    } else {
      const path = toPath(value);
      if (path) out.push(path);
    }
  }
  return out;
}

// 반려동물 사진 — 한 장뿐이라 경로에 시각을 붙여 이전 것과 겹치지 않게 한다.
export async function savePetPhoto(userId, petId, value) {
  if (!value) return null;
  if (!isNewPhoto(value)) return toPath(value);
  return upload(`${userId}/pets/${petId}-${Date.now()}.jpg`, value);
}

// ---------------------------------------------------------------------------
// 조회 · 삭제
// ---------------------------------------------------------------------------

// 여러 장을 한 번에 서명한다(기록 목록은 화면 하나에 수십 장이 뜬다).
// 실패하면 경로를 그대로 돌려준다 — 이미지가 깨질 뿐, "N장" 같은 개수 표시와
// 수정 시트의 목록은 정상으로 남는다.
export async function signPaths(paths) {
  const list = (paths ?? []).map(toPath).filter(Boolean);
  if (!list.length) return [];
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(list, SIGN_TTL_SECONDS);
  if (error || !data) return list;
  return list.map((path, i) => data[i]?.signedUrl || path);
}

export async function signPath(path) {
  const [url] = await signPaths([path]);
  return url ?? null;
}

// 기록이나 사진이 지워질 때 Storage에도 지운다. DB는 cascade가 있지만 Storage는
// 없어서, 안 지우면 파일만 남는다.
//
// 실패를 던지지 않는다: 사진 정리에 실패했다고 "삭제되었습니다"를 못 띄우면
// 사용자 쪽에서 할 수 있는 일이 없다. 남은 파일은 다음 정리에서 걷는다.
export async function removePaths(paths) {
  const list = (paths ?? []).map(toPath).filter(Boolean);
  if (!list.length) return;
  try {
    await supabase.storage.from(BUCKET).remove(list);
  } catch (e) {
    // 무시 — 위 주석 참고
  }
}
