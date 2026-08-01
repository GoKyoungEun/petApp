import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Icon from '../Icon';
import { colors } from '../theme';
import { useStore } from '../store';
import { scaled } from '../scale';

const TABS = [
  { key: 'home', label: '홈' },
  { key: 'calendar', label: '캘린더' },
  { key: 'schedule', label: '일정' },
  { key: 'stats', label: '통계' },
  { key: 'my', label: 'MY' },
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
            {/* The illustrated nav icons carry their own colour, so the state
                comes from which file we pick, not from a tint. */}
            <Icon name={`nav-${t.key}-${active ? 'active' : 'inactive'}`} size={22} />
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
