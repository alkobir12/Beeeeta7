import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, RefreshCw } from 'lucide-react';
import { api, customerAPI, supplierAPI } from '../services/api';
import { useToast } from '../hooks/use-toast';
import DebtWhatsAppComposerDialog from '../components/DebtWhatsAppComposerDialog';
import { buildDebtWhatsAppDraft } from '../utils/debtWhatsapp';
import { getWhatsAppLink } from '../utils/constants';

export default function DebtFollowUp() {
  const workshopId = process.env.REACT_APP_WORKSHOP_ID;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [settlementAccounts, setSettlementAccounts] = useState([]);
  const [manualAmounts, setManualAmounts] = useState({});
  const [savingRowId, setSavingRowId] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [customersRes, suppliersRes] = await Promise.all([
        customerAPI.getAll(workshopId ? { workshop_id: workshopId } : {}),
        supplierAPI.getAll(workshopId ? { workshop_id: workshopId } : {}),
      ]);

      const accountsRes = await api.get('/finance/chart-of-accounts', workshopId ? { params: { workshop_id: workshopId } } : undefined);
      const accountRows = Array.isArray(accountsRes?.data?.data)
        ? accountsRes.data.data
        : Array.isArray(accountsRes?.data)
          ? accountsRes.data
          : [];
      const payableAccounts = accountRows.filter((acc) => ['asset', 'liability', 'expense'].includes(String(acc?.type || '').toLowerCase()));
      setSettlementAccounts(payableAccounts);

      const customers = (customersRes.data || []).map((row) => ({ ...row, entityType: 'customer' }));
      const suppliers = (suppliersRes.data || []).map((row) => ({ ...row, entityType: 'supplier' }));
      const merged = [...customers, ...suppliers]
        .map((row) => ({
          ...row,
          ajelBalance: Number(row.ajelBalance || row.overdueBalance || 0),
          overdueBalance: Number(row.overdueBalance || row.ajelBalance || 0),
        }))
        .filter((row) => row.ajelBalance > 0 || row.overdueBalance > 0);

      setEntries(merged);
    } catch (error) {
      toast({ title: 'خطأ', description: 'تعذر تحميل متابعة الذمم', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, row) => {
        if (row.entityType === 'customer') {
          acc.customers += Number(row.ajelBalance || 0);
        } else {
          acc.suppliers += Number(row.ajelBalance || 0);
        }
        return acc;
      },
      { customers: 0, suppliers: 0 }
    );
  }, [entries]);

  const agingBuckets = useMemo(() => {
    const out = { b0_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0 };
    const now = Date.now();
    entries.forEach((row) => {
      const dateText = row?.movements?.[0]?.date;
      const dt = dateText ? new Date(dateText).getTime() : now;
      const ageDays = Math.max(0, Math.floor((now - dt) / (1000 * 60 * 60 * 24)));
      const amt = Number(row.ajelBalance || 0);
      if (ageDays <= 30) out.b0_30 += amt;
      else if (ageDays <= 60) out.b31_60 += amt;
      else if (ageDays <= 90) out.b61_90 += amt;
      else out.b90_plus += amt;
    });
    return out;
  }, [entries]);

  const selectedEntries = useMemo(
    () => entries.filter((row) => selectedIds.includes(`${row.entityType}-${row.id}`)),
    [entries, selectedIds]
  );

  const openPreviewForRows = (rows) => {
    const nextDrafts = rows.map((row) => buildDebtWhatsAppDraft(row, row.entityType));
    if (!nextDrafts.length) {
      toast({ title: 'تنبيه', description: 'لا توجد جهات محددة للمعاينة' });
      return;
    }
    setDrafts(nextDrafts);
    setDialogOpen(true);
  };

  const updateDraftMessage = (draftId, message) => {
    setDrafts((prev) => prev.map((draft) => (
      draft.id === draftId
        ? { ...draft, message, url: draft.phone ? getWhatsAppLink(draft.phone, message) : '' }
        : draft
    )));
  };

  const sendCurrent = (draft) => {
    if (!draft?.phone || !draft?.url) {
      toast({ title: 'تنبيه', description: 'لا يوجد رقم واتساب صالح لهذه الجهة', variant: 'destructive' });
      return;
    }
    window.open(draft.url, '_blank', 'noopener,noreferrer');
  };

  const sendAll = (allDrafts) => {
    const validDrafts = (allDrafts || []).filter((draft) => draft.phone && draft.url);
    if (!validDrafts.length) {
      toast({ title: 'تنبيه', description: 'لا توجد رسائل صالحة للإرسال', variant: 'destructive' });
      return;
    }
    validDrafts.forEach((draft, index) => {
      setTimeout(() => {
        window.open(draft.url, '_blank', 'noopener,noreferrer');
      }, index * 280);
    });
    toast({ title: 'تم التنفيذ', description: `تم فتح ${validDrafts.length} رسالة واتساب بعد المعاينة` });
  };

  const createSettlementOrder = async (row) => {
    const rowId = `${row.entityType}-${row.id}`;
    const amount = Number(manualAmounts[rowId] || row.ajelBalance || 0);
    const accountId = settlementAccounts[0]?.id || settlementAccounts[0]?.code || '';

    if (amount <= 0 || !accountId) {
      toast({ title: 'تنبيه', description: 'أدخل مبلغ صحيح وتأكد من وجود حساب قيد', variant: 'destructive' });
      return;
    }

    setSavingRowId(rowId);
    try {
      const payload = {
        type: 'payment_order',
        total: amount,
        amount,
        paymentAmount: amount,
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        status: 'issued',
        date: new Date().toISOString().split('T')[0],
        accountingAccountId: accountId,
        partnerId: row.id,
        partnerName: row.name,
        partnerPhone: row.phone || '',
        partnerType: row.entityType,
        notes: `أمر سداد/تحصيل من متابعة الذمم - ${row.name}`,
        items: [{
          name: `سداد ذمم - ${row.name}`,
          quantity: 1,
          price: amount,
          total: amount,
          isCustom: true,
        }],
      };

      await api.post('/operations', payload);
      toast({ title: 'تم إنشاء أمر السداد بنجاح' });
      setManualAmounts((prev) => ({ ...prev, [rowId]: '' }));
      await fetchData();
    } catch (_error) {
      toast({ title: 'تعذر إنشاء أمر السداد', variant: 'destructive' });
    } finally {
      setSavingRowId('');
    }
  };

  const fmt = (v) => Number(v || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6" dir="rtl" data-testid="debt-followup-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100" data-testid="debt-followup-title">متابعة الذمم والتحصيل</h1>
          <p className="text-sm text-slate-300/80 mt-1">تقادم الذمم + معاينة وتعديل رسائل واتساب قبل الإرسال الفردي أو الجماعي.</p>
        </div>
        <button
          type="button"
          className="apple-button h-10 px-4"
          onClick={fetchData}
          data-testid="debt-followup-refresh-button"
        >
          <span className="inline-flex items-center gap-2"><RefreshCw size={14} /> تحديث</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3" data-testid="debt-total-customers-card">
          <p className="text-xs text-cyan-200/80">ذمم العملاء (آجل)</p>
          <p className="text-lg font-bold text-cyan-100">{fmt(totals.customers)} ر.س</p>
        </div>
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3" data-testid="debt-total-suppliers-card">
          <p className="text-xs text-amber-200/80">ذمم الموردين (آجل)</p>
          <p className="text-lg font-bold text-amber-100">{fmt(totals.suppliers)} ر.س</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3" data-testid="debt-aging-0-30-card">
          <p className="text-xs text-slate-300/80">0-30 يوم</p>
          <p className="text-lg font-bold text-slate-100">{fmt(agingBuckets.b0_30)} ر.س</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3" data-testid="debt-aging-31-plus-card">
          <p className="text-xs text-slate-300/80">+31 يوم</p>
          <p className="text-lg font-bold text-slate-100">{fmt(agingBuckets.b31_60 + agingBuckets.b61_90 + agingBuckets.b90_plus)} ر.س</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4" data-testid="debt-followup-table-wrapper">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="text-sm text-slate-200">عدد الجهات: <span className="font-semibold">{entries.length}</span></div>
          <div className="flex gap-2">
            <button
              type="button"
              className="apple-button-secondary h-9 px-3"
              onClick={() => setSelectedIds(entries.map((row) => `${row.entityType}-${row.id}`))}
              data-testid="debt-select-all-button"
            >
              تحديد الكل
            </button>
            <button
              type="button"
              className="apple-button h-9 px-3"
              onClick={() => openPreviewForRows(selectedEntries)}
              data-testid="debt-open-bulk-preview-button"
            >
              <span className="inline-flex items-center gap-1"><MessageCircle size={14} /> معاينة/إرسال جماعي</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-400" data-testid="debt-followup-loading">جار تحميل الذمم...</div>
        ) : entries.length === 0 ? (
          <div className="py-10 text-center text-slate-400" data-testid="debt-followup-empty">لا توجد ذمم آجلة حالياً.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm" data-testid="debt-followup-table">
              <thead>
                <tr className="text-slate-300 border-b border-white/10">
                  <th className="p-2 text-right">تحديد</th>
                  <th className="p-2 text-right">الجهة</th>
                  <th className="p-2 text-right">النوع</th>
                  <th className="p-2 text-right">الهاتف</th>
                  <th className="p-2 text-right">مدين</th>
                  <th className="p-2 text-right">دائن</th>
                  <th className="p-2 text-right">آجل</th>
                  <th className="p-2 text-right">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => {
                  const rowId = `${row.entityType}-${row.id}`;
                  return (
                    <tr key={rowId} className="border-b border-white/5 text-slate-100" data-testid={`debt-row-${rowId}`}>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(rowId)}
                          onChange={(e) => setSelectedIds((prev) => e.target.checked ? [...prev, rowId] : prev.filter((id) => id !== rowId))}
                          data-testid={`debt-row-checkbox-${rowId}`}
                        />
                      </td>
                      <td className="p-2 font-semibold">{row.name}</td>
                      <td className="p-2">{row.entityType === 'supplier' ? 'مورد' : 'عميل'}</td>
                      <td className="p-2 ltr text-left">{row.phone || '-'}</td>
                      <td className="p-2">{fmt(row.debitBalance)}</td>
                      <td className="p-2">{fmt(row.creditBalance)}</td>
                      <td className="p-2 text-rose-200 font-bold">{fmt(row.ajelBalance)}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={manualAmounts[rowId] ?? ''}
                            onChange={(e) => setManualAmounts((prev) => ({ ...prev, [rowId]: e.target.value }))}
                            placeholder={String(Number(row.ajelBalance || 0).toFixed(2))}
                            className="w-28 rounded border border-white/20 bg-white/10 px-2 py-1 text-xs text-white"
                            data-testid={`debt-row-manual-amount-${rowId}`}
                          />
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded border border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                            onClick={() => createSettlementOrder(row)}
                            disabled={savingRowId === rowId}
                            data-testid={`debt-row-settlement-order-${rowId}`}
                          >
                            {savingRowId === rowId ? 'جارٍ...' : 'أمر سداد'}
                          </button>
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded border border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                            onClick={() => openPreviewForRows([row])}
                            data-testid={`debt-row-preview-${rowId}`}
                          >
                            معاينة واتساب
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DebtWhatsAppComposerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        drafts={drafts}
        onUpdateDraft={updateDraftMessage}
        onSendCurrent={sendCurrent}
        onSendAll={sendAll}
      />
    </div>
  );
}
