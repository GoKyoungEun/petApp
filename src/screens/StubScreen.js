import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from '../Icon';
import { colors } from '../theme';
import { scaled } from '../scale';

const INFO = {
  calendar: { icon: 'calendar', title: '캘린더', desc: '날짜별 기록을 한눈에 볼 수 있어요' },
  stats: { icon: 'chart', title: '통계', desc: '기간별 기록 요약을 확인해요' },
};

export default function StubScreen({ name }) {
  const info = INFO[name] || INFO.calendar;
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Icon name={info.icon} size={30} color={colors.primary} />
      </View>
      <Text style={styles.title}>{info.title}</Text>
      <Text style={styles.desc}>{info.desc}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>준비 중</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create(scaled({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },
  iconWrap: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.peachSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  desc: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  badge: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.peachSoft,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  badgeText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
}));
