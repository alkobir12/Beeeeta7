import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Boxes, Building2, PackageSearch,
  Plus, X, Send, MessageCircle, Search, Package, Trash2,
  ChevronDown, CheckCircle2,
} from 'lucide-react';
import { api } from '../../services/api';

const fmt = (v) => `${Number(v || 0).toLocaleString('ar-SA')} ر.س`;

const URGENCY = {
  critical: { label: 'فوري',   cls: 'bg-red-500/15 text-red-200 border-red-400/30 animate-pulse' },
  high:     { label: 'قريب',   cls: 'bg-amber-500/15 text-amber-200 border-amber-400/30' },
  planned:  { label: 'مجدول', cls: 'bg-cyan-500/15 text-cyan-100 border-cyan-400/30' },
  dormant:  { label: 'راكد',   cls: 'bg-slate-500/15 text-slate-200 border-slate-400/30' },
};

const glassCard = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(20px)',
  borderRadius: '20px',
};

// ─── نافذة إضافة طلب يدوي ──────────────────────────────────────────────────
function ManualOrderDialog({ open, onClose, onAdd }) {
  const [step, setStep]               = useState(1); // 1=مورد, 2=قطع
  const [suppliers, setSuppliers]     = useState([]);
  const [partsCatalog, setPartsCatalog] = useState([]);
  const [selSupplier, setSelSupplier] = useState(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [partsSearch, setPartsSearch] = useState('');
  const [orderItems, setOrderItems]   = useState([]);
  const [manualPart, setManualPart]   = useState({ name: '', qty: 1 });
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [supplierPhone, setSupplierPhone] = useState('');

  useEffect(() => {
    if (!open) { setStep(1); setSelSupplier(null); setOrderItems([]); setSupplierSearch(''); setPartsSearch(''); return; }
    api.get('/suppliers').then(r => {
      const list = Array.isArray(r.data) ? r.data : r.data?.data || r.data?.suppliers || [];
      setSuppliers(list.filter(s => !String(s.id).startsWith('acc-')));
    }).catch(() => {});
    api.get('/parts?limit=500').then(r => {
      const list = Array.isArray(r.data) ? r.data : r.data?.data || r.data?.parts || [];
      setPartsCatalog(list);
    }).catch(() => {});
  }, [open]);

  const filteredSuppliers = useMemo(() =>
    suppliers.filter(s => !supplierSearch || s.name?.includes(supplierSearch)),
    [suppliers, supplierSearch]);

  const filteredParts = useMemo(() =>
    partsCatalog.filter(p => !partsSearch || p.name?.toLowerCase().includes(partsSearch.toLowerCase())),
    [partsCatalog, partsSearch]);

  const addPart = (part) => {
    setOrderItems(prev => {
      const idx = prev.findIndex(i => i.id === part.id);
      if (idx >= 0) return prev.map((i, n) => n === idx ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: part.id || `p-${Date.now()}`, name: part.name, qty: 1, price: part.sellingPrice || part.price || 0 }];
    });
  };

  const addManualPart = () => {
    if (!manualPart.name.trim()) return;
    setOrderItems(prev => [...prev, { id: `m-${Date.now()}`, name: manualPart.name, qty: manualPart.qty, price: 0, isManual: true }]);
    setManualPart({ name: '', qty: 1 });
    setShowManualAdd(false);
  };

  const buildWAMessage = () => {
    if (!selSupplier || !orderItems.length) return '';
    return [
      `طلب توريد قطع — ${selSupplier.name}`,
      `التاريخ: ${new Date().toLocaleDateString('ar-SA')}`,
      '━━━━━━━━━━━━━━━━━━',
      ...orderItems.map(i => `• ${i.name}  ×${i.qty}`),
      '━━━━━━━━━━━━━━━━━━',
      'يرجى تأكيد التوفر وسعر الوحدة.',
    ].join('\n');
  };

  const sendViaWhatsApp = () => {
    const phone = (supplierPhone || selSupplier?.phone || '').replace(/\D/g, '');
    const msg = buildWAMessage();
    if (!phone) { alert('أدخل رقم واتساب المورد'); return; }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  const confirmOrder = () => {
    if (!selSupplier || !orderItems.length) return;
    onAdd({ supplier: selSupplier.name, phone: supplierPhone || selSupplier.phone || '', items: orderItems });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-2xl rounded-[28px] overflow-hidden flex flex-col" style={{ ...glassCard, maxHeight: '90vh', background: 'rgba(6,10,30,0.97)' }}>
        {/* رأس */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8"
          style={{ background: 'linear-gradient(135deg,rgba(14,165,233,0.1),rgba(99,102,241,0.1))' }}>
          <div>
            <h2 className="text-sm font-bold text-white">إضافة طلب شراء يدوي</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              الخطوة {step}/3 — {step===1?'اختر المورد':step===2?'أضف القطع':'تأكيد وإرسال'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/8 text-slate-400"><X size={16} /></button>
        </div>

        {/* محتوى */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* الخطوة 1: اختيار المورد */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)}
                  placeholder="ابحث باسم المورد..."
                  className="w-full rounded-xl pr-9 pl-3 py-2.5 text-sm text-slate-100 bg-white/5 border border-white/10 outline-none focus:border-sky-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                {filteredSuppliers.map(s => (
                  <button key={s.id} type="button" onClick={() => setSelSupplier(s)}
                    className={`rounded-2xl p-3 text-right transition-all border ${
                      selSupplier?.id === s.id
                        ? 'border-sky-500/60 bg-sky-500/15 text-sky-200'
                        : 'border-white/8 bg-white/3 text-slate-300 hover:bg-white/8'
                    }`}>
                    <div className="font-medium text-sm truncate">{s.name}</div>
                    {s.phone && <div className="text-[10px] opacity-60 mt-0.5">{s.phone}</div>}
                  </button>
                ))}
              </div>
              {selSupplier && (
                <div className="rounded-xl bg-sky-500/8 border border-sky-500/25 p-3">
                  <p className="text-xs text-sky-300">✓ المورد المختار: <strong>{selSupplier.name}</strong></p>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-[11px] text-slate-400 whitespace-nowrap">رقم واتساب:</label>
                    <input value={supplierPhone || selSupplier.phone || ''} onChange={e => setSupplierPhone(e.target.value)}
                      placeholder="966xxxxxxxxx"
                      className="flex-1 rounded-lg px-2 py-1 text-xs text-slate-100 bg-white/5 border border-white/10" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* الخطوة 2: إضافة القطع */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={partsSearch} onChange={e => setPartsSearch(e.target.value)}
                  placeholder="ابحث في كتالوج القطع..."
                  className="w-full rounded-xl pr-9 pl-3 py-2.5 text-sm text-slate-100 bg-white/5 border border-white/10 outline-none focus:border-violet-500/50" />
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1.5 border border-white/8 rounded-2xl p-2">
                {filteredParts.slice(0, 40).map(p => (
                  <button key={p.id} type="button" onClick={() => addPart(p)}
                    className={`w-full rounded-xl px-3 py-2 text-right flex justify-between items-center text-xs transition-all ${
                      orderItems.find(i=>i.id===p.id) ? 'bg-violet-500/15 border border-violet-500/30 text-violet-200' : 'bg-white/3 hover:bg-white/8 text-slate-200'
                    }`}>
                    <span className="text-slate-400 tabular-nums">{p.sellingPrice||p.price?`${Number(p.sellingPrice||p.price).toLocaleString('ar-SA')} ر.س`:''}</span>
                    <span className="truncate max-w-[65%]">{p.name}</span>
                  </button>
                ))}
                {!filteredParts.length && <p className="text-center text-xs text-slate-500 py-4">لا توجد نتائج</p>}
              </div>

              {/* إضافة قطعة يدوية */}
              {showManualAdd ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-3 space-y-2">
                  <p className="text-[11px] text-amber-300 font-semibold">قطعة غير موجودة في الكتالوج</p>
                  <div className="flex gap-2">
                    <input value={manualPart.name} onChange={e => setManualPart(p=>({...p,name:e.target.value}))}
                      placeholder="اسم القطعة..."
                      className="flex-1 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 bg-white/5 border border-white/10" />
                    <input type="number" min="1" value={manualPart.qty} onChange={e => setManualPart(p=>({...p,qty:Number(e.target.value)}))}
                      className="w-16 rounded-lg px-2 py-1.5 text-xs text-center text-slate-100 bg-white/5 border border-white/10" />
                    <button type="button" onClick={addManualPart}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/25 text-amber-200 text-xs font-semibold hover:bg-amber-500/40">إضافة</button>
                    <button type="button" onClick={() => setShowManualAdd(false)}
                      className="px-2 py-1.5 rounded-lg bg-white/5 text-slate-400 text-xs">×</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setShowManualAdd(true)}
                  className="w-full rounded-2xl border border-dashed border-amber-500/40 py-2.5 text-xs text-amber-400 hover:bg-amber-500/8 transition-colors flex items-center justify-center gap-1.5">
                  <Plus size={13} /> إضافة قطعة جديدة غير موجودة في الكتالوج
                </button>
              )}

              {/* القطع المختارة */}
              {orderItems.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-400">القطع المختارة ({orderItems.length}):</p>
                  {orderItems.map((item, i) => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setOrderItems(prev => prev.filter((_,n)=>n!==i))}
                          className="text-red-400 hover:text-red-300"><Trash2 size={12} /></button>
                        <span className="text-xs text-slate-200">{item.name}</span>
                        {item.isManual && <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 rounded">يدوي</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setOrderItems(prev=>prev.map((x,n)=>n===i?{...x,qty:Math.max(1,x.qty-1)}:x))} className="w-5 h-5 rounded bg-white/10 text-slate-300 text-xs">-</button>
                        <span className="text-xs text-cyan-300 w-6 text-center tabular-nums">{item.qty}</span>
                        <button onClick={() => setOrderItems(prev=>prev.map((x,n)=>n===i?{...x,qty:x.qty+1}:x))} className="w-5 h-5 rounded bg-white/10 text-slate-300 text-xs">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* الخطوة 3: تأكيد وإرسال */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span className="text-sm font-bold text-white">ملخص الطلب</span>
                </div>
                <p className="text-xs text-slate-300">المورد: <strong className="text-white">{selSupplier?.name}</strong></p>
                <p className="text-xs text-slate-300 mt-1">{orderItems.length} صنف</p>
                <div className="mt-2 space-y-1">
                  {orderItems.map(i => (
                    <p key={i.id} className="text-[11px] text-slate-400">• {i.name} × {i.qty}</p>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-white/3 border border-white/8 p-3">
                <p className="text-[11px] text-slate-400 mb-2 flex items-center gap-1"><MessageCircle size={12} /> معاينة رسالة واتساب:</p>
                <pre className="text-[11px] text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">{buildWAMessage()}</pre>
              </div>

              {!(supplierPhone || selSupplier?.phone) && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3">
                  <p className="text-[11px] text-amber-300">أدخل رقم واتساب المورد للإرسال:</p>
                  <input value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)}
                    placeholder="966xxxxxxxxx"
                    className="mt-2 w-full rounded-lg px-2.5 py-1.5 text-xs text-slate-100 bg-white/5 border border-white/10" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* أزرار التنقل */}
        <div className="flex gap-2 p-4 border-t border-white/8 bg-black/20">
          {step > 1 && (
            <button type="button" onClick={() => setStep(s=>s-1)}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 border border-white/10 hover:bg-white/8">رجوع</button>
          )}
          {step < 3 ? (
            <button type="button"
              disabled={(step===1 && !selSupplier) || (step===2 && !orderItems.length)}
              onClick={() => setStep(s=>s+1)}
              className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}>
              التالي →
            </button>
          ) : (
            <div className="flex-1 flex gap-2">
              <button type="button" onClick={sendViaWhatsApp}
                disabled={!orderItems.length}
                className="flex-1 py-2 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
                <MessageCircle size={15} /> واتساب
              </button>
              <button type="button" onClick={confirmOrder}
                className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}>
                <Send size={14} className="inline ml-1" /> تأكيد الطلب
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── المكوّن الرئيسي ────────────────────────────────────────────────────────
export const InventoryPlannerTab = ({ architecture, loading = false }) => {
  const navigate = useNavigate();
  const [orderDrafts, setOrderDrafts] = useState({});
  const [activeSupplier, setActiveSupplier] = useState('');
  const [showAddDialog, setShowAddDialog]   = useState(false);

  const supplierKeys = useMemo(() => Object.keys(orderDrafts), [orderDrafts]);
  useEffect(() => {
    if (!activeSupplier && supplierKeys.length) setActiveSupplier(supplierKeys[0]);
  }, [activeSupplier, supplierKeys]);

  const addToOrder = (row) => {
    const sup = row.supplier || 'مورد غير محدد';
    setOrderDrafts(prev => {
      const next = { ...prev };
      const ex = next[sup] || { supplier: sup, phone: row.supplier_phone || '', items: [] };
      const idx = ex.items.findIndex(i => i.part_id === row.part_id);
      if (idx >= 0) ex.items[idx] = { ...ex.items[idx], quantity: ex.items[idx].quantity + row.suggested_order_quantity };
      else ex.items.push({ part_id: row.part_id, part_name: row.part_name, quantity: row.suggested_order_quantity, suggested_order_quantity: row.suggested_order_quantity, avg_monthly_usage: row.avg_monthly_usage, supplier: row.supplier, supplier_phone: row.supplier_phone });
      next[sup] = { ...ex };
      return next;
    });
    setActiveSupplier(sup);
  };

  const handleManualOrderAdd = ({ supplier, phone, items }) => {
    setOrderDrafts(prev => {
      const next = { ...prev };
      const ex = next[supplier] || { supplier, phone, items: [] };
      items.forEach(item => {
        const idx = ex.items.findIndex(i => i.part_id === item.id);
        if (idx >= 0) ex.items[idx] = { ...ex.items[idx], quantity: ex.items[idx].quantity + item.qty };
        else ex.items.push({ part_id: item.id, part_name: item.name, quantity: item.qty, suggested_order_quantity: item.qty, avg_monthly_usage: 0, supplier, supplier_phone: phone });
      });
      ex.phone = phone || ex.phone;
      next[supplier] = { ...ex };
      return next;
    });
    setActiveSupplier(supplier);
  };

  const updateOrderItem = (sup, partId, qty) => setOrderDrafts(prev => {
    const next = { ...prev };
    if (!next[sup]) return prev;
    next[sup] = { ...next[sup], items: next[sup].items.map(i => i.part_id === partId ? { ...i, quantity: qty } : i) };
    return next;
  });

  const removeOrderItem = (sup, partId) => setOrderDrafts(prev => {
    const next = { ...prev };
    if (!next[sup]) return prev;
    const items = next[sup].items.filter(i => i.part_id !== partId);
    if (!items.length) delete next[sup];
    else next[sup] = { ...next[sup], items };
    return next;
  });

  const buildWhatsappMessage = (draft) => {
    if (!draft) return '';
    return [
      `طلب توريد قطع — ${draft.supplier}`,
      `التاريخ: ${new Date().toLocaleDateString('ar-SA')}`,
      '━━━━━━━━━━━━━━━━━━',
      ...draft.items.map(i => `• ${i.part_name}  الكمية: ${i.quantity}`),
      '━━━━━━━━━━━━━━━━━━',
      'يرجى تأكيد التوفر ومدة التوريد.',
    ].join('\n');
  };

  if (loading) return <div className="p-5 text-slate-300" style={glassCard}>جارٍ تحميل خطة التزويد...</div>;
  if (!architecture) return <div className="p-5 text-slate-400" style={glassCard}>لا توجد بيانات كافية لبناء خطة التزويد.</div>;

  const blueprint = architecture.blueprint || {};
  const replenishmentPlan = architecture.replenishment_plan || [];
  const supplierHealth = architecture.supplier_health || [];
  const stockSegments = architecture.stock_segments || [];
  const executionBudget = architecture.execution_budget || {};
  const activeDraft = activeSupplier ? orderDrafts[activeSupplier] : null;
  const waMessage = buildWhatsappMessage(activeDraft);
  const waPhone = (activeDraft?.phone || '').replace(/\D/g, '');
  const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}` : '';

  const statCards = [
    { key: 'supplier-coverage', label: 'تغطية الموردين', value: `${Number(blueprint.supplier_coverage_pct||0).toFixed(0)}%`, hint: `${blueprint.parts_with_supplier||0} صنف موثّق`, icon: Building2, color: '#38bdf8' },
    { key: 'urgent', label: 'توريد عاجل', value: blueprint.urgent_reorders_count||0, hint: `${blueprint.linked_backorder_quantity||0} قطعة معلّقة`, icon: AlertTriangle, color: '#ef4444' },
    { key: 'planned', label: 'تخطيط دوري', value: blueprint.planned_reorders_count||0, hint: blueprint.average_days_of_cover ? `تغطية ${blueprint.average_days_of_cover} يوم` : 'غير متاح', icon: PackageSearch, color: '#22c55e' },
    { key: 'dormant', label: 'مخزون راكد', value: fmt(blueprint.dormant_stock_value), hint: `${blueprint.margin_risk_count||0} صنف بهامش خطر`, icon: Boxes, color: '#f59e0b' },
  ];

  return (
    <div className="space-y-4" dir="rtl" data-testid="inventory-architecture-tab">
      <ManualOrderDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} onAdd={handleManualOrderAdd} />

      {/* ── بطاقات إحصاء ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {statCards.map(card => (
          <div key={card.key} className="p-4 rounded-[20px] transition-all hover:scale-[1.01]"
            style={{ ...glassCard, borderTop: `3px solid ${card.color}` }}
            data-testid={`inventory-architecture-card-${card.key}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400">{card.label}</p>
              <card.icon size={16} style={{ color: card.color }} />
            </div>
            <p className="text-xl font-bold text-white tabular-nums">{card.value}</p>
            <p className="text-[11px] text-slate-500 mt-1.5">{card.hint}</p>
          </div>
        ))}
      </div>

      {/* ── ميزانية التنفيذ ── */}
      {(executionBudget.total_commitment > 0) && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: 'ميزانية فورية', value: executionBudget.urgent, color: '#ef4444' },
            { label: 'أولوية قريبة',  value: executionBudget.high,   color: '#f59e0b' },
            { label: 'تخطيط دوري',   value: executionBudget.planned, color: '#38bdf8' },
            { label: 'الإجمالي الملتزم', value: executionBudget.total_commitment, color: '#a78bfa', bold: true },
          ].map((b, i) => (
            <div key={i} className="p-3 rounded-[18px]" style={{ ...glassCard, borderRight: `3px solid ${b.color}` }}>
              <p className="text-[11px] text-slate-400">{b.label}</p>
              <p className={`text-sm mt-1 tabular-nums ${b.bold ? 'text-white font-bold text-base' : 'text-slate-200 font-semibold'}`}>{fmt(b.value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── جدول خطة التزويد ── */}
      <div className="rounded-[22px] overflow-hidden" style={glassCard}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-white/8"
          style={{ background: 'linear-gradient(135deg,rgba(14,165,233,0.06),rgba(99,102,241,0.06))' }}>
          <div>
            <h2 className="text-sm font-bold text-white">خطة التزويد الذكية</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">توصيات مبنية على الطلب وحد الأمان والطلبات المعلّقة</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/8">
              آخر {blueprint.period_days||0} يوم
            </span>
            <button type="button" onClick={() => setShowAddDialog(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white border border-sky-500/40 hover:bg-sky-500/15 transition-all"
              style={{ background: 'rgba(14,165,233,0.12)' }}
              data-testid="inventory-add-order-btn">
              <Plus size={13} /> إضافة طلب يدوي
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right min-w-[960px]">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }} className="text-slate-400 border-b border-white/8">
                {['الصنف','المورد','المتاح/الأدنى','مبيعات الفترة','تغطية المخزون','طلبات معلّقة','الكمية المقترحة','التكلفة','الأولوية','إجراء'].map((h,i) => (
                  <th key={i} className="py-3 px-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {replenishmentPlan.map(row => {
                const badge = URGENCY[row.urgency] || URGENCY.planned;
                return (
                  <tr key={row.part_id} className="border-b border-white/5 hover:bg-white/3 transition-colors text-slate-200"
                    data-testid={`inventory-architecture-plan-row-${row.part_id}`}>
                    <td className="py-3 px-3">
                      <p className="text-slate-100 font-medium">{row.part_name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{row.part_number} · {row.category}</p>
                    </td>
                    <td className="py-3 px-3">{row.supplier || <span className="text-slate-500">—</span>}</td>
                    <td className="py-3 px-3 tabular-nums">{row.current_quantity} / {row.min_quantity}</td>
                    <td className="py-3 px-3 tabular-nums">{row.sold_period}</td>
                    <td className="py-3 px-3">{row.days_of_cover ? `${row.days_of_cover} يوم` : '—'}</td>
                    <td className="py-3 px-3 tabular-nums">{row.backorder_quantity}</td>
                    <td className="py-3 px-3 font-bold text-sky-300 tabular-nums">{row.suggested_order_quantity}</td>
                    <td className="py-3 px-3 tabular-nums">{fmt(row.estimated_purchase_cost)}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] border ${badge.cls}`}
                        data-testid={`inventory-architecture-plan-urgency-${row.part_id}`}>{badge.label}</span>
                    </td>
                    <td className="py-3 px-3">
                      <button type="button" onClick={() => addToOrder(row)}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-medium border border-sky-500/30 text-sky-300 hover:bg-sky-500/15 transition-all"
                        data-testid={`inventory-architecture-add-to-order-${row.part_id}`}>
                        + طلب
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!replenishmentPlan.length && (
                <tr><td colSpan={10} className="py-8 text-center text-slate-500" data-testid="inventory-architecture-plan-empty">
                  لا توجد توصيات توريد حالياً.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── مسودة الطلبات ── */}
      {!!supplierKeys.length && (
        <div className="rounded-[22px] p-4 space-y-4" style={glassCard}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white">طلبات الشراء</h3>
              <p className="text-[11px] text-slate-400">راجع الطلب ثم أرسله عبر واتساب</p>
            </div>
            <button type="button" onClick={() => setShowAddDialog(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/15 transition-all">
              <Plus size={13} /> طلب جديد
            </button>
          </div>

          {/* تبويبات الموردين */}
          <div className="flex flex-wrap gap-2">
            {supplierKeys.map(sup => (
              <button key={sup} type="button" onClick={() => setActiveSupplier(sup)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all border ${
                  sup === activeSupplier ? 'border-sky-500/50 bg-sky-500/20 text-sky-200' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}>
                {sup}
                <span className="mr-1 text-[10px] opacity-60">({orderDrafts[sup]?.items?.length})</span>
              </button>
            ))}
          </div>

          {activeDraft && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* قائمة البنود */}
              <div className="space-y-2">
                {activeDraft.items.map(item => (
                  <div key={item.part_id} className="rounded-xl bg-white/4 border border-white/8 p-3 space-y-2"
                    data-testid={`inventory-architecture-order-item-${item.part_id}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-white font-medium">{item.part_name}</p>
                      <button type="button" onClick={() => removeOrderItem(activeDraft.supplier, item.part_id)}
                        className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-red-500/10">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-slate-400">الكمية:</label>
                      <input type="number" min="1" value={item.quantity}
                        onChange={e => updateOrderItem(activeDraft.supplier, item.part_id, Number(e.target.value))}
                        className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white text-center"
                        data-testid={`inventory-architecture-order-qty-${item.part_id}`} />
                      <span className="text-[11px] text-slate-500">مقترح: {item.suggested_order_quantity}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* معاينة وإرسال */}
              <div className="rounded-[18px] border border-white/8 bg-white/3 p-4 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-white">معاينة الرسالة</h4>
                  {activeDraft.phone
                    ? <span className="text-[11px] text-sky-400">{activeDraft.phone}</span>
                    : <span className="text-[11px] text-amber-400">لا يوجد رقم مورد</span>
                  }
                </div>
                <textarea readOnly value={waMessage}
                  className="flex-1 min-h-[140px] rounded-xl border border-white/8 bg-slate-950/60 p-3 text-[11px] text-slate-200 resize-none"
                  data-testid="inventory-architecture-order-preview" />
                <div className="mt-3">
                  {waUrl ? (
                    <a href={waUrl} target="_blank" rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-bold text-white transition-all hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}
                      data-testid="inventory-architecture-order-send-whatsapp">
                      <MessageCircle size={16} /> إرسال عبر واتساب
                    </a>
                  ) : (
                    <p className="text-center text-xs text-slate-500">أدخل رقم المورد في الطلب اليدوي لتفعيل الإرسال</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── صحة الموردين ── */}
      {!!supplierHealth.length && (
        <div className="rounded-[22px] overflow-hidden" style={glassCard}>
          <div className="px-4 py-3 border-b border-white/8">
            <h2 className="text-sm font-bold text-white">صحة الموردين واستعداد الشراء</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right min-w-[700px]">
              <thead>
                <tr className="text-slate-400 border-b border-white/8 bg-white/2">
                  {['المورد','أصناف','عاجل','مجدول','طلبات','قيمة المخزون','التزام الشراء'].map((h,i) => (
                    <th key={i} className="py-3 px-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {supplierHealth.map((row, i) => (
                  <tr key={i} className="border-b border-white/5 text-slate-200 hover:bg-white/3 transition-colors"
                    data-testid={`inventory-architecture-supplier-row-${i}`}>
                    <td className="py-3 px-3 font-medium text-slate-100">{row.supplier_name}</td>
                    <td className="py-3 px-3 tabular-nums">{row.tracked_parts}</td>
                    <td className="py-3 px-3 text-red-300 tabular-nums">{row.urgent_items}</td>
                    <td className="py-3 px-3 text-cyan-300 tabular-nums">{row.planned_items}</td>
                    <td className="py-3 px-3 tabular-nums">{row.pending_backorders}</td>
                    <td className="py-3 px-3 tabular-nums">{fmt(row.stock_value)}</td>
                    <td className="py-3 px-3 font-bold tabular-nums">{fmt(row.purchase_commitment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── شرائح المخزون ── */}
      {!!stockSegments.length && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {stockSegments.map(seg => (
            <div key={seg.key} className="p-4 rounded-[20px]" style={glassCard}
              data-testid={`inventory-architecture-segment-${seg.key}`}>
              <div className="flex justify-between items-center gap-2">
                <p className="text-sm text-white font-medium">{seg.label}</p>
                <span className="text-sm text-cyan-300 tabular-nums font-bold">{seg.count||0}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">{seg.description}</p>
              <p className="text-[11px] text-slate-400 mt-2 tabular-nums">القيمة: {fmt(seg.value)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
