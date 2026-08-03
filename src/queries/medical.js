// Read hooks for the completed-care domain (MedicalRecord). Same contract as
// the other query modules: screens read here, store.js writes through
// medicalRepo and then invalidates.

import { useQuery } from '@tanstack/react-query';
import { medicalRepo } from '../medicalRepo';
import { queryClient } from '../queryClient';

export const medicalKeys = {
  all: ['medical'],
  pet: (petId) => ['medical', petId],
};

export function useMedicalRecords(petId) {
  return useQuery({
    queryKey: medicalKeys.pet(petId),
    queryFn: () => medicalRepo.listByPet(petId),
    enabled: !!petId,
  });
}

export function invalidateMedical(petId) {
  return queryClient.invalidateQueries({ queryKey: medicalKeys.pet(petId) });
}
