// MY 화면 — 계정, 반려동물 관리, 설정, 앱 정보.
//
// 반려동물 관리는 홈 헤더의 펫 전환 메뉴(PetMenu)와 같은 일을 하지만 진입점이
// 다르다. 메뉴는 "지금 보는 펫을 바꾼다"고, 여기는 "등록된 펫을 관리한다"다.
// 등록·수정 폼은 PetForm 하나를 그대로 쓴다.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Icon from '../Icon';
import { colors } from '../theme';
import { useStore } from '../store';
import { scaled } from '../scale';
import { speciesMeta, petSubtitle, MAX_PETS } from '../pets';
import { currentUser, signOut } from '../auth';
import appJson from '../../app.json';

export default function MyScreen() {
  const {
    pets, currentPetId, selectPet, openPetForm,
    openLegal, removeAccount, deleting, writeError,
  } = useStore();

  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    let alive = true;
    currentUser().then((u) => alive && setUser(u));
    return () => {
      alive = false;
    };
  }, []);

  // 성공하면 onAuthStateChange가 App.js의 게이트를 닫아 이 화면이 사라진다.
  const logout = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  };

  const full = pets.length >= MAX_PETS;

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>

      <Text style={styles.title}>MY</Text>

      {/* 계정 */}
      <View style={styles.card}>
        <View style={styles.account}>
          <View style={styles.avatar}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Icon name="user" size={22} />
            )}
          </View>
          <View style={styles.accountText}>
            <Text style={styles.name}>{user?.name || '로그인한 계정'}</Text>
            {/* 카카오는 이메일 동의를 안 한 계정이 있을 수 있다(08_TechStack) —
                없으면 provider 이름으로 대신한다. */}
            <Text style={styles.sub}>{user?.email || providerLabel(user?.provider)}</Text>
          </View>
        </View>

        <Pressable style={styles.logoutBtn} onPress={logout} disabled={busy}>
          <Text style={styles.logoutText}>{busy ? '로그아웃 중…' : '로그아웃'}</Text>
        </Pressable>
      </View>

      {/* 반려동물 관리 */}
      <Text style={styles.sectionLabel}>반려동물 {pets.length}/{MAX_PETS}</Text>
      <View style={styles.card}>
        {pets.map((p, i) => {
          const m = speciesMeta(p.species);
          const on = p.id === currentPetId;
          return (
            <View key={p.id} style={[styles.petRow, i === pets.length - 1 && styles.rowLast]}>
              <Pressable style={styles.petMain} onPress={() => selectPet(p.id)}>
                <View style={[styles.petAvatar, { backgroundColor: m.bg }]}>
                  {p.photoUrl ? (
                    <Image source={{ uri: p.photoUrl }} style={styles.petAvatarImg} />
                  ) : (
                    <Icon name={m.icon} size={16} color={m.fg} />
                  )}
                </View>
                <View style={styles.petText}>
                  <View style={styles.petNameRow}>
                    <Text style={styles.petName}>{p.name}</Text>
                    {/* 어느 펫을 보고 있는지가 홈·기록·통계 전부의 기준이라
                        여기서도 드러나야 한다. */}
                    {on && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>보는 중</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.sub}>{petSubtitle(p)}</Text>
                </View>
              </Pressable>
              <Pressable style={styles.editBtn} onPress={() => openPetForm(p.id)} hitSlop={8}>
                <Icon name="edit" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          );
        })}

        <Pressable
          style={[styles.addRow, pets.length > 0 && styles.addRowDivided]}
          onPress={() => openPetForm()}
          disabled={full}>
          <Icon name="plus" size={15} color={full ? colors.textGhost : colors.primary} />
          <Text style={[styles.addText, full && { color: colors.textGhost }]}>
            {full ? `최대 ${MAX_PETS}마리까지 등록돼요` : '반려동물 추가'}
          </Text>
        </Pressable>
      </View>

      {/* 설정 */}
      <Text style={styles.sectionLabel}>설정</Text>
      <View style={styles.card}>
        {/* notificationSetting은 일정마다 저장되지만 실제 예약은 미구현이다
            (09_Todo 우선순위 5). 켤 수 있는 것처럼 두면 알림을 기다리게 된다. */}
        <View style={[styles.row, styles.rowLast]}>
          <View style={styles.rowLeft}>
            <Icon name="bell" size={16} color={colors.textMuted} />
            <Text style={styles.rowLabel}>푸시 알림</Text>
          </View>
          <Text style={styles.rowValue}>준비 중</Text>
        </View>
      </View>

      {/* 앱 정보 */}
      <Text style={styles.sectionLabel}>앱 정보</Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={() => openLegal('terms')}>
          <View style={styles.rowLeft}>
            <Icon name="file-text" size={16} color={colors.textMuted} />
            <Text style={styles.rowLabel}>이용약관</Text>
          </View>
          <Icon name="chevron-right" size={14} color={colors.textGhost} />
        </Pressable>
        <Pressable style={styles.row} onPress={() => openLegal('privacy')}>
          <View style={styles.rowLeft}>
            <Icon name="file-text" size={16} color={colors.textMuted} />
            <Text style={styles.rowLabel}>개인정보 처리방침</Text>
          </View>
          <Icon name="chevron-right" size={14} color={colors.textGhost} />
        </Pressable>
        <View style={[styles.row, styles.rowLast]}>
          <View style={styles.rowLeft}>
            <Icon name="paw" size={16} color={colors.textMuted} />
            <Text style={styles.rowLabel}>버전</Text>
          </View>
          {/* app.json을 그대로 읽는다 — 버전을 두 군데 적어 두면 어긋난다. */}
          <Text style={styles.rowValue}>{appJson.expo.version}</Text>
        </View>
      </View>

      {/* 회원 탈퇴 — 되돌릴 수 없어서 다른 동작과 떨어뜨려 맨 아래에 둔다. */}
      <Pressable style={styles.leaveBtn} onPress={() => setConfirmLeave(true)} disabled={deleting}>
        <Text style={styles.leaveText}>회원 탈퇴</Text>
      </Pressable>

      <LeaveSheet
        visible={confirmLeave}
        busy={deleting}
        error={writeError}
        petCount={pets.length}
        onCancel={() => setConfirmLeave(false)}
        onConfirm={removeAccount}
      />
    </ScrollView>
  );
}

// 탈퇴 확인. 두 번 누르기로 끝내지 않고 시트를 띄우는 이유는, 무엇이 지워지는지
// 읽고 나서 누르게 하려는 것이다 — 되돌릴 수 없는 유일한 동작이다.
function LeaveSheet({ visible, busy, error, petCount, onCancel, onConfirm }) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (visible) setTyped('');
  }, [visible]);

  if (!visible) return null;

  // 글자를 직접 치게 한다. 확인 버튼만 있으면 습관적으로 눌러 버린다.
  const ok = typed.trim() === '탈퇴';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.leaveWrap}>
        <View style={styles.leaveCard}>
          <Text style={styles.leaveTitle}>정말 탈퇴할까요?</Text>
          <Text style={styles.leaveBody}>
            반려동물 {petCount}마리와 모든 기록·일정·사진이 지워집니다.
            {'\n'}되돌릴 수 없어요.
          </Text>

          <Text style={styles.leaveHint}>계속하려면 “탈퇴”라고 입력해 주세요</Text>
          <TextInput
            style={styles.leaveInput}
            value={typed}
            onChangeText={setTyped}
            placeholder="탈퇴"
            placeholderTextColor={colors.textGhost}
            autoCorrect={false}
          />

          {error ? <Text style={styles.leaveError}>{error}</Text> : null}

          <View style={styles.leaveBtns}>
            <Pressable style={styles.leaveCancel} onPress={onCancel} disabled={busy}>
              <Text style={styles.leaveCancelText}>취소</Text>
            </Pressable>
            <Pressable
              style={[styles.leaveConfirm, (!ok || busy) && styles.leaveConfirmOff]}
              onPress={onConfirm}
              disabled={!ok || busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.leaveConfirmText}>탈퇴하기</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function providerLabel(provider) {
  if (provider === 'kakao') return '카카오 계정';
  if (provider === 'google') return 'Google 계정';
  return '이메일 없음';
}

const styles = StyleSheet.create(scaled({
  wrap: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 28 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, paddingTop: 16, marginBottom: 12 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 18,
    marginBottom: 8,
  },

  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },

  account: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.peachSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 48, height: 48 },
  accountText: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted },

  logoutBtn: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { fontSize: 13, fontWeight: '700', color: colors.textBody },

  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  petMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 13,
    paddingLeft: 14,
  },
  petAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  petAvatarImg: { width: 38, height: 38 },
  petText: { flex: 1, gap: 2 },
  petNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  petName: { fontSize: 14, fontWeight: '700', color: colors.text },
  badge: {
    backgroundColor: colors.peachLight,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: colors.accentText },
  editBtn: { paddingVertical: 14, paddingHorizontal: 14 },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  addRowDivided: { borderTopWidth: 1, borderTopColor: colors.divider },
  addText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  rowLabel: { fontSize: 13, color: colors.textBody },
  rowValue: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },

  // 눈에 띄는 버튼으로 만들지 않는다 — 찾으면 있지만 먼저 눈에 들어오지는
  // 않아야 하는 동작이다.
  leaveBtn: { alignItems: 'center', paddingVertical: 22 },
  leaveText: { fontSize: 12, color: colors.textFaint, textDecorationLine: 'underline' },

  leaveWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(20,15,10,0.45)',
  },
  leaveCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  leaveTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 8 },
  leaveBody: { fontSize: 13, lineHeight: 20, color: colors.textBody, marginBottom: 16 },
  leaveHint: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  leaveInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
  },
  leaveError: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: colors.badText,
  },
  leaveBtns: { flexDirection: 'row', gap: 9, marginTop: 16 },
  leaveCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  leaveCancelText: { fontSize: 14, fontWeight: '700', color: colors.textBody },
  leaveConfirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.badText,
  },
  leaveConfirmOff: { backgroundColor: colors.textGhost },
  leaveConfirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },
}));
