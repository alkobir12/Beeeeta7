import React, { useState } from 'react';
import { 
  Calculator, 
  FileText, 
  DollarSign,
  Percent,
  Building,
  RefreshCw
} from 'lucide-react';

const API_URL = (
  process.env.NODE_ENV === 'production'
    ? '/api'
    : `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api')
);

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

export default function TaxesPage() {
  const [activeTab, setActiveTab] = useState('vat');
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calculator className="text-blue-500" />
            إدارة الضرائب
          </h1>
          <p className="text-gray-400">
            حساب ضريبة القيمة المضافة والزكاة وإعداد الإقرارات
          </p>
        </div>
      </div>

      {/* Tax Rates Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <Percent size={24} />
            <span className="font-medium">ضريبة القيمة المضافة</span>
          </div>
          <p className="text-3xl font-bold">15%</p>
          <p className="text-sm opacity-75 mt-1">النسبة الأساسية</p>
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign size={24} />
            <span className="font-medium">الزكاة</span>
          </div>
          <p className="text-3xl font-bold">2.5%</p>
          <p className="text-sm opacity-75 mt-1">على الوعاء الزكوي</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <Building size={24} />
            <span className="font-medium">الجهة المنظمة</span>
          </div>
          <p className="text-lg font-bold">ZATCA</p>
          <p className="text-sm opacity-75 mt-1">هيئة الزكاة والضريبة والجمارك</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="border-b border-gray-700">
          <div className="flex">
            {[
              { key: 'vat', label: 'حاسبة الضريبة', icon: Calculator },
              { key: 'zakat', label: 'حساب الزكاة', icon: DollarSign },
              { key: 'return', label: 'إقرار الضريبة', icon: FileText },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'vat' && <VATCalculator />}
          {activeTab === 'zakat' && <ZakatCalculator />}
          {activeTab === 'return' && <VATReturn />}
        </div>
      </div>
    </div>
  );
}

// VAT Calculator Component
function VATCalculator() {
  const [amount, setAmount] = useState('');
  const [isInclusive, setIsInclusive] = useState(false);
  const [rateType, setRateType] = useState('standard');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const calculateVAT = async () => {
    if (!amount) return;
    
    setLoading(true);
    try {
      const amountNum = parseFloat(amount);
      const rate = rateType === 'standard' ? 0.15 : 0;
      
      if (isInclusive) {
        const base = amountNum / (1 + rate);
        const vat = amountNum - base;
        setResult({
          base_amount: base,
          vat_amount: vat,
          total_amount: amountNum,
          vat_rate: 15,
        });
      } else {
        const vat = amountNum * rate;
        setResult({
          base_amount: amountNum,
          vat_amount: vat,
          total_amount: amountNum + vat,
          vat_rate: 15,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          المبلغ (ريال سعودي)
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-lg"
          placeholder="أدخل المبلغ..."
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer text-gray-300">
          <input
            type="checkbox"
            checked={isInclusive}
            onChange={(e) => setIsInclusive(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span className="text-sm">المبلغ شامل الضريبة</span>
        </label>

        <select
          value={rateType}
          onChange={(e) => setRateType(e.target.value)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
        >
          <option value="standard">النسبة الأساسية (15%)</option>
          <option value="zero">نسبة الصفر (0%)</option>
          <option value="exempt">معفى من الضريبة</option>
        </select>
      </div>

      <button
        onClick={calculateVAT}
        disabled={!amount || loading}
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <RefreshCw className="animate-spin" size={20} />
        ) : (
          <Calculator size={20} />
        )}
        <span>احسب الضريبة</span>
      </button>

      {result && (
        <div className="bg-gray-700/50 rounded-lg p-6 space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-gray-600">
            <span className="text-gray-400">المبلغ الأساسي</span>
            <span className="font-bold text-lg text-white">{formatCurrency(result.base_amount)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-600">
            <span className="text-gray-400">ضريبة القيمة المضافة ({result.vat_rate}%)</span>
            <span className="font-bold text-lg text-blue-400">{formatCurrency(result.vat_amount)}</span>
          </div>
          <div className="flex justify-between items-center py-2 bg-blue-900/30 rounded-lg px-4">
            <span className="font-bold text-blue-200">الإجمالي</span>
            <span className="font-bold text-2xl text-blue-400">{formatCurrency(result.total_amount)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Zakat Calculator Component
function ZakatCalculator() {
  const [zakatableBase, setZakatableBase] = useState('');
  const [yearStart, setYearStart] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [yearEnd, setYearEnd] = useState(new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const calculateZakat = async () => {
    if (!zakatableBase) return;
    
    setLoading(true);
    try {
      const base = parseFloat(zakatableBase);
      const days = Math.ceil((new Date(yearEnd).getTime() - new Date(yearStart).getTime()) / (1000 * 60 * 60 * 24));
      const adjustedRate = 2.5 * days / 354;
      setResult({
        zakatable_base: base,
        zakat_rate: 2.5,
        zakat_amount: base * adjustedRate / 100,
        period_days: days,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          الوعاء الزكوي (ريال سعودي)
        </label>
        <input
          type="number"
          value={zakatableBase}
          onChange={(e) => setZakatableBase(e.target.value)}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-lg"
          placeholder="رأس المال + الاحتياطيات + الأرباح المحتجزة - الأصول الثابتة"
        />
        <p className="text-xs text-gray-500 mt-1">
          الوعاء الزكوي = رأس المال + الاحتياطيات + الأرباح المحتجزة - الأصول الثابتة
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            بداية السنة المالية
          </label>
          <input
            type="date"
            value={yearStart}
            onChange={(e) => setYearStart(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            نهاية السنة المالية
          </label>
          <input
            type="date"
            value={yearEnd}
            onChange={(e) => setYearEnd(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          />
        </div>
      </div>

      <button
        onClick={calculateZakat}
        disabled={!zakatableBase || loading}
        className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <RefreshCw className="animate-spin" size={20} />
        ) : (
          <Calculator size={20} />
        )}
        <span>احسب الزكاة</span>
      </button>

      {result && (
        <div className="bg-green-900/20 rounded-lg p-6 space-y-4 border border-green-800">
          <div className="flex justify-between items-center py-2 border-b border-green-800">
            <span className="text-gray-400">الوعاء الزكوي</span>
            <span className="font-bold text-white">{formatCurrency(result.zakatable_base)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-green-800">
            <span className="text-gray-400">نسبة الزكاة</span>
            <span className="font-bold text-white">{result.zakat_rate}%</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-green-800">
            <span className="text-gray-400">مدة الفترة</span>
            <span className="font-bold text-white">{result.period_days} يوم</span>
          </div>
          <div className="flex justify-between items-center py-3 bg-green-900/30 rounded-lg px-4">
            <span className="font-bold text-green-200">الزكاة المستحقة</span>
            <span className="font-bold text-2xl text-green-400">{formatCurrency(result.zakat_amount)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// VAT Return Component
function VATReturn() {
  const [formData, setFormData] = useState({
    period_start: new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toISOString().split('T')[0],
    period_end: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0],
    standard_sales: '',
    zero_rated_sales: '',
    exempt_sales: '',
    standard_purchases: '',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateReturn = async () => {
    setLoading(true);
    try {
      const standardSales = parseFloat(formData.standard_sales || '0');
      const zeroSales = parseFloat(formData.zero_rated_sales || '0');
      const exemptSales = parseFloat(formData.exempt_sales || '0');
      const standardPurchases = parseFloat(formData.standard_purchases || '0');
      
      const outputVat = standardSales * 0.15;
      const inputVat = standardPurchases * 0.15;
      const netVat = outputVat - inputVat;
      
      setResult({
        sales: {
          standard_rated: { amount: standardSales, vat: outputVat },
          zero_rated: { amount: zeroSales, vat: 0 },
          exempt: { amount: exemptSales, vat: 0 },
          total_sales: standardSales + zeroSales + exemptSales,
          output_vat: outputVat,
        },
        purchases: {
          standard_rated: { amount: standardPurchases, vat: inputVat },
          input_vat: inputVat,
        },
        summary: {
          output_vat: outputVat,
          input_vat: inputVat,
          net_vat: netVat,
          vat_due: netVat > 0 ? netVat : 0,
          vat_refund: netVat < 0 ? Math.abs(netVat) : 0,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Period */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">بداية الفترة</label>
          <input
            type="date"
            value={formData.period_start}
            onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">نهاية الفترة</label>
          <input
            type="date"
            value={formData.period_end}
            onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          />
        </div>
      </div>

      {/* Sales */}
      <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-800">
        <h3 className="font-semibold text-blue-200 mb-4">المبيعات (ضريبة المخرجات)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">مبيعات بنسبة 15%</label>
            <input
              type="number"
              value={formData.standard_sales}
              onChange={(e) => setFormData({ ...formData, standard_sales: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">مبيعات بنسبة 0%</label>
            <input
              type="number"
              value={formData.zero_rated_sales}
              onChange={(e) => setFormData({ ...formData, zero_rated_sales: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">مبيعات معفاة</label>
            <input
              type="number"
              value={formData.exempt_sales}
              onChange={(e) => setFormData({ ...formData, exempt_sales: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* Purchases */}
      <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-800">
        <h3 className="font-semibold text-purple-200 mb-4">المشتريات (ضريبة المدخلات)</h3>
        <div>
          <label className="block text-sm text-gray-400 mb-1">مشتريات بنسبة 15%</label>
          <input
            type="number"
            value={formData.standard_purchases}
            onChange={(e) => setFormData({ ...formData, standard_purchases: e.target.value })}
            className="w-full md:w-1/3 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            placeholder="0.00"
          />
        </div>
      </div>

      <button
        onClick={generateReturn}
        disabled={loading}
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <RefreshCw className="animate-spin" size={20} />
        ) : (
          <FileText size={20} />
        )}
        <span>إعداد الإقرار</span>
      </button>

      {result && (
        <div className="bg-gray-700/50 rounded-lg p-6 space-y-6">
          <h3 className="font-bold text-lg text-white">ملخص إقرار ضريبة القيمة المضافة</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Output VAT */}
            <div className="space-y-2">
              <h4 className="font-medium text-blue-400">ضريبة المخرجات</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between text-gray-300">
                  <span>مبيعات 15%</span>
                  <span>{formatCurrency(result.sales?.standard_rated?.amount || 0)}</span>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t border-gray-600 text-white">
                  <span>إجمالي ضريبة المخرجات</span>
                  <span className="text-blue-400">{formatCurrency(result.sales?.output_vat || 0)}</span>
                </div>
              </div>
            </div>

            {/* Input VAT */}
            <div className="space-y-2">
              <h4 className="font-medium text-purple-400">ضريبة المدخلات</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between text-gray-300">
                  <span>مشتريات 15%</span>
                  <span>{formatCurrency(result.purchases?.standard_rated?.amount || 0)}</span>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t border-gray-600 text-white">
                  <span>إجمالي ضريبة المدخلات</span>
                  <span className="text-purple-400">{formatCurrency(result.purchases?.input_vat || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net VAT */}
          <div className={`rounded-lg p-4 ${result.summary?.vat_due > 0 ? 'bg-red-900/30 border border-red-800' : 'bg-green-900/30 border border-green-800'}`}>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold text-lg text-white">
                  {result.summary?.vat_due > 0 ? 'الضريبة المستحقة للدفع' : 'الضريبة المستحقة للاسترداد'}
                </p>
              </div>
              <span className={`font-bold text-2xl ${result.summary?.vat_due > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {formatCurrency(result.summary?.vat_due > 0 ? result.summary.vat_due : result.summary?.vat_refund || 0)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
