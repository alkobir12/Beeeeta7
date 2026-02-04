import { useQuery } from '@tanstack/react-query';
import { financeAPI } from '../services/api';

export function useFinanceAlerts() {
  const workshopId = process.env.REACT_APP_WORKSHOP_ID;

  return useQuery({
    queryKey: ['finance-alerts', workshopId],
    enabled: !!workshopId,
    queryFn: async () => {
      const res = await financeAPI.getAlerts({ workshop_id: workshopId });
      return res.data?.data?.alerts || [];
    },
    // NOTE: In production we disable auto-polling to prevent tab reloads / memory pressure on some devices.
    // Users can still refresh manually from the widget.
    staleTime: 5 * 60 * 1000,
    refetchInterval: process.env.NODE_ENV === 'production' ? false : 5 * 60 * 1000,
  });
}
