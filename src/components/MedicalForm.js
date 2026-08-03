// 완료 기록 시트 — 두 가지 진입을 한 폼으로 받는다.
//
//   mode 'complete' : 일정 탭에서 "완료 처리"를 눌렀을 때. 일정의 계획값을
//                     미리 채워 두고, 실제로 한 내용을 확인받는다.
//   mode 'standalone': 더보기 → 병원 기록. 일정 없이 다녀온 경우다. 저장한 뒤
//                     "다음 일정도 등록하시겠어요"를 묻는다(06_UserFlow).
//
// 계획값을 그냥 복사하지 않고 한 번 묻는 이유는, 계획과 실제가 어긋나는 것이
// MedicalRecord를 일정과 따로 두는 이유 자체이기 때문이다 — 며칠 늦게 갔거나
// 다른 병원에 갔거나.

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
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
import { SCHEDULE_TYPES } from '../schedules';
import SheetError from './SheetError';
import DateField from './DateField';

export default function MedicalForm() {
  const {
    medicalForm, closeMedicalForm, saveMedical, today, writeError,
    openScheduleForm,
  } = useStore();

  const mode = medicalForm?.mode ?? null;
  const schedule = medicalForm?.schedule ?? null;

  const [type, setType] = useState('hospitalVisit');
  const [customName, setCustomName] = useState('');
  const [date, setDate] = useState(today);
  const [hospital, setHospital] = useState('');
  const [product, setProduct] = useState('');
  const [memo, setMemo] = useState('');
  // 저장이 끝난 뒤에만 뜨는 "다음 일정도 등록하시겠어요" 단계.
  const [askNext, setAskNext] = useState(false);

  useEffect(() => {
    if (!medicalForm) return;
    setAskNext(false);
    setType(schedule?.scheduleType || 'hospitalVisit');
    setCustomName(schedule?.customTypeName || '');
    // 완료 흐름의 기본 시행일은 오늘이다. 지난 일정을 뒤늦게 체크하는 경우가
    // 많아 예정일을 그대로 쓰면 실제로 간 날과 어긋난다.
    setDate(today);
    setHospital(schedule?.hospitalName || '');
    setProduct(schedule?.productName || '');
    setMemo(schedule?.memo || '');
  }, [medicalForm]);

  if (!medicalForm) return null;

  const canSave = type !== 'custom' || customName.trim() !== '';

  const payload = {
    scheduleType: type,
    customTypeName: type === 'custom' ? customName.trim() : null,
    executedDate: date,
    hospitalName: hospital.trim() || null,
    productName: product.trim() || null,
    memo: memo.trim() || null,
  };

  const submit = async () => {
    if (!canSave) return;
    const ok = await saveMedical(payload);
    if (!ok) return; // 실패는 시트 안에 남는다
    // 일정을 완료한 경우는 이미 다음 일정 생성 여부가 반복 주기로 정해져 있다 —
    // 여기서 또 물으면 두 번 만들게 된다(06_UserFlow는 기록 먼저 만든 경우만).
    if (mode === 'standalone') setAskNext(true);
    else closeMedicalForm();
  };

  const registerNext = () => {
    closeMedicalForm();
    // id가 없으므로 일정 폼은 "새 일정"으로 열리고 값만 채워진다.
    openScheduleForm({
      scheduleType: payload.scheduleType,
      customTypeName: payload.customTypeName,
      hospitalName: payload.hospitalName,
      productName: payload.productName,
    });
  };

  const title = mode === 'complete' ? '완료 처리' : '병원 기록';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={closeMedicalForm}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{askNext ? '저장했어요' : title}</Text>
            <Pressable onPress={closeMedicalForm} hitSlop={8}>
              <Icon name="x" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {askNext ? (
            // 06_UserFlow "기록 먼저 생성 → 다음 일정도 등록하시겠어요 안내
            // → 등록 또는 나중에"
            <View style={styles.askBody}>
              <Text style={styles.askText}>다음 일정도 등록할까요?</Text>
              <Text style={styles.askSub}>
                지금 적은 병원·제품이 그대로 채워져요
              </Text>
              <View style={styles.askBtns}>
                <Pressable style={styles.laterBtn} onPress={closeMedicalForm}>
                  <Text style={styles.laterText}>나중에</Text>
                </Pressable>
                <Pressable style={styles.nextBtn} onPress={registerNext}>
                  <Text style={styles.nextText}>일정 등록</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.body}
                keyboardShouldPersistTaps="handled">

                {/* 일정에서 왔으면 종류는 그 일정의 것이다 — 바꿀 일이 없다. */}
                {mode === 'complete' ? (
                  <View style={styles.fromSchedule}>
                    <Icon name="check" size={14} color={colors.good} />
                    <Text style={styles.fromScheduleText}>
                      {schedule?.scheduleType === 'custom'
                        ? schedule?.customTypeName
                        : SCHEDULE_TYPES.find((t) => t.key === schedule?.scheduleType)?.label}
                      {' 일정을 완료합니다'}
                    </Text>
                  </View>
                ) : (
                  <Field label="종류" required>
                    <View style={styles.chipWrap}>
                      {SCHEDULE_TYPES.map((t) => {
                        const on = t.key === type;
                        return (
                          <Pressable
                            key={t.key}
                            style={[styles.typeChip, on && styles.typeChipOn]}
                            onPress={() => setType(t.key)}>
                            <Icon name={t.icon} size={16} />
                            <Text style={[styles.typeChipText, on && styles.typeChipTextOn]}>
                              {t.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </Field>
                )}

                {mode !== 'complete' && type === 'custom' && (
                  <Field label="이름" required>
                    <TextInput
                      style={styles.input}
                      value={customName}
                      onChangeText={setCustomName}
                      placeholder="예: 발톱 정리"
                      placeholderTextColor={colors.textGhost}
                    />
                  </Field>
                )}

                {/* 이미 한 일이라 미래는 고를 수 없다. */}
                <DateField label="시행일" value={date} today={today} onChange={setDate} />

                <Field label="병원 (선택)">
                  <TextInput
                    style={styles.input}
                    value={hospital}
                    onChangeText={setHospital}
                    placeholder="병원 이름"
                    placeholderTextColor={colors.textGhost}
                  />
                </Field>

                <Field label="제품 (선택)">
                  <TextInput
                    style={styles.input}
                    value={product}
                    onChangeText={setProduct}
                    placeholder="백신·약 이름"
                    placeholderTextColor={colors.textGhost}
                  />
                </Field>

                <Field label="메모 (선택)">
                  <TextInput
                    style={[styles.input, styles.memoInput]}
                    value={memo}
                    onChangeText={setMemo}
                    placeholder="남겨둘 내용을 적어보세요"
                    placeholderTextColor={colors.textGhost}
                    multiline
                    textAlignVertical="top"
                  />
                </Field>
              </ScrollView>

              <SheetError message={writeError} />

              <Pressable
                style={[styles.saveBtn, !canSave && styles.saveBtnOff]}
                onPress={submit}
                disabled={!canSave}>
                <Text style={[styles.saveText, !canSave && styles.saveTextOff]}>
                  {canSave ? (mode === 'complete' ? '완료 처리' : '저장') : '이름을 입력해 주세요'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, required, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      {children}
    </View>
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
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },

  fromSchedule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.goodBg,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  fromScheduleText: { fontSize: 12, fontWeight: '700', color: colors.goodText },

  field: { marginBottom: 14, gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  req: { color: colors.primary },

  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  memoInput: { height: 84, paddingTop: 12 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  typeChipOn: { borderColor: colors.accent, backgroundColor: colors.peachLight },
  typeChipText: { fontSize: 13, color: colors.textBody, fontWeight: '600' },
  typeChipTextOn: { color: colors.accentText, fontWeight: '800' },

  saveBtn: {
    marginHorizontal: 20,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnOff: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  saveText: { color: colors.accentText, fontWeight: '700', fontSize: 14 },
  saveTextOff: { color: colors.textGhost },

  askBody: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6, gap: 4 },
  askText: { fontSize: 15, fontWeight: '800', color: colors.text },
  askSub: { fontSize: 12, color: colors.textMuted, marginBottom: 16 },
  askBtns: { flexDirection: 'row', gap: 9 },
  laterBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  laterText: { fontSize: 14, fontWeight: '700', color: colors.textBody },
  nextBtn: {
    flex: 1.4,
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: colors.accent,
  },
  nextText: { fontSize: 14, fontWeight: '700', color: colors.accentText },
}));
