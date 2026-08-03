// 몸무게 전용 화면 — 02_MVP §7.
//
// 통계의 몸무게 카드에서 "자세히"로 들어온다. 카드의 스파크라인은 추이만
// 보여 주는 작은 그림이고, 여기서는 눈금·날짜·측정 로그까지 본다.
//
// 하단 탭에 없는 하위 화면이라 AllRecordsScreen과 같은 방식이다: tab 값으로
// 열고 헤더의 뒤로가기로 돌아간다.

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line as SvgLine } from 'react-native-svg';
import Icon from '../Icon';
import { colors } from '../theme';
import { useStore } from '../store';
import { scaled, s } from '../scale';
import { addDays, formatDay, formatDot, parseYmd } from '../date';
import { useRecordsByType } from '../queries/records';
import { weightStats } from '../stats';

// 02_MVP §7 "그래프 기간"
const PERIODS = [
  { key: '1m', label: '1개월', days: 30 },
  { key: '3m', label: '3개월', days: 90 },
  { key: '6m', label: '6개월', days: 180 },
  { key: '1y', label: '1년', days: 365 },
  { key: 'all', label: '전체', days: null },
];

const CHART_H = s(190);
const AXIS_W = s(38); // kg 라벨 자리
const BOTTOM_H = s(20); // 날짜 라벨 자리
const PAD_T = s(10);

export default function WeightScreen() {
  const { petId, today, setTab, openSheet, openEditRecord } = useStore();
  const [period, setPeriod] = useState('3m');
  const [chartWidth, setChartWidth] = useState(0);

  const { data: all = [] } = useRecordsByType(petId, 'weight');

  const { records, stats } = useMemo(() => {
    const days = PERIODS.find((p) => p.key === period).days;
    const from = days ? addDays(today, -(days - 1)) : null;
    const inRange = from ? all.filter((r) => r.recordDate >= from) : all;
    return { records: inRange, stats: weightStats(inRange) };
  }, [all, period, today]);

  // 로그는 최신이 위. useRecordsByType이 이미 내림차순으로 주지만, 정렬을
  // 믿고 쓰는 자리라 여기서 한 번 더 명시한다(stats.js와 같은 이유).
  const log = useMemo(
    () => [...records].sort((a, b) => (a.recordDate > b.recordDate ? -1 : 1)),
    [records]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={() => setTab('stats')} hitSlop={8}>
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>몸무게</Text>
        <Pressable style={styles.addBtn} onPress={() => openSheet('weight')} hitSlop={6}>
          <Icon name="plus" size={14} color={colors.accentText} />
          <Text style={styles.addBtnText}>기록</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>

        <View style={styles.filterRow}>
          {PERIODS.map((p) => {
            const on = p.key === period;
            return (
              <Pressable
                key={p.key}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => setPeriod(p.key)}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
          {stats.points.length === 0 ? (
            <Empty
              title="이 기간에 측정 기록이 없어요"
              sub="몸무게를 기록하면 변화를 그래프로 볼 수 있어요"
            />
          ) : (
            <>
              <View style={styles.summary}>
                <View>
                  <Text style={styles.summaryLabel}>최근 몸무게</Text>
                  <View style={styles.kgRow}>
                    <Text style={styles.kg}>{stats.latest}</Text>
                    <Text style={styles.kgUnit}>kg</Text>
                  </View>
                </View>
                {stats.change != null && (
                  <View style={styles.changeBox}>
                    <Text style={styles.summaryLabel}>기간 변화</Text>
                    <Text
                      style={[
                        styles.change,
                        {
                          color:
                            stats.change > 0
                              ? colors.warnText
                              : stats.change < 0
                                ? colors.blue
                                : colors.textMuted,
                        },
                      ]}>
                      {stats.change > 0 ? '+' : ''}{stats.change} kg
                    </Text>
                  </View>
                )}
              </View>

              {/* 02_MVP §7 · 05_UI_UX — 점이 하나면 선을 그릴 수 없다.
                  억지로 그리지 않고 안내만 낸다. */}
              {stats.points.length < 2 ? (
                <Text style={styles.hint}>측정이 두 번 이상이면 변화를 그려요</Text>
              ) : (
                <Chart points={stats.points} width={chartWidth - s(28)} />
              )}
            </>
          )}
        </View>

        {log.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>측정 기록</Text>
            <View style={styles.log}>
              {log.map((r, i) => {
                // 바로 이전 측정(시간상 더 과거)과 비교한다. 목록이 내림차순이라
                // 다음 항목이 그것이다. 가장 오래된 건은 비교 대상이 없다.
                const prev = log[i + 1];
                const kg = Number(r.data?.kg);
                const delta =
                  prev && Number.isFinite(Number(prev.data?.kg))
                    ? Math.round((kg - Number(prev.data.kg)) * 10) / 10
                    : null;
                return (
                  <Pressable
                    key={r.id}
                    style={[styles.logRow, i === log.length - 1 && styles.logRowLast]}
                    onPress={() => openEditRecord(r)}>
                    <Text style={styles.logDate}>{formatDay(r.recordDate)}</Text>
                    <View style={styles.logRight}>
                      {delta != null && delta !== 0 && (
                        <Text
                          style={[
                            styles.logDelta,
                            { color: delta > 0 ? colors.warnText : colors.blue },
                          ]}>
                          {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
                        </Text>
                      )}
                      <Text style={styles.logKg}>{kg} kg</Text>
                      <Icon name="chevron-right" size={13} color={colors.textGhost} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// 눈금·kg 라벨·날짜 라벨이 있는 선 그래프. x축은 순번이 아니라 날짜에
// 비례한다 — 간격이 다른 측정을 같은 폭으로 그리면 추이를 잘못 읽는다.
function Chart({ points, width }) {
  if (!width || width <= 0) return null;

  const xs = points.map((p) => parseYmd(p.date).getTime());
  const ys = points.map((p) => p.kg);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const rawMin = Math.min(...ys);
  const rawMax = Math.max(...ys);

  // 값이 위아래 테두리에 붙지 않게 여유를 준다. 몸무게가 내내 같으면 폭이
  // 0이라 눈금이 겹치므로 ±0.5kg을 임의로 벌린다.
  const span = rawMax - rawMin;
  const padY = span === 0 ? 0.5 : span * 0.15;
  const minY = rawMin - padY;
  const maxY = rawMax + padY;

  const plotW = width - AXIS_W;
  const plotH = CHART_H - BOTTOM_H - PAD_T;

  const px = (t) => AXIS_W + (maxX === minX ? plotW / 2 : ((t - minX) / (maxX - minX)) * plotW);
  const py = (kg) => PAD_T + plotH - ((kg - minY) / (maxY - minY)) * plotH;

  const GRIDS = 4;
  const gridValues = Array.from(
    { length: GRIDS + 1 },
    (_, i) => minY + ((maxY - minY) * i) / GRIDS
  );

  return (
    <View style={{ width, height: CHART_H }}>
      <Svg width={width} height={CHART_H}>
        {gridValues.map((v, i) => (
          <SvgLine
            key={i}
            x1={AXIS_W}
            y1={py(v)}
            x2={width}
            y2={py(v)}
            stroke={colors.divider}
            strokeWidth={1}
          />
        ))}
        <Polyline
          points={points.map((p, i) => `${px(xs[i])},${py(p.kg)}`).join(' ')}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <Circle key={i} cx={px(xs[i])} cy={py(p.kg)} r={3} fill={colors.primary} />
        ))}
      </Svg>

      {/* kg 라벨 — SVG Text 대신 RN Text를 겹쳐 글꼴이 앱과 같게 한다. */}
      {gridValues.map((v, i) => (
        <Text key={i} style={[styles.axisLabel, { top: py(v) - s(7) }]}>
          {v.toFixed(1)}
        </Text>
      ))}

      <View style={[styles.dateRow, { left: AXIS_W, width: plotW }]}>
        <Text style={styles.dateLabel}>{formatDot(points[0].date)}</Text>
        <Text style={styles.dateLabel}>{formatDot(points[points.length - 1].date)}</Text>
      </View>
    </View>
  );
}

function Empty({ title, sub }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
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
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  addBtnText: { color: colors.accentText, fontWeight: '700', fontSize: 12 },

  content: { paddingHorizontal: 18, paddingBottom: 28 },

  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  chip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.peachLight },
  chipText: { fontSize: 11, fontWeight: '600', color: colors.textBody },
  chipTextOn: { color: colors.accentText, fontWeight: '800' },

  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 14,
  },
  summary: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  kgRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 },
  kg: { fontSize: 26, fontWeight: '800', color: colors.text },
  kgUnit: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  changeBox: { alignItems: 'flex-end' },
  change: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  hint: { fontSize: 12, color: colors.textMuted, paddingVertical: 16, textAlign: 'center' },

  axisLabel: {
    position: 'absolute',
    left: 0,
    width: AXIS_W - s(6),
    textAlign: 'right',
    fontSize: 9,
    color: colors.textGhost,
    fontWeight: '600',
  },
  dateRow: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateLabel: { fontSize: 9, color: colors.textGhost, fontWeight: '600' },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 18,
    marginBottom: 8,
  },
  log: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: 'hidden' },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  logRowLast: { borderBottomWidth: 0 },
  logDate: { fontSize: 13, color: colors.textBody },
  logRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logDelta: { fontSize: 11, fontWeight: '800' },
  logKg: { fontSize: 13, fontWeight: '800', color: colors.text },

  empty: { alignItems: 'center', paddingVertical: 34, gap: 6 },
  emptyTitle: { fontSize: 13, fontWeight: '700', color: colors.textBody },
  emptySub: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
}));
