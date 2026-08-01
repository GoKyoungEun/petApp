import React from 'react';
import { View, Text, Image, ScrollView, Pressable, StyleSheet } from 'react-native';
import Icon from '../Icon';
import { colors } from '../theme';
import { useStore } from '../store';
import { recordRepo } from '../repository';
import { speciesMeta } from '../pets';
import { addDays, formatHeader } from '../date';
import { scaled } from '../scale';

// 강아지 = 산책 / 고양이 = 컨디션 (02_MVP_Requirement §3)
const QUICK_BASE = [
  { key: 'meal', icon: 'meal', label: '식사' },
  { key: 'poop', icon: 'poop', label: '배변' },
  { key: 'pee', icon: 'pee', label: '소변' },
];
const SPECIES_ITEM = {
  dog: { key: 'walk', icon: 'walk', label: '산책' },
  cat: { key: 'condition', icon: 'condition', label: '컨디션' },
};

// "오늘도 평소와 같아요" copies these types from yesterday.
const SAME_TYPES = {
  dog: ['meal', 'stool', 'urine', 'walk'],
  cat: ['meal', 'stool', 'urine', 'condition'],
};

export default function HomeScreen() {
  const { pet, species, currentPet, petId, today, setShowPetMenu, openSheet, todayItems, addRecords, showToast, setTab } =
    useStore();

  const meta = speciesMeta(species);
  const speciesItem = SPECIES_ITEM[species] || SPECIES_ITEM.dog;
  const quick = [...QUICK_BASE, speciesItem];

  // Copy yesterday's core-type records into today. If yesterday has none,
  // show a toast instead of creating anything.
  const sameAsUsual = async () => {
    if (!petId) return;
    const types = SAME_TYPES[species] || SAME_TYPES.dog;
    const prev = await recordRepo.listByDate(petId, addDays(today, -1));
    const copy = prev
      .filter((r) => types.includes(r.recordType))
      .map((r) => {
        const { photos, ...data } = r.data || {}; // don't duplicate photos
        return { recordType: r.recordType, data };
      });
    if (copy.length === 0) {
      showToast('어제 기록이 없어 불러올 수 없어요');
      return;
    }
    addRecords(copy, '어제 기록을 불러왔어요');
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* header */}
      <View style={styles.headerRow}>
        <Pressable style={styles.petBtn} onPress={() => setShowPetMenu(true)}>
          <View style={[styles.petAvatar, { backgroundColor: meta.bg }]}>
            {currentPet?.photoUrl ? (
              <Image source={{ uri: currentPet.photoUrl }} style={styles.petAvatarImg} />
            ) : (
              <Icon name={meta.icon} size={19} color={meta.fg} />
            )}
          </View>
          <Text style={styles.petName}>{pet}</Text>
          <Icon name="chevron-down" size={16} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.dateText}>{formatHeader(today)}</Text>
      </View>

      {/* same as usual */}
      <Pressable style={styles.sameBtn} onPress={sameAsUsual}>
        <Icon name="checks" size={20} color={colors.accentText} />
        <Text style={styles.sameBtnText}>오늘도 평소와 같아요</Text>
      </Pressable>

      {/* quick record */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>빠른 기록</Text>
        <View style={styles.quickGrid}>
          {quick.map((q) => (
            <Pressable
              key={q.key}
              style={styles.quickCell}
              onPress={() => openSheet(q.key)}
            >
              <Icon name={q.icon} size={21} color={colors.primary} />
              <Text style={styles.quickLabel}>{q.label}</Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.quickCell, styles.quickMore]}
            onPress={() => openSheet('more')}
          >
            <Icon name="dots" size={21} color={colors.textMuted} />
            <Text style={[styles.quickLabel, { color: colors.textFaint }]}>
              더보기
            </Text>
          </Pressable>
        </View>
      </View>

      {/* next schedule */}
      <Pressable style={styles.schedCard}>
        <View style={styles.rowCenter}>
          <View style={styles.schedIcon}>
            <Icon name="vaccine" size={18} color={colors.blue} />
          </View>
          <View>
            <Text style={styles.schedSmall}>다음 일정</Text>
            <Text style={styles.schedTitle}>심장사상충</Text>
          </View>
        </View>
        <View style={styles.dBadge}>
          <Text style={styles.dBadgeText}>D-3</Text>
        </View>
      </Pressable>

      {/* today records */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>오늘 기록</Text>
          <Pressable style={styles.moreLink} onPress={() => setTab('records')} hitSlop={8}>
            <Text style={styles.moreLinkText}>전체 보기</Text>
            <Icon name="chevron-right" size={13} color={colors.textMuted} />
          </Pressable>
        </View>
        {todayItems.length > 0 ? (
          <View style={styles.recordCard}>
            {todayItems.map((it, i) => (
              <RecordRow
                key={it.type}
                icon={it.icon}
                label={it.label}
                value={it.value}
                filled
                last={i === todayItems.length - 1}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyToday}>
            <Text style={styles.emptyTodayText}>아직 오늘 기록이 없어요</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function RecordRow({ icon, label, value, filled, last }) {
  return (
    <View style={[styles.recRow, last && styles.recRowLast]}>
      <View style={styles.rowCenter}>
        <Icon name={icon} size={16} color={colors.primary} />
        <Text style={styles.recLabel}>{label}</Text>
      </View>
      <Text
        style={[
          styles.recValue,
          { color: filled ? (icon === 'meal' ? colors.primary : colors.text) : colors.textGhost },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create(scaled({
  scroll: { flex: 1 },
  content: { padding: 18, paddingTop: 12, paddingBottom: 24, gap: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  petBtn: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  petAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.peach,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  petAvatarImg: { width: 36, height: 36 },
  petName: { fontWeight: '800', fontSize: 17, color: colors.text },
  dateText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  sameBtn: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sameBtnText: { color: colors.accentText, fontWeight: '700', fontSize: 15 },
  section: { gap: 9 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moreLink: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  moreLinkText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textFaint },
  quickGrid: { flexDirection: 'row', gap: 7 },
  quickCell: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 15,
    paddingVertical: 13,
    alignItems: 'center',
    gap: 6,
  },
  quickMore: {
    borderStyle: 'dashed',
    borderColor: '#CFC7BC',
    backgroundColor: colors.surfaceMuted,
  },
  quickLabel: { fontSize: 10, color: '#7A736B', fontWeight: '600' },
  schedCard: {
    backgroundColor: colors.blueBg,
    borderRadius: 16,
    padding: 14,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  schedIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.blueChip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schedSmall: { fontSize: 11, color: '#5E86A6', fontWeight: '500' },
  schedTitle: { fontSize: 14, fontWeight: '700', color: colors.blueDark, marginTop: 2 },
  dBadge: {
    backgroundColor: colors.blue,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  dBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  recordCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptyToday: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 22,
    alignItems: 'center',
  },
  emptyTodayText: { fontSize: 12, color: colors.textGhost },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  recRowLast: { borderBottomWidth: 0 },
  recLabel: { fontSize: 13, color: colors.textBody },
  recValue: { fontSize: 13, fontWeight: '700' },
}));
