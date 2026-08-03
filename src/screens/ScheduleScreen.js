// 건강 일정 탭.
//
// 예정과 지난 일정을 갈라서 보여 준다. 예정은 가까운 순(D-day가 작은 순),
// 지난 것은 최근에 있었던 순 — 둘 다 "지금과 가까운 것이 위"라는 같은 규칙이다.
//
// 완료 처리는 여기서 한 번에 한다. 반복 주기가 있으면 다음 일정이 함께 생기고,
// 4초 안에 실행취소하면 상태와 자동 생성분이 같이 되돌아간다(store.js).

import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Icon from '../Icon';
import { colors } from '../theme';
import { useStore } from '../store';
import { scaled } from '../scale';
import { formatDay, daysUntil } from '../date';
import { scheduleTitle, scheduleIcon } from '../scheduleRepo';

export default function ScheduleScreen() {
  const { schedules, today, openScheduleForm, completeSchedule } = useStore();

  const { upcoming, past } = useMemo(() => {
    const up = [];
    const done = [];
    for (const s of schedules) {
      // 완료·취소는 지난 쪽으로 내린다. 예정인데 날짜가 지난 것(놓친 일정)은
      // 위에 남겨 둔다 — 아직 해야 할 일이라 눈에 보여야 한다.
      if (s.status === 'planned') up.push(s);
      else done.push(s);
    }
    up.sort((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : 1));
    done.sort((a, b) => (a.scheduledDate > b.scheduledDate ? -1 : 1));
    return { upcoming: up, past: done };
  }, [schedules]);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>건강 일정</Text>
        <Pressable style={styles.addBtn} onPress={() => openScheduleForm()}>
          <Icon name="plus" size={15} color={colors.accentText} />
          <Text style={styles.addBtnText}>일정 추가</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}>
        {schedules.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>등록된 일정이 없어요</Text>
            <Text style={styles.emptySub}>예방접종·심장사상충 같은 일정을 미리 등록해 두세요</Text>
          </View>
        ) : (
          <>
            {upcoming.length > 0 && (
              <Section label="예정">
                {upcoming.map((s) => (
                  <ScheduleCard
                    key={s.id}
                    schedule={s}
                    today={today}
                    onEdit={() => openScheduleForm(s)}
                    onComplete={() => completeSchedule(s)}
                  />
                ))}
              </Section>
            )}

            {past.length > 0 && (
              <Section label="지난 일정">
                {past.map((s) => (
                  <ScheduleCard
                    key={s.id}
                    schedule={s}
                    today={today}
                    done
                    onEdit={() => openScheduleForm(s)}
                  />
                ))}
              </Section>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ label, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.list}>{children}</View>
    </View>
  );
}

function ScheduleCard({ schedule, today, done, onEdit, onComplete }) {
  const days = daysUntil(today, schedule.scheduledDate);
  // 놓친 일정은 예정인데 날짜가 지난 것. 상태로는 planned지만 사용자에게는
  // "지났다"고 말해 주는 편이 정확하다.
  const overdue = !done && days < 0;

  return (
    <View style={[styles.card, done && styles.cardDone]}>
      {/* 내용을 누르면 수정, 아래 줄이 완료. 한 줄 안에 작은 완료 버튼을 겹쳐
          두면 탭 영역이 좁고 어느 쪽이 눌릴지도 모호하다 — 아예 분리했다. */}
      <Pressable style={styles.cardMain} onPress={onEdit}>
        <View style={styles.cardIcon}>
          <Icon name={scheduleIcon(schedule)} size={20} />
        </View>

        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, done && styles.cardTitleDone]}>
            {scheduleTitle(schedule)}
          </Text>
          <Text style={styles.cardDate}>
            {formatDay(schedule.scheduledDate)}
            {schedule.hospitalName ? ` · ${schedule.hospitalName}` : ''}
          </Text>
          {schedule.memo ? (
            <Text style={styles.cardMemo} numberOfLines={1}>{schedule.memo}</Text>
          ) : null}
        </View>

        {done ? (
          <Text style={styles.doneMark}>
            {schedule.status === 'completed' ? '완료' : '취소'}
          </Text>
        ) : (
          <View style={[styles.dBadge, overdue && styles.dBadgeOver]}>
            <Text style={[styles.dBadgeText, overdue && styles.dBadgeTextOver]}>
              {days === 0 ? 'D-day' : days > 0 ? `D-${days}` : `D+${-days}`}
            </Text>
          </View>
        )}
      </Pressable>

      {!done && (
        <Pressable style={styles.completeBtn} onPress={onComplete}>
          <Icon name="check" size={16} color={colors.good} />
          <Text style={styles.completeText}>완료 처리</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create(scaled({
  wrap: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  addBtnText: { color: colors.accentText, fontWeight: '700', fontSize: 13 },

  body: { flex: 1, paddingHorizontal: 18 },
  section: { marginBottom: 18 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 8 },
  list: { gap: 9 },

  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  cardDone: { backgroundColor: colors.surfaceMuted },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.peachSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  cardTitleDone: { color: colors.textMuted },
  cardDate: { fontSize: 12, color: colors.textMuted },
  cardMemo: { fontSize: 11, color: colors.textFaint },

  dBadge: {
    backgroundColor: colors.blueChip,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  dBadgeOver: { backgroundColor: colors.badBg },
  dBadgeText: { fontSize: 11, fontWeight: '800', color: colors.blueDark },
  dBadgeTextOver: { color: colors.badText },

  // 손가락 타깃 확보용 — 카드 폭 전체에 높이 46.
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.goodBg,
  },
  completeText: { fontSize: 13, fontWeight: '800', color: colors.goodText },
  doneMark: { fontSize: 11, fontWeight: '700', color: colors.textGhost },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '700', color: colors.textBody },
  emptySub: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
}));
