// Data-access layer. Screens and the store call THIS — never storage directly.
//
// Records follow the event-based HealthRecord shape from 03_DB_Design.md:
//   { id, petId, recordType, recordDate, data, memo, createdAt, updatedAt }
// recordType: meal | stool | urine | vomit | walk | condition | weight | note
// `data` holds type-specific fields (state / minutes / kg / level / symptoms).
//
// The interface is async (Promise-based) so the backing store can be swapped
// with no change at the call sites. Current backing: AsyncStorage — records
// persist across app restarts (localStorage on web). Later: Supabase / Firebase.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'petapp:records:v1';

// 03_DB_Design "사진 제한" — 6장이면 전체 기록보기의 3열 격자에 2행으로
// 떨어진다 (2026-07-29에 5→6, 11_ChangeLog).
export const MAX_PHOTOS = 6;

let _records = null; // in-memory cache; null until first load
let _loading = null; // in-flight load promise (dedupes concurrent callers)
let _seq = 1;

const clone = (r) => ({ ...r, data: { ...r.data } });

// Load the cache once, restoring the id sequence so new ids never collide with
// persisted ones.
async function load() {
  if (_records) return _records;
  if (_loading) return _loading;
  _loading = (async () => {
    let stored = [];
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) stored = JSON.parse(raw);
    } catch (e) {
      stored = [];
    }
    _seq = stored.reduce((max, r) => {
      const n = parseInt(String(r.id).replace(/^r/, ''), 10);
      return Number.isFinite(n) && n >= max ? n + 1 : max;
    }, 1);
    _records = stored;
    return _records;
  })();
  return _loading;
}

async function persist() {
  await AsyncStorage.setItem(KEY, JSON.stringify(_records));
}

export const recordRepo = {
  async add({ petId, recordType, recordDate, data = {}, memo = null }) {
    await load();
    const now = new Date().toISOString();
    const rec = {
      id: `r${_seq++}`,
      petId,
      recordType,
      recordDate,
      data,
      memo,
      createdAt: now,
      updatedAt: now,
    };
    _records.push(rec);
    await persist();
    return clone(rec);
  },

  async listByDate(petId, recordDate) {
    await load();
    return _records
      .filter((r) => r.petId === petId && r.recordDate === recordDate)
      .map(clone);
  },

  // Newest date first — used by the "전체 기록보기" item tabs later.
  async listByType(petId, recordType) {
    await load();
    return _records
      .filter((r) => r.petId === petId && r.recordType === recordType)
      .sort((a, b) => (a.recordDate < b.recordDate ? 1 : -1))
      .map(clone);
  },

  async update(id, patch) {
    await load();
    const rec = _records.find((r) => r.id === id);
    if (!rec) return null;
    const { data, ...rest } = patch;
    Object.assign(rec, rest, { updatedAt: new Date().toISOString() });
    if (data) rec.data = { ...rec.data, ...data };
    await persist();
    return clone(rec);
  },

  async remove(id) {
    await load();
    const i = _records.findIndex((r) => r.id === id);
    if (i >= 0) {
      _records.splice(i, 1);
      await persist();
    }
  },

  // Unique dates (YYYY-MM-DD) that have ≥1 record — drives calendar markers.
  async datesWithRecords(petId) {
    await load();
    return [...new Set(_records.filter((r) => r.petId === petId).map((r) => r.recordDate))];
  },

  // Cascade cleanup when a pet is deleted, so no orphan records accumulate.
  async removeByPet(petId) {
    await load();
    const before = _records.length;
    _records = _records.filter((r) => r.petId !== petId);
    if (_records.length !== before) await persist();
  },
};
