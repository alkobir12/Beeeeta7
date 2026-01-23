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
      { name: 'المصاريف التشغيلية المدفوعة', amount: -65000 },
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

export default function CashFlow() {
  const [data] = useState(CASH_FLOW_DATA);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');

  const renderActivitySection = (activity, icon, iconColor, bgColor) => {
    const Icon = icon;
    const totalInflows = activity.inflows.reduce((sum, item) => sum + item.amount, 0);
    const totalOutflows = Math.abs(activity.outflows.reduce((sum, item) => sum + item.amount, 0));
    
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className={`${bgColor} px-4 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <Icon className={iconColor} size={20} />
            <h3 className={`font-bold ${iconColor}`}>{activity.label}</h3>
          </div>
          <span className={`font-bold ${activity.net_cash >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(activity.net_cash)}
          </span>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Inflows */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="text-green-400" size={16} />
              <h4 className="text-green-400 text-sm font-medium">التدفقات الداخلة</h4>
            </div>
            <div className="space-y-1">
              {activity.inflows.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-1.5 px-3 hover:bg-gray-700/30 rounded">
                  <span className="text-white text-sm">{item.name}</span>
                  <span className="font-mono text-sm text-green-400">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700/50">
              <span className="text-gray-400 text-sm">إجمالي التدفقات الداخلة</span>
              <span className="font-bold text-green-400">{formatCurrency(totalInflows)}</span>
            </div>
          </div>

          {/* Outflows */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownRight className="text-red-400" size={16} />
              <h4 className="text-red-400 text-sm font-medium">التدفقات الخارجة</h4>
            </div>
            <div className="space-y-1">
              {activity.outflows.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-1.5 px-3 hover:bg-gray-700/30 rounded">
                  <span className="text-white text-sm">{item.name}</span>
                  <span className="font-mono text-sm text-red-400">
                    ({formatCurrency(Math.abs(item.amount))})
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700/50">
              <span className="text-gray-400 text-sm">إجمالي التدفقات الخارجة</span>
              <span className="font-bold text-red-400">({formatCurrency(totalOutflows)})</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6" data-testid="cash-flow-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Banknote className="text-green-500" />
            قائمة التدفقات النقدية
          </h1>
          <p className="text-gray-400">تتبع حركة النقد الداخل والخارج</p>
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
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="text-gray-400" size={20} />
            <span className="text-sm text-gray-400">الرصيد الافتتاحي</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(data.opening_balance)}</p>
        </div>

        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight size={20} />
            <span className="text-sm opacity-80">صافي التغير</span>
          </div>
          <p className="text-2xl font-bold">{data.net_change >= 0 ? '+' : ''}{formatCurrency(data.net_change)}</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <CircleDollarSign className="text-blue-400" size={20} />
            <span className="text-sm text-gray-400">الرصيد الختامي</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{formatCurrency(data.closing_balance)}</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-purple-400" size={20} />
            <span className="text-sm text-gray-400">نسبة التغير</span>
          </div>
          <p className="text-2xl font-bold text-purple-400">
            {((data.net_change / data.opening_balance) * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Opening Balance */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Wallet className="text-gray-400" size={20} />
            <span className="text-white font-medium">الرصيد النقدي في بداية الفترة</span>
          </div>
          <span className="text-xl font-bold text-white">{formatCurrency(data.opening_balance)}</span>
        </div>
      </div>

      {/* Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {renderActivitySection(
          data.operating_activities,
          Building2,
          'text-blue-400',
          'bg-blue-900/30'
        )}
        
        {renderActivitySection(
          data.investing_activities,
          TrendingUp,
          'text-purple-400',
          'bg-purple-900/30'
        )}
        
        {renderActivitySection(
          data.financing_activities,
          Banknote,
          'text-orange-400',
          'bg-orange-900/30'
        )}
      </div>

      {/* Summary */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
        <h3 className="font-bold text-white text-lg mb-4">ملخص التدفقات النقدية</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
            <span className="text-gray-300">صافي النقد من الأنشطة التشغيلية</span>
            <span className={`font-bold ${data.operating_activities.net_cash >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(data.operating_activities.net_cash)}
            </span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
            <span className="text-gray-300">صافي النقد من الأنشطة الاستثمارية</span>
            <span className={`font-bold ${data.investing_activities.net_cash >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(data.investing_activities.net_cash)}
            </span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
            <span className="text-gray-300">صافي النقد من الأنشطة التمويلية</span>
            <span className={`font-bold ${data.financing_activities.net_cash >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(data.financing_activities.net_cash)}
            </span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-blue-900/30 border border-blue-800 rounded-lg">
            <span className="font-bold text-blue-400">صافي التغير في النقد</span>
            <span className={`text-xl font-bold ${data.net_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.net_change >= 0 ? '+' : ''}{formatCurrency(data.net_change)}
            </span>
          </div>
        </div>

        {/* Final Balance */}
        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg border border-blue-700 mt-4">
          <div>
            <span className="text-gray-300 text-sm">الرصيد النقدي في نهاية الفترة</span>
            <p className="text-xs text-gray-500 mt-1">({formatCurrency(data.opening_balance)} + {formatCurrency(data.net_change)})</p>
          </div>
          <span className="text-3xl font-bold text-white">{formatCurrency(data.closing_balance)}</span>
        </div>
      </div>
    </div>
  );
}
