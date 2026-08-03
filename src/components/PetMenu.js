import React from 'react';
import { Modal, View, Text, Image, Pressable, StyleSheet } from 'react-native';
import Icon from '../Icon';
import { colors } from '../theme';
import { useStore } from '../store';
import { speciesMeta, petSubtitle, MAX_PETS } from '../pets';
import { scaled } from '../scale';

export default function PetMenu() {
  const { pets, currentPetId, selectPet, showPetMenu, setShowPetMenu, openPetForm } =
    useStore();

  const full = pets.length >= MAX_PETS;

  const openAdd = () => {
    if (!full) openPetForm();
    else setShowPetMenu(false);
  };

  return (
    <Modal visible={showPetMenu} transparent animationType="fade"
      onRequestClose={() => setShowPetMenu(false)}>
      <Pressable style={styles.backdrop} onPress={() => setShowPetMenu(false)} />
      <View style={styles.menu}>
        {pets.map((p) => {
          const m = speciesMeta(p.species);
          return (
            <View key={p.id}
              style={[styles.item, p.id === currentPetId && styles.itemActive]}>
              <Pressable style={styles.itemMain} onPress={() => selectPet(p.id)}>
                <View style={[styles.avatar, { backgroundColor: m.bg }]}>
                  {p.photoUrl ? (
                    <Image source={{ uri: p.photoUrl }} style={styles.avatarImg} />
                  ) : (
                    <Icon name={m.icon} size={15} color={m.fg} />
                  )}
                </View>
                <View style={styles.itemText}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Text style={styles.sub}>{petSubtitle(p)}</Text>
                </View>
              </Pressable>
              <Pressable style={styles.editBtn} onPress={() => openPetForm(p.id)} hitSlop={6}>
                <Icon name="edit" size={15} color={colors.textMuted} />
              </Pressable>
            </View>
          );
        })}

        <Pressable style={styles.addRow} onPress={openAdd} disabled={full}>
          <Icon name="plus" size={15} color={full ? colors.textGhost : colors.primary} />
          <Text style={[styles.addText, full && { color: colors.textGhost }]}>
            {full ? '최대 5마리까지 등록돼요' : '반려동물 추가'}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create(scaled({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,15,10,0.28)' },
  menu: {
    position: 'absolute',
    top: 96,
    left: 18,
    width: 210,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 8,
    shadowColor: '#281905',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 4,
    paddingRight: 4,
  },
  itemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
  },
  editBtn: { padding: 8 },
  itemActive: { backgroundColor: colors.peachSoft },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 30, height: 30 },
  itemText: { flex: 1 },
  name: { fontSize: 13, fontWeight: '700', color: colors.text },
  sub: { fontSize: 10, color: colors.textMuted },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 11,
  },
  addText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
}));
