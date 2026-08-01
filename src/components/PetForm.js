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
import { speciesMeta, birthDateFromAge, ageYears } from '../pets';
import { scaled } from '../scale';

const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());

export default function PetForm() {
  const { showPetForm, closePetForm, addPet, updatePet, removePet, editingPetId, pets } =
    useStore();

  const editingPet = pets.find((p) => p.id === editingPetId) || null;
  const isEdit = !!editingPet;

  const [photo, setPhoto] = useState(null);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('dog');
  const [birthMode, setBirthMode] = useState('age'); // 'age' | 'date'
  const [age, setAge] = useState(1);
  const [birthText, setBirthText] = useState('');
  const [gender, setGender] = useState(null); // 'male' | 'female'
  const [breed, setBreed] = useState('');
  const [weight, setWeight] = useState('');
  const [neutered, setNeutered] = useState(null); // true | false
  const [confirmDel, setConfirmDel] = useState(false);

  // Reset (create) or prefill (edit) every time the form opens.
  useEffect(() => {
    if (!showPetForm) return;
    setConfirmDel(false);
    if (editingPet) {
      setPhoto(editingPet.photoUrl || null);
      setName(editingPet.name || '');
      setSpecies(editingPet.species || 'dog');
      if (editingPet.isEstimatedBirthDate) {
        setBirthMode('age');
        setAge(ageYears(editingPet.birthDate) ?? 1);
        setBirthText('');
      } else {
        setBirthMode('date');
        setAge(1);
        setBirthText(editingPet.birthDate || '');
      }
      setGender(editingPet.gender ?? null);
      setBreed(editingPet.breed || '');
      setWeight(editingPet.currentWeight != null ? String(editingPet.currentWeight) : '');
      setNeutered(typeof editingPet.neutered === 'boolean' ? editingPet.neutered : null);
    } else {
      setPhoto(null);
      setName('');
      setSpecies('dog');
      setBirthMode('age');
      setAge(1);
      setBirthText('');
      setGender(null);
      setBreed('');
      setWeight('');
      setNeutered(null);
    }
  }, [showPetForm, editingPetId]);

  const dateOk = birthMode === 'age' || isValidDate(birthText);
  const canSave = name.trim() !== '' && gender !== null && dateOk;

  const pickPhoto = async () => {
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        base64: true,
        quality: 0.6,
      });
      if (!res.canceled && res.assets?.length) {
        const a = res.assets[0];
        setPhoto(a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri);
      }
    } catch (e) {
      // pick cancelled or unavailable — leave photo unset
    }
  };

  const submit = () => {
    if (!canSave) return;
    const data = {
      name: name.trim(),
      species,
      birthDate: birthMode === 'age' ? birthDateFromAge(age) : birthText,
      isEstimatedBirthDate: birthMode === 'age',
      gender,
      photoUrl: photo,
      breed: breed.trim() || null,
      currentWeight: weight ? parseFloat(weight) : null,
      neutered,
    };
    if (isEdit) updatePet(editingPet.id, data);
    else addPet(data);
  };

  const onDelete = () => {
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    removePet(editingPet.id);
  };

  const canDelete = isEdit && pets.length > 1;

  const meta = speciesMeta(species);

  return (
    <Modal visible={showPetForm} transparent animationType="slide"
      onRequestClose={closePetForm}>
      {/* The form is bottom-anchored, so on iOS the keyboard covers the 저장
          button and the lower fields; Android already pans the window. */}
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{isEdit ? '반려동물 정보 수정' : '반려동물 등록'}</Text>
            <Pressable onPress={closePetForm} hitSlop={8}>
              <Icon name="x" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled">
            {/* photo */}
            <Pressable style={styles.photoWrap} onPress={pickPhoto}>
              <View style={[styles.photo, { backgroundColor: meta.bg }]}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.photoImg} />
                ) : (
                  <Icon name={meta.icon} size={30} color={meta.fg} />
                )}
              </View>
              <View style={styles.camBadge}>
                <Icon name="camera" size={13} color="#fff" />
              </View>
            </Pressable>
            <Text style={styles.photoHint}>사진 추가 (선택)</Text>

            <Field label="이름" required>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="예: 코코"
                placeholderTextColor={colors.textGhost}
              />
            </Field>

            <Field label="종" required>
              <Segmented
                options={[{ v: 'dog', l: '강아지' }, { v: 'cat', l: '고양이' }]}
                value={species}
                onChange={setSpecies}
              />
            </Field>

            <Field label="생일" required>
              <Segmented
                options={[{ v: 'age', l: '추정 나이' }, { v: 'date', l: '생년월일' }]}
                value={birthMode}
                onChange={setBirthMode}
              />
              {birthMode === 'age' ? (
                <View style={styles.stepper}>
                  <Pressable style={styles.stepBtn} onPress={() => setAge(Math.max(0, age - 1))}>
                    <Icon name="minus" size={15} color="#6B6259" />
                  </Pressable>
                  <Text style={styles.stepNum}>
                    {age}
                    <Text style={styles.stepUnit}> 살</Text>
                  </Text>
                  <Pressable style={styles.stepBtn} onPress={() => setAge(age + 1)}>
                    <Icon name="plus" size={15} color="#6B6259" />
                  </Pressable>
                </View>
              ) : (
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={birthText}
                  onChangeText={setBirthText}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textGhost}
                  keyboardType="numbers-and-punctuation"
                />
              )}
            </Field>

            <Field label="성별" required>
              <Segmented
                options={[{ v: 'male', l: '남아' }, { v: 'female', l: '여아' }]}
                value={gender}
                onChange={setGender}
              />
            </Field>

            <View style={styles.divider} />
            <Text style={styles.optionalLabel}>선택 정보</Text>

            <Field label="품종">
              <TextInput
                style={styles.input}
                value={breed}
                onChangeText={setBreed}
                placeholder="예: 푸들"
                placeholderTextColor={colors.textGhost}
              />
            </Field>

            <Field label="현재 몸무게">
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="예: 4.2"
                  placeholderTextColor={colors.textGhost}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.unit}>kg</Text>
              </View>
            </Field>

            <Field label="중성화">
              <Segmented
                options={[{ v: true, l: '했어요' }, { v: false, l: '안 했어요' }]}
                value={neutered}
                onChange={setNeutered}
              />
            </Field>
          </ScrollView>

          <Pressable
            style={[styles.saveBtn, !canSave && styles.saveBtnOff]}
            onPress={submit}
            disabled={!canSave}>
            <Text style={[styles.saveText, !canSave && styles.saveTextOff]}>
              {isEdit ? '저장' : '등록하기'}
            </Text>
          </Pressable>

          {isEdit && (
            canDelete ? (
              <Pressable style={styles.deleteBtn} onPress={onDelete}>
                <Text style={styles.deleteText}>
                  {confirmDel ? '한 번 더 누르면 삭제돼요' : '삭제'}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.deleteNote}>최소 한 마리는 필요해요</Text>
            )
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
        {required && <Text style={styles.req}> *</Text>}
      </Text>
      {children}
    </View>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = value === o.v;
        return (
          <Pressable
            key={String(o.v)}
            style={[styles.seg, on && styles.segOn]}
            onPress={() => onChange(o.v)}>
            <Text style={[styles.segText, on && styles.segTextOn]}>{o.l}</Text>
          </Pressable>
        );
      })}
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
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 4 },
  photoWrap: { alignSelf: 'center', marginTop: 4 },
  photo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImg: { width: 84, height: 84 },
  camBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  photoHint: { alignSelf: 'center', fontSize: 11, color: colors.textMuted, marginTop: 8, marginBottom: 6 },
  field: { marginTop: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textBody, marginBottom: 8 },
  req: { color: colors.primary },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  unit: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  segmented: {
    flexDirection: 'row',
    gap: 8,
  },
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 10,
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
  divider: { height: 1, backgroundColor: colors.divider, marginTop: 20 },
  optionalLabel: { fontSize: 11, fontWeight: '700', color: colors.textFaint, marginTop: 14 },
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
  deleteNote: { textAlign: 'center', color: colors.textGhost, fontSize: 12, paddingVertical: 12, marginTop: 4 },
}));
