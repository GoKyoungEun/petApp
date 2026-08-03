// 기록 시트의 "기록 날짜" 줄 — 눌러서 월 달력을 펼친다.
//
// 기본값은 언제나 오늘이라 빠른 기록의 탭 수는 그대로다(02_MVP "빠른 기록"은
// 탭 → 상태 → 즉시 저장). 어제 것을 뒤늦게 적는 경우에만 한 번 더 누른다.
//
// 기록은 미래 날짜를 고를 수 없다 — 이미 일어난 일만 적는다. 반대로 일정은
// 앞날이 본체라 allowFuture로 연다(03_DB_Design "일정과 기록의 관계").
//
// 달력을 Modal로 띄우지 않는 이유는 DateSelect와 같다 — 시트가 이미 Modal
// 안이라 겹쳐 띄우면 iOS에서 깨지고, 절대 위치로 덮으면 Android가 부모 바깥을
// 잘라낸다. 아래로 밀어내는 방식이 둘 다 피한다.

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Icon from '../Icon';
import { colors } from '../theme';
import { scaled } from '../scale';
import { WEEKDAYS, formatDay, parseYmd, daysUntil, monthRows } from '../date';

const RELATIVE = { '-1': '어제', 0: '오늘', 1: '내일' };

export default function DateField({ value, today, onChange, label = '기록 날짜', allowFuture = false }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const d = parseYmd(value || today);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const pick = (dateStr) => {
    onChange(dateStr);
    setOpen(false);
  };

  const shiftMonth = (delta) => {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  // 어제·오늘·내일은 날짜만 봐서는 바로 안 읽힌다 — 굳이 달력을 열지 않아도
  // 지금 어느 날을 가리키는지 알 수 있게 붙여 준다.
  const relative = RELATIVE[daysUntil(today, value)] ?? null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>

      <Pressable style={[styles.box, open && styles.boxOn]} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.boxText}>
          {formatDay(value)}
          {relative ? <Text style={styles.relative}>{`  ${relative}`}</Text> : null}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
      </Pressable>

      {open && (
        <View style={styles.cal}>
          <View style={styles.calHead}>
            <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={styles.navBtn}>
              <Icon name="chevron-left" size={16} color={colors.textMuted} />
            </Pressable>
            <Text style={styles.calTitle}>{view.year}년 {view.month + 1}월</Text>
            <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={styles.navBtn}>
              <Icon name="chevron-right" size={16} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={w} style={[styles.weekLabel, i === 0 && styles.sun]}>{w}</Text>
            ))}
          </View>

          {monthRows(view.year, view.month).map((row, ri) => (
            <View key={ri} style={styles.gridRow}>
              {row.map((dateStr, ci) => {
                if (dateStr == null) return <View key={ci} style={styles.cell} />;
                // YYYY-MM-DD는 문자열 비교가 곧 날짜순이다.
                const future = !allowFuture && dateStr > today;
                const isSel = dateStr === value;
                const isToday = dateStr === today;
                return (
                  <Pressable
                    key={ci}
                    style={styles.cell}
                    disabled={future}
                    onPress={() => pick(dateStr)}>
                    <View style={[styles.day, isSel && styles.daySel, isToday && !isSel && styles.dayToday]}>
                      <Text style={[
                        styles.dayText,
                        ci === 0 && styles.sun,
                        future && styles.dayFuture,
                        isSel && styles.daySelText,
                      ]}>
                        {parseYmd(dateStr).getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create(scaled({
  // 가로 여백은 시트가 이미 준다(둘 다 paddingHorizontal 20) — 여기서 또
  // 주면 날짜 칸만 선택지 버튼보다 좁아진다.
  wrap: { marginBottom: 14, gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  box: {
    // 높이를 고정하지 않고 선택지 버튼(styles.choice)과 같은 값으로 맞춘다 —
    // borderWidth 1 · borderRadius 14 · paddingVertical 14. 고정 높이로 두면
    // 글꼴 배율이 바뀌는 기기에서 둘이 어긋난다.
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  boxOn: { borderColor: colors.accent, backgroundColor: colors.peachLight },
  boxText: { fontSize: 14, fontWeight: '600', color: colors.text },
  relative: { fontSize: 12, fontWeight: '700', color: colors.primary },

  cal: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingBottom: 8,
  },
  calHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 10,
  },
  navBtn: { padding: 2 },
  calTitle: { fontSize: 14, fontWeight: '800', color: colors.text, minWidth: 96, textAlign: 'center' },
  weekRow: { flexDirection: 'row', paddingHorizontal: 4, marginBottom: 2 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  sun: { color: '#C6524A' },
  gridRow: { flexDirection: 'row', paddingHorizontal: 4 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  day: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  daySel: { backgroundColor: colors.primary },
  dayToday: { borderWidth: 1, borderColor: colors.accent },
  dayText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  daySelText: { color: '#fff', fontWeight: '800' },
  // 미래는 누를 수 없다 — 위 주석 참고.
  dayFuture: { color: colors.textGhost, fontWeight: '500' },
}));
