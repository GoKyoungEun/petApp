// Read hooks for the schedule domain. Same contract as queries/records.js and
// queries/pets.js: screens read here, store.js writes through scheduleRepo and
// then invalidates.
//
// Key shape: ['schedules', petId]. One pet's schedules are read as a whole list
// and split in the screen (예정 / 지난), so there is no per-view key to split —
// a single invalidate refreshes the tab, the calendar badges and the home card.

import { useQuery } from '@tanstack/react-query';
import { scheduleRepo } from '../scheduleRepo';
import { queryClient } from '../queryClient';

export const scheduleKeys = {
  all: ['schedules'],
  pet: (petId) => ['schedules', petId],
};

export function useSchedules(petId) {
  return useQuery({
    queryKey: scheduleKeys.pet(petId),
    queryFn: () => scheduleRepo.listByPet(petId),
    enabled: !!petId,
  });
}

export function invalidateSchedules(petId) {
  return queryClient.invalidateQueries({ queryKey: scheduleKeys.pet(petId) });
}
