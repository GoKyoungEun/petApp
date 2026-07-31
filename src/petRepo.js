// Pet data-access layer — same async contract as recordRepo (03_DB_Design Pet).
// Backing: AsyncStorage. Later: Supabase / Firebase, swapped here only.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'petapp:pets:v1';
const SEL_KEY = 'petapp:selectedPet:v1';

// Seeded on first run so the app opens to a working home. These are real,
// editable/removable records now — not hardcoded UI data.
const SEED = [
  { id: 'p1', userId: 'local', name: '코코', species: 'dog', birthDate: '2023-05-01', isEstimatedBirthDate: true, gender: 'male', photoUrl: null, breed: null, currentWeight: null, neutered: null },
  { id: 'p2', userId: 'local', name: '보리', species: 'cat', birthDate: '2025-03-01', isEstimatedBirthDate: true, gender: 'female', photoUrl: null, breed: null, currentWeight: null, neutered: null },
];

let _pets = null;
let _loading = null;
let _seq = 1;

const clone = (p) => ({ ...p });

async function load() {
  if (_pets) return _pets;
  if (_loading) return _loading;
  _loading = (async () => {
    let stored = null;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) stored = JSON.parse(raw);
    } catch (e) {
      stored = null;
    }
    if (!stored) {
      stored = SEED.map(clone);
      try {
        await AsyncStorage.setItem(KEY, JSON.stringify(stored));
      } catch (e) {
        // best-effort seed; keep in-memory copy either way
      }
    }
    _seq = stored.reduce((max, p) => {
      const n = parseInt(String(p.id).replace(/^p/, ''), 10);
      return Number.isFinite(n) && n >= max ? n + 1 : max;
    }, 1);
    _pets = stored;
    return _pets;
  })();
  return _loading;
}

async function persist() {
  await AsyncStorage.setItem(KEY, JSON.stringify(_pets));
}

export const petRepo = {
  async list() {
    await load();
    return _pets.map(clone);
  },

  async get(id) {
    await load();
    const p = _pets.find((x) => x.id === id);
    return p ? clone(p) : null;
  },

  async add(data) {
    await load();
    const now = new Date().toISOString();
    const pet = {
      id: `p${_seq++}`,
      userId: 'local',
      name: data.name,
      species: data.species,
      birthDate: data.birthDate ?? null,
      isEstimatedBirthDate: !!data.isEstimatedBirthDate,
      gender: data.gender ?? null,
      photoUrl: data.photoUrl ?? null,
      breed: data.breed ?? null,
      currentWeight: data.currentWeight ?? null,
      neutered: data.neutered ?? null,
      createdAt: now,
      updatedAt: now,
    };
    _pets.push(pet);
    await persist();
    return clone(pet);
  },

  async update(id, patch) {
    await load();
    const p = _pets.find((x) => x.id === id);
    if (!p) return null;
    Object.assign(p, patch, { updatedAt: new Date().toISOString() });
    await persist();
    return clone(p);
  },

  async remove(id) {
    await load();
    const i = _pets.findIndex((x) => x.id === id);
    if (i >= 0) {
      _pets.splice(i, 1);
      await persist();
    }
  },

  async getSelectedId() {
    try {
      return await AsyncStorage.getItem(SEL_KEY);
    } catch (e) {
      return null;
    }
  },

  async setSelectedId(id) {
    try {
      await AsyncStorage.setItem(SEL_KEY, id);
    } catch (e) {
      // non-critical
    }
  },
};
