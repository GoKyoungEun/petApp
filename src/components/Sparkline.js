// 몸무게 추이 선 그래프 (02_MVP §7 "그래프 유형 — 선 그래프").
//
// x축은 순번이 아니라 **날짜에 비례**한다. 3일 간격 측정 두 번과 3개월 간격
// 측정 두 번이 같은 모양으로 보이면 추이를 잘못 읽는다.
//
// 통계 카드에 들어가는 작은 그래프라 축과 눈금은 두지 않는다. 최소·최대값만
// 양끝에 적어 세로 범위를 알 수 있게 한다.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { colors } from '../theme';
import { scaled, s } from '../scale';
import { parseYmd } from '../date';

const HEIGHT = s(64);
const PAD = s(6); // 점이 테두리에 물리지 않게

export default function Sparkline({ points, width }) {
  // 점 하나로는 선을 그릴 수 없다 — 부르는 쪽에서 안내 문구를 띄운다.
  if (!points || points.length < 2 || !width) return null;

  const xs = points.map((p) => parseYmd(p.date).getTime());
  const ys = points.map((p) => p.kg);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const spanX = maxX - minX;
  const spanY = maxY - minY;

  const innerW = width - PAD * 2;
  const innerH = HEIGHT - PAD * 2;

  // 몸무게가 내내 같으면 spanY가 0이라 나눗셈이 무한대가 된다 — 가운데 직선으로.
  // 같은 날 여러 번 재면 spanX도 0이 될 수 있다.
  const px = (x) => PAD + (spanX === 0 ? innerW / 2 : ((x - minX) / spanX) * innerW);
  const py = (y) => PAD + (spanY === 0 ? innerH / 2 : innerH - ((y - minY) / spanY) * innerH);

  const coords = points.map((p, i) => `${px(xs[i])},${py(p.kg)}`).join(' ');

  return (
    <View style={{ width, height: HEIGHT }}>
      <Svg width={width} height={HEIGHT}>
        <Polyline
          points={coords}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* 마지막 측정만 점으로 — 전부 찍으면 촘촘할 때 선이 안 보인다. */}
        <Circle
          cx={px(xs[xs.length - 1])}
          cy={py(ys[ys.length - 1])}
          r={3.5}
          fill={colors.primary}
        />
      </Svg>

      <View style={styles.bounds} pointerEvents="none">
        <Text style={styles.boundText}>{maxY} kg</Text>
        <Text style={styles.boundText}>{minY} kg</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create(scaled({
  bounds: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  boundText: { fontSize: 9, color: colors.textGhost, fontWeight: '600' },
}));
