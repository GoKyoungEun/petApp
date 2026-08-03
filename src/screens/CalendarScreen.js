import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Icon from '../Icon';
import { colors } from '../theme';
import { useStore, summarizeDay } from '../store';
import { useRecordDates, useRecordsByDate } from '../queries/records';
import { WEEKDAYS, formatDay, parseYmd, ymd, monthRows, weekRows } from '../date';
import { scheduleTitle, scheduleIcon } from '../scheduleRepo';
import { scaled } from '../scale';

export default function CalendarScreen() {
  const { petId, today, setTab, openRecords, openSheet, schedules, openScheduleForm } = useStore();

  // Opens on the current month with today selected; the user's later navigation
  // is theirs to keep, so a midnight rollover must not yank the view back.
  const [view, setView] = useState(() => {
    const d = parseYmd(today);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);

  // 'month' = 6주 격자, 'week' = 선택한 날이 든 한 주만. 주간으로 접으면 아래
  // 날짜별 기록 패널이 그만큼 넓어진다.
  const [mode, setMode] = useState('month');

  const { data: dates } = useRecordDates(petId);
  const { data: dayRecords = [] } = useRecordsByDate(petId, selected);

  const recordDates = useMemo(() => new Set(dates ?? []), [dates]);

  // 05_UI_UX "일정은 별도 아이콘 또는 작은 배지로 표시한다" — 기록 점과 색을
  // 달리해 한 칸에서 둘을 구분한다. 완료·취소된 일정은 표시하지 않는다.
  const scheduleDates = useMemo(
    () => new Set(schedules.filter((s) => s.status === 'planned').map((s) => s.scheduledDate)),
    [schedules]
  );
  const daySchedules = useMemo(
    () => schedules.filter((s) => s.scheduledDate === selected),
    [schedules, selected]
  );
  const rows = useMemo(
    () => (mode === 'week' ? weekRows(selected) : monthRows(view.year, view.month)),
    [mode, selected, view]
  );
  const items = summarizeDay(dayRecords);

  // 헤더 화살표는 보고 있는 단위만큼 움직인다 — 월간이면 한 달, 주간이면 한 주.
  const shift = (delta) => {
    if (mode === 'week') {
      const d = parseYmd(selected);
      const next = ymd(d.getFullYear(), d.getMonth(), d.getDate() + delta * 7);
      setSelected(next);
      // 넘어간 주가 다음 달이면 제목도 따라가야 한다.
      const nd = parseYmd(next);
      setView({ year: nd.getFullYear(), month: nd.getMonth() });
      return;
    }
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  const toggleMode = () => {
    if (mode === 'month') {
      // 다른 달을 넘겨보다 접으면, 선택한 날이 화면 밖이라 엉뚱한 주가 뜬다.
      // 보고 있던 달의 1일로 옮겨 지금 보는 자리를 유지한다.
      const d = parseYmd(selected);
      if (d.getFullYear() !== view.year || d.getMonth() !== view.month) {
        setSelected(ymd(view.year, view.month, 1));
      }
      setMode('week');
    } else {
      const d = parseYmd(selected);
      setView({ year: d.getFullYear(), month: d.getMonth() });
      setMode('month');
    }
  };

  return (
    <View style={styles.wrap}>
      {/* month header */}
      <View style={styles.monthHead}>
        <Pressable onPress={() => shift(-1)} hitSlop={10} style={styles.navBtn}>
          <Icon name="chevron-left" size={20} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.monthTitle}>{view.year}년 {view.month + 1}월</Text>
        <Pressable onPress={() => shift(1)} hitSlop={10} style={styles.navBtn}>
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
            {row.map((dateStr, ci) => {
              if (dateStr == null) return <View key={ci} style={styles.cell} />;
              const d = parseYmd(dateStr);
              const isToday = dateStr === today;
              const isSel = dateStr === selected;
              const has = recordDates.has(dateStr);
              // 주간 보기의 한 주는 옆 달로 넘어갈 수 있다 — 그 칸은 흐리게 둔다.
              const outside = d.getMonth() !== view.month;
              return (
                <Pressable key={ci} style={styles.cell} onPress={() => setSelected(dateStr)}>
                  <View style={[styles.dayCircle, isSel && styles.daySelected, isToday && styles.dayToday]}>
                    <Text style={[
                      styles.dayNum,
                      ci === 0 && styles.daySun,
                      outside && styles.dayOutside,
                      isToday && styles.dayTodayText,
                      isSel && !isToday && styles.daySelectedText,
                    ]}>
                      {d.getDate()}
                    </Text>
                  </View>
                  <View style={styles.marks}>
                    <View style={[styles.dot, has ? styles.dotOn : styles.dotOff]} />
                    {scheduleDates.has(dateStr) && <View style={[styles.dot, styles.dotSched]} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* 월간 ↔ 주간. 주간으로 접으면 아래 기록 패널이 그만큼 넓어진다. */}
      <Pressable style={styles.toggle} onPress={toggleMode} hitSlop={8}>
        <Icon
          name={mode === 'month' ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
        <Text style={styles.toggleText}>{mode === 'month' ? '주간으로' : '월간으로'}</Text>
      </Pressable>

      {/* legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, styles.dotOn]} />
          <Text style={styles.legendText}>기록 있음</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, styles.dotSched]} />
          <Text style={styles.legendText}>일정</Text>
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
        {/* 그날의 일정을 기록보다 위에 둔다 — 날짜를 열어 보는 이유가 대개
            "이날 뭐 해야 하지"라서다. 눌러 수정 시트로 간다. */}
        {daySchedules.length > 0 && (
          <View style={styles.schedList}>
            {daySchedules.map((s) => (
              <Pressable key={s.id} style={styles.schedRow} onPress={() => openScheduleForm(s)}>
                <Icon name={scheduleIcon(s)} size={16} />
                <Text style={styles.schedTitle}>{scheduleTitle(s)}</Text>
                {s.status !== 'planned' && (
                  <Text style={styles.schedDone}>
                    {s.status === 'completed' ? '완료' : '취소'}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {items.length > 0 ? (
          <View style={styles.recordCard}>
            {items.map((it, i) => (
              <Pressable
                key={it.type}
                style={[styles.recRow, i === items.length - 1 && styles.recRowLast]}
                onPress={() => openRecords(it.type)}>
                <View style={styles.rowCenter}>
                  <Icon name={it.icon} size={16} color={colors.primary} />
                  <Text style={styles.recLabel}>{it.label}</Text>
                </View>
                <View style={styles.rowCenter}>
                  <Text style={styles.recValue}>{it.value}</Text>
                  <Icon name="chevron-right" size={13} color={colors.textGhost} />
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>이날은 아직 기록이 없어요</Text>
            {/* 06_UserFlow "캘린더 → 날짜 선택 → 기록 추가". 홈으로 보내면
                고른 날짜를 잃고 오늘에 쌓이므로, 더보기 시트를 이 날짜로 연다. */}
            <Pressable style={styles.emptyBtn} onPress={() => openSheet('more', false, selected)}>
              <Icon name="plus" size={15} color={colors.accentText} />
              <Text style={styles.emptyBtnText}>기록 추가</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create(scaled({
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
  dayOutside: { color: colors.textGhost, fontWeight: '500' },
  dayTodayText: { color: '#fff', fontWeight: '800' },
  daySelectedText: { color: colors.primary, fontWeight: '800' },
  marks: { flexDirection: 'row', gap: 3, height: 5, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotOn: { backgroundColor: colors.accent },
  dotOff: { backgroundColor: 'transparent' },
  dotSched: { backgroundColor: colors.blue },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 8,
    paddingBottom: 2,
  },
  toggleText: { fontSize: 11, color: colors.textMuted, fontWeight: '700' },
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
  schedList: {
    borderWidth: 1,
    borderColor: colors.blueChip,
    backgroundColor: colors.blueBg,
    borderRadius: 16,
    paddingVertical: 4,
    marginBottom: 10,
  },
  schedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  schedTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.blueDark },
  schedDone: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
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
}));
