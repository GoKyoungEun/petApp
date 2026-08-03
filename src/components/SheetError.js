// 시트 안에 뜨는 쓰기 실패 메시지.
//
// 스낵바·토스트는 Modal 위로 못 올라온다. 시트가 열린 채 저장이 실패하면
// 사용자에게 보이는 것이 아무것도 없어서, 버튼이 안 먹는 것처럼 보인다.
// 그래서 저장 버튼 바로 위에 이걸 깐다 (08_TechStack "실패 처리").

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { scaled } from '../scale';

export default function SheetError({ message }) {
  if (!message) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create(scaled({
  wrap: {
    marginHorizontal: 20,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.badBg,
    borderWidth: 1,
    borderColor: colors.badBorder,
  },
  text: { fontSize: 12, lineHeight: 17, color: colors.badText },
}));
