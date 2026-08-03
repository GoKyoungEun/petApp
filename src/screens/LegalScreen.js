// 이용약관 / 개인정보 처리방침 본문 화면.
//
// MY에서 들어오는 하위 화면이라 전체 기록보기·몸무게 화면과 같은 방식이다:
// tab 값으로 열고 헤더의 뒤로가기로 MY로 돌아간다.
//
// 본문은 src/legal.js에 있다 — 앱이 실제로 무엇을 수집하는지와 한곳에서
// 맞춰야 해서, 화면이 아니라 데이터로 둔다.

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Icon from '../Icon';
import { colors } from '../theme';
import { useStore } from '../store';
import { scaled } from '../scale';
import { TERMS, PRIVACY } from '../legal';

const DOCS = {
  terms: { title: '이용약관', sections: TERMS },
  privacy: { title: '개인정보 처리방침', sections: PRIVACY },
};

export default function LegalScreen() {
  const { legalDoc, setTab } = useStore();
  const doc = DOCS[legalDoc] || DOCS.terms;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={() => setTab('my')} hitSlop={8}>
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{doc.title}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {doc.sections.map((s) => (
          <View key={s.heading} style={styles.section}>
            <Text style={styles.heading}>{s.heading}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create(scaled({
  wrap: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  content: { paddingHorizontal: 18, paddingBottom: 32 },
  section: { marginBottom: 20 },
  heading: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 6 },
  // 약관은 길어서 줄간격이 좁으면 읽다가 줄을 놓친다.
  body: { fontSize: 13, lineHeight: 21, color: colors.textBody },
}));
