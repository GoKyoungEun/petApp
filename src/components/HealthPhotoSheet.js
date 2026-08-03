// 건강사진 기록 시트 — 홈 → 더보기 → 건강사진.
//
// Separate from QuickRecordSheet because this is the one record type that is
// *about* the photos: the category is required (02 §6), several photos are the
// normal case, and there is no one-tap state to pick. Everything else in the
// quick sheet is "tap a state, optionally attach".
//
// Stored as recordType 'healthPhoto' with { category, photos } in `data`
// (03_DB_Design — RecordPhoto 테이블은 아직 쓰지 않는다).

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from '../Icon';
import { colors } from '../theme';
import { useStore } from '../store';
import { scaled } from '../scale';
import { MAX_PHOTOS } from '../repository';
import { pickRecordPhotos, captureRecordPhoto } from '../photo';

export const PHOTO_CATEGORIES = ['눈', '코', '발', '피부 및 모질', '기타'];

export default function HealthPhotoSheet() {
  const { sheet, closeSheet, openSheet, sheetFromMore, addRecord } = useStore();

  const visible = sheet === 'photo';

  const [photos, setPhotos] = useState([]);
  const [category, setCategory] = useState(null);
  const [memo, setMemo] = useState('');
  const [memoOpen, setMemoOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPhotos([]);
    setCategory(null);
    setMemo('');
    setMemoOpen(false);
    setBusy(false);
  }, [visible]);

  if (!visible) return null;

  const remaining = MAX_PHOTOS - photos.length;
  // Category is required; a photo record with nothing in it is not a record.
  const canSave = photos.length > 0 && !!category;

  // Compression runs per photo and takes a moment — block the buttons so a
  // second tap can't push the count past MAX_PHOTOS.
  const add = async (fn) => {
    if (busy || remaining <= 0) return;
    setBusy(true);
    try {
      const picked = await fn(remaining);
      if (picked.length) setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!canSave) return;
    addRecord(
      { recordType: 'healthPhoto', data: { category, photos }, memo: memo.trim() || null },
      '건강사진이 기록되었습니다'
    );
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={closeSheet}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {sheetFromMore && (
                <Pressable onPress={() => openSheet('more')} hitSlop={8}>
                  <Icon name="arrow-left" size={17} color="#6B6259" />
                </Pressable>
              )}
              <Text style={styles.title}>건강사진</Text>
            </View>
            <Pressable onPress={closeSheet} hitSlop={8}>
              <Icon name="x" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled">

            <Text style={styles.label}>사진 {photos.length}/{MAX_PHOTOS}</Text>
            <View style={styles.grid}>
              {photos.map((uri, i) => (
                <Pressable
                  key={i}
                  style={styles.cell}
                  onPress={() => setPhotos((p) => p.filter((_, j) => j !== i))}>
                  <Image source={{ uri }} style={styles.cellImg} />
                  <View style={styles.cellX}>
                    <Icon name="x" size={10} color="#fff" />
                  </View>
                </Pressable>
              ))}
              {remaining > 0 && (
                <>
                  <Pressable
                    style={[styles.cell, styles.addCell, busy && styles.addBusy]}
                    onPress={() => add(captureRecordPhoto)}>
                    <Icon name="camera" size={18} color={colors.primary} />
                    <Text style={styles.addText}>촬영</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.cell, styles.addCell, busy && styles.addBusy]}
                    onPress={() => add(pickRecordPhotos)}>
                    <Icon name="healthPhoto" size={20} />
                    <Text style={styles.addText}>갤러리</Text>
                  </Pressable>
                </>
              )}
            </View>
            <Text style={styles.hint}>
              {busy ? '사진을 정리하는 중이에요' : '사진을 누르면 삭제돼요'}
            </Text>

            <Text style={[styles.label, styles.labelGap]}>
              분류 <Text style={styles.req}>*</Text>
            </Text>
            <View style={styles.chips}>
              {PHOTO_CATEGORIES.map((c) => {
                const on = c === category;
                return (
                  <Pressable
                    key={c}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => setCategory(c)}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>

            {memoOpen ? (
              <>
                <Text style={[styles.label, styles.labelGap]}>메모</Text>
                <TextInput
                  style={styles.memoInput}
                  value={memo}
                  onChangeText={setMemo}
                  placeholder="메모를 입력하세요"
                  placeholderTextColor={colors.textGhost}
                  multiline
                />
              </>
            ) : (
              <Pressable style={styles.memoBtn} onPress={() => setMemoOpen(true)}>
                <Icon name="memo" size={16} />
                <Text style={styles.memoBtnText}>메모 추가</Text>
              </Pressable>
            )}
          </ScrollView>

          <Pressable
            style={[styles.saveBtn, !canSave && styles.saveBtnOff]}
            onPress={submit}
            disabled={!canSave}>
            <Text style={[styles.saveText, !canSave && styles.saveTextOff]}>
              {photos.length === 0 ? '사진을 추가해 주세요' : !category ? '분류를 선택해 주세요' : '등록'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create(scaled({
  wrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,15,10,0.34)' },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingTop: 18,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textBody, marginBottom: 8 },
  labelGap: { marginTop: 18 },
  req: { color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  cell: {
    width: 68,
    height: 68,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  cellImg: { width: 68, height: 68 },
  cellX: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(20,15,10,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCell: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CFC7BC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  addBusy: { opacity: 0.5 },
  addText: { fontSize: 10, color: '#7A736B', fontWeight: '600' },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  chipText: { fontSize: 13, color: '#6B6259', fontWeight: '600' },
  chipTextOn: { color: colors.accentText, fontWeight: '700' },
  memoBtn: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    paddingVertical: 13,
  },
  memoBtnText: { fontSize: 13, color: '#6B6259', fontWeight: '600' },
  memoInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
    height: 78,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
  },
  saveBtnOff: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  saveText: { color: colors.accentText, fontWeight: '700', fontSize: 15 },
  saveTextOff: { color: colors.textGhost },
}));
