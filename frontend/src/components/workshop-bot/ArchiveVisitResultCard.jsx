import React from 'react';
import { CalendarDays, CreditCard, UserRound, Wrench } from 'lucide-react';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('ar-SA')} ر.س`;

const formatVisitDate = (value) => {
  if (!value) return 'غير محدد';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const ArchiveVisitResultCard = ({ result, compact = false, testIdPrefix = 'archive-result' }) => {
  if (!result?.vehicle) return null;

  const latestVisit = result.latestVisit;
  const vehicleTitle = [result.vehicle.brand, result.vehicle.model, result.vehicle.year].filter(Boolean).join(' ');

  if (compact) {
    return (
      <div
        className="rounded-2xl border border-cyan-400/15 bg-slate-950/78 p-3 backdrop-blur-xl"
        data-testid={`${testIdPrefix}-card`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-white" data-testid={`${testIdPrefix}-plate`}>
              {result.vehicle.plateNumber || 'بدون لوحة'}
            </p>
            <p className="text-[11px] text-slate-300" data-testid={`${testIdPrefix}-vehicle`}>
              {vehicleTitle || 'مركبة بدون وصف'} • {result.vehicle.customerName || 'عميل غير محدد'}
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-cyan-200" data-testid={`${testIdPrefix}-score`}>
            مطابقة {Number(result.matchScore || 0).toLocaleString('ar-SA')}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-300">
          <span className="rounded-full bg-white/5 px-2.5 py-1" data-testid={`${testIdPrefix}-date`}>
            آخر زيارة: {latestVisit ? formatVisitDate(latestVisit.entryDate || latestVisit.exitDate) : 'لا توجد زيارة'}
          </span>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-100" data-testid={`${testIdPrefix}-amount`}>
            القيمة: {formatCurrency(latestVisit?.totalAmount || 0)}
          </span>
          <span className="rounded-full bg-white/5 px-2.5 py-1" data-testid={`${testIdPrefix}-payment`}>
            الدفع: {latestVisit?.paymentMethodLabel || 'غير محددة'}
          </span>
        </div>

        <div className="mt-2 rounded-xl bg-white/5 px-3 py-2" data-testid={`${testIdPrefix}-repairs-box`}>
          <p className="text-[11px] text-slate-400">ما تم إصلاحه</p>
          <p className="mt-1 text-sm leading-6 text-slate-100" data-testid={`${testIdPrefix}-repairs`}>
            {latestVisit?.repairsSummary || 'لا توجد بنود إصلاح مسجلة في آخر زيارة'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-cyan-400/15 bg-slate-950/75 p-4 backdrop-blur-xl"
      data-testid={`${testIdPrefix}-card`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white" data-testid={`${testIdPrefix}-plate`}>
            {result.vehicle.plateNumber || 'بدون لوحة'}
          </p>
          <p className="text-xs text-slate-300" data-testid={`${testIdPrefix}-vehicle`}>
            {vehicleTitle || 'مركبة بدون وصف'}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-cyan-200" data-testid={`${testIdPrefix}-score`}>
          مطابقة {Number(result.matchScore || 0).toLocaleString('ar-SA')}
        </span>
      </div>

      <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
        <div className="rounded-xl bg-white/5 px-3 py-2" data-testid={`${testIdPrefix}-customer-box`}>
          <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-400">
            <UserRound size={13} /> العميل
          </div>
          <div className="text-sm text-white" data-testid={`${testIdPrefix}-customer`}>
            {result.vehicle.customerName || 'غير محدد'}
          </div>
        </div>

        <div className="rounded-xl bg-white/5 px-3 py-2" data-testid={`${testIdPrefix}-date-box`}>
          <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-400">
            <CalendarDays size={13} /> آخر زيارة
          </div>
          <div className="text-sm text-white" data-testid={`${testIdPrefix}-date`}>
            {latestVisit ? formatVisitDate(latestVisit.entryDate || latestVisit.exitDate) : 'لا توجد زيارة'}
          </div>
        </div>

        <div className="rounded-xl bg-white/5 px-3 py-2" data-testid={`${testIdPrefix}-payment-box`}>
          <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-400">
            <CreditCard size={13} /> الدفع
          </div>
          <div className="text-sm text-white" data-testid={`${testIdPrefix}-payment`}>
            {latestVisit?.paymentMethodLabel || 'غير محددة'}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3" data-testid={`${testIdPrefix}-repairs-box`}>
        <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
          <Wrench size={13} /> ما تم إصلاحه
        </div>
        <p className="text-sm leading-6 text-slate-100" data-testid={`${testIdPrefix}-repairs`}>
          {latestVisit?.repairsSummary || 'لا توجد بنود إصلاح مسجلة في آخر زيارة'}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-400/15 bg-emerald-500/8 px-3 py-2.5" data-testid={`${testIdPrefix}-amount-box`}>
        <span className="text-xs text-emerald-200">قيمة آخر زيارة</span>
        <span className="text-sm font-bold text-emerald-100" data-testid={`${testIdPrefix}-amount`}>
          {formatCurrency(latestVisit?.totalAmount || 0)}
        </span>
      </div>
    </div>
  );
};
