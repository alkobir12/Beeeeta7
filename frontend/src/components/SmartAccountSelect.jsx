/**
 * SmartAccountSelect
 * قائمة منسدلة ذكية للحسابات المحاسبية:
 * - تُرتّب آخر 3 حسابات مستخدمة في الأعلى
 * - تُصفّي الحسابات حسب نوع العملية والحقل
 * - تُسجّل الاختيار تلقائياً
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function SmartAccountSelect({
  operationType = 'sale',
  fieldKey = 'debit',
  value = '',
  onChange,
  placeholder = 'اختر حساباً...',
  className = '',
  includeAll = false,
  'data-testid': testId,
}) {
  const [accounts, setAccounts]   = useState([]);
  const [search, setSearch]       = useState('');
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API}/api/smart-accounting/accounts`, {
        params: { operation_type: operationType, field_key: fieldKey, include_all: includeAll },
      })
      .then((r) => setAccounts(r.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [operationType, fieldKey, includeAll]);

  const filtered = useMemo(
    () =>
      accounts.filter(
        (a) =>
          !search ||
          a.name?.includes(search) ||
          a.code?.includes(search)
      ),
    [accounts, search]
  );

  const selectedAcc = accounts.find((a) => a.code === value);

  const handleSelect = (acc) => {
    // تسجيل الاستخدام
    axios
      .post(`${API}/api/smart-accounting/accounts/track-usage`, {
        field_key: fieldKey,
        account_code: acc.code,
        operation_type: operationType,
      })
      .catch(() => {});
    onChange(acc.code, acc);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className={`relative ${className}`} dir="rtl">
      {/* زر الفتح */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm text-right transition-colors"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${value ? 'rgba(56,189,248,0.4)' : 'rgba(148,163,184,0.2)'}`,
          color: value ? 'rgba(248,250,252,0.95)' : 'rgba(148,163,184,0.7)',
        }}
        data-testid={testId}
      >
        <span>
          {loading ? 'جارٍ التحميل...' : selectedAcc ? `[${selectedAcc.code}] ${selectedAcc.name}` : placeholder}
        </span>
        <span className="text-slate-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {/* قائمة الاختيار */}
      {open && (
        <div
          className="absolute top-full right-0 left-0 mt-1 rounded-xl z-50 overflow-hidden"
          style={{
            background: 'rgba(6,10,30,0.98)',
            border: '1px solid rgba(56,189,248,0.2)',
            backdropFilter: 'blur(20px)',
            maxHeight: '240px',
            overflowY: 'auto',
          }}
        >
          {/* بحث */}
          <div className="sticky top-0 px-2 pt-2 pb-1" style={{ background: 'rgba(6,10,30,0.98)' }}>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم أو كود..."
              className="w-full rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>

          {/* الحسابات */}
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-500 text-center">لا توجد نتائج</div>
          ) : (
            <>
              {/* تمييز آخر المستخدمة */}
              {filtered.some((a) => a.recently_used) && (
                <div className="px-2.5 py-1 text-[10px] text-sky-400 font-semibold border-b border-white/5">
                  آخر حسابات مستخدمة
                </div>
              )}
              {filtered.map((acc) => (
                <button
                  key={acc.code}
                  type="button"
                  onClick={() => handleSelect(acc)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-right transition-colors hover:bg-sky-500/10"
                  style={{
                    color: acc.code === value ? 'rgba(56,189,248,0.95)' : 'rgba(226,232,240,0.85)',
                    background: acc.code === value ? 'rgba(56,189,248,0.08)' : undefined,
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <span className="truncate max-w-[65%]">{acc.name}</span>
                  <div className="flex items-center gap-1.5">
                    {acc.recently_used && (
                      <span className="text-[9px] bg-sky-500/20 text-sky-400 px-1 rounded">★</span>
                    )}
                    <span className="text-slate-500 font-mono">{acc.code}</span>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
