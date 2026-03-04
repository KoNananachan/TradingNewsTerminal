import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface MapEvent {
  id: number;
  title: string;
  latitude: number;
  longitude: number;
  sentiment: string | null;
  categorySlug: string | null;
  locationName: string | null;
  scrapedAt: string;
}

export function useMapEvents() {
  return useQuery({
    queryKey: ['map-events'],
    queryFn: () => api.get<MapEvent[]>('/map-events'),
    staleTime: 30_000,              // 30s — news is time-sensitive
    gcTime: 5 * 60 * 1000,         // 5 min garbage collection
    refetchInterval: 60_000,         // 1 min polling
    refetchOnWindowFocus: false,     // Avoid redundant refetches
    retry: 2,
  });
}
