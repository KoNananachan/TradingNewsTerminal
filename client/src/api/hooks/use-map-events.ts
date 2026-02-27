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
    refetchInterval: 60_000,
  });
}
