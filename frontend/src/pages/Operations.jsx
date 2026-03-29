/* eslint-disable */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Plus, Trash2, FileText, CreditCard, User, Building2, Car, Clock, Camera, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../hooks/use-toast';
import GuidanceStepper from '../components/GuidanceStepper';
// Floating assistant disabled: AbuFahad floating chat is injected via Layout
import { financeAPI } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import ConfirmPaymentDialog from '../components/ConfirmPaymentDialog';
import OperationDetailsModal from '../components/OperationDetailsModal';
import OperationCard from '../components/OperationCard';
import OperationDeleteConfirmDialog from '../components/OperationDeleteConfirmDialog';
import QuickPrintDialog from '../components/QuickPrintDialog';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveBackendBase } from '../utils/backendBase';

const API_URL = `${resolveBackendBase()}/api`;
const OPERATIONS_PAGE_SIZE = 15;
const OPERATION_KIND_WORKSHOP = 'WORKSHOP_OPERATION';
const OPERATION_KIND_VEHICLE = 'VEHICLE_OPERATION';
const OPERATION_KIND_RAKAN = 'RAKAN_PARTS_OPERATION';
const RAKAN_ACCOUNT_CODE_PREFIX = '5000';

const OPERATION_KIND_LABELS = {
  [OPERATION_KIND_WORKSHOP]: 'عملية ورشة',
  [OPERATION_KIND_VEHICLE]: 'عملية مركبة',
  [OPERATION_KIND_RAKAN]: 'عملية قطع راكان',
};

const RAKAN_ACCOUNT_KEYWORDS = ['راكان', 'rakan'];

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const normalizeAccountCode = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('acc-') && /^acc-\d+$/.test(raw)) return raw.replace('acc-', '');
  return raw;
};

const isRakanCode = (value) => normalizeAccountCode(value).startsWith(RAKAN_ACCOUNT_CODE_PREFIX);

const isRakanBusinessAccount = (account) => {
  const haystack = [account?.name, account?.code].map((v) => normalizeText(v)).join(' ');
  return isRakanCode(account?.code) || RAKAN_ACCOUNT_KEYWORDS.some((k) => haystack.includes(k));
};

const isRakanChartAccount = (account) => {
  if (isRakanCode(account?.code)) return true;
  const haystack = [account?.name_ar, account?.name, account?.code, account?.category]
    .map((v) => normalizeText(v))
    .join(' ');
  return RAKAN_ACCOUNT_KEYWORDS.some((k) => haystack.includes(k));
};

const isRakanOperationTagged = (operation = {}) => {
  const scope = normalizeText(operation.scope);
  const source = normalizeText(operation.source);
  const businessUnit = normalizeText(operation.businessUnit || operation.business_unit);
  const notes = normalizeText(operation.notes);
  return (
    scope === 'rakan_parts' ||
    source === 'rakan_parts_pos' ||
    businessUnit === 'rakan_parts' ||
    notes.includes('[rakan_parts]') ||
    notes.includes('account_code:5000')
  );
};

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
  const [isSaving, setIsSaving] = useState(false);
  const lastSubmitRef = useRef({ hash: '', timestamp: 0 });

  const [createError, setCreateError] = useState('');

  const [form, setForm] = useState({ 
    accountId: '', 
    accountingAccountId: '',
    operationKind: OPERATION_KIND_WORKSHOP,
    vehicleId: '',
    visitId: '',
    // scope: يحدد هل العملية مرتبطة بمركبة أم عملية عامة للورشة
    scope: 'workshop', // 'vehicle' | 'workshop'
    type: 'purchase', 
    partnerType: 'supplier', 
    partnerId: '',
    partnerName: '', 
    partnerPhone: '',
    items: [], 
    paymentMethod: 'cash', 
    paymentStatus: 'paid',
    status: 'issued',
    invoiceNumber: '',
    notes: '',
    // تاريخ العملية (افتراضي اليوم)
    date: new Date().toISOString().split('T')[0],

    paymentReceipt: null,
  });

  const operationsSteps = useMemo(() => (
    [
      {
        id: 'account',
        title: 'اختيار الحساب والطرف',
        hint: 'اختر الحساب واسم المورد/العميل قبل المتابعة.',
        done: Boolean(form.accountingAccountId),
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
  ), [form.accountingAccountId, form.items.length, form.paymentMethod]);

  const operationsSubtitle = form.operationKind === OPERATION_KIND_WORKSHOP
    ? 'أنت تنشئ عملية ورشة تشغيلية مستقلة عن المركبات. راجع القيد قبل الحفظ.'
    : form.operationKind === OPERATION_KIND_VEHICLE
      ? 'عملية مرتبطة بمركبة: سيتم ربط العميل تلقائياً من بيانات المركبة.'
      : 'عملية قطع راكان: يجب ربطها بعميل أو مركبة وتُفصل ماليًا عن الورشة.';
  const [item, setItem] = useState({ 
    itemType: 'part', 
    itemId: '', 
    name: '', 
    customName: '',
    quantity: 1, 
    price: 0 
  });

  const [ocrImage, setOcrImage] = useState('');
  const [ocrPreview, setOcrPreview] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrError, setOcrError] = useState('');
  const [ocrInvoiceType, setOcrInvoiceType] = useState(form.type || 'purchase');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [activeOperationsTab, setActiveOperationsTab] = useState('rakan');
  const [rakanPage, setRakanPage] = useState(1);
  const [workshopPage, setWorkshopPage] = useState(1);
  const [expandedOperationId, setExpandedOperationId] = useState(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printDialogConfig, setPrintDialogConfig] = useState(null);

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const vehicleIdFromUrl = searchParams.get('vehicleId');
  const vehiclePlateFromUrl = searchParams.get('plate');
  const workshopId = process.env.REACT_APP_WORKSHOP_ID;
  const freshQueryOptions = {
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 2,
  };

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
    },
    ...freshQueryOptions,
  });

  const partsQuery = useQuery({
    queryKey: ['parts'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/parts`);
      return res.data || [];
    },
    ...freshQueryOptions,
  });

  const servicesQuery = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/services`);
      return res.data || [];
    },
    ...freshQueryOptions,
  });

  const customersQuery = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/customers`);
      return res.data || [];
    },
    ...freshQueryOptions,
  });

  const suppliersQuery = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/suppliers`);
      return res.data || [];
    },
    ...freshQueryOptions,
  });

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/vehicles`);
      return res.data || [];
    },
    ...freshQueryOptions,
  });

  const operationsQuery = useQuery({
    queryKey: ['operations', vehicleIdFromUrl || 'all'],
    queryFn: async () => {
      const operationsUrl = vehicleIdFromUrl 
        ? `${API_URL}/operations?vehicle_id=${vehicleIdFromUrl}` 
        : `${API_URL}/operations`;
      const res = await axios.get(operationsUrl);
      return res.data || [];
    },
    ...freshQueryOptions,
  });

  const bizAccountsQuery = useQuery({
    queryKey: ['biz-accounts'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/biz-accounts`);
      return res.data || [];
    },
    ...freshQueryOptions,
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

  const activeVehicleId = form.operationKind !== OPERATION_KIND_WORKSHOP
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
  const bizAccounts = bizAccountsQuery.data || [];
  const rakanBizAccount = useMemo(
    () => bizAccounts.find((account) => isRakanBusinessAccount(account)) || null,
    [bizAccounts]
  );
  const workshopBizAccount = useMemo(() => {
    const nonRakan = bizAccounts.filter((account) => !isRakanBusinessAccount(account));
    if (!nonRakan.length) return null;
    const preferred = nonRakan.find((account) => {
      const text = `${normalizeText(account.name)} ${normalizeText(account.code)}`;
      return ['main', 'الرئيس', 'الرئيسي', 'workshop', 'default'].some((k) => text.includes(k));
    });
    return preferred || nonRakan[0] || null;
  }, [bizAccounts]);

  const selectedBusinessAccount = useMemo(() => {
    if (form.operationKind === OPERATION_KIND_RAKAN) {
      return rakanBizAccount;
    }
    return workshopBizAccount || rakanBizAccount || null;
  }, [form.operationKind, rakanBizAccount, workshopBizAccount]);

  const rakanBizAccountIds = useMemo(
    () => new Set((bizAccounts || []).filter((account) => isRakanBusinessAccount(account)).map((account) => String(account.id || account.code || ''))),
    [bizAccounts]
  );
  const rakanChartAccountIds = useMemo(
    () => new Set((accounts || []).filter((account) => isRakanChartAccount(account)).map((account) => String(account.id || account.code || ''))),
    [accounts]
  );
  const filteredAccounts = accounts.filter((account) => {
    const accountType = String(account?.type || '').toLowerCase();
    if (form.type === 'sale') return accountType === 'revenue';
    if (form.type === 'purchase') return ['expense', 'asset', 'liability'].includes(accountType);
    return true;
  });
  const selectedAccountingAccount = useMemo(
    () => accounts.find((account) => String(account.id || account.code) === String(form.accountingAccountId || '')) || null,
    [accounts, form.accountingAccountId]
  );
  const selectedAccountingCode = normalizeAccountCode(selectedAccountingAccount?.code || form.accountingAccountId || '');
  const isSelectedAccountingRakan = isRakanCode(selectedAccountingCode);
  const parts = partsQuery.data || [];
  const services = servicesQuery.data || [];
  const customers = customersQuery.data || [];
  const suppliers = suppliersQuery.data || [];
  const vehicles = vehiclesQuery.data || [];
  const activeVehicles = vehicles.filter((vehicle) => !['delivered', 'completed', 'finished', 'تم التسليم', 'مكتمل'].includes(vehicle.status));
  const vehicleOptions = activeVehicles.length ? activeVehicles : vehicles;
  const customerVehicles = useMemo(() => {
    if (!form.partnerId) return vehicleOptions;
    const list = vehicleOptions.filter((vehicle) => String(vehicle.customerId || '') === String(form.partnerId || ''));
    return list.length ? list : vehicleOptions;
  }, [vehicleOptions, form.partnerId]);
  const ops = operationsQuery.data || [];
  const visits = visitsQuery.data || [];

  const sortedOps = useMemo(() => {
    const arr = Array.isArray(ops) ? [...ops] : [];
    const getTs = (o) => {
      try {
        return new Date(o.date || o.op_date || o.createdAt || 0).getTime() || 0;
      } catch {
        return 0;
      }
    };
    // Smart order (CEO view): newest first, then higher absolute total
    arr.sort((a, b) => {
      const dt = getTs(b) - getTs(a);
      if (dt !== 0) return dt;
      const at = Math.abs(Number(b.total || 0)) - Math.abs(Number(a.total || 0));
      if (at !== 0) return at;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
    return arr;
  }, [ops]);

  const rakanOps = useMemo(
    () => sortedOps.filter((op) => (
      rakanBizAccountIds.has(String(op.accountId || ''))
      || rakanChartAccountIds.has(String(op.accountingAccountId || op.accountId || ''))
      || isRakanOperationTagged(op)
    )),
    [sortedOps, rakanBizAccountIds, rakanChartAccountIds]
  );

  const workshopOps = useMemo(
    () => sortedOps.filter((op) => !(
      rakanBizAccountIds.has(String(op.accountId || ''))
      || rakanChartAccountIds.has(String(op.accountingAccountId || op.accountId || ''))
      || isRakanOperationTagged(op)
    )),
    [sortedOps, rakanBizAccountIds, rakanChartAccountIds]
  );

  const rakanTotalPages = useMemo(
    () => Math.max(1, Math.ceil(rakanOps.length / OPERATIONS_PAGE_SIZE)),
    [rakanOps.length]
  );

  const workshopTotalPages = useMemo(
    () => Math.max(1, Math.ceil(workshopOps.length / OPERATIONS_PAGE_SIZE)),
    [workshopOps.length]
  );

  useEffect(() => {
    setRakanPage((prev) => Math.min(Math.max(prev, 1), rakanTotalPages));
  }, [rakanTotalPages]);

  useEffect(() => {
    setWorkshopPage((prev) => Math.min(Math.max(prev, 1), workshopTotalPages));
  }, [workshopTotalPages]);

  useEffect(() => {
    setExpandedOperationId(null);
  }, [activeOperationsTab, rakanPage, workshopPage]);

  const paginatedRakanOps = useMemo(() => {
    const start = (rakanPage - 1) * OPERATIONS_PAGE_SIZE;
    return rakanOps.slice(start, start + OPERATIONS_PAGE_SIZE);
  }, [rakanOps, rakanPage]);

  const paginatedWorkshopOps = useMemo(() => {
    const start = (workshopPage - 1) * OPERATIONS_PAGE_SIZE;
    return workshopOps.slice(start, start + OPERATIONS_PAGE_SIZE);
  }, [workshopOps, workshopPage]);

  const isRakanTabActive = activeOperationsTab === 'rakan';
  const activeOps = isRakanTabActive ? paginatedRakanOps : paginatedWorkshopOps;
  const activeOpsTotalCount = isRakanTabActive ? rakanOps.length : workshopOps.length;
  const activePage = isRakanTabActive ? rakanPage : workshopPage;
  const activeTotalPages = isRakanTabActive ? rakanTotalPages : workshopTotalPages;

  const setActivePage = (nextPage) => {
    if (isRakanTabActive) {
      setRakanPage(nextPage);
    } else {
      setWorkshopPage(nextPage);
    }
  };

  const activePageNumbers = useMemo(
    () => Array.from({ length: activeTotalPages }, (_, i) => i + 1),
    [activeTotalPages]
  );

  useEffect(() => {
    if (!expandedOperationId) return;
    const exists = sortedOps.some((op) => op.id === expandedOperationId);
    if (!exists) setExpandedOperationId(null);
  }, [expandedOperationId, sortedOps]);

  useEffect(() => {
    if (!selectedBusinessAccount?.id) return;
    setForm((prev) => {
      if (prev.accountId === selectedBusinessAccount.id) return prev;
      return { ...prev, accountId: selectedBusinessAccount.id };
    });
  }, [selectedBusinessAccount]);

  useEffect(() => {
    if (!filteredAccounts.length) {
      setForm((prev) => ({ ...prev, accountingAccountId: '' }));
      return;
    }
    const exists = filteredAccounts.some((acc) => String(acc.id || acc.code) === String(form.accountingAccountId || ''));
    if (!exists) {
      setForm((prev) => ({ ...prev, accountingAccountId: String(filteredAccounts[0].id || filteredAccounts[0].code || '') }));
    }
  }, [filteredAccounts, form.accountingAccountId]);

  useEffect(() => {
    if (!form.accountingAccountId) return;
    if (isSelectedAccountingRakan && form.operationKind !== OPERATION_KIND_RAKAN) {
      setForm((prev) => ({ ...prev, operationKind: OPERATION_KIND_RAKAN }));
      return;
    }
    if (!isSelectedAccountingRakan && form.operationKind === OPERATION_KIND_RAKAN) {
      setForm((prev) => ({
        ...prev,
        operationKind: prev.vehicleId ? OPERATION_KIND_VEHICLE : OPERATION_KIND_WORKSHOP,
      }));
    }
  }, [form.accountingAccountId, form.operationKind, form.vehicleId, isSelectedAccountingRakan]);

  useEffect(() => {
    if (vehicleIdFromUrl) {
      setForm(prev => ({
        ...prev,
        operationKind: OPERATION_KIND_VEHICLE,
        scope: 'vehicle',
        vehicleId: vehicleIdFromUrl,
      }));
    }
  }, [vehicleIdFromUrl]);

  useEffect(() => {
    if (!form.vehicleId) return;
    const selectedVehicle = vehicleOptions.find((v) => String(v.id) === String(form.vehicleId));
    if (!selectedVehicle) return;

    if (form.operationKind === OPERATION_KIND_VEHICLE || form.operationKind === OPERATION_KIND_RAKAN) {
      setForm((prev) => ({
        ...prev,
        partnerType: 'customer',
        partnerId: selectedVehicle.customerId || prev.partnerId || '',
        partnerName: selectedVehicle.customerName || prev.partnerName || '',
      }));
    }
  }, [form.vehicleId, form.operationKind, vehicleOptions]);

  useEffect(() => {
    if (!form.partnerId) return;
    if (form.operationKind !== OPERATION_KIND_RAKAN) return;
    const customer = customers.find((c) => String(c.id) === String(form.partnerId));
    if (!customer) return;
    setForm((prev) => ({
      ...prev,
      partnerType: 'customer',
      partnerName: customer.name || prev.partnerName,
    }));
  }, [form.partnerId, form.operationKind, customers]);

  useEffect(() => {
    if (vehicleIdFromUrl) {
      return;
    }
    if (form.operationKind === OPERATION_KIND_WORKSHOP) {
      setForm((prev) => ({
        ...prev,
        scope: 'workshop',
        vehicleId: '',
        visitId: '',
        partnerId: prev.type === 'purchase' ? prev.partnerId : '',
        partnerType: prev.type === 'purchase' ? 'supplier' : prev.partnerType,
      }));
    } else if (form.operationKind === OPERATION_KIND_VEHICLE) {
      setForm((prev) => ({
        ...prev,
        scope: 'vehicle',
        partnerType: 'customer',
      }));
    } else if (form.operationKind === OPERATION_KIND_RAKAN) {
      setForm((prev) => ({
        ...prev,
        scope: 'rakan_parts',
        partnerType: 'customer',
      }));
    }
  }, [form.operationKind, vehicleIdFromUrl]);

  useEffect(() => {
    if (!visits.length || form.visitId) return;
    const activeVisit = visits.find(v => v.status === 'in_progress');
    if (activeVisit) {
      setForm(prev => ({ ...prev, visitId: activeVisit.id }));
    }
  }, [visits, form.visitId]);

  useEffect(() => {
    if (form.type === 'sale' || form.type === 'purchase') {
      setOcrInvoiceType(form.type);
    }
  }, [form.type]);

  const createInlineItem = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    try {
      if (item.itemType === 'service') {
        const payload = {
          name: trimmed,
          category: 'خدمات عامة',
          price: Number(item.price) || 0,
          duration: 30,
        };
        const { data } = await axios.post(`${API_URL}/services`, payload);
        servicesQuery.refetch();
        return data;
      }

      const payload = {
        name: trimmed,
        partNumber: `AUTO-${Date.now().toString().slice(-6)}`,
        category: 'عام',
        purchasePrice: form.type === 'purchase' ? Number(item.price) || 0 : 0,
        sellingPrice: form.type === 'sale' ? Number(item.price) || 0 : Number(item.price) || 0,
        quantity: 0,
      };
      const { data } = await axios.post(`${API_URL}/parts`, payload);
      partsQuery.refetch();
      return data;
    } catch (error) {
      toast({ title: 'تعذر حفظ الصنف الجديد', variant: 'destructive' });
      return null;
    }
  };

  const addItem = async () => {
    if (!item.name && !item.itemId && !item.customName) return;
    let itemId = item.itemId;
    let itemName = item.name;

    if (!itemId && item.customName) {
      const created = await createInlineItem(item.customName);
      if (!created) return;
      itemId = created.id;
      itemName = created.name;
    }

    const total = Number(item.quantity) * Number(item.price);
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { ...item, itemId, name: itemName, total }]
    }));
    setItem({ itemType: 'part', itemId: '', name: '', customName: '', quantity: 1, price: 0 });
  };

  const handleCreateCustomer = async () => {
    if (!form.partnerName || !form.partnerPhone) {
      toast({ title: 'يرجى إدخال اسم العميل ورقم الجوال', variant: 'destructive' });
      return;
    }
    try {
      const payload = {
        name: form.partnerName,
        phone: form.partnerPhone,
        email: '',
        address: '',
      };
      const { data } = await axios.post(`${API_URL}/customers`, payload);
      setForm(prev => ({
        ...prev,
        partnerId: data.id,
        partnerName: data.name,
        partnerPhone: data.phone || prev.partnerPhone,
      }));
      customersQuery.refetch();
      toast({ title: 'تمت إضافة العميل بنجاح' });
    } catch (error) {
      toast({ title: 'تعذر إضافة العميل', variant: 'destructive' });
    }
  };

  const handleOcrFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result?.toString() || '';
      setOcrImage(base64);
      setOcrPreview(base64);
      setOcrResult(null);
      setOcrError('');
    };
    reader.readAsDataURL(file);
  };

  const runOcr = async () => {
    if (!ocrImage) return;
    setOcrLoading(true);
    setOcrError('');
    try {
      const { data } = await axios.post(`${API_URL}/parts/ocr`, { image_base64: ocrImage });
      setOcrResult(data);
    } catch (error) {
      setOcrError(error?.response?.data?.detail || 'تعذر قراءة الفاتورة');
    } finally {
      setOcrLoading(false);
    }
  };

  const applyOcrToItems = () => {
    if (!ocrResult?.items?.length) return;
    const itemType = ocrInvoiceType === 'sale' ? 'service' : 'part';
    const mappedItems = ocrResult.items.map((ocrItem) => {
      const qty = Number(ocrItem.quantity || 1);
      const price = Number(ocrItem.unit_price || 0);
      return {
        itemType,
        itemId: ocrItem.part_number || '',
        name: ocrItem.description || ocrItem.part_number || 'بند',
        quantity: qty || 1,
        price: price || 0,
        total: (qty || 1) * (price || 0),
      };
    });
    setForm(prev => ({
      ...prev,
      type: ocrInvoiceType,
      items: mappedItems,
      partnerName: prev.partnerName || ocrResult.vendor || '',
      invoiceNumber: prev.invoiceNumber || ocrResult.invoice_number || ''
    }));
  };

  const getErrorMessage = (e) => {
    const detail = e?.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail.map((x) => x?.msg || x?.message || JSON.stringify(x)).join(' | ');
    }
    if (detail && typeof detail === 'object') return JSON.stringify(detail);
    return detail || e?.response?.data?.message || e?.message || t('common.error') || 'حدث خطأ';
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
      const msg = getErrorMessage(e);
      toast({
        title: t('common.error'),
        description: msg || t('operations.save_failed') || 'فشل حفظ العملية',
        variant: 'destructive',
      });
    },
  });


  const handleUpdateOperationItems = async (opId, items) => {
    try {
      setSaveOpId(opId);

      const safeItems = Array.isArray(items) ? items : [];
      const newTotal = safeItems.reduce(
        (sum, it) => sum + (Number(it.quantity || 1) * Number(it.price || 0)),
        0
      );

      const payload = {
        items: safeItems,
        subtotal: newTotal,
        total: newTotal,
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

  const resolvePartnerPhone = (operation) => {
    const partnerId = operation?.partnerId || operation?.customerId || operation?.supplierId;
    const partnerName = operation?.partnerName || operation?.customerName || operation?.supplierName || '';
    const customerMatch = customers.find((c) =>
      (partnerId && String(c.id) === String(partnerId)) || (partnerName && c.name === partnerName)
    );
    const supplierMatch = suppliers.find((s) =>
      (partnerId && String(s.id) === String(partnerId)) || (partnerName && s.name === partnerName)
    );
    return (
      operation?.partnerPhone ||
      operation?.customerPhone ||
      operation?.supplierPhone ||
      customerMatch?.phone ||
      supplierMatch?.phone ||
      ''
    );
  };

  const buildOperationPayload = (operation) => {
    const opType = (operation?.type || '').toLowerCase();
    const isPurchase = ['purchase', 'expense', 'out'].includes(opType);
    const partnerPhone = resolvePartnerPhone(operation);
    const partner = {
      name: operation?.partnerName || operation?.customerName || operation?.supplierName || '',
      phone: partnerPhone,
    };
    const items = (operation?.items || []).map((item) => {
      const quantity = Number(item?.quantity || 1);
      const price = Number(item?.price || 0);
      const total = Number(item?.total || quantity * price);
      const itemName = item?.name || item?.itemName || 'عنصر';
      return {
        name: itemName,
        description: itemName,
        quantity,
        price,
        total,
        unit: item?.unit || 'حبة',
      };
    });

    const accountLabel = operation?.accountName || operation?.account_name || operation?.accountLabel || '';
    const documentTitle = isPurchase ? (accountLabel || 'فاتورة شراء') : 'فاتورة مبيعات';

    return {
      doc_type: 'invoice',
      items,
      customer: isPurchase ? {} : partner,
      supplier: isPurchase ? partner : {},
      vehicle: {
        plate: operation?.vehiclePlate || operation?.vehicle_plate || '',
        model: operation?.vehicleModel || operation?.vehicle_model || '',
        brand: operation?.vehicleBrand || operation?.vehicle_brand || '',
      },
      notes: operation?.description || operation?.notes || '',
      date: operation?.date || operation?.created_at || '',
      settings: {
        document_number: operation?.reference || operation?.id?.slice(0, 8) || '',
        document_title: documentTitle,
      },
    };
  };

  const openPrintDialogForOperation = (operation) => {
    const opType = (operation?.type || '').toLowerCase();
    const label = ['purchase', 'expense', 'out'].includes(opType) ? 'فاتورة شراء' : 'فاتورة مبيعات';
    const phone = resolvePartnerPhone(operation);
    setPrintDialogConfig({
      title: label,
      phone,
      payloadBuilder: () => buildOperationPayload(operation),
    });
    setPrintDialogOpen(true);
  };

  const requestDeleteOperation = (op) => {
    if (!op?.id) return;
    setDeleteTarget(op);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteOperation = async () => {
    if (!deleteTarget?.id) return;
    try {
      setDeleteOpId(deleteTarget.id);
      await axios.delete(`${API_URL}/operations/${deleteTarget.id}`);
      queryClient.invalidateQueries({ queryKey: ['operations', vehicleIdFromUrl || 'all'] });
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    } catch (e) {
      console.error('Failed to delete operation:', e);
    } finally {
      setDeleteOpId(null);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);

    // Validate required fields
    setCreateError('');

    if (!form.accountingAccountId) {
      const msg = t('operations.account_required') || 'اختر الحساب';
      setCreateError(msg);
      toast({
        title: t('common.error'),
        description: msg,
        variant: 'destructive',
      });
      setIsSaving(false);
      return;
    }

    if (!selectedBusinessAccount?.id) {
      const msg = 'لا يوجد حساب أعمال مناسب لنوع العملية الحالي';
      setCreateError(msg);
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
      setIsSaving(false);
      return;
    }

    const hasCustomerOrVehicle = Boolean(activeVehicleId || form.partnerId || form.partnerName);
    const selectedAccountType = String(selectedAccountingAccount?.type || '').toLowerCase();
    const effectiveOperationKind = isSelectedAccountingRakan
      ? OPERATION_KIND_RAKAN
      : (form.operationKind === OPERATION_KIND_RAKAN
        ? (activeVehicleId ? OPERATION_KIND_VEHICLE : OPERATION_KIND_WORKSHOP)
        : form.operationKind);

    const effectiveType = selectedAccountType === 'revenue'
      ? 'sale'
      : selectedAccountType === 'expense'
        ? (form.type === 'purchase' ? 'purchase' : 'expense')
        : ['asset', 'liability'].includes(selectedAccountType)
          ? 'purchase'
          : selectedAccountType === 'equity'
            ? 'expense'
            : form.type;

    if (effectiveOperationKind === OPERATION_KIND_VEHICLE && !activeVehicleId) {
      const msg = 'عملية المركبة تتطلب اختيار مركبة';
      setCreateError(msg);
      toast({
        title: t('common.error'),
        description: msg,
        variant: 'destructive',
      });
      setIsSaving(false);
      return;
    }

    if (effectiveOperationKind === OPERATION_KIND_RAKAN && ['sale', 'service'].includes(effectiveType) && !hasCustomerOrVehicle) {
      const msg = 'عملية قطع راكان تتطلب تحديد عميل أو مركبة';
      setCreateError(msg);
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
      setIsSaving(false);
      return;
    }

    try {
      const selectedVehicle = (vehicleOptions || []).find((v) => v.id === activeVehicleId);
      const vehicleDetailsNote = ((effectiveOperationKind === OPERATION_KIND_VEHICLE || effectiveOperationKind === OPERATION_KIND_RAKAN) && selectedVehicle)
        ? `\n[VEHICLE] اللوحة: ${selectedVehicle.plateNumber || selectedVehicle.plate_number || '-'} | النوع: ${selectedVehicle.brand || '-'} ${selectedVehicle.model || ''} | العميل: ${selectedVehicle.customerName || selectedVehicle.ownerName || '-'} | رقم الزيارة: ${form.visitId || '-'}`
        : '';

      const normalizedScope = effectiveOperationKind === OPERATION_KIND_WORKSHOP
        ? 'workshop'
        : effectiveOperationKind === OPERATION_KIND_VEHICLE
          ? 'vehicle'
          : 'rakan_parts';

      const normalizedSource = effectiveOperationKind === OPERATION_KIND_WORKSHOP
        ? 'workshop_operation'
        : effectiveOperationKind === OPERATION_KIND_VEHICLE
          ? 'vehicle_operation'
          : 'rakan_parts_operation';

      const cleanPayload = {
        ...form,
        type: effectiveType,
        workshopId: workshopId || null,
        operationKind: effectiveOperationKind,
        accountId: selectedBusinessAccount.id,
        accountingAccountId: form.accountingAccountId || null,
        opDate: form.date,
        scope: normalizedScope,
        source: normalizedSource,
        businessUnit: effectiveOperationKind === OPERATION_KIND_RAKAN ? 'rakan_parts' : 'workshop',
        vehicleId: effectiveOperationKind === OPERATION_KIND_WORKSHOP ? null : (activeVehicleId || null),
        visitId: effectiveOperationKind === OPERATION_KIND_WORKSHOP ? null : (form.visitId || null),
        partnerType: effectiveOperationKind === OPERATION_KIND_WORKSHOP
          ? (effectiveType === 'sale' ? 'customer' : (form.partnerType || 'supplier'))
          : (effectiveType === 'sale' ? 'customer' : 'supplier'),

        // NOTE: avoid sending File objects in JSON payload
        paymentReceipt: null,
        notes: `${form.notes || ''}${vehicleDetailsNote}`.trim(),
      };

      await createOperationMutation.mutateAsync(cleanPayload);
      setCreateError('');

      setForm({
        accountId: selectedBusinessAccount?.id || '',
        accountingAccountId: '',
        operationKind: vehicleIdFromUrl ? OPERATION_KIND_VEHICLE : OPERATION_KIND_WORKSHOP,
        vehicleId: vehicleIdFromUrl || '',
        visitId: '',
        scope: vehicleIdFromUrl ? 'vehicle' : 'workshop',
        type: 'purchase',
        partnerType: 'supplier',
        partnerId: '',
        partnerName: '',
        partnerPhone: '',
        items: [],
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        status: 'issued',
        invoiceNumber: '',
        notes: '',
        date: new Date().toISOString().split('T')[0],
        paymentReceipt: null,
      });
      setItem({ itemType: 'part', itemId: '', name: '', customName: '', quantity: 1, price: 0 });
    } catch (e) {
      const msg = getErrorMessage(e);
      setCreateError(msg || t('operations.save_failed') || 'فشل حفظ العملية');
      toast({
        title: t('common.error'),
        description: msg || t('operations.save_failed') || 'فشل حفظ العملية',
        variant: 'destructive',
      });
    }
  };

  const subtotal = form.items.reduce((s, it) => s + Number(it.total || (Number(it.quantity || 1) * Number(it.price || 0)) || 0), 0);
  const previewAccountType = String(selectedAccountingAccount?.type || '').toLowerCase();
  const previewEffectiveType = previewAccountType === 'revenue'
    ? 'sale'
    : previewAccountType === 'expense'
      ? (form.type === 'purchase' ? 'purchase' : 'expense')
      : ['asset', 'liability'].includes(previewAccountType)
        ? 'purchase'
        : previewAccountType === 'equity'
          ? 'expense'
          : form.type;
  const previewKind = isSelectedAccountingRakan
    ? OPERATION_KIND_RAKAN
    : (form.operationKind === OPERATION_KIND_RAKAN
      ? (activeVehicleId ? OPERATION_KIND_VEHICLE : OPERATION_KIND_WORKSHOP)
      : form.operationKind);
  const missingVehicleForVehicleKind = previewKind === OPERATION_KIND_VEHICLE && !activeVehicleId;
  const missingCustomerOrVehicleForRakan = previewKind === OPERATION_KIND_RAKAN
    && ['sale', 'service'].includes(previewEffectiveType)
    && !(activeVehicleId || form.partnerId || form.partnerName);
  const submitDisabled = (
    form.items.length === 0
    || !selectedBusinessAccount?.id
    || !form.accountingAccountId
    || missingVehicleForVehicleKind
    || missingCustomerOrVehicleForRakan
    || isSaving
  );

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
          {createError ? (
            <div
              className="mb-5 rounded-2xl border px-4 py-3"
              style={{
                backgroundColor: 'rgba(244,63,94,0.10)',
                borderColor: 'rgba(244,63,94,0.25)',
              }}
              role="alert"
              data-testid="operation-create-error-banner"
            >
              <div className="text-sm font-semibold" style={{ color: 'rgba(254,226,226,0.95)' }}>
                {t('common.error') || 'خطأ'}
              </div>
              <div className="text-sm mt-1" style={{ color: 'rgba(254,226,226,0.82)' }}>
                {createError}
              </div>
              <button
                type="button"
                className="mt-2 text-xs underline"
                style={{ color: 'rgba(254,226,226,0.85)' }}
                onClick={() => setCreateError('')}
              >
                {t('common.close') || 'إغلاق'}
              </button>
            </div>
          ) : null}
          <div className="flex items-center gap-3 mb-6 pb-4" style={{ borderBottom: `1px solid ${styles.cardBorder}` }}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-md">
              <Plus size={20} className="text-white" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold" style={{ color: styles.textPrimary }}>{t('operations.new_operation')}</h2>
          </div>

          <form onSubmit={submit} className="space-y-6">
            <div className="space-y-5">
              {/* Section 1: Basic Info */}
              <div className="rounded-2xl border px-4 py-4" style={{ backgroundColor: styles.tableBg, borderColor: styles.cardBorder }}>
                <div className="text-sm font-semibold mb-4" style={{ color: styles.textPrimary }}>{t('common.basic_info') || 'المعلومات الأساسية'}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2 md:col-span-2 lg:col-span-4">
                    <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>نوع العملية في النظام</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" data-testid="operation-kind-selector">
                      {[OPERATION_KIND_WORKSHOP, OPERATION_KIND_VEHICLE, OPERATION_KIND_RAKAN].map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          className={`px-3 py-2.5 rounded-xl text-xs sm:text-sm border transition ${form.operationKind === kind ? 'bg-cyan-500/20 border-cyan-300/40 text-cyan-100' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              operationKind: kind,
                              partnerId: kind === OPERATION_KIND_WORKSHOP ? '' : prev.partnerId,
                              partnerName: kind === OPERATION_KIND_WORKSHOP ? '' : prev.partnerName,
                              vehicleId: kind === OPERATION_KIND_WORKSHOP ? '' : prev.vehicleId,
                              visitId: kind === OPERATION_KIND_WORKSHOP ? '' : prev.visitId,
                            }));
                          }}
                          data-testid={`operation-kind-${kind}`}
                        >
                          {OPERATION_KIND_LABELS[kind]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>{t('operations.operation_type')}</label>
                    <div className="relative">
                      <FileText className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <select
                        className="apple-input pr-10"
                        value={form.type}
                        onChange={e => setForm({ ...form, type: e.target.value, partnerType: e.target.value === 'sale' ? 'customer' : 'supplier' })}
                        data-testid="operation-type-select"
                      >
                        <option value="purchase">{t('operations.purchase')}</option>
                        <option value="sale">{t('operations.sale')}</option>
                        <option value="expense">مصروف مباشر</option>
                        <option value="direct">عملية مفتوحة/مباشرة</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>{t('operations.operationDateLabel')}</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="apple-input"
                    />
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>{t('common.description') || 'الوصف'}</label>
                    <textarea
                      className="apple-input h-[44px] py-2"
                      style={{ minHeight: 44, resize: 'vertical' }}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder={t('common.optional') || 'اختياري'}
                      data-testid="operation-notes-input"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Linking */}
              <div className="rounded-2xl border px-4 py-4" style={{ backgroundColor: styles.tableBg, borderColor: styles.cardBorder }}>
                <div className="text-sm font-semibold mb-4" style={{ color: styles.textPrimary }}>{t('common.linking') || 'الربط'}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>حساب الأعمال</label>
                    <div className="apple-input text-sm" data-testid="operation-business-account-readonly">
                      {selectedBusinessAccount?.name || '---'}
                    </div>
                    <p className="text-[11px]" style={{ color: styles.textMuted }}>
                      {form.operationKind === OPERATION_KIND_RAKAN ? 'سيتم التسجيل ضمن حساب أعمال قطع راكان المستقل' : 'سيتم التسجيل ضمن حساب أعمال الورشة'}
                    </p>
                  </div>

                  {(form.operationKind === OPERATION_KIND_VEHICLE || form.operationKind === OPERATION_KIND_RAKAN) && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>{t('operations.vehicle')}</label>
                      <div className="relative">
                        <Car className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <select
                          className="apple-input pr-10"
                          value={form.vehicleId}
                          onChange={(e) => {
                            const vehicleId = e.target.value;
                            setForm((prev) => ({ ...prev, vehicleId, visitId: '' }));
                          }}
                          data-testid="operation-vehicle-select"
                        >
                          <option value="">{t('operations.select_vehicle')}...</option>
                          {(form.operationKind === OPERATION_KIND_RAKAN ? customerVehicles : vehicleOptions).map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.plateNumber} - {v.brand} {v.model}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {(form.operationKind === OPERATION_KIND_VEHICLE || form.operationKind === OPERATION_KIND_RAKAN) && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>{form.operationKind === OPERATION_KIND_VEHICLE ? 'العميل المرتبط بالمركبة' : 'العميل'}</label>
                      {form.operationKind === OPERATION_KIND_VEHICLE ? (
                        <div className="apple-input text-sm" data-testid="operation-linked-customer-readonly">
                          {form.partnerName || '---'}
                        </div>
                      ) : (
                        <select
                          className="apple-input"
                          value={form.partnerId || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            const selected = customers.find((item) => item.id === value);
                            setForm((prev) => ({
                              ...prev,
                              partnerId: value,
                              partnerName: selected?.name || '',
                              partnerPhone: selected?.phone || '',
                              partnerType: 'customer',
                              vehicleId: value ? prev.vehicleId : '',
                              visitId: '',
                            }));
                          }}
                          data-testid="operation-partner-select"
                        >
                          <option value="">اختر عميل</option>
                          {customers.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      )}
                      {form.operationKind === OPERATION_KIND_RAKAN && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs mb-1 block" style={{ color: styles.textMuted }}>اسم العميل (يدوي)</label>
                            <input
                              className="apple-input"
                              value={form.partnerName}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  partnerName: e.target.value,
                                  partnerId: '',
                                }))
                              }
                              data-testid="operation-partner-manual-name"
                            />
                          </div>
                          <div>
                            <label className="text-xs mb-1 block" style={{ color: styles.textMuted }}>جوال العميل (للحفظ)</label>
                            <input
                              className="apple-input"
                              value={form.partnerPhone}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  partnerPhone: e.target.value,
                                  partnerId: '',
                                }))
                              }
                              data-testid="operation-partner-manual-phone"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleCreateCustomer}
                            className="md:col-span-2 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/30"
                            data-testid="operation-partner-save"
                          >
                            حفظ العميل
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {form.operationKind === OPERATION_KIND_VEHICLE && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>{t('operations.visit') || t('operations.date')}</label>
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

                  {form.operationKind === OPERATION_KIND_WORKSHOP && (
                    <div className="space-y-2 md:col-span-2 lg:col-span-3">
                      <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>
                        الجهة/المستفيد (اختياري)
                      </label>
                      <div className="relative">
                        <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          className="apple-input pr-10"
                          placeholder="مثال: شركة الكهرباء / مورد أدوات"
                          value={form.partnerName}
                          onChange={e => setForm({ ...form, partnerName: e.target.value, partnerType: form.type === 'purchase' ? 'supplier' : 'customer' })}
                          data-testid="operation-partner-name-input"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {form.operationKind === OPERATION_KIND_RAKAN && (
                  <div className="mt-3 text-xs text-cyan-200" data-testid="operation-rakan-rule-note">
                    ملاحظة: عند استخدام حساب يبدأ بـ 5000 تُرحّل العملية تلقائياً إلى وحدة قطع راكان، ويلزم ربط عميل/مركبة فقط في حالات البيع.
                  </div>
                )}
              </div>

              {/* Section 3: Payment */}
              <div className="rounded-2xl border px-4 py-4" style={{ backgroundColor: styles.tableBg, borderColor: styles.cardBorder }}>
                <div className="text-sm font-semibold mb-4" style={{ color: styles.textPrimary }}>{t('common.payment') || 'الدفع'}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

                  <div className="space-y-2">
                    <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>الحساب المحاسبي (القيد)</label>
                    <div className="relative">
                      <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <select 
                        className="apple-input pr-10"
                        value={form.accountingAccountId} 
                        onChange={e => setForm({ ...form, accountingAccountId: e.target.value })}
                        data-testid="operation-account-select"
                      >
                        <option value="">{t('operations.select_account')}</option>
                        {Array.isArray(filteredAccounts) ? (
                          filteredAccounts.length > 0 ? (
                            filteredAccounts.map(a => (
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

                  <div className="space-y-2">
                    <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>{t('operations.invoiceNumber') || t('invoices.invoice_number') || 'رقم الفاتورة'}</label>
                    <input
                      className="apple-input"
                      value={form.invoiceNumber}
                      onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                      placeholder="INV-..."
                      data-testid="operation-invoice-number-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>{t('status.status') || 'الحالة'}</label>
                    <select
                      className="apple-input"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      data-testid="operation-status-select"
                    >
                      <option value="issued">{t('common.issued') || 'صادرة'}</option>
                      <option value="draft">{t('common.draft') || 'مسودة'}</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>{t('operations.paymentStatus') || (t('common.payment_status') || 'حالة الدفع')}</label>
                    <select
                      className="apple-input"
                      value={form.paymentStatus}
                      onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}
                      data-testid="operation-payment-status-select"
                    >
                      <option value="paid">{t('common.paid') || 'مدفوع'}</option>
                      <option value="unpaid">{t('common.unpaid') || 'غير مدفوع'}</option>
                    </select>
                  </div>

                  <div className="space-y-2 lg:col-span-3">
                    <label className="text-sm font-medium" style={{ color: styles.textSecondary }}>
                      📎 {t('operations.payment_receipt_optional')}
                    </label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setForm({ ...form, paymentReceipt: file });
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
              </div>

            {/* OCR Invoice */}
            <div className="rounded-2xl p-4 border" style={{ backgroundColor: styles.tableBg, borderColor: styles.cardBorder }}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold" style={{ color: styles.textPrimary }}>مسح فاتورة (Scanner)</div>
                  <div className="text-xs" style={{ color: styles.textSecondary }}>التقط صورة أو ارفع ملف لملء البنود تلقائياً</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={ocrInvoiceType}
                    onChange={(e) => setOcrInvoiceType(e.target.value)}
                    className="text-xs px-3 py-2 rounded-lg border"
                    style={{ borderColor: styles.inputBorder, backgroundColor: styles.inputBg, color: styles.textPrimary }}
                    data-testid="operation-ocr-invoice-type"
                  >
                    <option value="purchase">فاتورة شراء</option>
                    <option value="sale">فاتورة بيع</option>
                  </select>
                  <label className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border cursor-pointer" style={{ borderColor: styles.inputBorder, backgroundColor: styles.inputBg, color: styles.textPrimary }}>
                    <Camera size={14} /> التقاط
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleOcrFileChange} data-testid="operation-ocr-camera-input" />
                  </label>
                  <label className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border cursor-pointer" style={{ borderColor: styles.inputBorder, backgroundColor: styles.inputBg, color: styles.textPrimary }}>
                    <Upload size={14} /> رفع ملف
                    <input type="file" accept="image/*" className="hidden" onChange={handleOcrFileChange} data-testid="operation-ocr-file-input" />
                  </label>
                  <button
                    type="button"
                    onClick={runOcr}
                    disabled={ocrLoading}
                    className="text-xs px-3 py-2 rounded-lg"
                    style={{ backgroundColor: '#2563eb', color: '#fff' }}
                    data-testid="operation-ocr-run"
                  >
                    {ocrLoading ? 'جاري القراءة...' : 'تشغيل OCR'}
                  </button>
                  {ocrResult && (
                    <button
                      type="button"
                      onClick={applyOcrToItems}
                      className="text-xs px-3 py-2 rounded-lg"
                      style={{ backgroundColor: '#10b981', color: '#fff' }}
                      data-testid="operation-ocr-apply"
                    >
                      تطبيق البنود
                    </button>
                  )}
                </div>
              </div>
              {ocrPreview && (
                <img src={ocrPreview} alt="OCR" className="mt-2 max-h-40 rounded-lg" data-testid="operation-ocr-preview" />
              )}
              {ocrError && (
                <div className="mt-2 text-xs text-red-500" data-testid="operation-ocr-error">{ocrError}</div>
              )}
              {ocrResult && (
                <div className="mt-2 text-xs" style={{ color: styles.textSecondary }} data-testid="operation-ocr-summary">
                  المورد: {ocrResult.vendor || 'غير محدد'} | الإجمالي: {ocrResult.totals?.grand_total || '—'}
                </div>
              )}
            </div>

              {/* Section 4: Items */}

            {/* Items Section */}
            <div className="rounded-2xl p-4 border" style={{ backgroundColor: styles.tableBg, borderColor: styles.cardBorder }}>
              <label className="block text-sm font-semibold mb-4" style={{ color: styles.textPrimary }}>{t('operations.addItems')}</label>

              {/* Live total summary */}
              <div className="mt-4 flex items-center justify-between rounded-2xl border px-4 py-3" style={{ backgroundColor: 'rgba(15,23,42,0.35)', borderColor: styles.cardBorder }}>
                <div className="text-sm" style={{ color: styles.textSecondary }}>{t('operations.total') || 'الإجمالي'}</div>
                <div className="text-lg font-extrabold tabular-nums" style={{ color: styles.textPrimary }}>
                  {subtotal.toFixed(2)} {t('operations.SAR')}
                </div>
              </div>

              
              <div className="grid grid-cols-1 md:grid-cols-8 gap-3 items-end mb-4">
                <div className="md:col-span-1">
                  <label className="text-xs mb-1 block" style={{ color: styles.textMuted }}>نوع العنصر</label>
                  <select 
                    className="apple-input h-9 text-sm"
                    value={item.itemType} 
                    onChange={e=>setItem({ ...item, itemType: e.target.value, itemId: '', name: '', customName: '' })}
                    data-testid="operation-item-type-select"
                  >
                    <option value="part">{t('operations.part')}</option>
                    <option value="service">{t('operations.service')}</option>
                  </select>
                </div>
                
                <div className="md:col-span-1">
                  <label className="text-xs mb-1 block" style={{ color: styles.textMuted }}>{t('operations.items')}</label>
                  {item.itemType === 'part' ? (
                    <select 
                      className="apple-input h-9 text-sm"
                      value={item.itemId} 
                      onChange={e => { 
                        const it = parts.find(p=>p.id===e.target.value); 
                        setItem({
                          ...item,
                          itemId: e.target.value,
                          name: it?.name || '',
                          price: it?.sellingPrice || 0,
                          customName: '',
                        }); 
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
                        setItem({
                          ...item,
                          itemId: e.target.value,
                          name: s?.name || '',
                          price: s?.price || 0,
                          customName: '',
                        }); 
                      }}
                      data-testid="operation-service-select"
                    >
                      <option value="">{t('operations.selectService')}</option>
                      {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs mb-1 block" style={{ color: styles.textMuted }}>
                    إدخال صنف/خدمة جديدة
                  </label>
                  <input
                    type="text"
                    className="apple-input h-9 text-sm"
                    value={item.customName}
                    onChange={e =>
                      setItem({
                        ...item,
                        customName: e.target.value,
                        name: e.target.value,
                        itemId: '',
                      })
                    }
                    placeholder="يحفظ تلقائياً"
                    data-testid="operation-item-custom-input"
                  />
                </div>

                <div className="md:col-span-1">
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
                        <th className="p-3 text-right font-medium">نوع العنصر</th>
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
              <div className="text-xs" style={{ color: styles.textMuted }}>
                {t('operations.items_count') || 'العناصر'}: {form.items.length}
              </div>
              <button 
                type="submit" 
                disabled={submitDisabled}
                className="apple-button w-full sm:w-auto px-8 py-2 text-base"
                data-testid="operation-save-button"
              >
                {t('operations.submit')}
              </button>

              {form.items.length === 0 && (
                <div className="text-xs text-slate-500">{t('operations.items_required') || 'أضف عنصر واحد على الأقل قبل الحفظ'}</div>
              )}

              {missingVehicleForVehicleKind && (
                <div className="text-xs text-slate-500">{t('operations.select_vehicle_required') || 'اختر مركبة أولاً'}</div>
              )}

              {missingCustomerOrVehicleForRakan && (
                <div className="text-xs text-slate-500">حدد عميل أو مركبة لعملية قطع راكان قبل الحفظ</div>
              )}
            </div>
            </div>
          </form>
        </div>

        {/* Recent Operations */}
        <div className="space-y-6" data-testid="operations-sections-wrapper">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-50">{t('operations.recentOperations')}</h2>
              <p className="text-sm text-slate-200/70 mt-1">{t('operations.subtitle') || ''}</p>
            </div>
          </div>

          <div className="glass-card p-2" data-testid="operations-tabs-container">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2" data-testid="operations-tabs-list">
              <button
                type="button"
                className={`px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${isRakanTabActive ? 'bg-cyan-500/25 text-cyan-100 border border-cyan-300/40' : 'bg-white/5 text-slate-300 border border-white/10'}`}
                onClick={() => setActiveOperationsTab('rakan')}
                data-testid="operations-tab-rakan"
              >
                عمليات قطع راكان (مستقلة) • {rakanOps.length}
              </button>
              <button
                type="button"
                className={`px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${!isRakanTabActive ? 'bg-amber-500/25 text-amber-100 border border-amber-300/40' : 'bg-white/5 text-slate-300 border border-white/10'}`}
                onClick={() => setActiveOperationsTab('workshop')}
                data-testid="operations-tab-workshop"
              >
                عمليات الورشة • {workshopOps.length}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between" data-testid="operations-active-tab-summary">
            <h3 className="text-lg font-bold text-slate-100" data-testid="operations-active-tab-title">
              {isRakanTabActive ? 'عمليات قطع راكان (مستقلة)' : 'عمليات الورشة'}
            </h3>
            <span className="text-xs px-2 py-1 rounded bg-white/10 text-slate-200" data-testid="operations-active-tab-count">
              {activeOpsTotalCount} عملية
            </span>
          </div>

          {activeOpsTotalCount === 0 ? (
            <div className="apple-card p-4 text-center" data-testid="operations-active-tab-empty">
              <div className="text-sm text-slate-400">
                {isRakanTabActive ? 'لا توجد عمليات قطع راكان حالياً' : 'لا توجد عمليات ورشة حالياً'}
              </div>
            </div>
          ) : (
            <>
              <div
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4"
                data-testid="operations-active-tab-grid"
              >
                {activeOps.map((op, index) => {
                  const opRenderKey = op.id || `${isRakanTabActive ? 'rakan' : 'workshop'}-${op.invoiceNumber || 'op'}-${activePage}-${index}`;
                  return (
                  <OperationCard
                    key={opRenderKey}
                    operation={op}
                    isRTL={isRTL}
                    t={t}
                    accounts={accounts}
                    businessAccounts={bizAccounts}
                    vehicles={vehicleOptions}
                    isSaving={saveOpId === op.id}
                    isDeleting={deleteOpId === op.id}
                    expanded={expandedOperationId === (op.id || opRenderKey)}
                    onExpandedChange={(next) => {
                      if (next) {
                        setExpandedOperationId(op.id || opRenderKey);
                      } else {
                        setExpandedOperationId((prev) => (prev === op.id || prev === opRenderKey ? null : prev));
                      }
                    }}
                    onPrint={(o) => {
                      if (!o?.id) return;
                      openPrintDialogForOperation(o);
                    }}
                    onViewVehicle={(o) => {
                      if (!o?.vehicleId) return;
                      navigate(`/vehicle/${o.vehicleId}`);
                    }}
                    onConfirmCreditPayment={(o) => {
                      setConfirmTarget(o);
                      setConfirmOpen(true);
                    }}
                    onDelete={(o) => requestDeleteOperation(o)}
                    onUpdateItems={(opId, items) => handleUpdateOperationItems(opId, items)}
                  />
                  );
                })}
              </div>

              <div className="glass-card p-3" data-testid="operations-pagination-wrapper">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <span className="text-sm text-slate-300" data-testid="operations-pagination-label">
                    صفحة {activePage} من {activeTotalPages} صفحات
                  </span>

                  <div className="flex flex-wrap items-center gap-2" data-testid="operations-pagination-controls">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-white/10 text-slate-200 disabled:opacity-50"
                      disabled={activePage <= 1}
                      onClick={() => setActivePage(activePage - 1)}
                      data-testid="operations-pagination-prev-button"
                    >
                      السابق
                    </button>

                    <div className="flex flex-wrap items-center gap-1" data-testid="operations-pagination-numbers">
                      {activePageNumbers.map((pageNumber) => (
                        <button
                          key={`operations-page-${isRakanTabActive ? 'rakan' : 'workshop'}-${pageNumber}`}
                          type="button"
                          className={`w-9 h-9 rounded-lg text-sm border transition-colors ${pageNumber === activePage ? 'bg-cyan-500/30 border-cyan-300/40 text-cyan-100' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
                          onClick={() => setActivePage(pageNumber)}
                          data-testid={`operations-pagination-page-button-${pageNumber}`}
                        >
                          {pageNumber}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-white/10 text-slate-200 disabled:opacity-50"
                      disabled={activePage >= activeTotalPages}
                      onClick={() => setActivePage(activePage + 1)}
                      data-testid="operations-pagination-next-button"
                    >
                      التالي
                    </button>
                  </div>
                </div>
              </div>
            </>
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
            openPrintDialogForOperation(selectedOperation);
          }}
          onViewVehicle={() => {
            if (!selectedOperation?.vehicleId) return;
            navigate(`/vehicle/${selectedOperation.vehicleId}`);
          }}
          onDelete={async () => {
            if (!selectedOperation?.id) return;
            requestDeleteOperation(selectedOperation);
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
      
      <OperationDeleteConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={(v) => {
          // prevent closing while delete is in-flight
          if (deleteOpId) return;
          setDeleteConfirmOpen(v);
          if (!v) setDeleteTarget(null);
        }}
        operation={deleteTarget}
        isRTL={isRTL}
        t={t}
        isLoading={Boolean(deleteOpId)}
        onConfirm={confirmDeleteOperation}
      />

      <QuickPrintDialog
        open={printDialogOpen}
        title={printDialogConfig?.title || 'خيارات الطباعة'}
        description="معاينة تفاصيل العملية قبل الطباعة أو الإرسال"
        payloadBuilder={printDialogConfig?.payloadBuilder}
        initialPhone={printDialogConfig?.phone}
        onClose={() => setPrintDialogOpen(false)}
      />
      
      <span data-testid="confirm-open-state" className="hidden">{confirmOpen ? 'open' : 'closed'}</span>

    </div>
  );
};

export default Operations;