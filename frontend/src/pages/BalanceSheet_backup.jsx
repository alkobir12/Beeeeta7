import React, { useState } from 'react';
import { 
  Scale, 
  Download, 
  RefreshCw, 
  Calendar,
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  PiggyBank
} from 'lucide-react';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 0,
  }).format(amount || 0);
};

// Sample Balance Sheet Data
const BALANCE_SHEET_DATA = {
  as_of_date: '2024-12-31',
  assets: {
    current_assets: {
      label: 'الأصول المتداولة',
      items: [
        { code: '111', name: 'النقدية والبنوك', amount: 125000 },
        { code: '112', name: 'الذمم المدينة', amount: 45000 },
        { code: '113', name: 'المخزون', amount: 78500 },
        { code: '114', name: 'مصروفات مدفوعة مقدماً', amount: 12000 },
      ],
      total: 260500,
    },
    fixed_assets: {
      label: 'الأصول الثابتة',
      items: [
        { code: '121', name: 'المعدات والأجهزة', amount: 250000 },
        { code: '122', name: 'الأثاث والتجهيزات', amount: 35000 },
        { code: '123', name: 'مجمع الإهلاك', amount: -45000 },
      ],
      total: 240000,
    },
    total_assets: 500500,
  },
  liabilities: {
    current_liabilities: {
      label: 'الالتزامات المتداولة',
      items: [
        { code: '211', name: 'الذمم الدائنة', amount: 35000 },
        { code: '212', name: 'ضريبة القيمة المضافة المستحقة', amount: 12500 },
        { code: '213', name: 'مصروفات مستحقة', amount: 8000 },
        { code: '214', name: 'القسط الحالي من القروض', amount: 24000 },
      ],
      total: 79500,
    },
    long_term_liabilities: {
      label: 'الالتزامات طويلة الأجل',
      items: [
        { code: '221', name: 'القروض طويلة الأجل', amount: 76000 },
        { code: '222', name: 'الالتزامات الإيجارية', amount: 18000 },
      ],
      total: 94000,
    },
    total_liabilities: 173500,
  },
  equity: {
    label: 'حقوق الملكية',
    items: [
      { code: '31', name: 'رأس المال', amount: 200000 },
      { code: '32', name: 'احتياطي نظامي', amount: 20000 },
      { code: '33', name: 'الأرباح المحتجزة', amount: 82000 },
      { code: '34', name: 'صافي ربح الفترة الحالية', amount: 25000 },
    ],
    total: 327000,
  },
  total_liabilities_and_equity: 500500,
};

export default function BalanceSheet() {
  const [data] = useState(BALANCE_SHEET_DATA);
  const [loading, setLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const isBalanced = data.assets.total_assets === data.total_liabilities_and_equity;

  const renderSection = (section, title, icon, bgColor, textColor) => {
    const Icon = icon;
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className={`${bgColor} px-4 py-3 flex items-center gap-2`}>
          <Icon className={textColor} size={20} />
          <h3 className={`font-bold ${textColor}`}>{title}</h3>
        </div>
        
        <div className="p-4 space-y-4">
          {Object.entries(section).map(([key, category]) => {
            if (key === 'total_assets' || key === 'total_liabilities') return null;
            if (typeof category !== 'object' || !category.items) return null;
            
            return (
              <div key={key}>
                <h4 className="text-gray-300 font-medium mb-2 text-sm">{category.label}</h4>
                <div className="space-y-1">
                  {category.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1.5 px-3 hover:bg-gray-700/30 rounded">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-500 text-xs">{item.code}</span>
                        <span className="text-white text-sm">{item.name}</span>
                      </div>
                      <span className={`font-mono text-sm ${item.amount >= 0 ? 'text-white' : 'text-red-400'}`}>
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700">
                  <span className="text-gray-400 text-sm">إجمالي {category.label}</span>
                  <span className={`font-bold ${textColor}`}>{formatCurrency(category.total)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6" data-testid="balance-sheet-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Scale className="text-blue-500" />
            الميزانية العمومية
          </h1>
          <p className="text-gray-400">قائمة المركز المالي</p>
        </div>

        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 border border-gray-700">
            <Calendar size={18} className="text-gray-400" />
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="bg-transparent text-white border-0 outline-none"
            />
          </div>
          <button className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors">
            <Download size={20} className="text-gray-400" />
          </button>
          <button 
            onClick={() => setLoading(true)}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
          >
            <RefreshCw size={20} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Balance Check */}
      <div className={`rounded-xl p-4 flex items-center justify-between ${isBalanced ? 'bg-green-900/20 border border-green-800' : 'bg-red-900/20 border border-red-800'}`}>
        <div className="flex items-center gap-3">
          {isBalanced ? (
            <>
              <div className="p-2 bg-green-900/50 rounded-full">
                <Scale className="text-green-400" size={24} />
              </div>
              <div>
                <p className="font-bold text-green-400">الميزانية متوازنة ✓</p>
                <p className="text-sm text-green-300/70">الأصول = الالتزامات + حقوق الملكية</p>
              </div>
            </>
          ) : (
            <>
              <div className="p-2 bg-red-900/50 rounded-full">
                <Scale className="text-red-400" size={24} />
              </div>
              <div>
                <p className="font-bold text-red-400">الميزانية غير متوازنة!</p>
                <p className="text-sm text-red-300/70">يرجى مراجعة القيود المحاسبية</p>
              </div>
            </>
          )}
        </div>
        <div className="text-left">
          <p className="text-sm text-gray-400">الفرق</p>
          <p className={`font-bold text-lg ${isBalanced ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(Math.abs(data.assets.total_assets - data.total_liabilities_and_equity))}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <Wallet size={24} />
            <span className="font-medium">إجمالي الأصول</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(data.assets.total_assets)}</p>
        </div>

        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <Building2 size={24} />
            <span className="font-medium">إجمالي الالتزامات</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(data.liabilities.total_liabilities)}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <PiggyBank size={24} />
            <span className="font-medium">حقوق الملكية</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(data.equity.total)}</p>
        </div>
      </div>

      {/* Balance Sheet Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets */}
        {renderSection(data.assets, 'الأصول', Wallet, 'bg-blue-900/30', 'text-blue-400')}

        {/* Liabilities & Equity */}
        <div className="space-y-6">
          {renderSection(data.liabilities, 'الالتزامات', TrendingDown, 'bg-red-900/30', 'text-red-400')}
          
          {/* Equity */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="bg-purple-900/30 px-4 py-3 flex items-center gap-2">
              <PiggyBank className="text-purple-400" size={20} />
              <h3 className="font-bold text-purple-400">{data.equity.label}</h3>
            </div>
            
            <div className="p-4">
              <div className="space-y-1">
                {data.equity.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1.5 px-3 hover:bg-gray-700/30 rounded">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-500 text-xs">{item.code}</span>
                      <span className="text-white text-sm">{item.name}</span>
                    </div>
                    <span className="font-mono text-sm text-white">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700">
                <span className="text-gray-400 text-sm">إجمالي حقوق الملكية</span>
                <span className="font-bold text-purple-400">{formatCurrency(data.equity.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grand Totals */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex justify-between items-center p-4 bg-blue-900/20 rounded-lg border border-blue-800">
            <span className="font-bold text-blue-400">إجمالي الأصول</span>
            <span className="text-2xl font-bold text-blue-400">{formatCurrency(data.assets.total_assets)}</span>
          </div>
          <div className="flex justify-between items-center p-4 bg-purple-900/20 rounded-lg border border-purple-800">
            <span className="font-bold text-purple-400">الالتزامات + حقوق الملكية</span>
            <span className="text-2xl font-bold text-purple-400">{formatCurrency(data.total_liabilities_and_equity)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
