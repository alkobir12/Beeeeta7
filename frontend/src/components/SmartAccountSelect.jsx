import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const ENTRY_ALLOWED_GROUPS = {
  sale: ['customers', 'revenue', 'discounts'],
  purchase: ['suppliers', 'inventory', 'purchase_expenses'],
  expense: ['expenses', 'cash', 'bank'],
  receipt: ['customers', 'cash', 'bank'],
  payment: ['suppliers', 'cash', 'bank'],
  general: ['all'],
};

const GROUP_DEFAULT_SIDE = {
  customers: 'debit',
  suppliers: 'credit',
  revenue: 'credit',
  discounts: 'debit',
  expenses: 'debit',
  inventory: 'debit',
  purchase_expenses: 'debit',
  cash: 'debit',
  bank: 'debit',
};

const DESCRIPTION_KEYWORDS_MAP = [
  { keywords: ['إيجار', 'rent'], suggestedGroup: 'expenses' },
  { keywords: ['صيانة', 'maintenance'], suggestedGroup: 'expenses' },
  { keywords: ['رواتب', 'salaries'], suggestedGroup: 'expenses' },
  { keywords: ['تحصيل', 'collection'], suggestedGroup: 'customers' },
  { keywords: ['مورد', 'supplier'], suggestedGroup: 'suppliers' },
  { keywords: ['مخزون', 'inventory'], suggestedGroup: 'inventory' },
  { keywords: ['بيع', 'sale'], suggestedGroup: 'revenue' },
];

const CORE_FALLBACK_ACCOUNTS = [
  { id: 'core-003', code: '003', name: 'النقد', type: 'asset', group: 'cash' },
  { id: 'core-004', code: '004', name: 'البنك', type: 'asset', group: 'bank' },
  { id: 'core-005', code: '005', name: 'العملاء', type: 'asset', group: 'customers' },
  { id: 'core-006', code: '006', name: 'نقاط بيع', type: 'asset', group: 'bank' },
  { id: 'core-027', code: '027', name: 'إيرادات ميكانيك', type: 'revenue', group: 'revenue' },
  { id: 'core-028', code: '028', name: 'إيرادات توضيب', type: 'revenue', group: 'revenue' },
  { id: 'core-030', code: '030', name: 'تكلفة مبيعات', type: 'expense', group: 'expenses' },
  { id: 'core-2101', code: '2101', name: 'ذمم الموردين', type: 'liability', group: 'suppliers' },
];

const normalize = (text) => String(text || '').toLowerCase().trim();

const inferAccountGroup = (acc) => {
  const explicitGroup = normalize(acc?.group);
  if (explicitGroup) return explicitGroup;

  const code = String(acc?.code || '').trim();
  const name = normalize(acc?.name || acc?.name_ar);
  const type = normalize(acc?.type);

  if (code === '003') return 'cash';
  if (code === '004' || code === '006') return 'bank';
  if (name.includes('عميل') || code === '005') return 'customers';
  if (name.includes('مورد') || code.startsWith('21')) return 'suppliers';
  if (name.includes('مخزون')) return 'inventory';
  if (name.includes('مشتريات')) return 'purchase_expenses';
  if (type === 'revenue' || type === 'income') return 'revenue';
  if (type === 'expense' || type === 'cost') return 'expenses';

  return explicitGroup || 'other';
};

export default function SmartAccountSelect({
  entryType,
  lineType,
  description = '',
  operationType = 'sale',
  fieldKey = 'debit',
  value = '',
  onChange,
  placeholder = 'اختر حساباً...',
  className = '',
  includeAll = false,
  allAccounts = null,
  recentAccounts = [],
  favoriteAccounts = [],
  compact = false,
  'data-testid': testId,
}) {
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  const resolvedEntryType = entryType || operationType || 'general';
  const resolvedLineType = lineType || fieldKey || 'debit';
  const selectedCode = typeof value === 'string' ? value : value?.code || '';

  useEffect(() => {
    const onDocClick = (e) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (Array.isArray(allAccounts) && allAccounts.length > 0) {
      setAccounts(allAccounts);
      return;
    }

    setLoading(true);
    axios
      .get(`${API}/api/smart-accounting/accounts`, {
        params: { operation_type: resolvedEntryType, field_key: resolvedLineType, include_all: includeAll },
      })
      .then((r) => setAccounts(r.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [allAccounts, resolvedEntryType, resolvedLineType, includeAll]);

  const descriptionSuggestion = useMemo(() => {
    const desc = normalize(description);
    if (!desc) return null;
    return DESCRIPTION_KEYWORDS_MAP.find((rule) => rule.keywords.some((kw) => desc.includes(normalize(kw)))) || null;
  }, [description]);

  const normalizedAccounts = useMemo(
    () =>
      ((accounts && accounts.length > 0) ? accounts : CORE_FALLBACK_ACCOUNTS).map((acc) => ({
        ...acc,
        group: inferAccountGroup(acc),
        normalized_name: normalize(acc?.name || acc?.name_ar),
      })),
    [accounts]
  );

  const filtered = useMemo(() => {
    const allowedGroups = ENTRY_ALLOWED_GROUPS[resolvedEntryType] || ENTRY_ALLOWED_GROUPS.general;
    const keyword = normalize(search);

    return normalizedAccounts.filter((acc) => {
      if (!includeAll && !allowedGroups.includes('all') && !allowedGroups.includes(acc.group)) {
        return false;
      }

      const defaultSide = GROUP_DEFAULT_SIDE[acc.group];
      if (!includeAll && resolvedEntryType !== 'general' && defaultSide && defaultSide !== resolvedLineType) {
        return false;
      }

      if (!keyword) return true;
      const inCode = normalize(acc.code).includes(keyword);
      const inName = acc.normalized_name.includes(keyword);
      return inCode || inName;
    });
  }, [normalizedAccounts, search, resolvedEntryType, resolvedLineType, includeAll]);

  const favoriteIds = useMemo(
    () => new Set((favoriteAccounts || []).map((a) => String(a?.id || a?.code || ''))),
    [favoriteAccounts]
  );

  const recentIds = useMemo(() => {
    const ids = (recentAccounts || []).map((a) => String(a?.id || a?.code || ''));
    const fromBackend = filtered.filter((a) => a.recently_used).map((a) => String(a?.id || a?.code || ''));
    return new Set([...ids, ...fromBackend]);
  }, [recentAccounts, filtered]);

  const suggestedIds = useMemo(() => {
    if (!descriptionSuggestion) return new Set();
    return new Set(
      filtered
        .filter((acc) => !descriptionSuggestion.suggestedGroup || acc.group === descriptionSuggestion.suggestedGroup)
        .map((acc) => String(acc.id || acc.code))
    );
  }, [filtered, descriptionSuggestion]);

  const groupedOptions = useMemo(() => {
    const suggested = [];
    const favorites = [];
    const recents = [];
    const others = [];

    filtered.forEach((acc) => {
      const key = String(acc.id || acc.code);
      if (suggestedIds.has(key)) {
        suggested.push(acc);
      } else if (favoriteIds.has(key)) {
        favorites.push(acc);
      } else if (recentIds.has(key)) {
        recents.push(acc);
      } else {
        others.push(acc);
      }
    });

    return {
      suggested,
      favorites,
      recents,
      others,
    };
  }, [filtered, suggestedIds, favoriteIds, recentIds]);

  const selectedAcc = normalizedAccounts.find((a) => a.code === selectedCode || a.id === selectedCode);
  const selectedLabel = selectedAcc
    ? `[${selectedAcc.code}] ${selectedAcc.name || selectedAcc.name_ar}`
    : selectedCode
      ? `[${selectedCode}]`
      : placeholder;

  const emitChange = (acc) => {
    if (typeof onChange !== 'function') return;

    if (onChange.length <= 1) {
      onChange(acc || null);
      return;
    }

    onChange(acc ? acc.code : '', acc || null);
  };

  const handleSelect = (acc) => {
    if (!acc) {
      emitChange(null);
      setOpen(false);
      return;
    }

    axios
      .post(`${API}/api/smart-accounting/accounts/track-usage`, {
        field_key: resolvedLineType,
        account_code: acc.code,
        operation_type: resolvedEntryType,
      })
      .catch(() => {});

    emitChange(acc);
    setOpen(false);
  };

  const baseTestId = testId || 'smart-account-select';

  const renderSection = (label, items, sectionId, limit = null) => {
    if (!items || items.length === 0) return null;
    const list = Number.isInteger(limit) ? items.slice(0, limit) : items;

    return (
      <div data-testid={`${baseTestId}-${sectionId}-section`}>
        <div className="px-2.5 py-1 text-[10px] text-sky-400 font-semibold border-b border-white/5">{label}</div>
        {list.map((acc) => {
          const accKey = String(acc.id || acc.code);
          const isSelected = acc.code === selectedCode || acc.id === selectedCode;
          return (
            <button
              key={`${sectionId}-${accKey}`}
              type="button"
              onClick={() => handleSelect(acc)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-right transition-colors hover:bg-sky-500/10"
              style={{
                color: isSelected ? 'rgba(56,189,248,0.95)' : 'rgba(226,232,240,0.85)',
                background: isSelected ? 'rgba(56,189,248,0.08)' : undefined,
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
              data-testid={`${baseTestId}-option-${acc.code}`}
            >
              <span className="truncate max-w-[65%]">{acc.name || acc.name_ar}</span>
              <div className="flex items-center gap-1.5">
                {recentIds.has(accKey) && <span className="text-[9px] bg-sky-500/20 text-sky-400 px-1 rounded">★</span>}
                <span className="text-slate-500 font-mono">{acc.code}</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`} dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between rounded-xl text-right transition-colors ${compact ? 'px-2.5 py-1.5 text-xs md:text-sm' : 'px-3 py-2 text-xs md:text-sm'}`}
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${selectedCode ? 'rgba(56,189,248,0.4)' : 'rgba(148,163,184,0.2)'}`,
          color: selectedCode ? 'rgba(248,250,252,0.95)' : 'rgba(148,163,184,0.7)',
        }}
        data-testid={baseTestId}
      >
        <span className="truncate max-w-[84%]">
          {loading ? 'جارٍ التحميل...' : selectedLabel}
        </span>
        <span className="text-slate-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>

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
          data-testid={`${baseTestId}-dropdown`}
        >
          <div className="sticky top-0 px-2 pt-2 pb-1" style={{ background: 'rgba(6,10,30,0.98)' }}>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم أو كود..."
              className="w-full rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              data-testid={`${baseTestId}-search`}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-500 text-center">لا توجد نتائج</div>
          ) : (
            <>
              {renderSection('مقترح من الوصف', groupedOptions.suggested, 'suggested', 3)}
              {renderSection('المفضلة', groupedOptions.favorites, 'favorites')}
              {renderSection('الأخيرة', groupedOptions.recents, 'recents')}
              {renderSection('كل الحسابات المتاحة', groupedOptions.others, 'all')}
            </>
          )}
        </div>
      )}

      {resolvedEntryType === 'general' && selectedAcc && GROUP_DEFAULT_SIDE[selectedAcc.group] && GROUP_DEFAULT_SIDE[selectedAcc.group] !== resolvedLineType && (
        <p className="text-[11px] text-amber-400 mt-1" data-testid={`${baseTestId}-side-warning`}>
          تنبيه: هذا الحساب غالباً {GROUP_DEFAULT_SIDE[selectedAcc.group] === 'debit' ? 'مدين' : 'دائن'}،
          وتم استخدامه هنا كـ {resolvedLineType === 'debit' ? 'مدين' : 'دائن'}.
        </p>
      )}
    </div>
  );
}
