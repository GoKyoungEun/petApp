import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Icon from '../Icon';
import { colors } from '../theme';
import { useStore } from '../store';
import { scaled } from '../scale';

const TABS = [
  { key: 'home', icon: 'home', label: '홈' },
  { key: 'calendar', icon: 'calendar', label: '캘린더' },
  { key: 'schedule', icon: 'vaccine', label: '일정' },
  { key: 'stats', icon: 'chart', label: '통계' },
  { key: 'my', icon: 'user', label: 'MY' },
];

export default function BottomNav() {
  const { tab, setTab } = useStore();
  return (
    <View style={styles.nav}>
      {TABS.map((t) => {
        const active = tab === t.key;
        const color = active ? colors.primary : colors.textMuted;
        return (
          <Pressable key={t.key} style={styles.item} onPress={() => setTab(t.key)}>
            <Icon name={t.icon} size={22} color={color} />
            <Text style={[styles.label, { color, fontWeight: active ? '700' : '600' }]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create(scaled({
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#fff',
  },
  item: { alignItems: 'center', gap: 3 },
  label: { fontSize: 10 },
}));
