// 건강 일정 등록·수정 시트.
//
// 06_UserFlow "건강 일정 등록": 종류 → 예정일 → 병원·제품·메모 → 반복 주기 →
// 알림 → 저장. 수정은 같은 폼에 값을 채워 연다(반려동물 폼과 같은 방식).

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
import { SCHEDULE_TYPES, REPEAT_TYPES } from '../scheduleRepo';
import SheetError from './SheetError';
import DateField from './DateField';

export default function ScheduleForm() {
  const {
    showScheduleForm, closeScheduleForm, editingSchedule,
    saveSchedule, deleteSchedule, today, writeError,
  } = useStore();

  const isEdit = !!editingSchedule;

  const [type, setType] = useState('vaccination');
  const [customName, setCustomName] = useState('');
  const [date, setDate] = useState(today);
  const [hospital, setHospital] = useState('');
  const [product, setProduct] = useState('');
  const [memo, setMemo] = useState('');
  const [repeatOn, setRepeatOn] = useState(false);
  const [repeatValue, setRepeatValue] = useState(1);
  const [repeatType, setRepeatType] = useState('month');
  const [notifyOn, setNotifyOn] = useState(false);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState(1);
  const [confirmDel, setConfirmDel] = useState(false);

  // 열 때마다 초기화(새 일정) 또는 채우기(수정).
  useEffect(() => {
    if (!showScheduleForm) return;
    setConfirmDel(false);
    const s = editingSchedule;
    setType(s?.scheduleType || 'vaccination');
    setCustomName(s?.customTypeName || '');
    setDate(s?.scheduledDate || today);
    setHospital(s?.hospitalName || '');
    setProduct(s?.productName || '');
    setMemo(s?.memo || '');
    const hasRepeat = !!s?.repeatIntervalType && Number(s?.repeatIntervalValue) > 0;
    setRepeatOn(hasRepeat);
    setRepeatValue(hasRepeat ? s.repeatIntervalValue : 1);
    setRepeatType(hasRepeat ? s.repeatIntervalType : 'month');
    const notify = s?.notificationSetting;
    setNotifyOn(!!notify?.enabled);
    setNotifyDaysBefore(notify?.daysBefore ?? 1);
  }, [showScheduleForm, editingSchedule]);

  // 직접 입력은 이름이 있어야 목록에서 무엇인지 알 수 있다(03_DB_Design).
  const canSave = type !== 'custom' || customName.trim() !== '';

  const submit = () => {
    if (!canSave) return;
    saveSchedule({
      scheduleType: type,
      customTypeName: type === 'custom' ? customName.trim() : null,
      scheduledDate: date,
      hospitalName: hospital.trim() || null,
      productName: product.trim() || null,
      memo: memo.trim() || null,
      repeatIntervalType: repeatOn ? repeatType : null,
      repeatIntervalValue: repeatOn ? repeatValue : null,
      // 저장만 한다 — 실제 예약은 미구현(09_Todo 우선순위 5).
      notificationSetting: notifyOn ? { enabled: true, daysBefore: notifyDaysBefore } : null,
    });
  };

  const onDelete = () => {
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    deleteSchedule(editingSchedule.id);
  };

  if (!showScheduleForm) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={closeScheduleForm}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{isEdit ? '일정 수정' : '일정 등록'}</Text>
            <Pressable onPress={closeScheduleForm} hitSlop={8}>
              <Icon name="x" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled">

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

            {type === 'custom' && (
              <Field label="일정 이름" required>
                <TextInput
                  style={styles.input}
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="예: 발톱 정리"
                  placeholderTextColor={colors.textGhost}
                />
              </Field>
            )}

            {/* 일정은 앞날이 본체라 미래를 연다. */}
            <DateField
              label="예정일"
              value={date}
              today={today}
              onChange={setDate}
              allowFuture
            />

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

            <Field label="반복">
              <Pressable
                style={[styles.toggleRow, repeatOn && styles.toggleRowOn]}
                onPress={() => setRepeatOn((v) => !v)}>
                <Text style={styles.toggleText}>
                  {repeatOn ? '반복함' : '반복 안 함'}
                </Text>
                <Icon
                  name={repeatOn ? 'check' : 'plus'}
                  size={15}
                  color={repeatOn ? colors.primary : colors.textMuted}
                />
              </Pressable>

              {repeatOn && (
                <View style={styles.repeatRow}>
                  <View style={styles.stepper}>
                    <Pressable
                      style={styles.stepBtn}
                      onPress={() => setRepeatValue((v) => Math.max(1, v - 1))}>
                      <Icon name="minus" size={14} color="#6B6259" />
                    </Pressable>
                    <Text style={styles.stepNum}>{repeatValue}</Text>
                    <Pressable style={styles.stepBtn} onPress={() => setRepeatValue((v) => v + 1)}>
                      <Icon name="plus" size={14} color="#6B6259" />
                    </Pressable>
                  </View>
                  <View style={styles.chipWrap}>
                    {REPEAT_TYPES.map((r) => {
                      const on = r.key === repeatType;
                      return (
                        <Pressable
                          key={r.key}
                          style={[styles.chip, on && styles.chipOn]}
                          onPress={() => setRepeatType(r.key)}>
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>{r.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
              {repeatOn && (
                <Text style={styles.hint}>완료 처리하면 다음 일정이 자동으로 생겨요</Text>
              )}
            </Field>

            <Field label="알림">
              <Pressable
                style={[styles.toggleRow, notifyOn && styles.toggleRowOn]}
                onPress={() => setNotifyOn((v) => !v)}>
                <Text style={styles.toggleText}>{notifyOn ? '알림 받기' : '알림 없음'}</Text>
                <Icon
                  name={notifyOn ? 'check' : 'plus'}
                  size={15}
                  color={notifyOn ? colors.primary : colors.textMuted}
                />
              </Pressable>
              {notifyOn && (
                <View style={styles.chipWrap}>
                  {[0, 1, 3, 7].map((d) => {
                    const on = d === notifyDaysBefore;
                    return (
                      <Pressable
                        key={d}
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() => setNotifyDaysBefore(d)}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>
                          {d === 0 ? '당일' : `${d}일 전`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {/* 설정은 저장되지만 실제 푸시는 아직 안 간다(09_Todo 우선순위 5).
                  없는 기능을 있는 것처럼 두면 알림을 기다리다 일정을 놓친다. */}
              {notifyOn && <Text style={styles.hint}>푸시 알림은 준비 중이에요</Text>}
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
              {canSave ? (isEdit ? '저장' : '등록하기') : '일정 이름을 입력해 주세요'}
            </Text>
          </Pressable>

          {isEdit && (
            <Pressable style={styles.deleteBtn} onPress={onDelete}>
              <Text style={styles.deleteText}>
                {confirmDel ? '한 번 더 누르면 삭제돼요' : '삭제'}
              </Text>
            </Pressable>
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

  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.peachLight },
  chipText: { fontSize: 12, color: colors.textBody, fontWeight: '600' },
  chipTextOn: { color: colors.accentText, fontWeight: '800' },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  toggleRowOn: { borderColor: colors.accent, backgroundColor: colors.peachLight },
  toggleText: { fontSize: 14, fontWeight: '600', color: colors.text },

  repeatRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontSize: 15, fontWeight: '800', color: colors.text, minWidth: 18, textAlign: 'center' },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: 6 },

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
  deleteBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  deleteText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
}));
