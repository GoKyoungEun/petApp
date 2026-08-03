# Expo SDK 54

This project targets **Expo SDK 54** (downgraded from 57 on 2026-07-24 so it runs in the public Expo Go app, which supports up to SDK 54). Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

If you upgrade the SDK later, update this file and the version pins in package.json together.

# 새 컴퓨터에서 시작하기

```bash
git clone https://github.com/GoKyoungEun/petApp.git
cd petApp
npm install
cp .env.example .env   # Supabase URL·anon key를 채운다
npx expo start
```

`.env` 없이는 앱이 뜨지 않는다. 로그인이 필수라 Supabase 클라이언트가 없으면
띄울 화면 자체가 없어서, `src/supabase.js`가 시작하자마자 멈춘다. 값은
대시보드 Settings → API에서 받는다.

Expo Go로 QR을 찍으면 폰에서 열린다. 폰과 PC가 같은 WiFi에 있어야 하고,
다른 네트워크면 `npx expo start --tunnel`을 쓴다.

소셜 로그인을 실기기에서 테스트하려면 Supabase Authentication → URL
Configuration의 Redirect URLs에 `exp://**`가 있어야 한다. Expo Go는 커스텀
scheme(`petapp://`)을 못 쓰고 매번 바뀌는 `exp://` 주소로 돌아온다.

## 저장소에 없는 것

git에 담기지 않으므로 새 컴퓨터에는 따라오지 않는다.

| 경로 | 내용 | 없으면 |
|---|---|---|
| `assets/icon-src/` | 아이콘 1024px 원본 27개 (약 36MB) | 아이콘을 **다시 생성**할 수 없다. 앱 실행에는 지장 없다 — 생성본 `assets/icon/`은 커밋돼 있다 |
| `.env` | Supabase URL·anon key | **앱이 실행되지 않는다.** 대시보드 Settings → API에서 다시 받아 `.env.example`대로 채운다 |
| `node_modules/` | 의존성 | `npm install` |

`assets/icon-src`는 저장소가 공개라 36MB를 이력에 남기지 않으려고 뺐다
(11_ChangeLog 2026-08-02). 아이콘을 손볼 계획이면 원본을 따로 옮겨야 한다.

## 아이콘 다시 만들기

`assets/icon-src`에 1024px 원본을 두고:

```bash
node tools/make-icons.js
```

여백을 잘라 정사각형으로 맞추고 128px로 줄여 `assets/icon`에 쓴다.
파일 이름이 곧 `src/Icon.js`의 매핑 키이므로 이름을 바꾸면 그쪽도 고쳐야 한다.

# 문서 구조

기획 문서는 번호 순서를 지킨다. 작업 상태를 적을 때 셋의 역할이 겹치지
않게 한다.

- `09_Todo` — 지금 저장소에 있는 것 / 재구현이 필요한 것 / 남은 작업
- `10_ReleaseNote` — 버전별로 무엇이 들어갔는지
- `11_ChangeLog` — 확정된 스펙이 **바뀐** 결정과 그 이유

기획(설계가 확정됐다)과 구현 상태(코드에 있다)를 섞어 적지 않는다. 한 번
어긋난 적이 있어 `08_TechStack`은 문단마다 **[현재]** 표시로 구분한다.
