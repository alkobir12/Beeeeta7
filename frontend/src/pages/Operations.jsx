/* eslint-disable */

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Plus, Trash2, FileText, CreditCard, User, Building2, Car, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../hooks/use-toast';
import GuidanceStepper from '../components/GuidanceStepper';
// Floating assistant disabled: AbuFahad floating chat is injected via Layout
import { financeAPI } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import ConfirmPaymentDialog from '../components/ConfirmPaymentDialog';
import OperationDetailsModal from '../components/OperationDetailsModal';
import OperationCard from '../components/OperationCard';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Operations = () => {
  const { t, i18n } = useTranslation();
  const { themeName } = useTheme();
  const isLight = false; // keep dark/glass look for operations page
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const session = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('session'));
    } catch (e) {
      return null;
    }
  }, []);
  const guidanceEnabled = session?.guidanceEnabled !== false;
  const [selectedOperation, setSelectedOperation] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [saveOpId, setSaveOpId] = useState(null);
  const [deleteOpId, setDeleteOpId] = useState(null);

  const [form, setForm] = useState({ 
    accountId: '', 
    vehicleId: '',
    visitId: '',
    // scope: يحدد هل العملية مرتبطة بمركبة أم عملية عامة للورشة
    scope: 'workshop', // 'vehicle' | 'workshop'
    type: 'purchase', 
    partnerType: 'supplier', 
    partnerName: '', 
    items: [], 
    paymentMethod: 'cash', 
    notes: '',
    // تاريخ العملية (افتراضي اليوم)
    date: new Date().toISOString().split('T')[0],

    paymentReceipt: null,

    // New: For non-UUID account IDs (e.g., acc-1201 from COA), we send both:
    // - accountId: used by UI and persisted in operations table
    // - accountingAccountId: used by backend to build journal entry debit account
    accountingAccountId: ''
  });

  const operationsSteps = useMemo(() => (
    [
      {
        id: 'account',
        title: 'اختيار الحساب والطرف',
        hint: 'اختر الحساب واسم المورد/العميل قبل المتابعة.',
        done: Boolean(form.accountId && form.partnerName),
      },
      {
        id: 'items',
        title: 'إضافة البنود',
        hint: 'أضف البنود والكميات والأسعار بدقة.',
        done: form.items.length > 0,
      },
      {
        id: 'payment',
        title: 'تأكيد السداد',
        hint: 'حدد طريقة السداد أو أرفق إيصالًا إن وجد.',
        done: Boolean(form.paymentMethod),
      },
    ]
  ), [form.accountId, form.partnerName, form.items.length, form.paymentMethod]);

  const operationsSubtitle = form.scope === 'workshop'
    ? 'أنت تنشئ عملية يدوية. راجع الحساب والبنود لتجنب الخطأ المالي.'
    : 'اتبع الخطوات التالية لإكمال العملية بدقة.';
  const [item, setItem] = useState({ 
    itemType: 'part', 
    itemId: '', 
    name: '', 
    quantity: 1, 
    price: 0 
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const vehicleIdFromUrl = searchParams.get('vehicleId');
  const vehiclePlateFromUrl = searchParams.get('plate');
  const workshopId = process.env.REACT_APP_WORKSHOP_ID;

  const accountsQuery = useQuery({
    queryKey: ['chart-of-accounts', workshopId],
    queryFn: async () => {
      const chartAccRes = await financeAPI.getChartOfAccounts();
      let accountsData = [];
      if (chartAccRes?.data) {
        if (chartAccRes.data.success && Array.isArray(chartAccRes.data.data)) {
          accountsData = chartAccRes.data.data;
        } else if (Array.isArray(chartAccRes.data.data)) {
          accountsData = chartAccRes.data.data;
        } else if (Array.isArray(chartAccRes.data)) {
          accountsData = chartAccRes.data;
        } else if (chartAccRes.data.accounts && Array.isArray(chartAccRes.data.accounts)) {
          accountsData = chartAccRes.data.accounts;
        }
      }
      return accountsData || [];
    }
  });

  const partsQuery = useQuery({
    queryKey: ['parts'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/parts`);
      return res.data || [];
    }
  });

  const servicesQuery = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/services`);
      return res.data || [];
    }
  });

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/vehicles`);
      return res.data || [];
    }
  });

  const operationsQuery = useQuery({
    queryKey: ['operations', vehicleIdFromUrl || 'all'],
    queryFn: async () => {
      const operationsUrl = vehicleIdFromUrl 
        ? `${API_URL}/operations?vehicle_id=${vehicleIdFromUrl}` 
        : `${API_URL}/operations`;
      const res = await axios.get(operationsUrl);
      return res.data || [];
    }
  });

  const updateOperationMutation = useMutation({
    mutationFn: async ({ opId, payload }) => {
      const res = await axios.put(`${API_URL}/operations/${opId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations', vehicleIdFromUrl || 'all'] });
      toast({
        title: t('common.success'),
        description: t('operations.saved_successfully') || 'تم حفظ العملية',
      });
    },
    onError: (e) => {
      const detail = e?.response?.data?.detail || e?.message;
      toast({
        title: t('common.error'),
        description: detail || t('operations.save_failed') || 'فشل حفظ العملية',
        variant: 'destructive',
      });
    },
  });

  const activeVehicleId = form.scope === 'vehicle'
    ? (form.vehicleId || vehicleIdFromUrl)
    : '';

  const visitsQuery = useQuery({
    queryKey: ['vehicle-visits', activeVehicleId || 'none'],
    queryFn: async () => {
      if (!activeVehicleId) return [];
      const res = await axios.get(`${API_URL}/vehicles/${activeVehicleId}/visits`);
      return res.data || [];
    },
    enabled: Boolean(activeVehicleId)
  });

  const accounts = accountsQuery.data || [];
  const parts = partsQuery.data || [];
  const services = servicesQuery.data || [];
  const vehicles = vehiclesQuery.data || [];
  const ops = operationsQuery.data || [];
  const visits = visitsQuery.data || [];

  useEffect(() => {
    if (vehicleIdFromUrl) {
      setForm(prev => ({ 
        ...prev, 
        scope: 'vehicle',
        vehicleId: vehicleIdFromUrl 
      }));
    }
  }, [vehicleIdFromUrl]);

  useEffect(() => {
    if (!visits.length || form.visitId) return;
    const activeVisit = visits.find(v => v.status === 'in_progress');
    if (activeVisit) {
      setForm(prev => ({ ...prev, visitId: activeVisit.id }));
    }
  }, [visits, form.visitId]);

  const addItem = () => {
    if (!item.name && !item.itemId) return;
    const total = Number(item.quantity) * Number(item.price);
    setForm(prev => ({ ...prev, items: [...prev.items, { ...item, total }] }));
    setItem({ itemType: 'part', itemId: '', name: '', quantity: 1, price: 0 });
  };

  const createOperationMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await axios.post(`${API_URL}/operations`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations', vehicleIdFromUrl || 'all'] });
      toast({
        title: t('common.success'),
        description: t('operations.saved_successfully') || 'تم حفظ العملية',
      });
    },
    onError: (e) => {
      const detail = e?.response?.data?.detail || e?.message;
      toast({
        title: t('common.error'),
        description: detail || t('operations.save_failed') || 'فشل حفظ العملية',
        variant: 'destructive',
      });
    },
  });


  const handleUpdateOperationItems = async (opId, items) => {
    try {
      setSaveOpId(opId);
      const current = ops.find((o) => o.id === opId) || {};
      const payload = {
        ...current,
        items,
        // ensure backend recomputes total
        workshopId: workshopId || null,
      };
      await updateOperationMutation.mutateAsync({ opId, payload });
      return true;
    } catch (e) {
      return false;
    } finally {
      setSaveOpId(null);
    }
  };

  const handleDeleteOperation = async (op) => {
    if (!op?.id) return;
    if (!window.confirm(t('common.confirm_delete') || t('common.confirmDelete') || 'هل أنت متأكد من الحذف؟')) return;
    try {
      setDeleteOpId(op.id);
      await axios.delete(`${API_URL}/operations/${op.id}`);
      queryClient.invalidateQueries({ queryKey: ['operations', vehicleIdFromUrl || 'all'] });
    } catch (e) {
      console.error('Failed to delete operation:', e);
    } finally {
      setDeleteOpId(null);
    }
  };

  const submit = async (e) => {
    e.preventDefault();

    // Validate required fields for vehicle-linked operations
    if (form.scope === 'vehicle' && !activeVehicleId) {
      toast({
        title: t('common.error'),
        description: t('operations.select_vehicle_required') || 'اختر مركبة أولاً',
        variant: 'destructive',
      });
      return;
    }

    try {
      const cleanPayload = {
        ...form,
        workshopId: workshopId || null,
        accountId: form.accountId || null,
        accountingAccountId: form.accountId || null,
        opDate: form.date,
        vehicleId: form.scope === 'workshop' ? null : (activeVehicleId || null),
        visitId: form.scope === 'workshop' ? null : (form.visitId || null),

        // NOTE: avoid sending File objects in JSON payload
        paymentReceipt: null,
      };

      await createOperationMutation.mutateAsync(cleanPayload);

      setForm({
        accountId: '',
        vehicleId: vehicleIdFromUrl || '',
        visitId: '',
        scope: vehicleIdFromUrl ? 'vehicle' : 'workshop',
        type: 'purchase',
        partnerType: 'supplier',
        partnerName: '',
        items: [],
        paymentMethod: 'cash',
        notes: '',
        date: new Date().toISOString().split('T')[0],
        paymentReceipt: null,
        accountingAccountId: ''
      });
    } catch (e) {
      console.error('Failed to save operation:', e);
    }
  };

  const subtotal = form.items.reduce((s, it) => s + Number(it.total || 0), 0);

  // Theme-based styles (align with dashboard glass look)
  const styles = {
    bg: 'transparent',
    cardBg: isLight ? '#ffffff' : 'rgba(255,255,255,0.06)',
    cardBorder: isLight ? '#e2e8f0' : 'rgba(168,85,247,0.18)',
    textPrimary: isLight ? '#1e293b' : '#f8fafc',
    textSecondary: isLight ? '#64748b' : 'rgba(226,232,240,0.78)',
    textMuted: isLight ? '#94a3b8' : 'rgba(148,163,184,0.82)',
    inputBg: isLight ? '#ffffff' : 'rgba(255,255,255,0.06)',
    inputBorder: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.10)',
    hoverBg: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.08)',
    tableBg: isLight ? '#f8fafc' : 'rgba(2,6,23,0.35)',
  };

  return (
    <div 
      className={`max-w-7xl mx-auto space-y-8 p-2 sm:p-4 min-h-screen ${isRTL ? 'rtl' : 'ltr'}`} 
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ backgroundColor: styles.bg }}
    >
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: styles.textPrimary }}>{t('operations.title')}</h1>
          <p className="mt-1 text-sm sm:text-base" style={{ color: styles.textSecondary }}>{t('operations.subtitle')}</p>
        </div>

        <div className="mt-6" data-testid="operations-guidance-stepper">
          <GuidanceStepper
            title="إرشادات صفحة العمليات"
            subtitle={operationsSubtitle}
            steps={operationsSteps}
            enabled={guidanceEnabled}
            storageKey={`guidance-operations-${session?.id || session?.name || 'default'}`}
          />
        </div>

        {/* Create Operation Card */}
        <div 
          className="rounded-[32px] p-5 sm:p-6"
          style={{ 
            backgroundColor: styles.cardBg,
            border: `1px solid ${styles.cardBorder}`,
            boxShadow: '0 18px 60px rgba(2,6,23,0.55)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)'
          }}
        >
          <div className="flex items-center gap-3 mb-6 pb-4" style={{ borderBottom: `1px solid ${styles.cardBorder}` }}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-md">
              <Plus size={20} className="text-white" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold" style={{ color: styles.textPrimary }}>{t('operations.new_operation')}</h2>
          </div>

          <form onSubmit={submit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* تصنيف العملية: مركبة / ورشة عامة */}
              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>{t('operations.scopeLabel')}</label>
                <div className="relative">
                  <FileText className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <select
                    className="apple-input pr-10"
                    value={form.scope}
                    onChange={(e) => {
                      const scope = e.target.value;
                      setForm(prev => ({
                        ...prev,
                        scope,
                        // إذا كانت عملية ورشة، نجعل المركبة والزيارة اختيارية
                        vehicleId: scope === 'workshop' ? '' : prev.vehicleId,
                        visitId: scope === 'workshop' ? '' : prev.visitId,
                      }));
                    }}
                    data-testid="operation-scope-select"
                  >
                    <option value="vehicle">{t('operations.scopeVehicle')}</option>
                    <option value="workshop">{t('operations.scopeWorkshop')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>{t('operations.account')}</label>
                <div className="relative">
                  <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <select 
                    className="apple-input pr-10"
                    value={form.accountId} 
                    onChange={e => setForm({ ...form, accountId: e.target.value })}
                    data-testid="operation-account-select"
                  >
                    <option value="">{t('operations.select_account')}</option>
                    {/* 🔧 الإصلاح: تحقق من أن accounts مصفوفة قبل استخدام .map() */}
                    {Array.isArray(accounts) ? (
                      accounts.length > 0 ? (
                        accounts.map(a => (
                          <option key={a.id || a.code} value={a.id || a.code}>
                            {a.name_ar || a.name || a.code}
                          </option>
                        ))
                      ) : (
                        <option value="">{t('operations.no_accounts')}</option>
                      )
                    ) : (
                      <option value="">{t('operations.loading_accounts')}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* اختيار المركبة (يظهر فقط عندما يكون التصنيف = مركبة) */}
              {form.scope === 'vehicle' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>{t('operations.vehicle')}</label>
                  <div className="relative">
                    <Car className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select 
                      className="apple-input pr-10"
                      value={form.vehicleId} 
                    onChange={(e) => {
                        const vehicleId = e.target.value;
                        setForm({ ...form, vehicleId, visitId: '' });
                      }}
                      data-testid="operation-vehicle-select"
                    >
                      <option value="">{t('operations.select_vehicle')}...</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.plateNumber} - {v.brand} {v.model}
                        </option>
                      ))}
                                  </select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>{t('operations.operationDateLabel')}</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="apple-input"
                />
              </div>

              {/* زيارة المركبة / التاريخ (أيضًا فقط في حالة مركبة) */}
              {form.scope === 'vehicle' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>{t('operations.date')}</label>
                  <div className="relative">
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select 
                      className="apple-input pr-10"
                      value={form.visitId || ''} 
                      onChange={e => setForm({ ...form, visitId: e.target.value })}
                      disabled={!form.vehicleId}
                      data-testid="operation-visit-select"
                    >
                      <option value="">---</option>
                      {visits.map(v => (
                        <option key={v.id} value={v.id}>
                          {new Date(v.entryDate || v.entry_date).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')} 
                          {v.status === 'in_progress' ? ` (${t('status.in_progress')})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>{t('operations.operation_type')}</label>
                <div className="relative">
                  <FileText className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <select 
                    className="apple-input pr-10"
                    value={form.type} 
                    onChange={e => setForm({ ...form, type: e.target.value, partnerType: e.target.value === 'purchase' ? 'supplier' : 'customer' })}
                    data-testid="operation-type-select"
                  >
                    <option value="purchase">{t('operations.purchase')}</option>
                    <option value="sale">{t('operations.sale')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                {/* TODO: يمكن لاحقًا توحيد هذا القسم أو إزالته إذا أصبح مكررًا مع حقل الحساب في الأعلى */}
                <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>{t('operations.account')}</label>
                <div className="relative">
                  <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <select 
                    className="apple-input pr-10"
                    value={form.accountId || ''} 
                    onChange={e => setForm({ ...form, accountId: e.target.value })}
                    data-testid="operation-secondary-account-select"
                  >
                    <option value="">{t('operations.selectAccount')}</option>
                    {Array.isArray(accounts) ? accounts.filter(acc => 
                      !acc.parent_id && !acc.parentId
                    ).map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.code})
                      </option>
                    )) : null}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>
                  {form.partnerType === 'supplier' ? t('operations.supplierName') : t('operations.customerName')}
                </label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    className="apple-input pr-10"
                    placeholder={t('operations.customName')} 
                    value={form.partnerName} 
                    onChange={e => setForm({ ...form, partnerName: e.target.value })} 
                    data-testid="operation-partner-name-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>{t('operations.paymentMethod')}</label>
                <div className="relative">
                  <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <select 
                    className="apple-input pr-10"
                    value={form.paymentMethod} 
                    onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                    data-testid="operation-payment-method-select"
                  >
                    <option value="cash">{t('operations.cash')}</option>
                    <option value="card">{t('operations.card')}</option>
                    <option value="transfer">{t('operations.transfer')}</option>
                    <option value="credit">{t('operations.credit')}</option>
                  </select>
                </div>
              </div>

              {/* رفع إيصال الدفع */}
              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>
                  📎 {t('operations.payment_receipt_optional')}
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setForm({ ...form, paymentReceipt: file });
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{
                    backgroundColor: styles.inputBg,
                    borderColor: styles.inputBorder,
                    color: styles.textPrimary,
                  }}
                  data-testid="operation-payment-receipt-input"
                />
                {form.paymentReceipt && (
                  <p className="text-xs" style={{ color: 'rgba(34,197,94,0.95)' }}>✓ {form.paymentReceipt.name}</p>
                )}
              </div>
            </div>

            {/* Items Section */}
            <div className="rounded-2xl p-4 border" style={{ backgroundColor: styles.tableBg, borderColor: styles.cardBorder }}>
              <label className="block text-sm font-semibold mb-4" style={{ color: styles.textPrimary }}>{t('operations.addItems')}</label>
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mb-4">
                <div className="md:col-span-2">
                  <label className="text-xs mb-1 block" style={{ color: styles.textMuted }}>{t('operations.itemType')}</label>
                  <select 
                    className="apple-input h-9 text-sm"
                    value={item.itemType} 
                    onChange={e=>setItem({...item, itemType: e.target.value})}
                    data-testid="operation-item-type-select"
                  >
                    <option value="part">{t('operations.part')}</option>
                    <option value="service">{t('operations.service')}</option>
                  </select>
                </div>
                
                <div className="md:col-span-4">
                  <label className="text-xs mb-1 block" style={{ color: styles.textMuted }}>{t('operations.items')}</label>
                  {item.itemType === 'part' ? (
                    <select 
                      className="apple-input h-9 text-sm"
                      value={item.itemId} 
                      onChange={e => { 
                        const it = parts.find(p=>p.id===e.target.value); 
                        setItem({...item, itemId: e.target.value, name: it?.name || '', price: it?.sellingPrice || 0}); 
                      }}
                      data-testid="operation-part-select"
                    >
                      <option value="">{t('operations.selectPart')}</option>
                      {parts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  ) : (
                    <select 
                      className="apple-input h-9 text-sm"
                      value={item.itemId} 
                      onChange={e => { 
                        const s = services.find(s=>s.id===e.target.value); 
                        setItem({...item, itemId: e.target.value, name: s?.name || '', price: s?.price || 0}); 
                      }}
                      data-testid="operation-service-select"
                    >
                      <option value="">{t('operations.selectService')}</option>
                      {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs mb-1 block" style={{ color: styles.textMuted }}>{t('operations.quantity')}</label>
                  <input 
                    type="number" 
                    className="apple-input h-9 text-sm"
                    value={item.quantity} 
                    onChange={e=> setItem({...item, quantity: Number(e.target.value) || 0})} 
                    data-testid="operation-item-quantity-input"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs mb-1 block" style={{ color: styles.textMuted }}>{t('operations.price')}</label>
                  <input 
                    type="number" 
                    className="apple-input h-9 text-sm"
                    value={item.price} 
                    onChange={e=> setItem({...item, price: Number(e.target.value) || 0})} 
                    data-testid="operation-item-price-input"
                  />
                </div>

                <div className="md:col-span-2">
                  <button 
                    type="button" 
                    onClick={addItem}
                    className="apple-button w-full h-9 flex items-center justify-center gap-1"
                    data-testid="operation-add-item-button"
                  >
                    <Plus size={16} />
                    <span>{t('operations.addItem')}</span>
                  </button>
                </div>
              </div>

              {/* Items Table */}
              {form.items.length > 0 && (
                <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: styles.cardBg, borderColor: styles.cardBorder }}>
                  <table className="w-full text-sm">
                    <thead style={{ backgroundColor: styles.tableBg, color: styles.textSecondary }}>
                      <tr>
                        <th className="p-3 text-right font-medium">{t('operations.itemType')}</th>
                        <th className="p-3 text-right font-medium">{t('operations.itemName')}</th>
                        <th className="p-3 text-right font-medium">{t('operations.qty')}</th>
                        <th className="p-3 text-right font-medium">{t('operations.price')}</th>
                        <th className="p-3 text-right font-medium">{t('operations.total')}</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'rgba(148,163,184,0.14)' }}>
                      {form.items.map((it, idx)=> (
                        <tr key={idx}>
                          <td className="p-3" style={{ color: styles.textSecondary }}>{it.itemType==='part'? t('operations.part') : t('operations.service')}</td>
                          <td className="p-3 font-medium" style={{ color: styles.textPrimary }}>{it.name}</td>
                          <td className="p-3" style={{ color: styles.textSecondary }}>{it.quantity}</td>
                          <td className="p-3" style={{ color: styles.textSecondary }}>{it.price}</td>
                          <td className="p-3 font-medium" style={{ color: styles.textPrimary }}>{(Number(it.quantity)*Number(it.price)).toFixed(2)}</td>
                          <td className="p-3 text-left">
                            <button 
                              type="button"
                              onClick={() => {
                                const newItems = [...form.items];
                                newItems.splice(idx, 1);
                                setForm({...form, items: newItems});
                              }}
                              className="text-rose-200 hover:text-rose-100 p-1"
                              data-testid={`operation-remove-item-button-${idx}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="font-bold" style={{ backgroundColor: styles.tableBg, color: styles.textPrimary }}>
                      <tr>
                        <td colSpan="4" className="p-3 text-left">{t('operations.total')}:</td>
                        <td className="p-3" style={{ color: '#93c5fd' }}>{subtotal.toFixed(2)} {t('operations.SAR')}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="flex flex-col items-end pt-4 gap-2">
              <button 
                type="submit" 
                disabled={form.items.length === 0 || (form.scope === 'vehicle' && !activeVehicleId)}
                className="apple-button w-full sm:w-auto px-8 py-2 text-base"
                data-testid="operation-save-button"
              >
                {t('operations.submit')}
              </button>

              {form.items.length === 0 && (
                <div className="text-xs text-slate-500">{t('operations.items_required') || 'أضف عنصر واحد على الأقل قبل الحفظ'}</div>
              )}

              {form.scope === 'vehicle' && !activeVehicleId && (
                <div className="text-xs text-slate-500">{t('operations.select_vehicle_required') || 'اختر مركبة أولاً'}</div>
              )}
            </div>
          </form>
        </div>

        {/* Recent Operations */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-50">{t('operations.recentOperations')}</h2>
              <p className="text-sm text-slate-200/70 mt-1">{t('operations.subtitle') || ''}</p>
            </div>
          </div>

          {ops.length === 0 ? (
            <div className="apple-card p-6 text-center">
              <div className="text-sm text-slate-500">{t('operations.noOperations') || t('common.no_data') || '-'}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {ops.map((op) => (
                <OperationCard
                  key={op.id}
                  operation={op}
                  isRTL={isRTL}
                  t={t}
                  accounts={accounts}
                  isSaving={saveOpId === op.id}
                  isDeleting={deleteOpId === op.id}
                  onPrint={(o) => {
                    if (!o?.id) return;
                    navigate(`/print?type=invoice&operationId=${o.id}`);
                  }}
                  onViewVehicle={(o) => {
                    if (!o?.vehicleId) return;
                    navigate(`/vehicle/${o.vehicleId}`);
                  }}
                  onConfirmCreditPayment={(o) => {
                    setConfirmTarget(o);
                    setConfirmOpen(true);
                  }}
                  onDelete={(o) => handleDeleteOperation(o)}
                  onUpdateItems={(opId, items) => handleUpdateOperationItems(opId, items)}
                />
              ))}
            </div>
          )}
        </div>

        <OperationDetailsModal
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          operation={selectedOperation}
          accounts={accounts}
          t={(k) => {
            // small adapter to reuse existing translations
            if (k === 'operations.from_to') return t('operations_ui.from_to');
            if (k === 'operations.notes') return t('operations_ui.notes');
            return t(k);
          }}
          isRTL={isRTL}
          onPrint={() => {
            if (!selectedOperation?.id) return;
            navigate(`/print?type=invoice&operationId=${selectedOperation.id}`);
          }}
          onViewVehicle={() => {
            if (!selectedOperation?.vehicleId) return;
            navigate(`/vehicle/${selectedOperation.vehicleId}`);
          }}
          onDelete={async () => {
            if (!selectedOperation?.id) return;
            await handleDeleteOperation(selectedOperation);
            setDetailsOpen(false);
            setSelectedOperation(null);
          }}
        />
      
      {/* أبوفهد (المساعد المالي) أصبح عبر الزر العائم الموحد */}

      <ConfirmPaymentDialog
        open={confirmOpen}
        onOpenChange={(v) => {
          setConfirmOpen(v);
          if (!v) setConfirmTarget(null);
        }}
        onConfirm={async ({ amount, date }) => {
          if (!confirmTarget?.id) return;
          try {
            await axios.post(`${API_URL}/operations/${confirmTarget.id}/confirm-payment`, {
              workshopId: workshopId || null,
              amount,
              date,
            });
            setConfirmOpen(false);
            setConfirmTarget(null);
            queryClient.invalidateQueries({ queryKey: ['operations', vehicleIdFromUrl || 'all'] });
          } catch (e) {
            console.error('Failed to confirm payment:', e);
            alert(t('operations.payment_confirm_failed'));
          }
        }}
      />
      <span data-testid="confirm-open-state" className="hidden">{confirmOpen ? 'open' : 'closed'}</span>

    </div>
  );
};

export default Operations;
