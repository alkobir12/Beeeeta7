import React, { useEffect, useMemo, useState } from 'react';
import { Package, Filter, Search } from 'lucide-react';
import axios from 'axios';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import InjectorDiagnostics from './InjectorDiagnosticsV7';
import AppleToyotaReader from '../components/AppleToyotaReader';
import FloatingAIAssistant from '../components/FloatingAIAssistant';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const PartsCatalog = () => {
  const [loading, setLoading] = useState(false);
  const [parts, setParts] = useState([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('الكل');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [activeTab, setActiveTab] = useState('parts');

  useEffect(() => {
    loadParts();
  }, []);

  const loadParts = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/parts`);
      setParts(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const set = new Set(parts.map(p => p.category || 'أخرى'));
    return ['الكل', ...Array.from(set)];
  }, [parts]);

  const filteredParts = useMemo(() => {
    return parts.filter(p => {
      if (categoryFilter !== 'الكل' && (p.category || 'أخرى') !== categoryFilter) return false;
      if (inStockOnly && Number(p.quantity || 0) <= 0) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        return [p.name, p.partNumber, p.category].join(' ').toLowerCase().includes(q);
      }
      return true;
    });
  }, [parts, categoryFilter, inStockOnly, query]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 relative">
      {/* Floating AI Assistant for Catalog context */}
      <FloatingAIAssistant context="catalog" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">مركز الكتالوج والتشخيص المتقدم</h1>
          <p className="text-gray-500 mt-1">
            كتالوج القطع + تشخيص Denso + مساعد Gemini
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 max-w-2xl">
          <TabsTrigger value="parts">كتالوج القطع</TabsTrigger>
          <TabsTrigger value="toyota">دليل تويوتا</TabsTrigger>
          <TabsTrigger value="denso">فحص Denso</TabsTrigger>
        </TabsList>

        {/* Toyota Manual Tab - Apple Design */}
        <TabsContent value="toyota">
          <AppleToyotaReader />
        </TabsContent>

        <TabsContent value="parts">
          {/* Search & Filter Bar */}
          <div className="apple-card p-4 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                className="apple-input pr-10"
                placeholder="بحث باسم القطعة، الرقم، أو الفئة..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative min-w-[150px]">
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <select
                  className="apple-input pr-10 h-10 text-sm"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                />
                <span className="text-sm text-gray-700 select-none">متوفر فقط</span>
              </label>
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : filteredParts.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Package size={48} className="mx-auto mb-4 text-gray-300" />
              <p>لا توجد قطع مطابقة للبحث</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredParts.map((part) => (
                <div key={part.id} className="apple-card p-5 group hover:shadow-md transition-all duration-200">
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                      <Package size={20} />
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                      Number(part.quantity) > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {Number(part.quantity) > 0 ? 'متوفر' : 'نفذت'}
                    </span>
                  </div>

                  <h3 className="font-bold text-gray-900 mb-1 truncate" title={part.name}>{part.name}</h3>
                  <p className="text-xs text-gray-500 font-mono mb-4">{part.partNumber}</p>

                  <div className="flex items-end justify-between pt-4 border-t border-gray-50">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">السعر</p>
                      <p className="font-bold text-[#0071E3]">
                        {Number(part.sellingPrice || part.purchasePrice || 0).toFixed(2)} <span className="text-xs font-normal text-gray-500">ر.س</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400 mb-0.5">الكمية</p>
                      <p className="font-medium text-gray-700">{Number(part.quantity || 0)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="denso">
          <div className="mt-4">
            <InjectorDiagnostics />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PartsCatalog;
