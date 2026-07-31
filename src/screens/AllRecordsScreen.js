import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, StyleSheet } from 'react-native';
import Icon from '../Icon';
import { colors } from '../theme';
import { useStore } from '../store';
import { recordRepo } from '../repository';
import { formatDay, parseYmd } from '../date';

// Item tabs, fixed order per 05_UI_UX. key = recordType (healthPhoto has no
// records yet — photos aren't attached to records in this pass).
const ITEMS = [
  { key: 'meal', label: '식사' },
  { key: 'stool', label: '배변' },
  { key: 'urine', label: '소변' },
  { key: 'vomit', label: '구토' },
  { key: 'walk', label: '산책' },
  { key: 'weight', label: '몸무게' },
  { key: 'healthPhoto', label: '건강사진' },
  { key: 'condition', label: '컨디션' },
  { key: 'note', label: '메모' },
];

const PHOTO_CATEGORIES = ['눈', '코', '발', '피부 및 모질', '기타'];

// recordType → quick-sheet key for the "기록 추가" shortcut.
const SHEET_KEY = {
  meal: 'meal', stool: 'poop', urine: 'pee', vomit: 'vomit',
  walk: 'walk', condition: 'condition', weight: 'weight', note: 'memo',
};

function formatDate(s) {
  const d = parseYmd(s);
  if (isNaN(d.getTime())) return s;
  return formatDay(s);
}

function describe(type, r) {
  const d = r.data || {};
  switch (type) {
    case 'meal': return d.state || '기록';
    case 'stool': return d.state || '기록';
    case 'urine': return '소변';
    case 'vomit': return '구토';
    case 'walk': return `${d.minutes ?? 0}분`;
    case 'weight': return `${d.kg ?? '-'} kg`;
    case 'condition':
      return d.level + (d.symptoms?.length ? ` · ${d.symptoms.join(', ')}` : '');
    case 'note': return r.memo || '메모';
    default: return '';
  }
}

// Group records into date buckets, newest date first.
function groupByDate(records) {
  const map = new Map();
  for (const r of records) {
    if (!map.has(r.recordDate)) map.set(r.recordDate, []);
    map.get(r.recordDate).push(r);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

export default function AllRecordsScreen() {
  const { petId, setTab, openSheet } = useStore();
  const [type, setType] = useState('meal');
  const [records, setRecords] = useState([]);
  const [photoCat, setPhotoCat] = useState('눈');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!petId || type === 'healthPhoto') {
        if (alive) setRecords([]);
        return;
      }
      const list = await recordRepo.listByType(petId, type);
      if (alive) setRecords(list);
    })();
    return () => {
      alive = false;
    };
  }, [petId, type]);

  const grouped = groupByDate(records);
  const isPhoto = type === 'healthPhoto';
  const empty = isPhoto || grouped.length === 0;

  const addRecord = () => {
    const key = SHEET_KEY[type];
    if (key) {
      setTab('home');
      openSheet(key, key !== 'meal' && key !== 'poop' && key !== 'pee' && key !== 'walk');
    } else {
      setTab('home');
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={() => setTab('home')} hitSlop={8}>
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>전체 기록</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsRow}
        contentContainerStyle={styles.tabsContent}
      >
        {ITEMS.map((it) => {
          const on = it.key === type;
          return (
            <Pressable
              key={it.key}
              style={[styles.tab, on && styles.tabOn]}
              onPress={() => setType(it.key)}
            >
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{it.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isPhoto && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.catRow}
          contentContainerStyle={styles.catContent}
        >
          {PHOTO_CATEGORIES.map((c) => {
            const on = c === photoCat;
            return (
              <Pressable
                key={c}
                style={[styles.cat, on && styles.catOn]}
                onPress={() => setPhotoCat(c)}
              >
                <Text style={[styles.catText, on && styles.catTextOn]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {empty ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              {isPhoto ? '아직 등록된 사진이 없어요' : '이날은 아직 기록이 없어요'}
            </Text>
            {!isPhoto && (
              <Pressable style={styles.emptyBtn} onPress={addRecord}>
                <Icon name="plus" size={15} color={colors.accentText} />
                <Text style={styles.emptyBtnText}>기록 추가</Text>
              </Pressable>
            )}
          </View>
        ) : (
          grouped.map(([date, items]) => (
            <View key={date} style={styles.card}>
              <Text style={styles.cardDate}>{formatDate(date)}</Text>
              {items.map((r) => (
                <View key={r.id} style={styles.entryBlock}>
                  <View style={styles.entry}>
                    <View style={styles.dot} />
                    <Text style={styles.entryText}>{describe(type, r)}</Text>
                  </View>
                  {r.memo ? <Text style={styles.entryMemo}>{r.memo}</Text> : null}
                  {r.data?.photos?.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                      {r.data.photos.map((uri, i) => (
                        <Image key={i} source={{ uri }} style={styles.entryPhoto} />
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
              ))}
              {(type === 'urine' || type === 'vomit') && (
                <Text style={styles.countHint}>총 {items.length}회</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  tabsRow: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabsContent: { paddingHorizontal: 14, paddingBottom: 10, gap: 7 },
  tab: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  tabOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  tabText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  tabTextOn: { color: colors.accentText, fontWeight: '700' },
  catRow: { flexGrow: 0, marginTop: 10 },
  catContent: { paddingHorizontal: 16, gap: 7 },
  cat: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 13,
  },
  catOn: { borderColor: colors.primary, backgroundColor: colors.peachSoft },
  catText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  catTextOn: { color: colors.primary, fontWeight: '700' },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 15,
    gap: 8,
  },
  cardDate: { fontSize: 13, fontWeight: '800', color: colors.text },
  entryBlock: { gap: 7 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  entryText: { fontSize: 13, color: colors.textBody, fontWeight: '600', flex: 1 },
  entryMemo: { fontSize: 12, color: colors.textMuted, marginLeft: 15, lineHeight: 17 },
  photoRow: { marginLeft: 15 },
  entryPhoto: { width: 64, height: 64, borderRadius: 10, marginRight: 8, backgroundColor: colors.surfaceMuted },
  countHint: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  emptyWrap: { alignItems: 'center', paddingTop: 70, gap: 14 },
  emptyText: { fontSize: 13, color: colors.textMuted },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  emptyBtnText: { color: colors.accentText, fontWeight: '700', fontSize: 13 },
});
