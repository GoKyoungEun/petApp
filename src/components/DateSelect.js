// 년·월·일 룰렛(휠) 선택기.
//
// 원래는 'YYYY-MM-DD' 텍스트 입력이었는데, 폰에서 구분자까지 직접 치는 게
// 번거롭고 오타가 나면 저장 버튼이 잠겨 이유를 알기 어려웠다. 고를 수 있는
// 값만 보여 주므로 잘못된 날짜가 아예 나오지 않는다.
//
// 값은 계속 로컬 캘린더 'YYYY-MM-DD' 문자열이다(src/date.js) — 부르는 쪽은
// 문자열만 다루면 되고 저장 형식도 그대로다.
//
// 라이브러리를 쓰지 않은 이유: @react-native-picker/picker는 iOS에서만 휠이고
// Android에서는 드롭다운이라 두 플랫폼이 달라진다. ScrollView의 snapToInterval
// 로 만들면 iOS·Android·웹이 같은 모양이 되고 이 앱의 색·글꼴을 그대로 쓴다.

import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { scaled, s } from '../scale';
import { toYmd, parseYmd, isValidYmd } from '../date';

// 반려동물 나이는 길어야 스무 해 남짓이라 30년이면 넉넉하다.
const YEAR_SPAN = 30;

// 한 칸 높이와 보이는 칸 수(홀수여야 가운데가 생긴다).
//
// 높이는 스타일과 스크롤 계산 양쪽에 쓰이는데, 둘이 1px이라도 어긋나면 스냅이
// 칸에서 밀린다. 그래서 여기서 한 번만 s()로 실제 px을 만들고 스타일에도 그
// 값을 그대로 넣는다 — scaled()에 맡기면 s()가 두 번 걸린다.
const ITEM = s(38);
const VISIBLE = 5;
const PAD = ITEM * ((VISIBLE - 1) / 2); // 첫 항목도 가운데에 올 수 있게 위아래 여백
const CENTER = ITEM * ((VISIBLE - 1) / 2);

const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

export default function DateSelect({ value, onChange }) {
  const today = new Date();

  // 값이 없거나 깨졌으면 오늘로 잡는다. '추정 나이' 쪽도 1살로 미리 채워져
  // 있으므로, 여기만 빈 채로 두면 저장 버튼이 왜 잠겼는지 알 수 없다.
  const valid = value && isValidYmd(value);
  const base = valid ? parseYmd(value) : today;
  const year = base.getFullYear();
  const month = base.getMonth() + 1;
  const day = base.getDate();

  useEffect(() => {
    if (!valid) onChange(toYmd(today));
  }, [valid]);

  const emit = (y, m, d) => {
    // 3월 31일에서 2월로 옮기면 2월 31일이 된다 — 그 달의 마지막 날로 당긴다.
    // 이때 일 휠은 스스로 새 위치로 돌아간다(Wheel의 되감기 효과).
    onChange(toYmd(new Date(y, m - 1, Math.min(d, daysInMonth(y, m)))));
  };

  const thisYear = today.getFullYear();
  // 최근 연도가 위로 오게 내림차순. 대부분의 반려동물이 최근 몇 해 안에
  // 태어나서, 오름차순이면 매번 한참 굴려야 한다.
  const years = Array.from({ length: YEAR_SPAN + 1 }, (_, i) => thisYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);

  return (
    <View style={[styles.wrap, metrics.wrap]}>
      {/* 가운데 칸을 짚어 주는 띠. 휠보다 뒤에 깔고 터치를 통과시켜야
          스크롤을 가로막지 않는다. */}
      <View style={[styles.band, metrics.band, { pointerEvents: 'none' }]} />

      <View style={styles.cols}>
        <Wheel items={years} selected={year} suffix="년"
          onSelect={(y) => emit(y, month, day)} flex={1.2} />
        <Wheel items={months} selected={month} suffix="월"
          onSelect={(m) => emit(year, m, day)} flex={1} />
        <Wheel items={days} selected={day} suffix="일"
          onSelect={(d) => emit(year, month, d)} flex={1} />
      </View>
    </View>
  );
}

function Wheel({ items, selected, suffix, onSelect, flex }) {
  const ref = useRef(null);
  const index = Math.max(0, items.indexOf(selected));

  // 지금 휠이 실제로 멈춰 있는 칸. 밖에서 값이 바뀐 경우(달이 짧아져 일이
  // 당겨진 경우)에만 되감고, 사용자가 방금 굴려서 생긴 변화에는 손대지 않는다
  // — 그러지 않으면 스크롤이 스스로 튕긴다.
  const settled = useRef(index);

  // 처음 열릴 때 선택된 값을 가운데로. 렌더 직후에는 스크롤할 내용이 아직
  // 붙지 않아 그 자리에서 부르면 먹지 않는다 — 한 틱 미룬다.
  useEffect(() => {
    const id = setTimeout(() => {
      ref.current?.scrollTo({ x: 0, y: index * ITEM, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (settled.current === index) return;
    settled.current = index;
    ref.current?.scrollTo({ x: 0, y: index * ITEM, animated: true });
  }, [index]);

  const snap = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    const i = Math.min(items.length - 1, Math.max(0, Math.round(y / ITEM)));
    settled.current = i;
    if (items[i] !== selected) onSelect(items[i]);
  };

  return (
    <ScrollView
      ref={ref}
      style={{ flex }}
      // 폼 전체가 세로 ScrollView라 중첩된다 — Android는 이 플래그가 있어야
      // 안쪽 휠이 제스처를 받는다.
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM}
      decelerationRate="fast"
      // 손을 뗀 뒤 미끄러져 멈출 때(momentum)와 그대로 멈출 때(drag) 둘 다 온다.
      onMomentumScrollEnd={snap}
      onScrollEndDrag={snap}
      contentContainerStyle={{ paddingVertical: PAD }}>
      {items.map((it, i) => {
        const dist = Math.abs(i - index);
        return (
          <Pressable
            key={it}
            style={metrics.item}
            // 굴리지 않고 눈에 보이는 칸을 바로 눌러도 되게.
            onPress={() => onSelect(it)}>
            <Text
              style={[
                styles.itemText,
                dist === 0 && styles.itemTextOn,
                dist === 1 && styles.itemTextNear,
                dist > 1 && styles.itemTextFar,
              ]}>
              {it}
              {suffix}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// s()가 이미 걸린 실제 px — scaled()를 통과시키지 않는다(위 ITEM 주석 참고).
const metrics = StyleSheet.create({
  wrap: { height: ITEM * VISIBLE },
  band: { height: ITEM, top: CENTER },
  item: { height: ITEM, alignItems: 'center', justifyContent: 'center' },
});

const styles = StyleSheet.create(scaled({
  wrap: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.peachSoft,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.accent,
  },
  // 세 휠이 wrap 높이를 꽉 채워야 스냅 위치와 가운데 띠가 맞는다.
  cols: { flexDirection: 'row', flex: 1 },
  itemText: { fontSize: 15, color: colors.textBody },
  itemTextOn: { fontSize: 17, fontWeight: '800', color: colors.accentText },
  itemTextNear: { color: colors.textMuted },
  itemTextFar: { color: colors.textGhost },
}));
