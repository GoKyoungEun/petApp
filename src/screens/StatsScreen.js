// 통계 화면 — 05_UI_UX "통계 화면".
//
// 카드 순서는 문서에 확정돼 있다: 기록한 날짜 수 → 컨디션 → 배변 → 소변 →
// 산책 → 몸무게. 몸무게만 자기 기간 필터를 따로 갖는다(체중은 며칠 단위로
// 보면 의미가 없고, 나머지는 최근 흐름을 보는 카드라 기간이 짧다).
//
// 카드 다섯 장은 기간 조회 한 번으로 만든다. 몸무게만 "전체" 옵션이 있어
// 항목별 조회를 따로 쓴다.
//
// 데이터가 부족하면 그래프를 억지로 만들지 않고 안내 문구를 띄운다(05_UI_UX).

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Icon from '../Icon';
import { colors } from '../theme';
import { useStore } from '../store';
import { scaled } from '../scale';
import { addDays, formatDot } from '../date';
import { useRecordsInRange, useRecordsByType } from '../queries/records';
import {
  recordedDays, conditionStats, stoolStats, urineStats, walkStats, weightStats,
  CONDITION_LEVELS, STOOL_STATES,
} from '../stats';
import Sparkline from '../components/Sparkline';

// 05_UI_UX "기간 필터: 7일, 30일, 3개월, 1년"
const PERIODS = [
  { key: '7d', label: '7일', days: 7 },
  { key: '30d', label: '30일', days: 30 },
  { key: '3m', label: '3개월', days: 90 },
  { key: '1y', label: '1년', days: 365 },
];

// 05_UI_UX "몸무게 카드에는 별도 필터를 둔다"
const WEIGHT_PERIODS = [
  { key: '1m', label: '1개월', days: 30 },
  { key: '3m', label: '3개월', days: 90 },
  { key: '6m', label: '6개월', days: 180 },
  { key: '1y', label: '1년', days: 365 },
  { key: 'all', label: '전체', days: null },
];

const CONDITION_COLOR = {
  '좋아요': colors.good,
  '보통': colors.accent,
  '안 좋아요': colors.badBorder,
};

const STOOL_COLOR = {
  '정상': colors.good,
  '설사': colors.warnBorder,
  '색 이상': colors.badBorder,
};

export default function StatsScreen() {
  const { petId, today, pet, openRecords } = useStore();

  const [period, setPeriod] = useState('30d');
  const [weightPeriod, setWeightPeriod] = useState('3m');
  const [cardWidth, setCardWidth] = useState(0);

  const days = PERIODS.find((p) => p.key === period).days;
  // 오늘을 포함해 N일 — 7일 필터면 오늘과 그 앞 6일.
  const from = addDays(today, -(days - 1));

  const { data: records = [], isLoading } = useRecordsInRange(petId, from, today);
  // 몸무게는 "전체"를 고를 수 있어 기간 조회로는 못 덮는다.
  const { data: weightRecords = [] } = useRecordsByType(petId, 'weight');

  const stats = useMemo(() => ({
    recorded: recordedDays(records, from, today),
    condition: conditionStats(records),
    stool: stoolStats(records, from, today),
    urine: urineStats(records, from, today),
    walk: walkStats(records),
  }), [records, from, today]);

  const weight = useMemo(() => {
    const wDays = WEIGHT_PERIODS.find((p) => p.key === weightPeriod).days;
    const wFrom = wDays ? addDays(today, -(wDays - 1)) : null;
    const inRange = wFrom
      ? weightRecords.filter((r) => r.recordDate >= wFrom)
      : weightRecords;
    return weightStats(inRange);
  }, [weightRecords, weightPeriod, today]);

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>

      <View style={styles.head}>
        <Text style={styles.title}>통계</Text>
        <Text style={styles.subtitle}>{pet}</Text>
      </View>

      <View style={styles.filterRow}>
        {PERIODS.map((p) => {
          const on = p.key === period;
          return (
            <Pressable
              key={p.key}
              style={[styles.filterChip, on && styles.filterChipOn]}
              onPress={() => setPeriod(p.key)}>
              <Text style={[styles.filterText, on && styles.filterTextOn]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.range}>{formatDot(from)} — {formatDot(today)}</Text>

      {isLoading ? (
        <Card><Text style={styles.empty}>불러오는 중이에요</Text></Card>
      ) : (
        <>
          {/* 1. 기록한 날짜 수 */}
          <Card title="기록한 날짜 수" icon="calendar">
            <View style={styles.bigRow}>
              <Text style={styles.big}>{stats.recorded.days}</Text>
              <Text style={styles.bigUnit}>/ {stats.recorded.total}일</Text>
            </View>
            <Bar ratio={stats.recorded.ratio} color={colors.primary} />
            <Text style={styles.note}>
              하루에 한 건이라도 남긴 날을 셉니다
            </Text>
          </Card>

          {/* 2. 컨디션 변화 */}
          <Card title="컨디션 변화" icon="condition">
            {stats.condition.total === 0 ? (
              <Text style={styles.empty}>이 기간에 컨디션 기록이 없어요</Text>
            ) : (
              <>
                <View style={styles.bigRow}>
                  <Text style={styles.big}>{stats.condition.latest}</Text>
                  <Text style={styles.bigUnit}>최근</Text>
                </View>
                <StackBar
                  parts={CONDITION_LEVELS.map((l) => ({
                    ratio: stats.condition.ratios[l],
                    color: CONDITION_COLOR[l],
                  }))}
                />
                <Legend
                  items={CONDITION_LEVELS.map((l) => ({
                    label: l,
                    value: `${stats.condition.counts[l]}회`,
                    color: CONDITION_COLOR[l],
                  }))}
                />
              </>
            )}
          </Card>

          {/* 3. 배변 상태 및 횟수 */}
          <Card title="배변" icon="poop">
            {stats.stool.total === 0 ? (
              <Text style={styles.empty}>이 기간에 배변 기록이 없어요</Text>
            ) : (
              <>
                <View style={styles.bigRow}>
                  <Text style={styles.big}>{stats.stool.total}</Text>
                  <Text style={styles.bigUnit}>회 · 하루 평균 {stats.stool.perDay}회</Text>
                </View>
                <StackBar
                  parts={STOOL_STATES.map((s) => ({
                    ratio: stats.stool.total ? stats.stool.counts[s] / stats.stool.total : 0,
                    color: STOOL_COLOR[s],
                  }))}
                />
                <Legend
                  items={STOOL_STATES.map((s) => ({
                    label: s,
                    value: `${stats.stool.counts[s]}회`,
                    color: STOOL_COLOR[s],
                  }))}
                />
              </>
            )}
          </Card>

          {/* 4. 소변 횟수 */}
          <Card title="소변" icon="pee">
            {stats.urine.total === 0 ? (
              <Text style={styles.empty}>이 기간에 소변 기록이 없어요</Text>
            ) : (
              <View style={styles.bigRow}>
                <Text style={styles.big}>{stats.urine.total}</Text>
                <Text style={styles.bigUnit}>회 · 하루 평균 {stats.urine.perDay}회</Text>
              </View>
            )}
          </Card>

          {/* 5. 산책 횟수 및 총시간 */}
          <Card title="산책" icon="walk">
            {stats.walk.count === 0 ? (
              <Text style={styles.empty}>이 기간에 산책 기록이 없어요</Text>
            ) : (
              <>
                <View style={styles.bigRow}>
                  <Text style={styles.big}>{stats.walk.count}</Text>
                  <Text style={styles.bigUnit}>회 · 총 {stats.walk.minutes}분</Text>
                </View>
                <Text style={styles.note}>한 번에 평균 {stats.walk.perWalk}분</Text>
              </>
            )}
          </Card>

          {/* 6. 몸무게 변화 — 자기 기간 필터를 갖는다 */}
          <Card
            title="몸무게"
            icon="weight"
            onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}>
            <View style={styles.filterRowSmall}>
              {WEIGHT_PERIODS.map((p) => {
                const on = p.key === weightPeriod;
                return (
                  <Pressable
                    key={p.key}
                    style={[styles.filterChipSmall, on && styles.filterChipOn]}
                    onPress={() => setWeightPeriod(p.key)}>
                    <Text style={[styles.filterTextSmall, on && styles.filterTextOn]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {weight.points.length === 0 ? (
              <Text style={styles.empty}>이 기간에 몸무게 기록이 없어요</Text>
            ) : (
              <>
                <View style={styles.bigRow}>
                  <Text style={styles.big}>{weight.latest}</Text>
                  <Text style={styles.bigUnit}>kg</Text>
                  {weight.change != null && weight.change !== 0 && (
                    <Text
                      style={[
                        styles.change,
                        { color: weight.change > 0 ? colors.warnText : colors.blue },
                      ]}>
                      {weight.change > 0 ? '▲' : '▼'} {Math.abs(weight.change)} kg
                    </Text>
                  )}
                </View>

                {weight.points.length < 2 ? (
                  // 05_UI_UX "데이터가 부족할 경우 그래프를 억지로 만들지 않는다"
                  <Text style={styles.empty}>측정이 두 번 이상이면 변화를 그려요</Text>
                ) : (
                  <Sparkline points={weight.points} width={cardWidth} />
                )}

                <Pressable style={styles.moreLink} onPress={() => openRecords('weight')}>
                  <Text style={styles.moreLinkText}>측정 기록 보기</Text>
                  <Icon name="chevron-right" size={13} color={colors.textMuted} />
                </Pressable>
              </>
            )}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function Card({ title, icon, children, onLayout }) {
  return (
    <View style={styles.card}>
      {title && (
        <View style={styles.cardHead}>
          <Icon name={icon} size={16} />
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
      )}
      <View style={styles.cardBody} onLayout={onLayout}>{children}</View>
    </View>
  );
}

function Bar({ ratio, color }) {
  return (
    <View style={styles.barTrack}>
      <View
        style={[
          styles.barFill,
          // 0%도 굵기가 보이면 "조금 있음"으로 오해된다 — 0이면 아예 그리지 않는다.
          { width: `${Math.round(ratio * 100)}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

// 비율 막대 하나에 여러 색을 이어 붙인다.
function StackBar({ parts }) {
  const visible = parts.filter((p) => p.ratio > 0);
  if (visible.length === 0) return null;
  return (
    <View style={styles.barTrack}>
      {visible.map((p, i) => (
        <View
          key={i}
          style={{ width: `${Math.round(p.ratio * 100)}%`, backgroundColor: p.color }}
        />
      ))}
    </View>
  );
}

function Legend({ items }) {
  return (
    <View style={styles.legend}>
      {items.map((it) => (
        <View key={it.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: it.color }]} />
          <Text style={styles.legendLabel}>{it.label}</Text>
          <Text style={styles.legendValue}>{it.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create(scaled({
  wrap: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 28 },

  head: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingTop: 16 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },

  filterRow: { flexDirection: 'row', gap: 7, marginTop: 14 },
  filterChip: {
    flex: 1, // 넷이 폭을 균등하게 — 기기 폭이 달라도 줄바꿈이 없다
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingVertical: 9,
    backgroundColor: colors.surface,
  },
  filterChipOn: { borderColor: colors.accent, backgroundColor: colors.peachLight },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.textBody },
  filterTextOn: { color: colors.accentText, fontWeight: '800' },

  filterRowSmall: { flexDirection: 'row', gap: 5, marginBottom: 12 },
  filterChipSmall: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  filterTextSmall: { fontSize: 11, fontWeight: '600', color: colors.textBody },

  range: { fontSize: 11, color: colors.textFaint, marginTop: 8, marginBottom: 4 },

  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    marginTop: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  cardBody: { gap: 8 },

  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  big: { fontSize: 24, fontWeight: '800', color: colors.text },
  bigUnit: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  change: { fontSize: 12, fontWeight: '800', marginLeft: 4 },
  note: { fontSize: 11, color: colors.textFaint },
  empty: { fontSize: 12, color: colors.textMuted, paddingVertical: 6 },

  barTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.divider,
    overflow: 'hidden',
  },
  barFill: { height: '100%' },

  legend: { gap: 5, marginTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendLabel: { flex: 1, fontSize: 12, color: colors.textBody },
  legendValue: { fontSize: 12, fontWeight: '700', color: colors.text },

  moreLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    marginTop: 4,
  },
  moreLinkText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
}));
