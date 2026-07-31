import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Icon from '../Icon';
import { colors } from '../theme';
import { useStore, summarizeDay } from '../store';
import { recordRepo } from '../repository';
import { WEEKDAYS, formatDay, parseYmd, toYmd } from '../date';

const ymd = (y, m, d) => toYmd(new Date(y, m, d)); // m is 0-indexed

// Build a 6-row week grid of day numbers (null for leading/trailing blanks).
function monthGrid(year, month) {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export default function CalendarScreen() {
  const { petId, today, setTab } = useStore();

  // Opens on the current month with today selected; the user's later navigation
  // is theirs to keep, so a midnight rollover must not yank the view back.
  const [view, setView] = useState(() => {
    const d = parseYmd(today);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [recordDates, setRecordDates] = useState(new Set());
  const [dayRecords, setDayRecords] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!petId) return;
      const dates = await recordRepo.datesWithRecords(petId);
      if (alive) setRecordDates(new Set(dates));
    })();
    return () => {
      alive = false;
    };
  }, [petId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!petId) {
        if (alive) setDayRecords([]);
        return;
      }
      const list = await recordRepo.listByDate(petId, selected);
      if (alive) setDayRecords(list);
    })();
    return () => {
      alive = false;
    };
  }, [petId, selected]);

  const rows = useMemo(() => monthGrid(view.year, view.month), [view]);
  const items = summarizeDay(dayRecords);

  const shiftMonth = (delta) => {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <View style={styles.wrap}>
      {/* month header */}
      <View style={styles.monthHead}>
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={styles.navBtn}>
          <Icon name="chevron-left" size={20} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.monthTitle}>{view.year}년 {view.month + 1}월</Text>
        <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={styles.navBtn}>
          <Icon name="chevron-right" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* weekday labels */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={w} style={[styles.weekLabel, i === 0 && { color: '#C6524A' }]}>{w}</Text>
        ))}
      </View>

      {/* grid */}
      <View style={styles.grid}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.gridRow}>
            {row.map((day, ci) => {
              if (day == null) return <View key={ci} style={styles.cell} />;
              const dateStr = ymd(view.year, view.month, day);
              const isToday = dateStr === today;
              const isSel = dateStr === selected;
              const has = recordDates.has(dateStr);
              return (
                <Pressable key={ci} style={styles.cell} onPress={() => setSelected(dateStr)}>
                  <View style={[styles.dayCircle, isSel && styles.daySelected, isToday && styles.dayToday]}>
                    <Text style={[
                      styles.dayNum,
                      ci === 0 && styles.daySun,
                      isToday && styles.dayTodayText,
                      isSel && !isToday && styles.daySelectedText,
                    ]}>
                      {day}
                    </Text>
                  </View>
                  <View style={[styles.dot, has ? styles.dotOn : styles.dotOff]} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, styles.dotOn]} />
          <Text style={styles.legendText}>기록 있음</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendToday} />
          <Text style={styles.legendText}>오늘</Text>
        </View>
      </View>

      {/* selected day panel */}
      <View style={styles.panelHead}>
        <Text style={styles.panelDate}>{formatDay(selected)}</Text>
        {items.length > 0 && (
          <Pressable style={styles.moreLink} onPress={() => setTab('records')} hitSlop={8}>
            <Text style={styles.moreLinkText}>전체 기록</Text>
            <Icon name="chevron-right" size={13} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <ScrollView style={styles.panelBody} contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}>
        {items.length > 0 ? (
          <View style={styles.recordCard}>
            {items.map((it, i) => (
              <View key={it.type} style={[styles.recRow, i === items.length - 1 && styles.recRowLast]}>
                <View style={styles.rowCenter}>
                  <Icon name={it.icon} size={16} color={colors.primary} />
                  <Text style={styles.recLabel}>{it.label}</Text>
                </View>
                <Text style={styles.recValue}>{it.value}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>이날은 아직 기록이 없어요</Text>
            <Pressable style={styles.emptyBtn} onPress={() => setTab('home')}>
              <Icon name="plus" size={15} color={colors.accentText} />
              <Text style={styles.emptyBtnText}>기록 추가</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  monthHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 16,
  },
  navBtn: { padding: 4 },
  monthTitle: { fontSize: 17, fontWeight: '800', color: colors.text, minWidth: 120, textAlign: 'center' },
  weekRow: { flexDirection: 'row', paddingHorizontal: 8, marginBottom: 4 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  grid: { paddingHorizontal: 8 },
  gridRow: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 5, gap: 3 },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: colors.peachSoft, borderWidth: 1, borderColor: colors.accent },
  dayToday: { backgroundColor: colors.primary, borderWidth: 0 },
  dayNum: { fontSize: 14, color: colors.text, fontWeight: '600' },
  daySun: { color: '#C6524A' },
  dayTodayText: { color: '#fff', fontWeight: '800' },
  daySelectedText: { color: colors.primary, fontWeight: '800' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotOn: { backgroundColor: colors.accent },
  dotOff: { backgroundColor: 'transparent' },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    paddingVertical: 12,
    marginTop: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendToday: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  legendText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  panelDate: { fontSize: 15, fontWeight: '800', color: colors.text },
  moreLink: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  moreLinkText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  panelBody: { flex: 1, paddingHorizontal: 18 },
  recordCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: 'hidden' },
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
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recLabel: { fontSize: 13, color: colors.textBody },
  recValue: { fontSize: 13, fontWeight: '700', color: colors.text },
  empty: { alignItems: 'center', paddingTop: 40, gap: 14 },
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
