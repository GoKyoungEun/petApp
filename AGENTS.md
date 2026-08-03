# Expo SDK 54

This project targets **Expo SDK 54** (downgraded from 57 on 2026-07-24 so it runs in the public Expo Go app, which supports up to SDK 54). Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

If you upgrade the SDK later, update this file and the version pins in package.json together.

# 새 컴퓨터에서 시작하기

```bash
git clone https://github.com/GoKyoungEun/petApp.git
cd petApp
npm install
npx expo start
```

Expo Go로 QR을 찍으면 폰에서 열린다. 폰과 PC가 같은 WiFi에 있어야 하고,
다른 네트워크면 `npx expo start --tunnel`을 쓴다.

## 저장소에 없는 것

git에 담기지 않으므로 새 컴퓨터에는 따라오지 않는다.

| 경로 | 내용 | 없으면 |
|---|---|---|
| `assets/icon-src/` | 일러스트 아이콘 1024px 원본 27개 (약 36MB) | **일러스트 27종**을 다시 생성할 수 없다. 앱 실행에는 지장 없다 — 생성본 `assets/icon/`은 커밋돼 있다. 앱 아이콘(하트+발바닥)은 원본이 없어도 만들 수 있다 |
| `.env` | Supabase URL·anon key | Phase 2(서버 연동) 작업을 할 수 없다. 대시보드 Settings → API에서 다시 받는다 |
| `node_modules/` | 의존성 | `npm install` |

`assets/icon-src`는 저장소가 공개라 36MB를 이력에 남기지 않으려고 뺐다
(11_ChangeLog 2026-08-02). 일러스트 아이콘을 손볼 계획이면 원본을 따로
옮겨야 한다.

## 아이콘 다시 만들기

아이콘 생성 스크립트는 둘이고 서로 다른 일을 한다.

**기록·메뉴 일러스트 27종** — `assets/icon-src`에 1024px 원본을 두고:

```bash
node tools/make-icons.js
```

여백을 잘라 정사각형으로 맞추고 128px로 줄여 `assets/icon`에 쓴다.
파일 이름이 곧 `src/Icon.js`의 매핑 키이므로 이름을 바꾸면 그쪽도 고쳐야 한다.

**앱 아이콘·스플래시(하트+발바닥 마크)** — 원본 파일이 없다. 모양이 스크립트
안에 도형으로 들어 있어 어디서든 그냥 돌리면 된다:

```bash
node tools/make-app-icons.js
```

`assets/`의 `icon.png`, `android-icon-{foreground,background,monochrome}.png`,
`favicon.png`, `splash-icon.png` 여섯 개를 덮어쓴다. 모양이나 색을 바꾸려면
스크립트 위쪽 `PALETTE`·`DIAMOND`·`PAD`·`TOES` 상수를 만진다. 색은
`src/theme.js`에서 가져오므로 팔레트를 바꿨으면 여기도 맞춘다. 왜 원본
비트맵을 두지 않는지는 11_ChangeLog 2026-08-03.

# 문서 구조

기획 문서는 번호 순서를 지킨다. 작업 상태를 적을 때 셋의 역할이 겹치지
않게 한다.

- `09_Todo` — 지금 저장소에 있는 것 / 재구현이 필요한 것 / 남은 작업
- `10_ReleaseNote` — 버전별로 무엇이 들어갔는지
- `11_ChangeLog` — 확정된 스펙이 **바뀐** 결정과 그 이유

기획(설계가 확정됐다)과 구현 상태(코드에 있다)를 섞어 적지 않는다. 한 번
어긋난 적이 있어 `08_TechStack`은 문단마다 **[현재]** 표시로 구분한다.
