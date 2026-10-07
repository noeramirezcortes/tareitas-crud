import { QueryClient } from '@tanstack/react-query'

/**
 * QueryClient global. TanStack Query es la única fuente de verdad
 * para el estado proveniente del servidor (no Redux).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
