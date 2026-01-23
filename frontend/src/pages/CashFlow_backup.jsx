/** Backup of original CashFlow with mock data **/

import React, { useState } from 'react';
import { 
  Banknote, 
  Download, 
  RefreshCw, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Building2,
  TrendingUp,
  CircleDollarSign
} from 'lucide-react';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 0,
  }).format(amount || 0);
};

// Sample Cash Flow Data
const CASH_FLOW_DATA = {
  period: {
    start_date: '2024-01-01',
    end_date: '2024-12-31',
  },
  opening_balance: 85000,
  operating_activities: {
    label: 'الأنشطة التشغيلية',
    inflows: [
      { name: 'المقبوضات من العملاء', amount: 495000 },
      { name: 'إيرادات أخرى محصلة', amount: 8000 },
    ],
    outflows: [
      { name: 'المدفوعات للموردين', amount: -185000 },
      { name: 'الرواتب والأجور المدفوعة', amount: -175000 },
      { name: 'المصروفات التشغيلية المدفوعة', amount: -65000 },
      { name: 'ضريبة القيمة المضافة المدفوعة', amount: -12000 },
    ],
    net_cash: 66000,
  },
  investing_activities: {
    label: 'الأنشطة الاستثمارية',
    inflows: [
      { name: 'بيع أصول ثابتة', amount: 15000 },
    ],
    outflows: [
      { name: 'شراء معدات جديدة', amount: -45000 },
      { name: 'تحسينات على المنشأة', amount: -8000 },
    ],
    net_cash: -38000,
  },
  financing_activities: {
    label: 'الأنشطة التمويلية',
    inflows: [
      { name: 'قروض جديدة', amount: 50000 },
    ],
    outflows: [
      { name: 'سداد أقساط القروض', amount: -30000 },
      { name: 'توزيعات أرباح', amount: -8000 },
    ],
    net_cash: 12000,
  },
  closing_balance: 125000,
  net_change: 40000,
};

export default function CashFlowBackup() {
  const [data] = useState(CASH_FLOW_DATA);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');

  return (
    <div className="p-6 space-y-6" data-testid="cash-flow-page-backup">
      {/* Original content preserved as backup */}
    </div>
  );
}
