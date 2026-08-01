// Read hooks for the pet domain. Same contract as queries/records.js: screens
// read here, store.js writes through petRepo and then invalidates.

import { useQuery } from '@tanstack/react-query';
import { petRepo } from '../petRepo';
import { queryClient } from '../queryClient';

export const petKeys = {
  all: ['pets'],
  list: () => ['pets', 'list'],
};

// The account's pets (max 5 — 02_MVP_Requirement §2).
export function usePets() {
  return useQuery({
    queryKey: petKeys.list(),
    queryFn: () => petRepo.list(),
  });
}

export function invalidatePets() {
  return queryClient.invalidateQueries({ queryKey: petKeys.all });
}
