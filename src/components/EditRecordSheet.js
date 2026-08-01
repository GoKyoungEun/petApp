// Edit or delete an existing record (02_MVP_Requirement §8 — 횟수 제한 없이
// 수정, 저장 항목은 기록 기준일·createdAt·updatedAt).
//
// Opened from 전체 기록보기 by tapping a record. Fields shown depend on
// recordType; the value controls mirror the ones in QuickRecordSheet so an edit
// looks like the sheet the record was created in.

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
import * as ImagePicker from 'expo-image-picker';
import Icon from '../Icon';
import { colors } from '../theme';
import { useStore } from '../store';
import { scaled } from '../scale';
import { isValidYmd } from '../date';
import { MAX_PHOTOS } from '../repository';

const TITLE = {
  meal: '식사', stool: '배변', urine: '소변', vomit: '구토',
  walk: '산책', condition: '컨디션', weight: '몸무게', note: '메모',
};

// Types whose quick-record flow offers photo + memo (02_MVP_Requirement §4).
const ATTACHABLE = ['meal', 'stool', 'urine', 'vomit'];

const STATE_OPTS = {
  meal: ['완료', '안 먹음'],
  stool: ['정상', '설사', '색 이상'],
};

const CONDITION_LEVELS = ['좋아요', '보통', '안 좋아요'];

const SYMPTOM_OPTS = [
  '식욕 저하', '기운 없음', '구토', '설사', '기침',
  '재채기', '절뚝거림', '자주 긁음', '기타',
];

export default function EditRecordSheet() {
  const { editingRecord, closeEditRecord, updateRecord, deleteRecord } = useStore();

  const rec = editingRecord;
  const type = rec?.recordType;

  const [state, setState] = useState(null);
  const [minutes, setMinutes] = useState(0);
  const [kg, setKg] = useState(0);
  const [level, setLevel] = useState(null);
  const [symptoms, setSymptoms] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [memo, setMemo] = useState('');
  const [dateText, setDateText] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  // Refill from the record every time the sheet opens on a different row.
  useEffect(() => {
    if (!rec) return;
    const d = rec.data || {};
    setState(d.state ?? null);
    setMinutes(d.minutes ?? 0);
    setKg(d.kg ?? 0);
    setLevel(d.level ?? null);
    setSymptoms(d.symptoms ?? []);
    setPhotos(d.photos ?? []);
    setMemo(rec.memo ?? '');
    setDateText(rec.recordDate ?? '');
    setConfirmDel(false);
  }, [rec?.id]);

  if (!rec) return null;

  const attachable = ATTACHABLE.includes(type);
  const dateOk = isValidYmd(dateText);
  // 메모 records carry their body in `memo`, so an empty one has nothing left.
  const bodyOk = type !== 'note' || memo.trim() !== '';
  const canSave = dateOk && bodyOk;

  const pickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.5,
      });
      if (!res.canceled && res.assets?.length) {
        const a = res.assets[0];
        const uri = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
        setPhotos((prev) => [...prev, uri].slice(0, MAX_PHOTOS));
      }
    } catch (e) {
      // cancelled / unavailable
    }
  };

  const submit = () => {
    if (!canSave) return;
    const data = {};
    if (type === 'meal' || type === 'stool') data.state = state;
    if (type === 'walk') data.minutes = minutes;
    if (type === 'weight') data.kg = kg;
    if (type === 'condition') {
      data.level = level;
      data.symptoms = level === '안 좋아요' ? symptoms : [];
    }
    if (attachable) data.photos = photos;

    updateRecord(rec.id, {
      recordDate: dateText,
      memo: type === 'note' ? memo.trim() : memo.trim() || null,
      data,
    });
  };

  const onDelete = () => {
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    deleteRecord(rec.id);
  };

  const toggleSymptom = (op) =>
    setSymptoms((cur) => (cur.includes(op) ? cur.filter((x) => x !== op) : [...cur, op]));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={closeEditRecord}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{TITLE[type] || '기록'} 수정</Text>
            <Pressable onPress={closeEditRecord} hitSlop={8}>
              <Icon name="x" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled">

            {STATE_OPTS[type] && (
              <Field label="상태">
                <Segmented options={STATE_OPTS[type]} value={state} onChange={setState} />
              </Field>
            )}

            {type === 'walk' && (
              <Field label="산책 시간">
                <Stepper
                  onMinus={() => setMinutes((m) => Math.max(0, m - 5))}
                  onPlus={() => setMinutes((m) => m + 5)}>
                  <Text style={styles.stepNum}>
                    {minutes}
                    <Text style={styles.stepUnit}> 분</Text>
                  </Text>
                </Stepper>
              </Field>
            )}

            {type === 'weight' && (
              <Field label="몸무게">
                <Stepper
                  onMinus={() => setKg((v) => Math.max(0, Math.round((v - 0.1) * 10) / 10))}
                  onPlus={() => setKg((v) => Math.round((v + 0.1) * 10) / 10)}>
                  <Text style={styles.stepNum}>
                    {kg.toFixed(1)}
                    <Text style={styles.stepUnit}> kg</Text>
                  </Text>
                </Stepper>
              </Field>
            )}

            {type === 'condition' && (
              <>
                <Field label="컨디션">
                  <Segmented options={CONDITION_LEVELS} value={level} onChange={setLevel} />
                </Field>
                {level === '안 좋아요' && (
                  <Field label="증상">
                    <View style={styles.chipWrap}>
                      {SYMPTOM_OPTS.map((op) => {
                        const on = symptoms.includes(op);
                        return (
                          <Pressable
                            key={op}
                            style={[styles.chip, on && styles.chipOn]}
                            onPress={() => toggleSymptom(op)}>
                            <Text style={[styles.chipText, on && styles.chipTextOn]}>{op}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </Field>
                )}
              </>
            )}

            {attachable && (
              <Field label={`사진 ${photos.length}/${MAX_PHOTOS}`}>
                <View style={styles.photoGrid}>
                  {photos.map((uri, i) => (
                    <Pressable
                      key={i}
                      style={styles.photoCell}
                      onPress={() => setPhotos((p) => p.filter((_, j) => j !== i))}>
                      <Image source={{ uri }} style={styles.photoImg} />
                      <View style={styles.photoX}>
                        <Icon name="x" size={10} color="#fff" />
                      </View>
                    </Pressable>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <Pressable style={[styles.photoCell, styles.photoAdd]} onPress={pickPhoto}>
                      <Icon name="camera" size={18} color={colors.primary} />
                    </Pressable>
                  )}
                </View>
                {photos.length > 0 && (
                  <Text style={styles.hint}>사진을 누르면 삭제돼요</Text>
                )}
              </Field>
            )}

            <Field label={type === 'note' ? '메모' : '메모 (선택)'}>
              <TextInput
                style={[styles.input, styles.memoInput]}
                value={memo}
                onChangeText={setMemo}
                placeholder="메모를 입력하세요"
                placeholderTextColor={colors.textGhost}
                multiline
              />
            </Field>

            <Field label="기록 날짜">
              <TextInput
                style={[styles.input, !dateOk && styles.inputBad]}
                value={dateText}
                onChangeText={setDateText}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textGhost}
                keyboardType="numbers-and-punctuation"
              />
              {!dateOk && <Text style={styles.errText}>날짜 형식을 확인해 주세요</Text>}
            </Field>
          </ScrollView>

          <Pressable
            style={[styles.saveBtn, !canSave && styles.saveBtnOff]}
            onPress={submit}
            disabled={!canSave}>
            <Text style={[styles.saveText, !canSave && styles.saveTextOff]}>저장</Text>
          </Pressable>

          <Pressable style={styles.deleteBtn} onPress={onDelete}>
            <Text style={styles.deleteText}>
              {confirmDel ? '한 번 더 누르면 삭제돼요' : '삭제'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = value === o;
        return (
          <Pressable
            key={o}
            style={[styles.seg, on && styles.segOn]}
            onPress={() => onChange(o)}>
            <Text style={[styles.segText, on && styles.segTextOn]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stepper({ children, onMinus, onPlus }) {
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepBtn} onPress={onMinus}>
        <Icon name="minus" size={16} color="#6B6259" />
      </Pressable>
      {children}
      <Pressable style={styles.stepBtn} onPress={onPlus}>
        <Icon name="plus" size={16} color="#6B6259" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create(scaled({
  wrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,15,10,0.34)' },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
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
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  field: { marginTop: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textBody, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
  },
  inputBad: { borderColor: colors.badBorder },
  memoInput: { height: 78, textAlignVertical: 'top' },
  errText: { fontSize: 11, color: colors.badText, marginTop: 6 },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: 8 },
  segmented: { flexDirection: 'row', gap: 8 },
  seg: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  segText: { fontSize: 13, color: '#6B6259', fontWeight: '600' },
  segTextOn: { color: colors.accentText, fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.peachLight },
  chipText: { fontSize: 12, color: '#6B6259', fontWeight: '600' },
  chipTextOn: { color: colors.accentText, fontWeight: '700' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  photoCell: {
    width: 68,
    height: 68,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  photoImg: { width: 68, height: 68 },
  photoX: {
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
  photoAdd: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CFC7BC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 4,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontSize: 22, fontWeight: '800', color: colors.text },
  stepUnit: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
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
  deleteBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  deleteText: { color: colors.badText, fontWeight: '600', fontSize: 13 },
}));
