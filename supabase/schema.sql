-- Supabase schema — 03_DB_Design.md 기준.
--
-- 서버(Supabase 프로젝트)에는 2026-07-29에 이미 적용돼 있다. 이 파일은 그때의
-- 사본이 코드와 함께 유실돼(09_Todo "코드 유실") 03_DB_Design에서 다시 쓴
-- 것이다. **서버가 원본이고 이 파일은 사본이다** — 처음 실행하기 전에
-- 대시보드 스키마와 한 번 대조한다.
--
-- 전부 다시 실행해도 안전하도록 create ... if not exists / drop policy if exists
-- 를 쓴다. 컬럼이 이미 있는 테이블은 create table if not exists가 건너뛰므로,
-- 스키마가 바뀌면 alter를 따로 적는다.
--
-- 소유권은 전부 RLS가 정한다. 앱은 조회에 user_id 조건을 넣지 않는다
-- (08_TechStack "데이터 계층"). pets만 user_id를 직접 들고 있고, 나머지는
-- pet_id를 타고 올라가 확인한다.

-- ---------------------------------------------------------------------------
-- updated_at 자동 갱신
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pet — 03_DB_Design "Pet". 계정당 최대 5마리는 앱에서 막는다(02 §2).
-- ---------------------------------------------------------------------------

create table if not exists public.pets (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users (id) on delete cascade,
  name                    text not null,
  species                 text not null check (species in ('dog', 'cat')),
  birth_date              date,
  is_estimated_birth_date boolean not null default false,
  gender                  text check (gender in ('male', 'female')),
  -- URL이 아니라 Storage 경로다: {user_id}/pets/{pet_id}-{시각}.jpg
  -- (08_TechStack "이미지 저장"). 읽을 때 서명 URL로 바꾼다.
  photo_url               text,
  breed                   text,
  current_weight          numeric(5, 2),
  neutered                boolean,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists pets_user_id_idx on public.pets (user_id);

drop trigger if exists pets_touch_updated_at on public.pets;
create trigger pets_touch_updated_at
  before update on public.pets
  for each row execute function public.touch_updated_at();

alter table public.pets enable row level security;

drop policy if exists "pets are owned by their user" on public.pets;
create policy "pets are owned by their user" on public.pets
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- HealthRecord — 이벤트 기반 공통 기록(03_DB_Design "기본 원칙").
--
-- 유형별 상세는 별도 테이블 대신 data jsonb에 담는다: 유형이 9종이고 필드가
-- 하나~둘뿐이라 테이블을 나누면 조회가 9-way join이 된다. 사진도 여기 들어간다
-- (data.photos = Storage 경로 배열, data.category = 기록 단위 분류).
-- ---------------------------------------------------------------------------

create table if not exists public.health_records (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references public.pets (id) on delete cascade,
  record_type text not null check (record_type in (
    'meal', 'stool', 'urine', 'vomit', 'walk',
    'condition', 'weight', 'healthPhoto', 'medicalRecord', 'note'
  )),
  record_date date not null,
  data        jsonb not null default '{}'::jsonb,
  memo        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 홈·캘린더 날짜 패널이 (펫, 날짜)로 읽고, 전체 기록보기 탭이 (펫, 유형)으로
-- 읽는다. 캘린더 마커는 (펫, 날짜) 인덱스만으로 커버된다.
create index if not exists health_records_pet_date_idx
  on public.health_records (pet_id, record_date desc);
create index if not exists health_records_pet_type_date_idx
  on public.health_records (pet_id, record_type, record_date desc);

drop trigger if exists health_records_touch_updated_at on public.health_records;
create trigger health_records_touch_updated_at
  before update on public.health_records
  for each row execute function public.touch_updated_at();

alter table public.health_records enable row level security;

drop policy if exists "records follow their pet" on public.health_records;
create policy "records follow their pet" on public.health_records
  for all
  using (exists (
    select 1 from public.pets p
    where p.id = health_records.pet_id and p.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.pets p
    where p.id = health_records.pet_id and p.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- RecordPhoto — 03_DB_Design "RecordPhoto".
--
-- 아직 쓰지 않는다. 사진은 health_records.data.photos에 경로 배열로 들어가고
-- 분류는 기록 단위(data.category)다. 사진 하나하나에 분류나 썸네일이 필요해질
-- 때 이 테이블로 옮긴다 — 그때까지는 스키마만 둔다.
-- ---------------------------------------------------------------------------

create table if not exists public.record_photos (
  id            uuid primary key default gen_random_uuid(),
  record_id     uuid not null references public.health_records (id) on delete cascade,
  category      text,
  image_url     text not null,
  thumbnail_url text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists record_photos_record_idx
  on public.record_photos (record_id, sort_order);

alter table public.record_photos enable row level security;

drop policy if exists "photos follow their record" on public.record_photos;
create policy "photos follow their record" on public.record_photos
  for all
  using (exists (
    select 1 from public.health_records r
    join public.pets p on p.id = r.pet_id
    where r.id = record_photos.record_id and p.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.health_records r
    join public.pets p on p.id = r.pet_id
    where r.id = record_photos.record_id and p.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- Schedule — 앞으로 해야 할 건강관리 일정(03_DB_Design "Schedule").
-- 실제로 한 일은 medical_records에 따로 남긴다("일정과 기록의 관계").
-- ---------------------------------------------------------------------------

create table if not exists public.schedules (
  id                   uuid primary key default gen_random_uuid(),
  pet_id               uuid not null references public.pets (id) on delete cascade,
  schedule_type        text not null check (schedule_type in (
    'vaccination', 'heartworm', 'deworming', 'healthCheck', 'hospitalVisit', 'custom'
  )),
  -- custom일 때만 채운다. 그 외 타입은 null(03_DB_Design).
  custom_type_name     text,
  scheduled_date       date not null,
  status               text not null default 'planned'
                       check (status in ('planned', 'completed', 'cancelled', 'missed')),
  hospital_name        text,
  product_name         text,
  memo                 text,
  repeat_interval_type text check (repeat_interval_type in ('day', 'week', 'month', 'year')),
  repeat_interval_value integer,
  notification_setting jsonb,
  -- 일정을 완료하면 그때 만든 medical_records 행을 여기 연결한다. 두 테이블이
  -- 서로를 참조해서, 외래키는 medical_records를 만든 뒤 아래에서 붙인다.
  linked_record_id     uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint schedules_custom_name_present
    check (schedule_type <> 'custom' or custom_type_name is not null)
);

-- 일정 탭은 예정·지난을 날짜순으로 가른다.
create index if not exists schedules_pet_date_idx
  on public.schedules (pet_id, scheduled_date);

drop trigger if exists schedules_touch_updated_at on public.schedules;
create trigger schedules_touch_updated_at
  before update on public.schedules
  for each row execute function public.touch_updated_at();

alter table public.schedules enable row level security;

drop policy if exists "schedules follow their pet" on public.schedules;
create policy "schedules follow their pet" on public.schedules
  for all
  using (exists (
    select 1 from public.pets p
    where p.id = schedules.pet_id and p.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.pets p
    where p.id = schedules.pet_id and p.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- MedicalRecord — 실제로 완료한 건강관리·병원 방문(03_DB_Design).
-- ---------------------------------------------------------------------------

create table if not exists public.medical_records (
  id            uuid primary key default gen_random_uuid(),
  pet_id        uuid not null references public.pets (id) on delete cascade,
  -- 일정 없이 기록만 먼저 만들 수 있다(03 "사용자가 기록을 먼저 생성한 경우").
  schedule_id   uuid references public.schedules (id) on delete set null,
  medical_type  text not null,
  executed_date date not null,
  hospital_name text,
  product_name  text,
  memo          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists medical_records_pet_date_idx
  on public.medical_records (pet_id, executed_date desc);

drop trigger if exists medical_records_touch_updated_at on public.medical_records;
create trigger medical_records_touch_updated_at
  before update on public.medical_records
  for each row execute function public.touch_updated_at();

alter table public.medical_records enable row level security;

drop policy if exists "medical records follow their pet" on public.medical_records;
create policy "medical records follow their pet" on public.medical_records
  for all
  using (exists (
    select 1 from public.pets p
    where p.id = medical_records.pet_id and p.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.pets p
    where p.id = medical_records.pet_id and p.user_id = (select auth.uid())
  ));

-- schedules.linked_record_id의 외래키.
--
-- **서버와 다르다 (2026-08-03 확인).** 여기서는 medical_records를 가리키게 썼지만
-- 서버의 schedules_linked_record_id_fkey는 그렇지 않다 — 방금 만든 완료 기록의
-- id를 넣었더니 거부했다. 원본이 어느 테이블을 가리키는지는 익명 키로 볼 수
-- 없어서 확인하지 못했다(health_records일 가능성이 높다. 03_DB_Design의
-- HealthRecord recordType 목록에 medicalRecord가 있다).
--
-- 앱은 이 컬럼을 쓰지 않는다. 03_DB_Design "일정 완료 시" 3단계의 "scheduleId로
-- 연결"은 medical_records.schedule_id이고, 이 컬럼은 그 반대 방향 포인터라
-- 없어도 연결이 성립한다. 그래서 지금은 앱 동작에 영향이 없다.
--
-- 이 파일을 빈 프로젝트에 실행할 계획이라면 그때 서버 정의를 확인해 맞춘다.
alter table public.schedules
  drop constraint if exists schedules_linked_record_id_fkey;
alter table public.schedules
  add constraint schedules_linked_record_id_fkey
  foreign key (linked_record_id) references public.medical_records (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 회원 탈퇴
--
-- auth.users를 지우려면 service_role 권한이 필요한데, 그 키를 앱에 넣으면 누구나
-- 남의 계정을 지울 수 있다. 대신 **자기 자신만** 지우는 함수를 하나 두고 로그인한
-- 사용자에게만 실행 권한을 준다. security definer라 함수 소유자 권한으로 돌지만,
-- 지우는 대상이 auth.uid()로 못 박혀 있어 남의 계정에는 닿지 못한다.
--
-- search_path를 비워 두는 이유: definer 함수가 호출자가 만든 동명의 스키마를
-- 타고 엉뚱한 테이블을 보는 것을 막는다. 그래서 아래는 전부 정규화된 이름이다.
--
-- 앱은 이 함수를 부르기 전에 Storage 파일과 각 테이블 행을 먼저 지운다
-- (src/account.js). cascade 설정에 기대지 않으려는 것이다.
--
-- dry_run이 있는 이유: 그 순서 때문에 이 함수가 없으면 데이터만 지워지고 계정이
-- 남는다. 실제로 한 번 그랬다 — 함수를 만들기 전에 탈퇴를 눌러 기록이 다
-- 날아갔다. 앱은 아무것도 지우기 전에 dry_run으로 한 번 찔러 보고, 함수가
-- 없으면 그 자리에서 멈춘다.
-- ---------------------------------------------------------------------------

create or replace function public.delete_current_user(dry_run boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception '로그인이 필요합니다';
  end if;
  -- 있는지만 확인하는 호출. 여기서 돌아가면 진짜 호출도 성공한다.
  if dry_run then
    return;
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_current_user() from public, anon;
grant execute on function public.delete_current_user() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage — record-photos 버킷(비공개).
--
-- 경로 첫 폴더가 소유자 검증 기준이다(08_TechStack "이미지 저장"):
--   기록  {user_id}/{record_id}/{시각}-{n}.jpg
--   반려동물 {user_id}/pets/{pet_id}-{시각}.jpg
-- 버킷이 비공개라 조회는 서명 URL(24시간)로만 된다.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('record-photos', 'record-photos', false)
on conflict (id) do nothing;

drop policy if exists "record photos are owned by their folder" on storage.objects;
create policy "record photos are owned by their folder" on storage.objects
  for all
  using (
    bucket_id = 'record-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'record-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
