// Photo picking for record sheets (빠른 기록 · 수정 시트).
//
// Kept out of the sheets so both go through one implementation — they had
// drifted into two copies of the same picker call, and only one of them would
// have been fixed.
//
// 02_MVP_Requirement §6 allows up to MAX_PHOTOS per record, so the picker has
// to be multi-select. Note `allowsEditing` is mutually exclusive with
// `allowsMultipleSelection` (SDK 54 docs) — that is why the pet profile picker
// in PetForm, which crops to a square, stays single-select and separate.

import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

// Returns the picked images as data URIs, at most `remaining` of them.
// Returns [] on cancel, denied permission, or when there is no room left.
export async function pickRecordPhotos(remaining) {
  if (!remaining || remaining <= 0) return [];
  try {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') return [];
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true, // Android · iOS 14+ · Web
      selectionLimit: remaining, // Android · iOS 14+
      base64: true,
      quality: 0.5,
    });
    if (res.canceled || !res.assets?.length) return [];
    // slice again: platforms without selectionLimit support (iOS 13 and older)
    // ignore it, so the cap has to hold here too.
    return res.assets
      .slice(0, remaining)
      .map((a) => (a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri));
  } catch (e) {
    return []; // cancelled or picker unavailable
  }
}
