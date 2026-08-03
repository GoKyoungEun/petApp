// MY 화면 — 지금은 로그아웃만.
//
// 반려동물 관리·설정·앱 정보는 Phase 3에서 붙인다(09_Todo "재구현이 필요한
// 것"). 로그아웃을 먼저 만드는 이유는 로그인 왕복을 검증할 방법이 이것뿐이기
// 때문이다 — 세션이 AsyncStorage에 남아서 앱을 지웠다 깔지 않으면 다시
// 로그인할 수가 없다.

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { scaled } from '../scale';
import { currentUser, signOut } from '../auth';

export default function MyScreen() {
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    currentUser().then((u) => alive && setUser(u));
    return () => {
      alive = false;
    };
  }, []);

  // 성공하면 onAuthStateChange가 App.js의 게이트를 닫아 이 화면이 사라진다.
  const logout = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>MY</Text>

      <View style={styles.card}>
        <Text style={styles.name}>{user?.name || '로그인한 계정'}</Text>
        {/* 카카오는 이메일 동의를 안 한 계정이 있을 수 있다(08_TechStack) —
            없으면 provider 이름으로 대신한다. */}
        <Text style={styles.sub}>{user?.email || providerLabel(user?.provider)}</Text>
      </View>

      <Pressable style={styles.logoutBtn} onPress={logout} disabled={busy}>
        <Text style={styles.logoutText}>{busy ? '로그아웃 중…' : '로그아웃'}</Text>
      </Pressable>
    </View>
  );
}

function providerLabel(provider) {
  if (provider === 'kakao') return '카카오 계정';
  if (provider === 'google') return 'Google 계정';
  return '이메일 없음';
}

const styles = StyleSheet.create(scaled({
  wrap: { flex: 1, padding: 20, gap: 14 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 4 },
  card: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted },
  logoutBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { fontSize: 14, fontWeight: '700', color: colors.textBody },
}));
