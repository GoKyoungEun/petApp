// 앱 camelCase ↔ 컬럼 snake_case 매핑.
//
// 테이블마다 FIELDS 한 벌만 선언하고, select 목록·row→앱·패치→row 셋을 여기서
// 만들어 낸다. 필드가 늘 때 세 군데를 따로 고치다 하나를 빠뜨리는 일을 막으려는
// 것이다 — 빠뜨리면 조회는 되는데 저장만 안 되는, 눈에 잘 안 띄는 버그가 된다.
//
// 08_TechStack "데이터 계층 · 컬럼 매핑".

// 앱이 만들지도 고치지도 않는 컬럼. id는 gen_random_uuid(), 두 시각은 DB
// 트리거가 채운다(supabase/schema.sql). 패치에 섞여 들어와도 버린다.
const READONLY = new Set(['id', 'createdAt', 'updatedAt']);

export function makeMapper(fields, { readonly = [] } = {}) {
  const skip = new Set([...READONLY, ...readonly]);
  const pairs = Object.entries(fields);
  const writable = pairs.filter(([key]) => !skip.has(key));

  return {
    // supabase의 .select()에 그대로 넘긴다. `*`를 쓰지 않는 이유는 나중에
    // 컬럼이 추가돼도 앱이 모르는 데이터를 실어 오지 않게 하기 위해서다.
    select: pairs.map(([, col]) => col).join(', '),

    toApp(row) {
      if (!row) return null;
      const out = {};
      for (const [key, col] of pairs) out[key] = row[col] ?? null;
      return out;
    },

    // 넘어온 키 중 쓰기 가능한 것만 컬럼명으로 바꾼다. 모르는 키는 조용히
    // 버린다 — 폼이 화면용 필드를 함께 넘기는 경우가 있다.
    toRow(patch) {
      const out = {};
      for (const [key, col] of writable) {
        if (patch[key] !== undefined) out[col] = patch[key];
      }
      return out;
    },
  };
}

// 03_DB_Design "Pet"
export const petMapper = makeMapper({
  id: 'id',
  userId: 'user_id',
  name: 'name',
  species: 'species',
  birthDate: 'birth_date',
  isEstimatedBirthDate: 'is_estimated_birth_date',
  gender: 'gender',
  photoUrl: 'photo_url',
  breed: 'breed',
  currentWeight: 'current_weight',
  neutered: 'neutered',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
// user_id는 insert 때 세션에서 한 번 넣는다(petRepo). 나중에 patch로 바뀌면
// 남의 계정으로 펫을 넘길 수 있으니 쓰기 목록에서 뺀다 — RLS가 막지만
// 애초에 보내지 않는 편이 낫다.
}, { readonly: ['userId'] });

// 03_DB_Design "HealthRecord". petId는 기록을 만든 뒤 다른 펫으로 옮기는 UI가
// 없어서 patch 대상이 아니다.
export const recordMapper = makeMapper({
  id: 'id',
  petId: 'pet_id',
  recordType: 'record_type',
  recordDate: 'record_date',
  data: 'data',
  memo: 'memo',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
}, { readonly: ['petId', 'recordType'] });
