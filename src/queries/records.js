// Read hooks for the record domain. Screens call these instead of touching
// recordRepo directly; writes still go through store.js, which invalidates
// `recordKeys.pet(petId)` afterwards.
//
// Key shape: ['records', petId, <view>, ...args]. Every view for one pet shares
// the `['records', petId]` prefix, so a single invalidate after a write
// refreshes the home summary, the calendar dots and the 전체 기록 list at once.

import { useQuery } from '@tanstack/react-query';
import { recordRepo } from '../repository';
import { queryClient } from '../queryClient';

export const recordKeys = {
  all: ['records'],
  pet: (petId) => ['records', petId],
  byDate: (petId, date) => ['records', petId, 'byDate', date],
  byType: (petId, type) => ['records', petId, 'byType', type],
  range: (petId, from, to) => ['records', petId, 'range', from, to],
  dates: (petId) => ['records', petId, 'dates'],
};

// One day's records — home "오늘 기록" and the calendar day panel.
export function useRecordsByDate(petId, date) {
  return useQuery({
    queryKey: recordKeys.byDate(petId, date),
    queryFn: () => recordRepo.listByDate(petId, date),
    enabled: !!petId && !!date,
  });
}

// One item's records across all dates, newest first — 전체 기록보기 tabs.
// Pass a falsy type to stay idle (the 건강사진 tab has no records yet).
export function useRecordsByType(petId, type) {
  return useQuery({
    queryKey: recordKeys.byType(petId, type),
    queryFn: () => recordRepo.listByType(petId, type),
    enabled: !!petId && !!type,
  });
}

// Every type over a date range — the 통계 화면 builds all six cards from this
// one query instead of one request per card.
export function useRecordsInRange(petId, from, to) {
  return useQuery({
    queryKey: recordKeys.range(petId, from, to),
    queryFn: () => recordRepo.listByRange(petId, from, to),
    enabled: !!petId && !!from && !!to,
  });
}

// Dates that have at least one record — drives the calendar markers.
export function useRecordDates(petId) {
  return useQuery({
    queryKey: recordKeys.dates(petId),
    queryFn: () => recordRepo.datesWithRecords(petId),
    enabled: !!petId,
  });
}

// Imperative read for event handlers ("오늘도 평소와 같아요" reads yesterday).
// Goes through the same cache rather than calling the repo directly, so it
// reuses a fresh entry and seeds one otherwise.
export function fetchRecordsByDate(petId, date) {
  return queryClient.fetchQuery({
    queryKey: recordKeys.byDate(petId, date),
    queryFn: () => recordRepo.listByDate(petId, date),
  });
}

export function invalidateRecords(petId) {
  return queryClient.invalidateQueries({ queryKey: recordKeys.pet(petId) });
}
