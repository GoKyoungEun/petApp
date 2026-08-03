// 로그인 화면 — 06_UserFlow "앱 실행 → 소셜 로그인 → 반려동물 등록 → 홈 진입"
// 의 첫 칸이다.
//
// 소셜 로그인만 지원한다(02 §1). 게스트·이메일 로그인은 제외 — 데이터 경로를
// 서버 하나로 유지하려는 결정이고(11_ChangeLog 2026-07-29), 그래서 세션이
// 없으면 앱 본체를 아예 마운트하지 않는다(App.js).
//
// 애플 로그인은 iOS 앱스토어 배포 때 필수라 그때 추가한다(08_TechStack).

import React, { useState } from 'react';
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { scaled } from '../scale';
import { signInWith } from '../auth';

const PROVIDERS = [
  { key: 'kakao', label: '카카오로 시작하기', bg: '#FEE500', fg: '#191600' },
  { key: 'google', label: 'Google로 시작하기', bg: '#FFFFFF', fg: '#3C4043', border: '#DADCE0' },
];

export default function LoginScreen() {
  // 어느 버튼을 눌렀는지까지 들고 있어야 그 버튼에만 스피너를 돌릴 수 있다.
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);

  const start = async (provider) => {
    setError(null);
    setPending(provider);
    try {
      await signInWith(provider);
      // 성공하면 onAuthStateChange가 App.js의 게이트를 열어 이 화면이 사라진다.
      // 여기서 따로 화면을 바꾸지 않는다.
    } catch (e) {
      setError(e?.message || '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setPending(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.brand}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} />
        <Text style={styles.title}>건강일기</Text>
        <Text style={styles.subtitle}>매일의 작은 기록이{'\n'}건강의 신호가 돼요</Text>
      </View>

      <View style={styles.buttons}>
        {PROVIDERS.map((p) => (
          <Pressable
            key={p.key}
            style={[
              styles.btn,
              { backgroundColor: p.bg },
              p.border && { borderWidth: 1, borderColor: p.border },
              pending && pending !== p.key && styles.btnDim,
            ]}
            // 두 개를 동시에 누르면 브라우저 창이 겹친다.
            disabled={!!pending}
            onPress={() => start(p.key)}>
            {pending === p.key ? (
              <ActivityIndicator color={p.fg} />
            ) : (
              <Text style={[styles.btnText, { color: p.fg }]}>{p.label}</Text>
            )}
          </Pressable>
        ))}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {/* 링크는 아직 없다 — 이용약관·개인정보 처리방침 문서 자체가 미작성
          (09_Todo "다음 구현 우선순위" 6). */}
      <Text style={styles.terms}>
        계속하면 이용약관과 개인정보 처리방침에 동의하는 것으로 봅니다
      </Text>
    </View>
  );
}

const styles = StyleSheet.create(scaled({
  wrap: {
    flex: 1,
    backgroundColor: colors.peachSoft,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    paddingTop: 96,
    paddingBottom: 28,
  },
  brand: { alignItems: 'center', gap: 6 },
  logo: { width: 96, height: 96, borderRadius: 24, marginBottom: 14 },
  title: { fontSize: 26, fontWeight: '800', color: colors.textStrong },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  buttons: { gap: 10 },
  btn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDim: { opacity: 0.5 },
  btnText: { fontSize: 15, fontWeight: '700' },
  error: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: colors.badText,
    textAlign: 'center',
  },
  terms: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.textFaint,
    textAlign: 'center',
  },
}));
