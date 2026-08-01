import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { recordRepo } from './repository';
import { petRepo } from './petRepo';
import { todayYmd } from './date';
import { useRecordsByDate, invalidateRecords } from './queries/records';
import { usePets, invalidatePets } from './queries/pets';

const StoreContext = createContext(null);

// Home "오늘 기록" is a count-based read-model over today's events, in fixed
// order. Repeated events (식사/배변/소변/구토) show "N회" — never a flipping
// state label. Only types with ≥1 record appear, so the list grows as you log.
const TYPE_META = {
  meal: { icon: 'meal', label: '식사' },
  stool: { icon: 'poop', label: '배변' },
  urine: { icon: 'pee', label: '소변' },
  vomit: { icon: 'vomit', label: '구토' },
  walk: { icon: 'walk', label: '산책' },
  condition: { icon: 'condition', label: '컨디션' },
  weight: { icon: 'weight', label: '몸무게' },
  note: { icon: 'memo', label: '메모' },
  healthPhoto: { icon: 'healthPhoto', label: '건강사진' },
};
// 05_UI_UX "날짜 상세 화면" fixed order — 사진 comes last.
const TODAY_ORDER = [
  'meal', 'stool', 'urine', 'vomit', 'walk', 'condition', 'weight', 'note', 'healthPhoto',
];

function summarizeType(type, recs) {
  switch (type) {
    case 'meal': {
      const eaten = recs.filter((r) => r.data?.state === '완료').length;
      return eaten > 0 ? `${eaten}회` : '안 먹음';
    }
    case 'stool':
    case 'urine':
    case 'vomit':
      return `${recs.length}회`;
    case 'walk':
      return `${recs.reduce((s, r) => s + (r.data?.minutes || 0), 0)}분`;
    case 'condition':
      return recs[recs.length - 1]?.data?.level || '기록';
    case 'weight': {
      const kg = recs[recs.length - 1]?.data?.kg;
      return kg != null ? `${kg} kg` : '기록';
    }
    case 'note':
      return '작성됨';
    case 'healthPhoto': {
      // Count photos, not records — two records of three photos reads as 6장.
      const n = recs.reduce((sum, r) => sum + (r.data?.photos?.length || 0), 0);
      return `${n}장`;
    }
    default:
      return `${recs.length}회`;
  }
}

export function summarizeDay(records) {
  const byType = {};
  for (const r of records) (byType[r.recordType] ||= []).push(r);
  return TODAY_ORDER.filter((t) => byType[t]?.length).map((t) => ({
    type: t,
    icon: TYPE_META[t].icon,
    label: TYPE_META[t].label,
    value: summarizeType(t, byType[t]),
  }));
}

export function StoreProvider({ children }) {
  const [tab, setTab] = useState('home');

  // The working date. A health diary is left open overnight, so the app can't
  // read "today" once at launch and keep it forever — re-read it whenever the
  // app comes back to the foreground, and roll it over at the next midnight
  // while the app stays open.
  const [today, setToday] = useState(todayYmd);

  useEffect(() => {
    const sync = () => setToday((cur) => (cur === todayYmd() ? cur : todayYmd()));

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });

    // Fire just after the upcoming local midnight; the effect re-runs on the
    // new `today` and schedules the following day.
    const midnight = new Date();
    midnight.setHours(24, 0, 1, 0);
    const timer = setTimeout(sync, midnight.getTime() - Date.now());

    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [today]);

  // Pets come from the query cache (seeds 코코·보리 on first run); which one is
  // selected is UI state and stays here.
  const { data: pets = [] } = usePets();
  const [currentPetId, setCurrentPetId] = useState(null);
  const [showPetMenu, setShowPetMenu] = useState(false);
  const [showPetForm, setShowPetForm] = useState(false);
  const [editingPetId, setEditingPetId] = useState(null); // null = create mode

  const currentPet = pets.find((p) => p.id === currentPetId) || null;
  const petId = currentPet?.id ?? null;
  const species = currentPet?.species ?? 'dog';
  const pet = currentPet?.name ?? '';

  // Restore the last selection once the list arrives. Only on the first load —
  // later refetches (after an edit or delete) must not override the user's
  // current choice.
  const selectionRestored = useRef(false);
  useEffect(() => {
    if (selectionRestored.current || pets.length === 0) return;
    selectionRestored.current = true;
    (async () => {
      const saved = await petRepo.getSelectedId();
      setCurrentPetId(saved && pets.some((p) => p.id === saved) ? saved : pets[0].id);
    })();
  }, [pets]);

  // Which item tab 전체 기록보기 opens on. Lives here so the calendar can jump
  // straight to one item (06_UserFlow "항목 선택 시 수정") — its day panel shows
  // per-type totals, not individual records, so it can't open the edit sheet.
  const [recordsType, setRecordsType] = useState('meal');

  const openRecords = useCallback((type = 'meal') => {
    setRecordsType(type);
    setTab('records');
  }, []);

  const [sheet, setSheet] = useState(null);
  const [sheetFromMore, setSheetFromMore] = useState(false);
  const [condStage, setCondStage] = useState('main');
  const [walkMin, setWalkMin] = useState(20);
  const [weightVal, setWeightVal] = useState(4.2);
  const [symptoms, setSymptoms] = useState(['식욕 저하']);

  // Today's records for the current pet. The query refetches itself whenever
  // petId/today change or a write invalidates the prefix.
  const { data: records = [] } = useRecordsByDate(petId, today);

  const lastBatch = useRef([]); // ids added by the last save — undo removes these
  const [snack, setSnack] = useState(null); // save confirmation (has undo)
  const snackTimer = useRef(null);
  const [toast, setToast] = useState(null); // plain notice (no undo)
  const toastTimer = useRef(null);

  const selectPet = useCallback(async (id) => {
    setCurrentPetId(id);
    setShowPetMenu(false);
    await petRepo.setSelectedId(id);
  }, []);

  // id = null → create; id = pet id → edit that pet.
  const openPetForm = useCallback((id = null) => {
    setEditingPetId(id);
    setShowPetMenu(false);
    setShowPetForm(true);
  }, []);

  const closePetForm = useCallback(() => {
    setShowPetForm(false);
    setEditingPetId(null);
  }, []);

  const addPet = useCallback(async (data) => {
    const created = await petRepo.add(data);
    await invalidatePets();
    setCurrentPetId(created.id);
    await petRepo.setSelectedId(created.id);
    closePetForm();
    return created;
  }, [closePetForm]);

  const updatePet = useCallback(async (id, data) => {
    await petRepo.update(id, data);
    await invalidatePets();
    closePetForm();
  }, [closePetForm]);

  const removePet = useCallback(
    async (id) => {
      await petRepo.remove(id);
      await recordRepo.removeByPet(id); // cascade — no orphan records
      await invalidatePets();
      await invalidateRecords(id);
      if (id === currentPetId) {
        // Read the fresh list directly: the query refetch may not have landed
        // yet, and the next selection has to be right now.
        const list = await petRepo.list();
        const next = list[0]?.id ?? null;
        setCurrentPetId(next);
        await petRepo.setSelectedId(next);
      }
      closePetForm();
    },
    [currentPetId, closePetForm]
  );

  const clearSnackTimer = useCallback(() => {
    if (snackTimer.current) {
      clearTimeout(snackTimer.current);
      snackTimer.current = null;
    }
  }, []);

  const showSnack = useCallback(
    (msg) => {
      clearSnackTimer();
      setToast(null);
      setSnack(msg);
      snackTimer.current = setTimeout(() => {
        setSnack((cur) => (cur === msg ? null : cur));
      }, 4000);
    },
    [clearSnackTimer]
  );

  // Plain toast without an undo action (e.g. "no data to copy").
  const showToast = useCallback(
    (msg) => {
      clearSnackTimer();
      setSnack(null);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast(msg);
      toastTimer.current = setTimeout(() => {
        setToast((cur) => (cur === msg ? null : cur));
      }, 2600);
    },
    [clearSnackTimer]
  );

  const openSheet = useCallback((name, fromMore = false) => {
    if (name === 'walk') setWalkMin(20);
    setCondStage('main');
    setSheetFromMore(fromMore);
    setSheet(name);
  }, []);

  const closeSheet = useCallback(() => {
    setSheet(null);
    setCondStage('main');
  }, []);

  // Create one or more event records, then surface the snackbar. The ids are
  // tracked so undo can remove exactly this batch (a single tap, or the whole
  // "오늘도 평소와 같아요" set).
  const addRecords = useCallback(
    async (entries, msg) => {
      const added = [];
      for (const e of entries) {
        const rec = await recordRepo.add({
          petId,
          recordDate: today,
          recordType: e.recordType,
          data: e.data || {},
          memo: e.memo ?? null,
        });
        added.push(rec.id);
      }
      lastBatch.current = added;
      await invalidateRecords(petId);
      setSheet(null);
      setCondStage('main');
      showSnack(msg);
    },
    [petId, today, showSnack]
  );

  const addRecord = useCallback((entry, msg) => addRecords([entry], msg), [addRecords]);

  // Editing an existing record (02_MVP_Requirement §8 — no edit-count limit).
  // Note these use showToast, not showSnack: undo is wired to the *last added*
  // batch, so offering it here would delete the wrong rows.
  const [editingRecord, setEditingRecord] = useState(null);

  const openEditRecord = useCallback((record) => setEditingRecord(record), []);
  const closeEditRecord = useCallback(() => setEditingRecord(null), []);

  const updateRecord = useCallback(
    async (id, patch) => {
      await recordRepo.update(id, patch); // repo stamps updatedAt
      await invalidateRecords(petId);
      setEditingRecord(null);
      showToast('수정되었습니다');
    },
    [petId, showToast]
  );

  const deleteRecord = useCallback(
    async (id) => {
      await recordRepo.remove(id);
      await invalidateRecords(petId);
      setEditingRecord(null);
      showToast('삭제되었습니다');
    },
    [petId, showToast]
  );

  const undo = useCallback(async () => {
    clearSnackTimer();
    for (const id of lastBatch.current) await recordRepo.remove(id);
    lastBatch.current = [];
    await invalidateRecords(petId);
    setSnack(null);
  }, [clearSnackTimer, petId]);

  const toggleSymptom = useCallback((op) => {
    setSymptoms((cur) =>
      cur.includes(op) ? cur.filter((x) => x !== op) : [...cur, op]
    );
  }, []);

  const todayItems = useMemo(() => summarizeDay(records), [records]);

  const value = {
    tab,
    setTab,
    today,
    pets,
    pet,
    currentPet,
    currentPetId,
    petId,
    species,
    selectPet,
    addPet,
    updatePet,
    removePet,
    showPetMenu,
    setShowPetMenu,
    showPetForm,
    editingPetId,
    openPetForm,
    closePetForm,
    sheet,
    setSheet,
    sheetFromMore,
    openSheet,
    closeSheet,
    condStage,
    setCondStage,
    walkMin,
    setWalkMin,
    weightVal,
    setWeightVal,
    symptoms,
    toggleSymptom,
    records,
    todayItems,
    recordsType,
    setRecordsType,
    openRecords,
    addRecord,
    addRecords,
    editingRecord,
    openEditRecord,
    closeEditRecord,
    updateRecord,
    deleteRecord,
    undo,
    snack,
    toast,
    showToast,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
