/** Backup of original IncomeStatement with mock data **/

import React, { useState } from 'react';
import { 
  TrendingUp, 
  Download, 
  RefreshCw, 
  Calendar,
  DollarSign,
  MinusCircle,
  ArrowDown,
  ArrowUp,
  Percent
} from 'lucide-react';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 0,
  }).format(amount || 0);
};

// Sample Income Statement Data
const INCOME_STATEMENT_DATA = {
  period: {
    start_date: '2024-01-01',
    end_date: '2024-12-31',
  },
  revenue: {
    operating_revenue: {
      label: 'الإيرادات التشغيلية',
      items: [
        { code: '41', name: 'إيرادات خدمات الصيانة', amount: 350000 },
        { code: '42', name: 'إيرادات قطع الغيار', amount: 125000 },
        { code: '43', name: 'إيرادات الفحص والتشخيص', amount: 45000 },
      ],
      total: 520000,
    },
    other_revenue: {
      label: 'إيرادات أخرى',
      items: [
        { code: '44', name: 'إيرادات متنوعة', amount: 8000 },
      ],
      total: 8000,
    },
    total_revenue: 528000,
  },
  expenses: {
    cost_of_sales: {
      label: 'تكلفة المبيعات',
      items: [
        { code: '51', name: 'تكلفة قطع الغيار المباعة', amount: 95000 },
        { code: '52', name: 'تكلفة المواد والمستهلكات', amount: 35000 },
      ],
      total: 130000,
    },
    operating_expenses: {
      label: 'المصروفات التشغيلية',
      items: [
        { code: '53', name: 'الرواتب والأجور', amount: 180000 },
        { code: '54', name: 'الإيجار', amount: 48000 },
        { code: '55', name: 'الكهرباء والماء', amount: 18000 },
        { code: '56', name: 'صيانة المعدات', amount: 12000 },
        { code: '57', name: 'التأمينات', amount: 8000 },
        { code: '58', name: 'الاستهلاك', amount: 25000 },
      ],
      total: 291000,
    },
    admin_expenses: {
      label: 'المصروفات الإدارية والعمومية',
      items: [
        { code: '61', name: 'مصروفات إدارية', amount: 15000 },
        { code: '62', name: 'مصروفات تسويق', amount: 12000 },
        { code: '63', name: 'مصروفات اتصالات', amount: 6000 },
      ],
      total: 33000,
    },
    financial_expenses: {
      label: 'المصروفات التمويلية',
      items: [
        { code: '71', name: 'فوائد القروض', amount: 9000 },
        { code: '72', name: 'رسوم بنكية', amount: 2000 },
      ],
      total: 11000,
    },
    total_expenses: 465000,
  },
  summary: {
    gross_profit: 398000, // Revenue - Cost of Sales
    operating_income: 107000, // Gross - Operating Expenses
    net_income_before_tax: 74000,
    zakat_tax: 3700, // 5% of net income
    net_income: 70300,
  },
};

export default function IncomeStatementBackup() {
  const [data] = useState(INCOME_STATEMENT_DATA);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');

  const profitMargin = ((data.summary.net_income / data.revenue.total_revenue) * 100).toFixed(1);
  const grossMargin = ((data.summary.gross_profit / data.revenue.total_revenue) * 100).toFixed(1);

  return (
    <div className="p-6 space-y-6" data-testid="income-statement-page-backup">
      {/* Original header & content preserved here for backup */}
      {/* ... */}
    </div>
  );
}
