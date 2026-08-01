import { QueryClient } from '@tanstack/react-query';

// One cache for the whole app (08_TechStack "데이터 계층"). Screens read through
// the hooks in src/queries/*, and store.js invalidates a key prefix after each
// write — no second layer of manual refresh state.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});
