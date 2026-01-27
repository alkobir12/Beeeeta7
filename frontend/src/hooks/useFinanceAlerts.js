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
    // لأننا أصلاً نسوي polling كل 5 دقائق بالويدجت
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
