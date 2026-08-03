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

Expo Go로 QR을 찍으면 폰에서 열린다.

**로그인을 테스트하려면 터널로 띄워야 한다:**

```bash
npx expo start --tunnel
```

같은 WiFi여도 LAN 모드로는 소셜 로그인이 안 된다. Expo Go가 `exp://<LAN
IP>:8081/--/auth/callback`으로 돌아오려 하는데, Supabase가 루프백이 아닌 IP
주소를 리디렉트 대상에서 거부하기 때문이다. 허용 목록에 무엇을 넣어도 안
된다. 터널은 IP 대신 `*.exp.direct` 호스트명을 준다.

증상이 헷갈린다 — 구글 인증은 성공해서 `auth.users`에 계정이 생기는데,
브라우저만 Site URL로 떨어져 "사이트에 접근할 수 없습니다"가 뜨고 앱은 세션
없이 로그인 화면으로 돌아온다. 자세한 내용과 확인 방법은 08_TechStack
"백엔드".

Supabase Authentication → URL Configuration의 Redirect URLs에 `exp://**`와
`petapp://**`가 있어야 한다.

## 저장소에 없는 것

git에 담기지 않으므로 새 컴퓨터에는 따라오지 않는다.

| 경로 | 내용 | 없으면 |
|---|---|---|
| `assets/icon-src/` | 일러스트 아이콘 1024px 원본 27개 (약 36MB) + 앱 마크 원본 `app-mark.png` | 아이콘을 **다시 생성할 수 없다** — 일러스트 27종도, 앱 아이콘도 원본이 있어야 한다. 앱 실행에는 지장 없다: 생성본(`assets/icon/`과 `assets/*.png`)은 커밋돼 있다 |
| `.env` | Supabase URL·anon key | **앱이 실행되지 않는다.** 대시보드 Settings → API에서 다시 받아 `.env.example`대로 채운다 |
| `node_modules/` | 의존성 | `npm install` |

`assets/icon-src`는 저장소가 공개라 36MB를 이력에 남기지 않으려고 뺐다
(11_ChangeLog 2026-08-02). 아이콘을 손볼 계획이면 원본을 따로 옮겨야 한다.

## 아이콘 다시 만들기

아이콘 생성 스크립트는 둘이고 서로 다른 일을 한다.

**기록·메뉴 일러스트 27종** — `assets/icon-src`에 1024px 원본을 두고:

```bash
node tools/make-icons.js
```

여백을 잘라 정사각형으로 맞추고 128px로 줄여 `assets/icon`에 쓴다.
파일 이름이 곧 `src/Icon.js`의 매핑 키이므로 이름을 바꾸면 그쪽도 고쳐야 한다.

**앱 아이콘·스플래시** — `assets/icon-src/app-mark.png`(하트 안의 강아지·고양이)를
두고:

```bash
node tools/make-app-icons.js
```

`assets/`의 `icon.png`, `android-icon-{foreground,background,monochrome}.png`,
`favicon.png`, `splash-icon.png` 여섯 개를 덮어쓴다.

원본은 청록 배경인데 앱 팔레트가 주황이라, 스크립트가 **배경 색만** 옮기고
그림은 그대로 둔다. 배경색은 `BG` 상수(= `src/theme.js`의 primary)이고
`app.json`의 `android.adaptiveIcon.backgroundColor`와 같아야 한다 — 다르면
적응형 아이콘의 전경·배경 레이어가 다른 색에서 만난다.

원본을 다른 그림으로 바꾸면 스크립트 위쪽 `TEAL`(배경으로 쓰인 색상 대역)을
새 그림에 맞춰야 한다. 그 대역이 그림 안의 다른 요소와 겹치지 않는지도
확인한다 — 겹치면 그 부분이 배경으로 오인돼 함께 파인다.

# 안드로이드 앱으로 빌드하기

로컬 빌드는 안드로이드 SDK가 필요하다. 없으면 **EAS 클라우드 빌드**를 쓴다 —
SDK 없이 설치 가능한 APK가 나온다.

```bash
npx eas-cli login          # Expo 계정. 없으면 expo.dev에서 먼저 가입
npx eas-cli init           # 프로젝트를 계정에 연결 (app.json에 projectId를 쓴다)
npx eas-cli build -p android --profile preview
```

`preview` 프로필은 APK를 만든다(`eas.json`). 폰에 바로 설치해 보는 용도다.
스토어에 올릴 때는 `--profile production`으로 AAB를 만든다.

**환경변수를 따로 넣어야 한다.** `.env`는 `.gitignore`에 있고 EAS는 git에 없는
파일을 올리지 않는다. 그대로 빌드하면 앱이 켜지자마자 `src/supabase.js`의
"환경변수가 없습니다" 오류로 멈춘다. 한 번만 등록해 두면 된다:

```bash
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://<project-ref>.supabase.co" --visibility plaintext --environment preview --environment production
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon key>" --visibility plaintext --environment preview --environment production
```

`plaintext`인 이유: `EXPO_PUBLIC_*`은 번들에 그대로 박혀 APK를 뜯으면 누구나
읽는다. 감춰 봐야 감춰지지 않고, 실제 방어선은 RLS다(08_TechStack).

빌드 전에 확인할 것

- `android.package`(`kr.co.outspring.banryeojangsaeng`)는 **한 번 스토어에 올리면
  바꿀 수 없다.** 처음 빌드 전에 확정한다.
- Supabase Redirect URLs에 `petapp://**`가 있어야 소셜 로그인이 돌아온다.
  Expo Go의 `exp://`와 달리 독립 빌드는 `app.json`의 `scheme`을 쓴다.
- 카메라·사진 권한 문구는 `expo-image-picker` 플러그인 설정에 있다. 마이크
  권한은 `blockedPermissions`로 막아 뒀다 — 이 앱은 영상을 쓰지 않는데
  플러그인이 기본으로 붙인다.

# 문서 구조

기획 문서는 번호 순서를 지킨다. 작업 상태를 적을 때 셋의 역할이 겹치지
않게 한다.

- `09_Todo` — 지금 저장소에 있는 것 / 재구현이 필요한 것 / 남은 작업
- `10_ReleaseNote` — 버전별로 무엇이 들어갔는지
- `11_ChangeLog` — 확정된 스펙이 **바뀐** 결정과 그 이유

기획(설계가 확정됐다)과 구현 상태(코드에 있다)를 섞어 적지 않는다. 한 번
어긋난 적이 있어 `08_TechStack`은 문단마다 **[현재]** 표시로 구분한다.

## 빌드가 이상할 때

Metro가 `process.env.EXPO_PUBLIC_*`을 **번들에 값으로 박아 넣고 그 결과를
캐시한다.** 환경변수를 바꾸고 다시 빌드해도 캐시가 살아 있으면 옛 값이 그대로
나온다 — `Bundled 500ms`처럼 비정상적으로 빨리 끝나면 캐시를 쓴 것이다.

```bash
npx expo export --platform web --clear
npx expo start --clear
```

값이 실제로 들어갔는지는 번들을 뒤져 보면 확실하다:

```bash
grep -c "<project-ref>" dist/_expo/static/js/web/*.js
```
