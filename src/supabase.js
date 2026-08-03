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

// 키가 없으면 createClient가 던지는 메시지("supabaseUrl is required")만으로는
// 원인을 알기 어렵다. 무엇을 어디서 받아야 하는지 적어 준다.
if (!url || !anonKey) {
  throw new Error(
    '.env에 EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY가 없습니다.\n' +
      'Supabase 대시보드 → Settings → API에서 받아 프로젝트 루트에 .env로 두고 ' +
      'expo를 다시 시작하세요 (AGENTS.md "저장소에 없는 것").'
  );
}

const isWeb = Platform.OS === 'web';

export const supabase = createClient(url, anonKey, {
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
