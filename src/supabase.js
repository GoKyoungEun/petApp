// Supabase 클라이언트 — 앱 전체에 이거 하나만 둔다(08_TechStack).
//
// 여러 개를 만들면 세션 갱신 타이머와 onAuthStateChange 구독이 클라이언트마다
// 따로 돌아서, 한쪽이 토큰을 갱신하는 동안 다른 쪽이 만료된 토큰으로 요청을
// 보내게 된다. repo·auth·photoStore 모두 여기서 import 한다.

import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// 키가 없을 때 여기서 throw하면 안 된다. 모듈 로드 중이라 프로덕션 빌드에서는
// 안내 한 줄 없이 앱이 그대로 죽는다 — 실제로 첫 APK가 그렇게 아무 화면도 뜨지
// 않았다. 개발 서버에서만 빨간 화면으로 보여서 눈치채기도 어려웠다.
//
// 대신 무엇이 잘못됐는지를 값으로 내보내고, App.js가 읽을 수 있는 화면으로
// 띄운다. 클라이언트는 자리표시자로라도 만들어 둬야 이 파일을 import하는
// 다른 모듈들이 로드 단계에서 함께 무너지지 않는다.
export const configError =
  !url || !anonKey
    ? 'Supabase 주소와 키가 없습니다.\n\n' +
      '개발 중이라면 프로젝트 루트에 .env를 두고 expo를 다시 시작하세요.\n' +
      '빌드한 앱이라면 EAS 환경변수(EXPO_PUBLIC_SUPABASE_URL / ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY)를 등록한 뒤 다시 빌드해야 합니다.\n\n' +
      'AGENTS.md "안드로이드 앱으로 빌드하기" 참고.'
    : null;

const isWeb = Platform.OS === 'web';

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder', {
  auth: {
    // 네이티브는 AsyncStorage, 웹은 supabase-js 기본값(localStorage)에 맡긴다.
    storage: isWeb ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // 웹은 OAuth가 돌아온 URL에서 세션을 직접 줍는다. 네이티브는 돌아온 주소를
    // src/auth.js가 받아 코드로 교환하므로 꺼 둔다.
    detectSessionInUrl: isWeb,
    flowType: 'pkce',
  },
});

// 앱이 백그라운드에 있는 동안 갱신 타이머를 돌릴 이유가 없다. 포그라운드로
// 돌아올 때 다시 켜면 그때 만료된 토큰을 한 번에 갱신한다.
if (!isWeb) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
