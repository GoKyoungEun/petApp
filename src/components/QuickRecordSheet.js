import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  StyleSheet,
  Animated,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from '../Icon';
import { colors } from '../theme';
import { useStore } from '../store';
import { scaled } from '../scale';
import { formatDot } from '../date';
import { MAX_PHOTOS } from '../repository';
import { pickRecordPhotos } from '../photo';
import SheetError from './SheetError';

const SYMPTOM_OPTS = [
  '식욕 저하', '기운 없음', '구토', '설사', '기침',
  '재채기', '절뚝거림', '자주 긁음', '기타',
];

// Sheets that use the two-step flow (state → photo/memo detail).
const DETAIL_TITLE = { meal: '식사', poop: '배변', pee: '소변', vomit: '구토' };

export default function QuickRecordSheet() {
  const {
    sheet, sheetFromMore, closeSheet, openSheet, addRecord, today,
    condStage, setCondStage,
    walkMin, setWalkMin, weightVal, setWeightVal,
    symptoms, toggleSymptom, writeError,
  } = useStore();

  // Two-step state for attach-capable sheets.
  const [step, setStep] = useState('main'); // 'main' | 'detail'
  const [pending, setPending] = useState(null); // { recordType, data, msg }
  // Attachment state, reset whenever the sheet changes.
  const [photos, setPhotos] = useState([]);
  const [memo, setMemo] = useState('');
  const [memoOpen, setMemoOpen] = useState(false);

  useEffect(() => {
    setStep('main');
    setPending(null);
    setPhotos([]);
    setMemo('');
    setMemoOpen(false);
  }, [sheet]);

  const backToMore = sheetFromMore ? () => openSheet('more') : undefined;

  // 'photo' is handled by HealthPhotoSheet — that record type is about the
  // photos rather than a one-tap state, so it gets its own sheet.
  const visible = !!sheet && sheet !== 'photo';
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slide.setValue(0);
      Animated.timing(slide, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, sheet, step, condStage]);

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  const pickPhoto = async () => {
    const picked = await pickRecordPhotos(MAX_PHOTOS - photos.length);
    if (picked.length) setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
  };

  // Step 1 → step 2: remember the chosen record, then show the detail step.
  const toDetail = (recordType, data, msg) => {
    setPending({ recordType, data: data || {}, msg });
    setStep('detail');
  };

  // Save from the detail step. 건너뛰기 → no attachments; 등록 → include them.
  const commit = (withAttach) => {
    if (!pending) return;
    const data = { ...(pending.data || {}) };
    if (withAttach && photos.length) data.photos = photos;
    addRecord(
      { recordType: pending.recordType, data, memo: withAttach ? memo.trim() || null : null },
      pending.msg
    );
  };

  const renderDetail = () => (
    <>
      <SheetHeader title={DETAIL_TITLE[sheet]} onClose={closeSheet} onBack={() => setStep('main')} />
      {pending?.data?.state ? (
        <View style={styles.chosenRow}>
          <Text style={styles.chosenText}>{pending.data.state}</Text>
        </View>
      ) : null}
      <Text style={styles.detailHint}>사진이나 메모를 더할 수 있어요</Text>

      <View style={styles.attachCards}>
        <Pressable style={styles.attachCard} onPress={pickPhoto}>
          <Icon name="camera" size={20} color={colors.primary} />
          <Text style={styles.attachCardText}>
            사진 추가{photos.length ? ` ${photos.length}/${MAX_PHOTOS}` : ''}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.attachCard, memoOpen && styles.attachCardOn]}
          onPress={() => setMemoOpen((v) => !v)}
        >
          <Icon name="memo" size={20} color={colors.primary} />
          <Text style={styles.attachCardText}>메모 추가</Text>
        </Pressable>
      </View>

      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
          {photos.map((uri, i) => (
            <Pressable key={i} style={styles.thumbWrap}
              onPress={() => setPhotos((p) => p.filter((_, j) => j !== i))}>
              <Image source={{ uri }} style={styles.thumb} />
              <View style={styles.thumbX}>
                <Icon name="x" size={10} color="#fff" />
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {memoOpen && (
        <TextInput
          style={styles.memoInput}
          value={memo}
          onChangeText={setMemo}
          placeholder="메모를 입력하세요"
          placeholderTextColor={colors.textGhost}
          multiline
        />
      )}

      <View style={styles.detailBtns}>
        <Pressable style={styles.skipBtn} onPress={() => commit(false)}>
          <Text style={styles.skipText}>건너뛰기</Text>
        </Pressable>
        <Pressable style={styles.registerBtn} onPress={() => commit(true)}>
          <Text style={styles.registerText}>등록</Text>
        </Pressable>
      </View>
    </>
  );

  const showDetail = DETAIL_TITLE[sheet] && step === 'detail';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeSheet}>
      {/* The 메모 input sits at the bottom of the sheet, so on iOS the keyboard
          would cover it. The sheet is a flex-end child rather than absolutely
          positioned, so KeyboardAvoidingView's inset actually lifts it. */}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={closeSheet} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.grabber} />
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {sheet === 'more' && (
              <MoreSheet openSheet={openSheet} closeSheet={closeSheet} />
            )}

            {showDetail && renderDetail()}

            {sheet === 'meal' && step === 'main' && (
              <>
                <SheetHeader title="식사" onClose={closeSheet} />
                <View style={styles.stack}>
                  <ChoiceBtn variant="good" label="먹었어요"
                    onPress={() => toDetail('meal', { state: '완료' }, '식사 기록되었습니다')} />
                  <ChoiceBtn variant="plain" label="안 먹었어요"
                    onPress={() => toDetail('meal', { state: '안 먹음' }, '식사 기록되었습니다')} />
                </View>
                <Text style={styles.hintCenter}>먹을 때마다 눌러 횟수를 기록해요</Text>
              </>
            )}

            {sheet === 'poop' && step === 'main' && (
              <>
                <SheetHeader title="배변" onClose={closeSheet} />
                <View style={styles.stack}>
                  <ChoiceBtn variant="good" label="정상"
                    onPress={() => toDetail('stool', { state: '정상' }, '배변 기록되었습니다')} />
                  <ChoiceBtn variant="warn" label="설사"
                    onPress={() => toDetail('stool', { state: '설사' }, '배변 기록되었습니다')} />
                  <ChoiceBtn variant="bad" label="색 이상"
                    onPress={() => toDetail('stool', { state: '색 이상' }, '배변 기록되었습니다')} />
                </View>
              </>
            )}

            {sheet === 'pee' && step === 'main' && (
              <>
                <SheetHeader title="소변" onClose={closeSheet} />
                <Pressable style={styles.accentBtn}
                  onPress={() => toDetail('urine', {}, '소변 기록되었습니다')}>
                  <Icon name="pee" size={17} color={colors.accentText} />
                  <Text style={styles.accentBtnText}>지금 다녀왔어요</Text>
                </Pressable>
              </>
            )}

            {sheet === 'vomit' && step === 'main' && (
              <>
                <SheetHeader title="구토" onClose={closeSheet} onBack={backToMore} />
                <ChoiceBtn variant="warn" icon="vomit" label="기록하기"
                  onPress={() => toDetail('vomit', {}, '구토 기록되었습니다')} />
              </>
            )}

            {sheet === 'walk' && (
              <>
                <SheetHeader title="산책" onClose={closeSheet} onBack={backToMore} />
                <Stepper
                  value={<Text style={styles.stepNum}>{walkMin}<Text style={styles.stepUnit}>분</Text></Text>}
                  onMinus={() => setWalkMin(Math.max(5, walkMin - 5))}
                  onPlus={() => setWalkMin(walkMin + 5)}
                />
                <Text style={styles.hintCenter}>5분 단위로 조절</Text>
                <PrimaryBtn label="기록하기"
                  onPress={() => addRecord({ recordType: 'walk', data: { minutes: walkMin } }, '산책 기록되었습니다')} />
              </>
            )}

            {sheet === 'condition' && condStage === 'main' && (
              <>
                <SheetHeader title="컨디션" onClose={closeSheet} onBack={backToMore} />
                <View style={styles.stack}>
                  <ChoiceBtn variant="good" label="좋아요"
                    onPress={() => addRecord({ recordType: 'condition', data: { level: '좋아요' } }, '컨디션 기록되었습니다')} />
                  <ChoiceBtn variant="plain" label="보통이에요"
                    onPress={() => addRecord({ recordType: 'condition', data: { level: '보통' } }, '컨디션 기록되었습니다')} />
                  <ChoiceBtn variant="warnOutline" label="안 좋아요"
                    onPress={() => setCondStage('symptom')} />
                </View>
              </>
            )}

            {sheet === 'condition' && condStage === 'symptom' && (
              <>
                <SheetHeader title="어떤 증상이 있나요?" small onClose={closeSheet}
                  onBack={() => setCondStage('main')} />
                <Text style={styles.subHint}>해당하는 항목을 모두 선택하세요</Text>
                <View style={styles.chips}>
                  {SYMPTOM_OPTS.map((op) => {
                    const on = symptoms.includes(op);
                    return (
                      <Pressable key={op} onPress={() => toggleSymptom(op)}
                        style={[styles.chip, on && styles.chipOn]}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{op}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <PrimaryBtn label="저장"
                  onPress={() => addRecord({ recordType: 'condition', data: { level: '안 좋아요', symptoms } }, '컨디션 기록되었습니다')} />
              </>
            )}

            {sheet === 'weight' && (
              <>
                <SheetHeader title="몸무게" onClose={closeSheet} onBack={backToMore} />
                <Stepper
                  value={<Text style={styles.stepNum}>{weightVal.toFixed(1)}<Text style={styles.stepUnit}> kg</Text></Text>}
                  onMinus={() => setWeightVal(Math.round((weightVal - 0.1) * 10) / 10)}
                  onPlus={() => setWeightVal(Math.round((weightVal + 0.1) * 10) / 10)}
                />
                <Text style={styles.hintCenter}>측정일 · {formatDot(today)}</Text>
                <PrimaryBtn label="저장"
                  onPress={() => addRecord({ recordType: 'weight', data: { kg: weightVal } }, '몸무게 기록되었습니다')} />
              </>
            )}

            {sheet === 'memo' && (
              <MemoSheet onClose={closeSheet} onBack={backToMore} addRecord={addRecord} />
            )}
          </ScrollView>
          {/* Sheet-wide: every branch above saves through the store, and any of
              them can fail. Sits below the scroll area so it stays visible. */}
          <SheetError message={writeError} />
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// 오늘의 메모 (recordType='note') — free text, explicit save.
function MemoSheet({ onClose, onBack, addRecord }) {
  const [text, setText] = useState('');
  return (
    <>
      <SheetHeader title="오늘의 메모" onClose={onClose} onBack={onBack} />
      <TextInput
        style={styles.noteBox}
        value={text}
        onChangeText={setText}
        placeholder="오늘 특별히 남기고 싶은 내용을 적어보세요"
        placeholderTextColor={colors.textGhost}
        multiline
        textAlignVertical="top"
      />
      <PrimaryBtn
        label="저장"
        onPress={() => addRecord({ recordType: 'note', memo: text.trim() || '작성됨' }, '메모가 저장되었습니다')}
      />
    </>
  );
}

function MoreSheet({ openSheet, closeSheet }) {
  const { species } = useStore();
  const items = [
    { key: 'vomit', icon: 'vomit', label: '구토' },
    species === 'cat'
      ? { key: 'walk', icon: 'walk', label: '산책' }
      : { key: 'condition', icon: 'condition', label: '컨디션' },
    { key: 'weight', icon: 'weight', label: '몸무게' },
    { key: 'photo', icon: 'healthPhoto', label: '건강사진' },
    { key: 'memo', icon: 'memo', label: '메모' },
  ];
  // Fixed three per row. Laying this out with a percentage width plus a gap
  // overflowed by a pixel or two and silently dropped to two columns, and the
  // safe percentage changes with screen width and the scale ratio — so build
  // real rows and let flex divide them.
  const rows = [];
  for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));

  return (
    <>
      <SheetHeader title="더보기" onClose={closeSheet} />
      <View style={styles.moreGrid}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.moreRow}>
            {row.map((it) => (
              <Pressable key={it.key} style={styles.moreCell}
                onPress={() => openSheet(it.key, true)}>
                <Icon name={it.icon} size={22} color={colors.primary} />
                <Text style={styles.moreLabel}>{it.label}</Text>
              </Pressable>
            ))}
            {/* keep the last row's cells the same width as a full row's */}
            {Array.from({ length: 3 - row.length }, (_, i) => (
              <View key={`gap${i}`} style={styles.moreFiller} />
            ))}
          </View>
        ))}
      </View>
    </>
  );
}

function SheetHeader({ title, onClose, onBack, small }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={8}>
            <Icon name="arrow-left" size={17} color="#6B6259" />
          </Pressable>
        )}
        <Text style={[styles.headerTitle, small && { fontSize: 14 }]}>{title}</Text>
      </View>
      <Pressable onPress={onClose} hitSlop={8}>
        <Icon name="x" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const VARIANTS = {
  good: { borderColor: colors.goodBorder, backgroundColor: colors.goodBg, color: colors.goodText, weight: '700' },
  warn: { borderColor: colors.warnBorder, backgroundColor: colors.warnBg, color: colors.warnText, weight: '700' },
  warnOutline: { borderColor: colors.warnBorder, backgroundColor: '#fff', color: colors.warnText, weight: '700' },
  bad: { borderColor: colors.badBorder, backgroundColor: colors.badBg, color: colors.badText, weight: '700' },
  plain: { borderColor: colors.borderStrong, backgroundColor: '#fff', color: '#6B6259', weight: '600' },
};

function ChoiceBtn({ variant, label, icon, onPress }) {
  const v = VARIANTS[variant] || VARIANTS.plain;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, { borderColor: v.borderColor, backgroundColor: v.backgroundColor }]}
    >
      {icon && <Icon name={icon} size={16} color={v.color} style={{ marginRight: 7 }} />}
      <Text style={{ color: v.color, fontWeight: v.weight, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

function PrimaryBtn({ label, onPress }) {
  return (
    <Pressable style={styles.primaryBtn} onPress={onPress}>
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

function Stepper({ value, onMinus, onPlus }) {
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepBtn} onPress={onMinus}>
        <Icon name="minus" size={16} color="#6B6259" />
      </Pressable>
      {value}
      <Pressable style={styles.stepBtn} onPress={onPlus}>
        <Icon name="plus" size={16} color="#6B6259" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create(scaled({
  fill: { flex: 1, justifyContent: 'flex-end' },
  // Absolutely filled rather than flex:1, so the sheet is the only flex child
  // and the keyboard inset lifts the sheet instead of shrinking the backdrop.
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,15,10,0.34)' },
  sheet: {
    maxHeight: '84%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E7DFD4',
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  stack: { gap: 9, marginBottom: 14 },
  choice: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.accentText, fontWeight: '700', fontSize: 14 },
  accentBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  accentBtnText: { color: colors.accentText, fontWeight: '700', fontSize: 14 },
  hintCenter: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginBottom: 4 },
  subHint: { fontSize: 11, color: colors.textMuted, marginBottom: 12 },
  // detail step
  chosenRow: {
    alignSelf: 'flex-start',
    backgroundColor: colors.peachSoft,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 13,
    marginBottom: 10,
  },
  chosenText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  detailHint: { fontSize: 12, color: colors.textMuted, marginBottom: 12 },
  attachCards: { flexDirection: 'row', gap: 10 },
  attachCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 7,
  },
  attachCardOn: { borderColor: colors.accent, backgroundColor: colors.peachSoft },
  attachCardText: { fontSize: 12, color: '#6B6259', fontWeight: '600' },
  detailBtns: { flexDirection: 'row', gap: 10, marginTop: 18 },
  skipBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  skipText: { color: '#6B6259', fontWeight: '600', fontSize: 14 },
  registerBtn: {
    flex: 2,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  registerText: { color: colors.accentText, fontWeight: '700', fontSize: 14 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 4,
    marginTop: 6,
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
  stepNum: { fontSize: 28, fontWeight: '800', color: colors.text },
  stepUnit: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  moreGrid: { gap: 10 },
  moreRow: { flexDirection: 'row', gap: 10 },
  moreFiller: { flex: 1 },
  moreCell: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    gap: 7,
  },
  moreLabel: { fontSize: 11, color: '#6B6259', fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  chipText: { color: colors.textMuted, fontWeight: '500', fontSize: 12 },
  chipTextOn: { color: colors.accentText, fontWeight: '700' },
  thumbRow: { marginTop: 12 },
  thumbWrap: { marginRight: 8 },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: colors.surfaceMuted },
  thumbX: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    minHeight: 64,
    fontSize: 13,
    color: colors.text,
  },
  noteBox: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    height: 110,
    padding: 12,
    marginBottom: 14,
    fontSize: 13,
    color: colors.text,
  },
}));
