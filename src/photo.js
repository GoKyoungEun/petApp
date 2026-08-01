// Photo capture and picking for record sheets (빠른 기록 · 건강사진 · 수정).
//
// Everything goes through compress() before it reaches the store: 02 §6 says
// "업로드 전 자동 압축, 원본은 삭제", and the numbers come from 08_TechStack —
// long edge 1280px, JPEG quality 0.7. That is small enough that a six-photo
// record stays a few hundred KB, and still detailed enough for the AI analysis
// planned in 07_Roadmap 3차.
//
// Compression matters more than it looks: photos are stored inside the record
// (`data.photos`) today, so an uncompressed 4000px camera shot would be read
// back on every 통계/몸무게 query that loads a pet's whole history.

import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export const MAX_LONG_EDGE = 1280;
export const JPEG_QUALITY = 0.7;

// Resize so the longer side is at most MAX_LONG_EDGE, then re-encode as JPEG.
// Returns a data URI, or null if the image could not be processed.
async function compress(asset) {
  try {
    const { uri, width, height } = asset;
    const context = ImageManipulator.manipulate(uri);

    // Pass only the longer side so the aspect ratio is kept. Images already
    // under the limit are left at their own size.
    const longEdge = Math.max(width || 0, height || 0);
    if (longEdge > MAX_LONG_EDGE) {
      context.resize(
        (width || 0) >= (height || 0) ? { width: MAX_LONG_EDGE } : { height: MAX_LONG_EDGE }
      );
    }

    const rendered = await context.renderAsync();
    const out = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: JPEG_QUALITY,
      base64: true,
    });
    return out.base64 ? `data:image/jpeg;base64,${out.base64}` : out.uri;
  } catch (e) {
    // Fall back to whatever the picker gave us rather than losing the photo.
    return asset.uri ?? null;
  }
}

async function compressAll(assets, limit) {
  const out = [];
  for (const a of assets.slice(0, limit)) {
    const uri = await compress(a);
    if (uri) out.push(uri);
  }
  return out;
}

// Gallery, multi-select. Returns at most `remaining` compressed data URIs;
// [] on cancel, denied permission, or when there is no room left.
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
    });
    if (res.canceled || !res.assets?.length) return [];
    // slice again: platforms without selectionLimit support ignore it.
    return compressAll(res.assets, remaining);
  } catch (e) {
    return [];
  }
}

// Camera, one shot (02 §6 "카메라와 갤러리 모두 지원"). Returns [] or one URI.
export async function captureRecordPhoto(remaining) {
  if (!remaining || remaining <= 0) return [];
  try {
    if (Platform.OS === 'web') return []; // no camera capture on web
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') return [];

    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'] });
    if (res.canceled || !res.assets?.length) return [];
    return compressAll(res.assets, 1);
  } catch (e) {
    return [];
  }
}
