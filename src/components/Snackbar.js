import React, { useEffect, useRef } from 'react';
import { Animated, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { useStore } from '../store';

export default function Snackbar() {
  const { snack, undo, toast } = useStore();
  const anim = useRef(new Animated.Value(0)).current;
  const message = snack || toast;

  useEffect(() => {
    if (message) {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [message]);

  if (!message) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  return (
    <Animated.View style={[styles.snack, { opacity: anim, transform: [{ translateY }] }]}>
      <Text style={[styles.msg, !snack && styles.msgToast]}>{message}</Text>
      {snack ? (
        <Pressable onPress={undo} hitSlop={8}>
          <Text style={styles.undo}>실행취소</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  snack: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 78,
    backgroundColor: colors.dark,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  msg: { color: '#fff', fontSize: 13, fontWeight: '500', flex: 1 },
  msgToast: { textAlign: 'center' },
  undo: { color: colors.accent, fontSize: 13, fontWeight: '700', marginLeft: 12 },
});
