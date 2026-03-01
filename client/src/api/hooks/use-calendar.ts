import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface EconomicEvent {
  id: number;
  externalId: string;
  event: string;
  country: string;
  date: string;
  impact: string;
  actual: string | null;
  previous: string | null;
  estimate: string | null;
  released: boolean;
}

export function useEconomicCalendar(from?: string, to?: string, country?: string, impact?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (country) params.set('country', country);
  if (impact) params.set('impact', impact);

  return useQuery<EconomicEvent[]>({
    queryKey: ['calendar', from, to, country, impact],
    queryFn: () => api.get(`/calendar?${params.toString()}`),
    refetchInterval: 60_000,
  });
}

export function useUpcomingEvents() {
  return useQuery<EconomicEvent[]>({
    queryKey: ['calendar', 'upcoming'],
    queryFn: () => api.get('/calendar/upcoming'),
    refetchInterval: 30_000,
  });
}
