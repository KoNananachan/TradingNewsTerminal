import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface ConflictEvent {
  name: string;
  lat: number;
  lng: number;
  count: number;
  url: string;
  title: string;
}

export function useConflicts() {
  return useQuery({
    queryKey: ['conflicts'],
    queryFn: () => api.get<ConflictEvent[]>('/conflicts'),
    staleTime: 3 * 60 * 1000,      // 3 min — data is fresh for this long
    gcTime: 10 * 60 * 1000,        // 10 min garbage collection
    refetchInterval: 5 * 60 * 1000, // 5 min (was 10 min — faster conflict updates)
    refetchOnWindowFocus: false,     // Avoid redundant refetches on tab switch
    retry: 2,                        // Retry failed requests twice
  });
}
