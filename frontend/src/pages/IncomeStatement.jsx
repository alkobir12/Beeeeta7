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
        { code: '61', name: 'مصاريف إدارية', amount: 15000 },
        { code: '62', name: 'مصاريف تسويق', amount: 12000 },
        { code: '63', name: 'مصاريف اتصالات', amount: 6000 },
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

export default function IncomeStatement() {
  const [data] = useState(INCOME_STATEMENT_DATA);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');

  const profitMargin = ((data.summary.net_income / data.revenue.total_revenue) * 100).toFixed(1);
  const grossMargin = ((data.summary.gross_profit / data.revenue.total_revenue) * 100).toFixed(1);

  return (
    <div className="p-6 space-y-6" data-testid="income-statement-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="text-green-500" />
            قائمة الدخل
          </h1>
          <p className="text-gray-400">بيان الأرباح والخسائر</p>
        </div>

        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 border border-gray-700">
            <Calendar size={18} className="text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-white border-0 outline-none w-32"
            />
            <span className="text-gray-500">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-white border-0 outline-none w-32"
            />
          </div>
          <button className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors">
            <Download size={20} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUp size={20} />
            <span className="text-sm opacity-80">إجمالي الإيرادات</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(data.revenue.total_revenue)}</p>
        </div>

        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDown size={20} />
            <span className="text-sm opacity-80">إجمالي المصروفات</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(data.expenses.total_expenses)}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={20} />
            <span className="text-sm opacity-80">صافي الربح</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(data.summary.net_income)}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Percent size={20} />
            <span className="text-sm opacity-80">هامش الربح</span>
          </div>
          <p className="text-2xl font-bold">{profitMargin}%</p>
        </div>
      </div>

      {/* Income Statement Content */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {/* Revenue Section */}
        <div className="border-b border-gray-700">
          <div className="bg-green-900/30 px-4 py-3 flex items-center gap-2">
            <ArrowUp className="text-green-400" size={20} />
            <h3 className="font-bold text-green-400">الإيرادات</h3>
          </div>
          
          <div className="p-4 space-y-4">
            {Object.entries(data.revenue).map(([key, category]) => {
              if (key === 'total_revenue' || typeof category !== 'object') return null;
              
              return (
                <div key={key}>
                  <h4 className="text-gray-400 text-sm mb-2">{category.label}</h4>
                  <div className="space-y-1">
                    {category.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1.5 px-3 hover:bg-gray-700/30 rounded">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-500 text-xs">{item.code}</span>
                          <span className="text-white text-sm">{item.name}</span>
                        </div>
                        <span className="font-mono text-sm text-green-400">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700/50">
                    <span className="text-gray-400 text-sm">إجمالي {category.label}</span>
                    <span className="font-bold text-green-400">{formatCurrency(category.total)}</span>
                  </div>
                </div>
              );
            })}
            
            {/* Total Revenue */}
            <div className="flex justify-between items-center p-3 bg-green-900/20 rounded-lg">
              <span className="font-bold text-green-400">إجمالي الإيرادات</span>
              <span className="text-xl font-bold text-green-400">{formatCurrency(data.revenue.total_revenue)}</span>
            </div>
          </div>
        </div>

        {/* Expenses Section */}
        <div className="border-b border-gray-700">
          <div className="bg-red-900/30 px-4 py-3 flex items-center gap-2">
            <ArrowDown className="text-red-400" size={20} />
            <h3 className="font-bold text-red-400">المصروفات</h3>
          </div>
          
          <div className="p-4 space-y-4">
            {Object.entries(data.expenses).map(([key, category]) => {
              if (key === 'total_expenses' || typeof category !== 'object') return null;
              
              return (
                <div key={key}>
                  <h4 className="text-gray-400 text-sm mb-2">{category.label}</h4>
                  <div className="space-y-1">
                    {category.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1.5 px-3 hover:bg-gray-700/30 rounded">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-500 text-xs">{item.code}</span>
                          <span className="text-white text-sm">{item.name}</span>
                        </div>
                        <span className="font-mono text-sm text-red-400">
                          ({formatCurrency(item.amount)})
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700/50">
                    <span className="text-gray-400 text-sm">إجمالي {category.label}</span>
                    <span className="font-bold text-red-400">({formatCurrency(category.total)})</span>
                  </div>
                </div>
              );
            })}
            
            {/* Total Expenses */}
            <div className="flex justify-between items-center p-3 bg-red-900/20 rounded-lg">
              <span className="font-bold text-red-400">إجمالي المصروفات</span>
              <span className="text-xl font-bold text-red-400">({formatCurrency(data.expenses.total_expenses)})</span>
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
            <span className="text-gray-300">مجمل الربح</span>
            <span className="font-bold text-white">{formatCurrency(data.summary.gross_profit)}</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
            <span className="text-gray-300">الربح التشغيلي</span>
            <span className="font-bold text-white">{formatCurrency(data.summary.operating_income)}</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
            <span className="text-gray-300">صافي الربح قبل الزكاة</span>
            <span className="font-bold text-white">{formatCurrency(data.summary.net_income_before_tax)}</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
            <span className="text-gray-300">الزكاة (5%)</span>
            <span className="font-bold text-orange-400">({formatCurrency(data.summary.zakat_tax)})</span>
          </div>
          
          {/* Net Income */}
          <div className={`flex justify-between items-center p-4 rounded-lg ${data.summary.net_income >= 0 ? 'bg-green-900/30 border border-green-800' : 'bg-red-900/30 border border-red-800'}`}>
            <span className={`font-bold text-lg ${data.summary.net_income >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              صافي الربح / (الخسارة)
            </span>
            <span className={`text-2xl font-bold ${data.summary.net_income >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(data.summary.net_income)}
            </span>
          </div>
        </div>
      </div>

      {/* Profit Margins */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h4 className="text-gray-400 text-sm mb-3">هامش مجمل الربح</h4>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-white">{grossMargin}%</span>
            <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
                style={{ width: `${grossMargin}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h4 className="text-gray-400 text-sm mb-3">هامش صافي الربح</h4>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-white">{profitMargin}%</span>
            <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                style={{ width: `${profitMargin}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
