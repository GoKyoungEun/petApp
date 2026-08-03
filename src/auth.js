// 인증 계층 — 소셜 로그인만 지원한다(01_ProjectVision, 02 §1).
//
// 흐름(PKCE): signInWithOAuth로 제공자 로그인 URL을 받고 → 인앱 브라우저로
// 띄우고 → 돌아온 주소의 `code`를 세션으로 교환한다. supabase-js가 리디렉트를
// 직접 하게 두지 않는 이유는, 네이티브에는 "현재 페이지"가 없어서 돌아올 곳을
// 앱이 직접 잡아 줘야 하기 때문이다(skipBrowserRedirect).
//
// 화면은 이 파일만 부른다. supabase.auth를 화면에서 직접 만지지 않는다.

import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

// 실제 빌드에서는 app.json의 scheme을 따라 petapp://auth/callback이 된다.
// Expo Go는 커스텀 scheme을 못 써서 exp://<호스트>/--/auth/callback으로
// 돌아오고 호스트가 매번 바뀌므로, Supabase Redirect URLs에 `exp://**`를
// 등록해 둬야 실기기 테스트가 된다 (08_TechStack "리디렉트 URI").
export const redirectTo = Linking.createURL('/auth/callback');

// 돌아온 주소에서 code를 꺼내 세션으로 바꾼다. 사용자가 동의를 거절하면 code
// 대신 error가 실려 오므로 그쪽을 먼저 본다.
async function sessionFromUrl(url) {
  const { queryParams } = Linking.parse(url);
  const { code, error, error_description: desc } = queryParams ?? {};

  if (error) throw new Error(desc || String(error));
  if (!code) return null; // 취소 등 — 조용히 로그인 화면에 남는다

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    String(code)
  );
  if (exchangeError) throw exchangeError;
  return data.session;
}

// provider: 'google' | 'kakao' (애플은 iOS 배포 때 추가 — 08_TechStack)
export async function signInWith(provider) {
  // 웹은 브라우저가 곧 앱이다. 리디렉트를 그대로 맡기면 돌아온 URL에서
  // supabase-js가 세션을 줍는다(detectSessionInUrl).
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) throw error;
    return null;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  // 'cancel'(사용자가 닫음) · 'dismiss'(시스템이 닫음) 둘 다 실패가 아니다.
  if (result.type !== 'success') return null;

  return sessionFromUrl(result.url);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

// 세션이 바뀔 때마다 부른다(로그인·로그아웃·토큰 갱신·앱 재시작 복원).
// 반환값을 호출해 구독을 끊는다.
export function onAuthChange(fn) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    fn(session ?? null);
  });
  return () => data.subscription.unsubscribe();
}

// 쓰기에서 user_id가 필요한 곳(pets.insert, Storage 경로)만 쓴다. 조회에는
// 넣지 않는다 — 소유권은 RLS가 정한다(08_TechStack "데이터 계층").
export async function currentUserId() {
  const session = await getSession();
  const id = session?.user?.id;
  if (!id) throw new Error('로그인이 필요합니다');
  return id;
}

// MY 화면 계정 카드. 카카오는 이메일 동의를 안 한 계정이 있을 수 있어 화면
// 쪽에서 빈 값을 처리한다(08_TechStack).
export async function currentUser() {
  const session = await getSession();
  const user = session?.user;
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? null,
    name: meta.full_name || meta.name || meta.nickname || null,
    avatarUrl: meta.avatar_url || meta.picture || null,
    provider: user.app_metadata?.provider ?? null,
  };
}
