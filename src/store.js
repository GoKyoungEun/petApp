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
};
const TODAY_ORDER = ['meal', 'stool', 'urine', 'vomit', 'walk', 'condition', 'weight', 'note'];

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

  const [pets, setPets] = useState([]);
  const [currentPetId, setCurrentPetId] = useState(null);
  const [showPetMenu, setShowPetMenu] = useState(false);
  const [showPetForm, setShowPetForm] = useState(false);
  const [editingPetId, setEditingPetId] = useState(null); // null = create mode

  const currentPet = pets.find((p) => p.id === currentPetId) || null;
  const petId = currentPet?.id ?? null;
  const species = currentPet?.species ?? 'dog';
  const pet = currentPet?.name ?? '';

  // Load persisted pets + last selection on mount (seeds 코코·보리 first run).
  useEffect(() => {
    (async () => {
      const list = await petRepo.list();
      setPets(list);
      const saved = await petRepo.getSelectedId();
      setCurrentPetId(
        saved && list.some((p) => p.id === saved) ? saved : list[0]?.id ?? null
      );
    })();
  }, []);

  const [sheet, setSheet] = useState(null);
  const [sheetFromMore, setSheetFromMore] = useState(false);
  const [condStage, setCondStage] = useState('main');
  const [walkMin, setWalkMin] = useState(20);
  const [weightVal, setWeightVal] = useState(4.2);
  const [symptoms, setSymptoms] = useState(['식욕 저하']);

  const [records, setRecords] = useState([]); // today's records for current pet
  const lastBatch = useRef([]); // ids added by the last save — undo removes these
  const [snack, setSnack] = useState(null); // save confirmation (has undo)
  const snackTimer = useRef(null);
  const [toast, setToast] = useState(null); // plain notice (no undo)
  const toastTimer = useRef(null);

  const refreshToday = useCallback(async () => {
    if (!petId) {
      setRecords([]);
      return;
    }
    setRecords(await recordRepo.listByDate(petId, today));
  }, [petId, today]);

  useEffect(() => {
    refreshToday();
  }, [refreshToday]);

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
    setPets(await petRepo.list());
    setCurrentPetId(created.id);
    await petRepo.setSelectedId(created.id);
    closePetForm();
    return created;
  }, [closePetForm]);

  const updatePet = useCallback(async (id, data) => {
    await petRepo.update(id, data);
    setPets(await petRepo.list());
    closePetForm();
  }, [closePetForm]);

  const removePet = useCallback(
    async (id) => {
      await petRepo.remove(id);
      await recordRepo.removeByPet(id);
      const list = await petRepo.list();
      setPets(list);
      if (id === currentPetId) {
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
      await refreshToday();
      setSheet(null);
      setCondStage('main');
      showSnack(msg);
    },
    [petId, today, refreshToday, showSnack]
  );

  const addRecord = useCallback((entry, msg) => addRecords([entry], msg), [addRecords]);

  const undo = useCallback(async () => {
    clearSnackTimer();
    for (const id of lastBatch.current) await recordRepo.remove(id);
    lastBatch.current = [];
    await refreshToday();
    setSnack(null);
  }, [clearSnackTimer, refreshToday]);

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
    addRecord,
    addRecords,
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
