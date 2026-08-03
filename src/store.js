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
import { scheduleRepo } from './scheduleRepo';
import { medicalRepo } from './medicalRepo';
import { todayYmd } from './date';
import { useRecordsByDate, invalidateRecords } from './queries/records';
import { usePets, invalidatePets } from './queries/pets';
import { useSchedules, invalidateSchedules } from './queries/schedules';
import { useMedicalRecords, invalidateMedical } from './queries/medical';

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

// Writes fail for reasons the user can act on (offline) and reasons they can't
// (RLS, a bad column). Lead with what didn't happen, then append the underlying
// message — without it a failed save is indistinguishable from a frozen button.
function writeMessage(e, fallback) {
  const detail = typeof e?.message === 'string' ? e.message.trim() : '';
  return detail ? `${fallback}\n${detail}` : fallback;
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

  // Pets come from the query cache; which one is selected is UI state and stays
  // here. A new account starts with an empty list — there is no seed data.
  const { data: pets = [], isSuccess: petsLoaded } = usePets();
  const [currentPetId, setCurrentPetId] = useState(null);
  const [showPetMenu, setShowPetMenu] = useState(false);
  const [showPetForm, setShowPetForm] = useState(false);
  const [editingPetId, setEditingPetId] = useState(null); // null = create mode

  // A write that failed (network, RLS, storage). Snackbars and toasts can't
  // render above a Modal, so a sheet that fails while open shows this inline
  // instead (08_TechStack "실패 처리").
  const [writeError, setWriteError] = useState(null);
  const clearWriteError = useCallback(() => setWriteError(null), []);

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

  // Every screen is "the current pet's ...", so an account with no pets has
  // nothing to show — open the registration form instead of an empty home
  // (08_TechStack: no seed data, each account starts empty). This only fires on
  // the transition, so closing the form doesn't immediately reopen it.
  useEffect(() => {
    if (petsLoaded && pets.length === 0) {
      setEditingPetId(null);
      setShowPetForm(true);
    }
  }, [petsLoaded, pets.length]);

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
    setWriteError(null);
    setShowPetForm(true);
  }, []);

  const closePetForm = useCallback(() => {
    setShowPetForm(false);
    setEditingPetId(null);
    setWriteError(null);
  }, []);

  const addPet = useCallback(async (data) => {
    try {
      setWriteError(null);
      const created = await petRepo.add(data);
      await invalidatePets();
      setCurrentPetId(created.id);
      await petRepo.setSelectedId(created.id);
      closePetForm();
      return created;
    } catch (e) {
      setWriteError(writeMessage(e, '반려동물을 등록하지 못했습니다'));
      return null;
    }
  }, [closePetForm]);

  const updatePet = useCallback(async (id, data) => {
    try {
      setWriteError(null);
      await petRepo.update(id, data);
      await invalidatePets();
      closePetForm();
    } catch (e) {
      setWriteError(writeMessage(e, '수정하지 못했습니다'));
    }
  }, [closePetForm]);

  const removePet = useCallback(
    async (id) => {
      try {
        setWriteError(null);
        // Records go first. The DB cascades them when the pet row goes, but
        // that would take their Storage paths with it and leave the photo files
        // behind — removeByPet reads the paths before deleting.
        await recordRepo.removeByPet(id);
        await petRepo.remove(id);
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
      } catch (e) {
        setWriteError(writeMessage(e, '삭제하지 못했습니다'));
      }
    },
    [currentPetId, closePetForm]
  );

  const clearSnackTimer = useCallback(() => {
    if (snackTimer.current) {
      clearTimeout(snackTimer.current);
      snackTimer.current = null;
    }
  }, []);

  // 스낵바의 "실행취소"가 무엇을 되돌릴지는 띄우는 쪽이 정한다. 기록 저장은
  // 방금 만든 행을 지우는 것이고 일정 완료는 상태를 되돌리고 자동 생성된 다음
  // 일정을 지우는 것이라, 스낵바 하나에 동작을 고정해 둘 수 없다.
  const undoAction = useRef(null);

  const showSnack = useCallback(
    (msg, onUndo = null) => {
      clearSnackTimer();
      setToast(null);
      undoAction.current = onUndo;
      setSnack(msg);
      snackTimer.current = setTimeout(() => {
        setSnack((cur) => (cur === msg ? null : cur));
        undoAction.current = null;
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

  // Which day the open sheet writes to. Always reopens on today, so the quick
  // path costs no extra taps; the sheet's 기록 날짜 field moves it when the user
  // is filling in something they forgot yesterday.
  const [sheetDate, setSheetDate] = useState(today);

  const openSheet = useCallback((name, fromMore = false, date) => {
    if (name === 'walk') setWalkMin(20);
    setCondStage('main');
    setSheetFromMore(fromMore);
    setWriteError(null);
    // 더보기 → 개별 기록으로 넘어갈 때도 이 함수를 거친다. 이미 시트가 열려
    // 있으면 그때 고른 날짜를 유지해야 한다 — 아니면 캘린더에서 넘어온 날짜가
    // 한 칸 건너뛰는 사이에 오늘로 되돌아간다.
    setSheetDate((cur) => date ?? (sheet ? cur : today));
    setSheet(name);
  }, [sheet, today]);

  const closeSheet = useCallback(() => {
    setSheet(null);
    setCondStage('main');
    setWriteError(null);
    setSheetDate(today);
  }, [today]);

  // Create one or more event records, then surface the snackbar. The ids are
  // tracked so undo can remove exactly this batch (a single tap, or the whole
  // "오늘도 평소와 같아요" set).
  const addRecords = useCallback(
    async (entries, msg) => {
      const added = [];
      try {
        setWriteError(null);
        for (const e of entries) {
          const rec = await recordRepo.add({
            petId,
            // 항목별로 날짜를 다르게 줄 일은 없다. "오늘도 평소와 같아요"처럼
            // 시트 없이 부르는 쪽은 today를 직접 넘긴다.
            recordDate: e.recordDate ?? sheetDate,
            recordType: e.recordType,
            data: e.data || {},
            memo: e.memo ?? null,
          });
          added.push(rec.id);
        }
      } catch (e) {
        // Partial batches happen: "오늘도 평소와 같아요" writes several rows and
        // the third can fail. Keep what landed (undo still targets exactly it)
        // and leave the sheet open with the reason.
        lastBatch.current = added;
        await invalidateRecords(petId);
        setWriteError(writeMessage(e, '저장하지 못했습니다'));
        return;
      }
      lastBatch.current = added;
      await invalidateRecords(petId);
      setSheet(null);
      setCondStage('main');
      setSheetDate(today); // 다음에 여는 시트는 다시 오늘부터
      // 이 배치만 정확히 지운다 — 한 번 탭이든 "오늘도 평소와 같아요" 한 벌이든.
      showSnack(msg, async () => {
        for (const id of lastBatch.current) await recordRepo.remove(id);
        lastBatch.current = [];
        await invalidateRecords(petId);
      });
    },
    [petId, today, sheetDate, showSnack]
  );

  const addRecord = useCallback((entry, msg) => addRecords([entry], msg), [addRecords]);

  // Editing an existing record (02_MVP_Requirement §8 — no edit-count limit).
  // Note these use showToast, not showSnack: undo is wired to the *last added*
  // batch, so offering it here would delete the wrong rows.
  const [editingRecord, setEditingRecord] = useState(null);

  const openEditRecord = useCallback((record) => {
    setWriteError(null);
    setEditingRecord(record);
  }, []);
  const closeEditRecord = useCallback(() => {
    setEditingRecord(null);
    setWriteError(null);
  }, []);

  const updateRecord = useCallback(
    async (id, patch) => {
      try {
        setWriteError(null);
        await recordRepo.update(id, patch); // DB trigger stamps updated_at
        await invalidateRecords(petId);
        setEditingRecord(null);
        showToast('수정되었습니다');
      } catch (e) {
        setWriteError(writeMessage(e, '수정하지 못했습니다'));
      }
    },
    [petId, showToast]
  );

  const deleteRecord = useCallback(
    async (id) => {
      try {
        setWriteError(null);
        await recordRepo.remove(id);
        await invalidateRecords(petId);
        setEditingRecord(null);
        showToast('삭제되었습니다');
      } catch (e) {
        setWriteError(writeMessage(e, '삭제하지 못했습니다'));
      }
    },
    [petId, showToast]
  );

  const undo = useCallback(async () => {
    clearSnackTimer();
    setSnack(null);
    const action = undoAction.current;
    undoAction.current = null;
    if (!action) return;
    try {
      await action();
    } catch (e) {
      // No sheet is open here, so the toast is visible.
      showToast('실행취소하지 못했습니다');
    }
  }, [clearSnackTimer, showToast]);

  const toggleSymptom = useCallback((op) => {
    setSymptoms((cur) =>
      cur.includes(op) ? cur.filter((x) => x !== op) : [...cur, op]
    );
  }, []);

  // --- 건강 일정 --------------------------------------------------------
  //
  // 일정은 "앞으로 할 일", 기록은 "이미 한 일"이라 도메인이 나뉘어 있다
  // (03_DB_Design "일정과 기록의 관계"). 폼 상태는 반려동물 폼과 같은 모양이다.

  const { data: schedules = [] } = useSchedules(petId);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null); // null = 새 일정

  const openScheduleForm = useCallback((schedule = null) => {
    setEditingSchedule(schedule);
    setWriteError(null);
    setShowScheduleForm(true);
  }, []);

  const closeScheduleForm = useCallback(() => {
    setShowScheduleForm(false);
    setEditingSchedule(null);
    setWriteError(null);
  }, []);

  const saveSchedule = useCallback(
    async (data) => {
      try {
        setWriteError(null);
        // id가 있어야 수정이다. "다음 일정도 등록하시겠어요"는 값만 채운
        // id 없는 객체를 넘기므로 새 일정으로 가야 한다.
        if (editingSchedule?.id) await scheduleRepo.update(editingSchedule.id, data);
        else await scheduleRepo.add({ ...data, petId, status: 'planned' });
        await invalidateSchedules(petId);
        closeScheduleForm();
      } catch (e) {
        setWriteError(writeMessage(e, '일정을 저장하지 못했습니다'));
      }
    },
    [petId, editingSchedule, closeScheduleForm]
  );

  const deleteSchedule = useCallback(
    async (id) => {
      try {
        setWriteError(null);
        await scheduleRepo.remove(id);
        await invalidateSchedules(petId);
        closeScheduleForm();
        showToast('일정을 삭제했어요');
      } catch (e) {
        setWriteError(writeMessage(e, '삭제하지 못했습니다'));
      }
    },
    [petId, closeScheduleForm, showToast]
  );

  // --- 완료 기록 (MedicalRecord) ----------------------------------------
  //
  // 03_DB_Design "일정과 기록의 관계". 두 갈래로 만들어진다:
  //   일정 완료  — 일정 탭의 "완료 처리" → 시트에서 실제 내용 확인 → 연결까지
  //   기록 먼저  — 더보기 → 병원 기록 → 저장 후 "다음 일정도 등록하시겠어요"

  const { data: medicalRecords = [] } = useMedicalRecords(petId);

  // null | { mode: 'complete', schedule } | { mode: 'standalone' }
  const [medicalForm, setMedicalForm] = useState(null);

  const openMedicalForm = useCallback((form) => {
    setWriteError(null);
    setMedicalForm(form);
  }, []);

  const closeMedicalForm = useCallback(() => {
    setMedicalForm(null);
    setWriteError(null);
  }, []);

  // 두 갈래가 저장하는 곳이 달라서 여기서 가른다. 성공하면 true를 준다 —
  // 시트가 "다음 일정" 단계로 넘어갈지 판단해야 하기 때문이다.
  const saveMedical = useCallback(
    async (data) => {
      const form = medicalForm;
      if (!form) return false;
      try {
        setWriteError(null);

        if (form.mode === 'complete') {
          const result = await scheduleRepo.complete(form.schedule.id, data);
          await invalidateSchedules(petId);
          await invalidateMedical(petId);
          if (result) {
            // 되돌릴 것이 셋이다: 상태, 이번에 만든 완료 기록, 반복으로 생긴
            // 다음 일정. 하나만 되돌리면 어긋난 상태가 남는다.
            showSnack(
              result.nextId ? '완료했어요 · 다음 일정을 만들었어요' : '완료했어요',
              async () => {
                await scheduleRepo.uncomplete(form.schedule.id, result);
                await invalidateSchedules(petId);
                await invalidateMedical(petId);
              }
            );
          }
        } else {
          await medicalRepo.add({
            petId,
            scheduleId: null,
            medicalType:
              data.scheduleType === 'custom'
                ? data.customTypeName || 'custom'
                : data.scheduleType,
            executedDate: data.executedDate,
            hospitalName: data.hospitalName,
            productName: data.productName,
            memo: data.memo,
          });
          await invalidateMedical(petId);
          // 실행취소는 걸지 않는다 — 바로 뒤에 "다음 일정도 등록할까요"가
          // 뜨는데 그 위에 스낵바를 겹쳐 두면 무엇을 취소하는지 모호해진다.
          // 삭제는 완료 기록 목록에서 할 수 있다.
        }
        return true;
      } catch (e) {
        setWriteError(writeMessage(e, '저장하지 못했습니다'));
        return false;
      }
    },
    [petId, medicalForm, showSnack]
  );

  const deleteMedical = useCallback(
    async (id) => {
      try {
        await medicalRepo.remove(id);
        await invalidateMedical(petId);
        // 완료 기록을 지워도 일정 상태는 그대로 둔다. 사용자가 지운 것은 "무엇을
        // 했는지"이지 "했다는 사실"이 아니다 — 되돌리려면 일정에서 실행취소한다.
        showToast('완료 기록을 삭제했어요');
      } catch (e) {
        showToast(writeMessage(e, '삭제하지 못했습니다'));
      }
    },
    [petId, showToast]
  );

  // 홈 "다음 일정" 카드 — 오늘 이후로 가장 가까운 예정 일정 하나.
  const nextSchedule = useMemo(
    () =>
      schedules
        .filter((s) => s.status === 'planned' && s.scheduledDate >= today)
        .sort((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : 1))[0] ?? null,
    [schedules, today]
  );

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
    sheetDate,
    setSheetDate,
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
    writeError,
    clearWriteError,
    schedules,
    nextSchedule,
    showScheduleForm,
    editingSchedule,
    openScheduleForm,
    closeScheduleForm,
    saveSchedule,
    deleteSchedule,
    medicalRecords,
    medicalForm,
    openMedicalForm,
    closeMedicalForm,
    saveMedical,
    deleteMedical,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
