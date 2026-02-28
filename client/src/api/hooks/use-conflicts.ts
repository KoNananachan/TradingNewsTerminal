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
    refetchInterval: 10 * 60 * 1000, // 10 minutes
  });
}
