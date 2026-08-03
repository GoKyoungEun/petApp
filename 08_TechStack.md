# 08. Tech Stack

프론트엔드·백엔드 모두 확정. (최종 갱신 2026-08-03)

> **읽는 법**: 아래 "확정"은 *기술 선택이 확정됐다*는 뜻이다. 7/24~7/30
> 작업분 코드가 유실됐으므로(09_Todo "코드 유실"), 구현 상태는 문단마다
> 붙인 **[현재]** 표시를 따른다. 서버 자원(Supabase 프로젝트·스키마·RLS·
> Storage, 카카오/구글 OAuth 설정)은 클라우드에 살아 있어 재생성이 필요 없다.

## 앱 (확정)

- **React Native + Expo SDK 54**
  - SDK 54를 쓰는 이유: 공개 Expo Go 앱이 SDK 54까지만 지원한다. 상위 SDK는 개발 빌드가 필요해 배포/테스트가 번거로워 54로 고정. (`AGENTS.md` 참고)
- 주요 라이브러리: `@supabase/supabase-js`(서버), `@react-native-async-storage/async-storage`(세션·선택된 펫), `expo-web-browser`·`expo-linking`(소셜 로그인), `expo-image-picker`(사진 선택·촬영), `expo-image-manipulator`(저장 전 압축·리사이즈), `react-native-safe-area-context`(세이프 영역), `@tanstack/react-query`(서버 상태 관리)
- 상태 관리: UI 상태는 React Context (`src/store.js`), 데이터는 **TanStack Query**. 화면은 훅으로 읽고, 쓰기는 store.js가 repo 호출 후 키 prefix를 invalidate. dataVersion 수동 무효화 방식은 쓰지 않는다.
  - **[현재]** 기록(`src/queries/records.js`)·펫(`src/queries/pets.js`) 두 도메인 적용. 일정(`src/queries/schedules.js`)은 일정 화면과 함께 재구현 대상.

이유

- iOS와 Android 동시 개발
- 웹 프론트엔드 경험 활용 가능
- 카메라, 푸시, 소셜 로그인 구현 가능

주의

카메라 품질, 백그라운드 동작, 네이티브 모듈 제약은 사전 검증이 필요하다.

## 데이터 계층 (확정: repository 인터페이스 + Supabase)

화면·스토어는 **async repository 인터페이스**에만 의존한다 (`src/repository.js` 기록, `src/petRepo.js` 반려동물, `src/scheduleRepo.js` 일정). 화면은 repo를 직접 부르지 않고 TanStack Query 훅(`src/queries/*.js`)을 거친다.

- **[현재] 백킹은 Supabase다** (2026-08-03 재작성). 기록·펫 repo 2종. 일정 repo(`src/scheduleRepo.js`)는 일정 화면과 함께 만든다 — 테이블과 RLS는 이미 있다.
- 인터페이스가 그대로여서 7/30 교체 때도, 8/3 재작성 때도 화면 코드는 한 줄도 바뀌지 않았다 — 설계 의도대로 동작한 셈이다.
- 교체 후 남을 로컬 저장은 세션과 "선택된 펫"(`petapp:selectedPet:{user_id}`)뿐이다.
- 기록은 이벤트 기반(HealthRecord) — `03_DB_Design` 참고.
- **컬럼 매핑**: 테이블마다 `FIELDS`(앱 camelCase 키 → 컬럼 snake_case) 한 벌만 선언하고 `src/db.js`의 `makeMapper`가 select 목록·row→앱·패치→row를 만든다. `writable` 목록에 없는 키(`id`·`created_at`·`updated_at`)는 패치로 못 건드린다.
- **소유권**: 조회에 `user_id` 조건을 넣지 않는다 — RLS가 정한다. 쓰기에서 user_id가 필요한 곳(`pets.insert`, Storage 경로)만 세션에서 읽는다.
- **id**: Postgres `gen_random_uuid()`. 앱이 만들던 `r1`/`p1`/`s1` 방식은 제거.
- **캐시**: Query 하나만 쓴다(`staleTime` 5분, `retry` 1 — `src/queryClient.js`). repo의 인메모리 캐시는 Supabase 교체 때 함께 제거했다.
- **실패 처리**: repo는 실패를 던지고 store가 받아 알린다. 스낵바·토스트는 시트(Modal) 위로 못 올라오므로, 시트가 열린 채 실패하면 시트 안에 메시지를 찍는다(`writeError`).
- 미해결: 한 펫의 기록이 5000건을 넘으면 `limit(5000)`에서 잘린다 → 페이지네이션 필요.

## 백엔드 (확정: Supabase, 2026-07-29)

**Supabase**로 확정 — 관계형/이벤트 스키마 적합성, Auth(카카오·구글·애플 OAuth 지원), Storage, 무료 티어. 프로젝트 생성·스키마 실행 완료(03_DB_Design 기반, RLS 포함) — **서버에 그대로 살아 있다.**

- **[현재]** 앱 쪽 코드는 2026-08-03에 재작성했다 — `supabase/schema.sql` 사본, `src/supabase.js`, `src/auth.js`, `src/db.js`, `src/photoStore.js`, `src/screens/LoginScreen.js`, repo 2종 교체. **다만 `.env`가 없어 서버에 붙여 검증하지 못했다** — 대시보드 Settings → API에서 URL·anon key를 받아 `.env.example`대로 채운다. 남은 검증 항목은 09_Todo "검증이 남은 것".
- 소셜 로그인: 카카오·구글 연동은 2026-07-30 실기기까지 확인했고 **콘솔 설정은 유지된다**. 앱 코드만 다시 붙이면 된다. 애플은 추후 추가 (iOS 앱스토어 배포 시 필수)
  - 카카오 설정값: Redirect URI `https://<project>.supabase.co/auth/v1/callback`(카카오 콘솔), 대표/사이트 도메인은 같은 주소에서 경로만 뗀 것. Client ID = 카카오 **REST API 키**. Web 플랫폼을 먼저 등록해야 Redirect URI 칸이 열린다.
  - Supabase의 카카오 provider는 기본 scope에 `account_email`이 들어간다. 이메일 동의항목이 없으면 카카오가 거부하는데(KOE205 계열), 이 프로젝트에서는 통과했다. 막힐 경우 `signInWithOAuth`의 `scopes`로 이메일을 빼면 된다 — 앱은 이메일 없는 계정을 이미 처리한다(MyScreen `user?.email || '카카오 계정'`).
- **로그인 필수(게이트)** — 세션이 없으면 앱 본체를 마운트하지 않는다. 데이터 경로를 서버 하나로 유지 (11_ChangeLog 2026-07-29)
- 진행 순서: ~~스키마 실행~~ → ~~supabase-js 클라이언트~~ → ~~구글 OAuth 연동(웹·실기기 검증 완료)~~ → ~~repository 교체~~ / 카카오 연동은 병행
- 기존 로컬 데이터는 서버로 이전하지 않고 초기화하기로 결정 (테스트 데이터). 로컬 시드(코코·보리)도 제거 — 계정마다 빈 목록에서 시작하고, 펫이 0마리면 등록 폼이 자동으로 열린다.

관련 라이브러리·파일

- `@supabase/supabase-js` — 클라이언트는 `src/supabase.js` 하나만. 세션은 AsyncStorage에 저장(웹은 localStorage), PKCE 플로우.
- `expo-web-browser` + `expo-linking` — OAuth를 인앱 브라우저로 띄우고 돌아온 `code`를 세션으로 교환 (`src/auth.js`).
- 환경변수: `.env`의 `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`. `EXPO_PUBLIC_*`은 번들에 포함되므로 비밀값 금지 — publishable 키는 공개용이고 실제 방어선은 RLS다.
- 리디렉트 URI: 실제 빌드는 `petapp://auth/callback`(app.json `scheme`). **Expo Go는 커스텀 scheme을 못 써서 `exp://...`로 돌아오고 터널 주소가 매번 바뀌므로, Supabase Redirect URLs에 `exp://**` 를 등록해야 실기기 테스트가 된다.**

## 데이터베이스

관계형 데이터가 많으므로 PostgreSQL 계열이 유리하다.

주요 데이터

- 사용자
- 반려동물
- 기록
- 사진
- 일정
- 완료 기록
- 알림 설정

## 이미지 저장

Supabase Storage `record-photos` 버킷(비공개) — `src/photoStore.js`가 담당한다.

- 경로: 기록 `{user_id}/{record_id}/{시각}-{n}.jpg`, 반려동물 `{user_id}/pets/{pet_id}-{시각}.jpg`. **경로 첫 폴더가 소유자 검증 기준**(schema.sql의 storage 정책).
- DB에는 URL이 아니라 **경로**만 저장하고(`health_records.data.photos`, `pets.photo_url`), 조회할 때 서명 URL(24시간)로 바꿔 화면에 넘긴다. 수정 시트가 되돌려 보낸 서명 URL은 저장 시 경로로 환원한다.
- base64를 jsonb에 넣지 않는 이유: 기록당 6장 × 수백 KB면 "펫 전체 기록" 조회(통계·몸무게)가 매번 수 MB를 끌어온다.
- 업로드 전 앱에서 압축(긴 변 1280px·JPEG q0.7, `src/photo.js`) — 원본 미보관.
- Hermes에는 `atob`이 없어 base64 디코딩을 직접 구현했다. 업로드 본문은 Blob/FormData보다 플랫폼 차이가 적은 `Uint8Array`.
- 기록·펫을 지우거나 사진을 빼면 Storage 파일도 함께 지운다. DB에만 cascade가 있어서, 안 지우면 참조 없는 파일이 계속 쌓인다. 실패는 삼킨다 — 사진 정리에 실패했다고 "삭제되었습니다"를 못 띄우면 사용자가 할 수 있는 일이 없다.
- 썸네일 생성(`record_photos.thumbnail_url`)은 아직 미구현 — 목록에서도 원본 크기를 그대로 받는다.
- 향후 AI 분석용 최소 해상도 기준 정의 필요

## 푸시 알림

후보

- Firebase Cloud Messaging
- Expo Notifications

## 통계

MVP에서는 서버에서 집계하거나 기간별 원시 데이터를 받아 앱에서 계산할 수 있다.

사용량 증가 시 서버 집계 테이블 또는 배치 처리 검토가 필요하다.
