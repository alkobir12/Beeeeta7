'use client';

import React, { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface NamedAmount {
  name: string;
  amount: number;
}

interface BalanceSheetData {
  assets: {
    current_assets: NamedAmount[];
    fixed_assets: NamedAmount[];
    total: number;
  };
  liabilities: {
    current_liabilities: NamedAmount[];
    long_term_liabilities: NamedAmount[];
    total: number;
  };
  equity: {
    capital: NamedAmount[];
    retained_earnings: NamedAmount[];
    net_income: number;
    total: number;
  };
}

export default function BalanceSheetPage() {
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().split('T')[0],
  );

  useEffect(() => {
    fetchBalanceSheet();
  }, [asOfDate]);

  const fetchBalanceSheet = async () => {
    try {
      // TODO: ربط بواجهة الـ API الحقيقية
      setData({
        assets: {
          current_assets: [
            { name: 'النقدية في الصندوق', amount: 50000 },
            { name: 'البنك الأهلي', amount: 200000 },
            { name: 'العملاء', amount: 150000 },
            { name: 'المخزون', amount: 80000 },
          ],
          fixed_assets: [
            { name: 'السيارات والمعدات', amount: 500000 },
            { name: 'المباني', amount: 1000000 },
            { name: 'الأثاث والتجهيزات', amount: 150000 },
          ],
          total: 2_080_000,
        },
        liabilities: {
          current_liabilities: [
            { name: 'الموردين', amount: 75000 },
            { name: 'الضرائب المستحقة', amount: 45000 },
            { name: 'الرواتب المستحقة', amount: 30000 },
          ],
          long_term_liabilities: [
            { name: 'قرض بنكي', amount: 400000 },
          ],
          total: 550_000,
        },
        equity: {
          capital: [{ name: 'رأس مال المالك', amount: 1_000_000 }],
          retained_earnings: [{ name: 'أرباح محتجزة', amount: 430_000 }],
          net_income: 100_000,
          total: 1_530_000,
        },
      });
    } catch (error) {
      console.error('Error fetching balance sheet:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">لا توجد بيانات متاحة</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            الميزانية العمومية
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            تقرير المركز المالي للورشة حتى تاريخ{' '}
            {new Date(asOfDate).toLocaleDateString('ar-SA')}
          </p>
        </div>

        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">التاريخ:</label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            />
          </div>

          <button
            onClick={fetchBalanceSheet}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <RefreshCw size={20} />
          </button>

          <button className="btn-primary flex items-center gap-2">
            <Download size={16} />
            <span>تصدير</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6">
          <p className="text-sm opacity-90">إجمالي الأصول</p>
          <p className="text-2xl font-bold mt-2">
            {formatCurrency(data.assets.total)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl p-6">
          <p className="text-sm opacity-90">إجمالي الخصوم</p>
          <p className="text-2xl font-bold mt-2">
            {formatCurrency(data.liabilities.total)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6">
          <p className="text-sm opacity-90">حقوق الملكية</p>
          <p className="text-2xl font-bold mt-2">
            {formatCurrency(data.equity.total)}
          </p>
        </div>
      </div>
      {/* التفاصيل (كما في الكود الذي أرسلته، يمكن توسيعه لاحقًا) */}
    </div>
  );
}
