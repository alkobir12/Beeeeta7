import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Slider } from '../components/ui/slider';
import { Package, Filter, ShoppingCart, X, Search } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const PartsCatalog = () => {
  const [loading, setLoading] = useState(false);
  const [parts, setParts] = useState([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('الكل');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [priceRange, setPriceRange] = useState([0, 0]);
  const [inStockOnly, setInStockOnly] = useState(false);

  useEffect(() => {
    loadParts();
  }, []);

  const loadParts = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/parts`);
      const list = data || [];
      setParts(list);
      if (list.length) {
        const prices = list.map(p => Number(p.sellingPrice || p.purchasePrice || 0));
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        setMinPrice(min);
        setMaxPrice(max);
        setPriceRange([min, max]);
      }
    } catch (e) {
      console.error('Error loading parts catalog', e);
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
      const price = Number(p.sellingPrice || p.purchasePrice || 0);
      if (categoryFilter !== 'الكل' && (p.category || 'أخرى') !== categoryFilter) return false;
      if (inStockOnly && Number(p.quantity || 0) <= 0) return false;
      if (price < priceRange[0] || price > priceRange[1]) return false;

      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const text = [p.name, p.partNumber, p.category].join(' ').toLowerCase();
        return text.includes(q);
      }
      return true;
    });
  }, [parts, categoryFilter, inStockOnly, priceRange, query]);

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50" dir="rtl">
        <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
          {/* العنوان */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
                <Package size={26} className="text-blue-600" />
                كتالوج قطع الغيار
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                استعراض وفلترة القطع المسجلة في المخزون الحالي بسرعة.
              </p>
            </div>
          </div>

          {/* شريط البحث والفلاتر */}
          <Card className="mb-6 shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 flex items-center gap-2">
                  <Search className="text-slate-400" size={18} />
                  <Input
                    placeholder="ابحث باسم القطعة أو رقمها أو الفئة..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={18} className="text-slate-500" />
                  <select
                    className="border rounded-md px-2 py-1 text-sm bg-white"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      checked={inStockOnly}
                      onChange={(e) => setInStockOnly(e.target.checked)}
                    />
                    متوفر بالمخزون فقط
                  </label>
                </div>
              </div>

              {/* فلتر السعر */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>نطاق السعر (ر.س)</span>
                  <span>
                    {Math.round(priceRange[0])} - {Math.round(priceRange[1])}
                  </span>
                </div>
                <Slider
                  min={minPrice}
                  max={maxPrice}
                  step={1}
                  value={priceRange}
                  onValueChange={(val) => setPriceRange(val)}
                />
              </div>
            </CardContent>
          </Card>

          {/* شبكة القطع */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          ) : filteredParts.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="py-16 text-center text-slate-500">
                لا توجد قطع مطابقة لمعايير البحث الحالية.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredParts.map((part) => (
                <Card key={part.id} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between gap-2 text-base">
                      <span className="truncate" title={part.name}>{part.name}</span>
                      <Badge variant={Number(part.quantity || 0) > 0 ? 'default' : 'destructive'} className="shrink-0">
                        {Number(part.quantity || 0) > 0 ? 'متوفر' : 'غير متوفر'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>رقم القطعة:</span>
                      <span className="font-mono text-[11px]">{part.partNumber}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>الفئة:</span>
                      <span>{part.category || 'غير محددة'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>السعر للبيع:</span>
                      <span className="font-semibold text-blue-700">
                        {Number(part.sellingPrice || part.purchasePrice || 0).toFixed(2)} ر.س
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>المتوفر بالمخزون:</span>
                      <span>{Number(part.quantity || 0)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PartsCatalog;
