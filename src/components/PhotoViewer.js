// 사진 크게 보기 — 목록의 작은 격자에서 누르면 화면 가득 열리고 좌우로 넘긴다.
//
// 왜 필요한가: 건강사진은 나중에 수의사에게 보여 주려고 남기는 것인데, 카드 안
// 3열 격자에서는 눈·피부 상태가 보이지 않는다.
//
// 원본이 아니라 저장된 사진(긴 변 1280px)을 그대로 띄운다. `contain`이라 잘리는
// 곳 없이 화면에 맞춰진다.

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Dimensions,
  StyleSheet,
} from 'react-native';
import Icon from '../Icon';
import { scaled } from '../scale';

export default function PhotoViewer({ photos, index = 0, onClose, onIndexChange }) {
  const ref = useRef(null);
  // 화면 크기는 열릴 때 읽는다. 앱이 세로 고정이라 도중에 바뀌지 않는다(app.json).
  //
  // 높이까지 실제 값으로 주는 이유: 페이지에 폭만 주면 그 안의 height:'100%'가
  // 기준 없이 0으로 풀려 사진이 아예 안 보인다.
  const { width, height } = Dimensions.get('window');
  const open = !!photos?.length;

  // 누른 사진부터 보여 준다. 렌더 직후에는 스크롤할 내용이 아직 붙지 않아
  // 그 자리에서 부르면 먹지 않는다 — 한 틱 미룬다(DateSelect와 같은 이유).
  useEffect(() => {
    if (!open) return undefined;
    const id = setTimeout(() => {
      ref.current?.scrollTo({ x: index * width, y: 0, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [open, index, width]);

  if (!open) return null;

  const onScrollEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    onIndexChange?.(Math.min(photos.length - 1, Math.max(0, i)));
  };

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}>
          {photos.map((uri, i) => (
            <View key={i} style={{ width, height }}>
              <Image source={{ uri }} style={{ width, height }} resizeMode="contain" />
            </View>
          ))}
        </ScrollView>

        {/* 위에 겹쳐 둔다. 사진이 세로로 길면 아래쪽이 가려지는데, 닫기는 언제나
            같은 자리에 있어야 찾기 쉽다. */}
        <View style={styles.bar}>
          {photos.length > 1 && (
            <Text style={styles.counter}>
              {index + 1} / {photos.length}
            </Text>
          )}
          <Pressable style={styles.close} onPress={onClose} hitSlop={12}>
            <Icon name="x" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create(scaled({
  // 사진을 볼 때는 배경이 어두워야 색이 제대로 읽힌다.
  wrap: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 52,
    paddingBottom: 10,
  },
  counter: { color: '#fff', fontSize: 13, fontWeight: '700' },
  close: {
    marginLeft: 'auto',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
}));
