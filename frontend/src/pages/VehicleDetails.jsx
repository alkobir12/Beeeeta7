import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ConfirmPaymentDialog from '../components/ConfirmPaymentDialog';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Car, User, Phone, Calendar, Wrench, CheckCircle, FileText, Upload, Printer, Receipt, Clock, Trash2, Camera, X, Scan, Plus, ChevronDown, ChevronUp, Edit2, Save, XCircle, FileCheck, ClipboardList } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import GuidanceStepper from '../components/GuidanceStepper';
import { vehicleAPI, technicianAPI, financeAPI, customerAPI, visitAPI, serviceAPI, partAPI } from '../services/api';
import { statusSteps, getStatusLabel, getStatusColor } from '../mock/data';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/formatters';

// Updated icons imports

const API_URL = (
  process.env.NODE_ENV === 'production'
    ? '/api'
    : `${process.env.REACT_APP_BACKEND_URL}/api`.replace('//api', '/api')
);
const FILE_BASE = process.env.NODE_ENV === 'production' ? '' : (process.env.REACT_APP_BACKEND_URL || '');

// --- Helper Components ---

const VisitItemRow = ({ item, isEditing, onChange, onDelete, servicesCatalog = [], partsCatalog = [], rowId }) => {
  if (!isEditing) {
    return (
      <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
        <td className="py-2 px-3 text-xs text-gray-600 font-medium">
          {item.itemType === 'part' ? 'قطعة' : 'خدمة'}
        </td>
        <td className="py-2 px-3 text-xs text-gray-800">{item.name}</td>
        <td className="py-2 px-3 text-xs text-gray-800 text-center">{item.quantity}</td>
        <td className="py-2 px-3 text-xs text-gray-800 text-center">{item.price}</td>
        <td className="py-2 px-3 text-xs font-bold text-gray-900 text-right">
          {formatCurrency(item.quantity * item.price)}
        </td>
      </tr>
    );
  }

  const options = item.itemType === 'part' ? partsCatalog : servicesCatalog;
  const listId = `${item.itemType}-list-${rowId}`;

  return (
    <tr className="border-b border-blue-100 bg-blue-50/30">
      <td className="p-2 min-w-[90px]">
        <select
          value={item.itemType}
          onChange={(e) => onChange('itemType', e.target.value)}
          className="w-full text-xs sm:text-sm border border-gray-300 rounded p-2"
          data-testid={`visit-item-type-${rowId}`}
        >
          <option value="service">خدمة</option>
          <option value="part">قطعة</option>
        </select>
      </td>
      <td className="p-2 min-w-[160px]">
        <input
          type="text"
          list={listId}
          value={item.name}
          onChange={(e) => {
            const value = e.target.value;
            onChange('name', value);
            const match = options.find((opt) => (opt.name || '').trim() === value.trim());
            if (match) {
              const price = match.price ?? match.sellingPrice ?? match.selling_price ?? 0;
              onChange('price', Number(price) || 0);
            }
          }}
          className="w-full min-w-[140px] sm:min-w-[220px] text-xs sm:text-sm border border-gray-300 rounded p-2"
          placeholder="اسم البند"
          data-testid={`visit-item-name-${rowId}`}
        />
        <datalist id={listId}>
          {options.map((opt) => (
            <option key={opt.id || opt.name} value={opt.name} />
          ))}
        </datalist>
      </td>
      <td className="p-2">
        <input
          type="number"
          value={item.quantity}
          onChange={(e) => onChange('quantity', Number(e.target.value))}
          className="w-16 sm:w-20 text-xs sm:text-sm border border-gray-300 rounded p-2 text-center"
          min="1"
          data-testid={`visit-item-quantity-${rowId}`}
        />
      </td>
      <td className="p-2">
        <input
          type="number"
          value={item.price}
          onChange={(e) => onChange('price', Number(e.target.value))}
          className="w-20 sm:w-24 text-xs sm:text-sm border border-gray-300 rounded p-2 text-center"
          min="0"
          data-testid={`visit-item-price-${rowId}`}
        />
      </td>
      <td className="p-2 text-right">
        <button
          onClick={onDelete}
          className="p-1 text-red-500 hover:bg-red-100 rounded"
          title="حذف"
          data-testid={`visit-item-delete-${rowId}`}
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
};

const VisitCard = ({ visit, technicians, onUpdate, onDelete, approvals = [], servicesCatalog = [], partsCatalog = [], onServiceAdded, onPartAdded, canDelete = false }) => {
  const [isExpanded, setIsExpanded] = useState((visit.status || 'in_progress') === 'in_progress');
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState(visit.status);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [techId, setTechId] = useState(visit.technicianId || visit.technician_id || '');
  const [notes, setNotes] = useState(visit.notes || '');
  const [mileage, setMileage] = useState(visit.mileage || '');
  
  const { toast } = useToast();

  useEffect(() => {
    // Parse items from visit.notes if strictly JSON structure, else empty or try legacy
    let parsedItems = [];
    try {
      if (visit.notes && visit.notes.trim().startsWith('{')) {
        const obj = JSON.parse(visit.notes);
        if (obj.items) parsedItems = obj.items;
        // If notes was just JSON, clear plain text notes for UI to avoid showing JSON
        if (!obj.text) setNotes(''); 
        else setNotes(obj.text);
      } else {
        setNotes(visit.notes || '');
      }
    } catch (e) {
      setNotes(visit.notes || '');
    }
    setItems(parsedItems);
    setStatus(visit.status);
    setTechId(visit.technicianId || visit.technician_id || '');
    setMileage(visit.mileage || '');
    setIsEditing(visit.status === 'in_progress');
  }, [visit]);

  const persistCatalogEntries = async () => {
    const normalize = (val) => (val || '').trim().toLowerCase();
    const serviceNames = new Set(servicesCatalog.map((s) => normalize(s.name)));
    const partNames = new Set(partsCatalog.map((p) => normalize(p.name)));

    const newServices = items
      .filter((it) => it.itemType === 'service' && normalize(it.name))
      .filter((it) => !serviceNames.has(normalize(it.name)));

    const newParts = items
      .filter((it) => it.itemType === 'part' && normalize(it.name))
      .filter((it) => !partNames.has(normalize(it.name)));

    const uniqueServices = Array.from(
      new Map(newServices.map((it) => [normalize(it.name), it])).values()
    );
    const uniqueParts = Array.from(
      new Map(newParts.map((it) => [normalize(it.name), it])).values()
    );

    for (const svc of uniqueServices) {
      try {
        const payload = {
          name: svc.name.trim(),
          category: 'خدمة عامة',
          price: Number(svc.price || 0),
          duration: 30,
          laborCost: 0,
          active: true,
        };
        const res = await serviceAPI.create(payload);
        onServiceAdded?.(res.data);
        serviceNames.add(normalize(svc.name));
      } catch (e) {
        console.error('Error creating service:', e);
      }
    }

    for (const part of uniqueParts) {
      try {
        const payload = {
          partNumber: `AUTO-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
          name: part.name.trim(),
          category: 'عام',
          purchasePrice: 0,
          sellingPrice: Number(part.price || 0),
          quantity: 0,
          minQuantity: 0,
          supplier: '',
        };
        const res = await partAPI.create(payload);
        onPartAdded?.(res.data);
        partNames.add(normalize(part.name));
      } catch (e) {
        console.error('Error creating part:', e);
      }
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await persistCatalogEntries();
      const payload = {
        status: status,
        technicianId: techId || null,
        mileage: Number(mileage),
        notes: JSON.stringify({ text: notes, items: items })
      };

      await axios.put(`${API_URL}/visits/${visit.id}`, payload);
      
      setIsEditing(false);
      onUpdate();
      toast({ title: 'تم الحفظ', description: `تم حفظ ${items.length} بند بنجاح` });
    } catch (e) {
      console.error('Save visit error:', e);
      toast({ title: 'خطأ', description: 'فشل الحفظ. تأكد من الاتصال وحاول مرة أخرى.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReopen = async () => {
    try {
      await axios.put(`${API_URL}/visits/${visit.id}`, { status: 'in_progress' });
      setStatus('in_progress');
      setIsEditing(true);
      setIsExpanded(true);
      onUpdate();
      toast({ title: 'تم', description: 'تم إعادة فتح الزيارة للتعديل' });
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل إعادة فتح الزيارة', variant: 'destructive' });
    }
  };

  const latestApproval = approvals?.[0];

  const handleCloseVisit = async () => {
    if (isSaving) return;
    if (!window.confirm('هل تريد حفظ جميع البنود وإغلاق الزيارة؟')) return;
    setIsSaving(true);
    try {
      await persistCatalogEntries();
      const payload = {
        status: 'completed',
        exitDate: new Date().toISOString(),
        technicianId: techId || null,
        mileage: Number(mileage),
        notes: JSON.stringify({ text: notes, items: items })
      };
      await axios.put(`${API_URL}/visits/${visit.id}`, payload);
      setStatus('completed');
      setIsEditing(false);
      onUpdate();
      toast({ title: 'تم الحفظ والإغلاق', description: 'تم حفظ البنود وإغلاق الزيارة بنجاح' });
    } catch (e) {
      console.error('Close visit error:', e);
      toast({ title: 'خطأ', description: 'فشل إغلاق الزيارة. تأكد من الاتصال وحاول مرة أخرى.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const addItem = () => {
    setItems([...items, { itemType: 'service', name: '', quantity: 1, price: 0 }]);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const deleteItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className={`border rounded-xl transition-all duration-200 ${isExpanded ? 'border-blue-200 shadow-md bg-white' : 'border-gray-200 bg-gray-50 hover:bg-white'}`}>
      {/* Header */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status === 'in_progress' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
            <Calendar size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-sm">
                {new Date(visit.entryDate || visit.entry_date).toLocaleDateString('ar-SA')}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                {status === 'in_progress' ? 'تحت الإصلاح' : 'مكتملة'}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
              <span>{mileage ? `${mileage.toLocaleString()} كم` : 'بدون عداد'}</span>
              {items.length > 0 && <span>• {items.length} بنود</span>}
              {totalAmount > 0 && <span className="font-semibold text-green-600">• {formatCurrency(totalAmount)}</span>}
            </div>
          </div>
        </div>
        <div>
          {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100">
          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">الفني المسؤول</label>
              <select 
                className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white disabled:bg-gray-50"
                value={techId}
                onChange={(e) => setTechId(e.target.value)}
                disabled={!isEditing}
              >
                <option value="">-- غير محدد --</option>
                {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">قراءة العداد</label>
              <input 
                type="number"
                className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white disabled:bg-gray-50"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                disabled={!isEditing}
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-2 px-3 text-right text-xs font-medium text-gray-500 w-24">النوع</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-gray-500">البند</th>
                  <th className="py-2 px-3 text-center text-xs font-medium text-gray-500 w-16">الكمية</th>
                  <th className="py-2 px-3 text-center text-xs font-medium text-gray-500 w-20">السعر</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-gray-500 w-24">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-xs text-gray-400">لا توجد بنود مسجلة لهذه الزيارة</td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <VisitItemRow 
                      key={idx} 
                      item={item} 
                      isEditing={isEditing} 
                      onChange={(f, v) => updateItem(idx, f, v)}
                      onDelete={() => deleteItem(idx)}
                      servicesCatalog={servicesCatalog}
                      partsCatalog={partsCatalog}
                      rowId={idx}
                    />
                  ))
                )}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan="4" className="py-2 px-3 text-left text-xs font-bold text-gray-700">المجموع الكلي:</td>
                  <td className="py-2 px-3 text-right text-xs font-bold text-blue-600">{formatCurrency(totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
            {isEditing && (
              <button 
                onClick={addItem}
                className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-medium flex items-center justify-center gap-1 transition-colors border-t border-blue-100"
                data-testid={`visit-add-item-button-${visit.id}`}
              >
                <Plus size={14} /> إضافة بند جديد
              </button>
            )}
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">ملاحظات الزيارة</label>
            <textarea 
              className="w-full text-xs border border-gray-300 rounded-lg p-2 min-h-[60px] bg-white disabled:bg-gray-50 resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!isEditing}
              placeholder="أي ملاحظات إضافية..."
              data-testid={`visit-notes-textarea-${visit.id}`}
            />
          </div>


          {latestApproval && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <div className="font-bold mb-1">اعتماد واتساب</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                <div>الحالة: <span className="font-semibold">{latestApproval.status}</span></div>
                <div>الرمز: <span className="font-mono">{latestApproval.token}</span></div>
                {latestApproval.respondedAt && (
                  <div>وقت الرد: <span className="font-semibold">{String(latestApproval.respondedAt).slice(0, 19).replace('T',' ')}</span></div>
                )}
                {latestApproval.responderName && (
                  <div>المعتمد: <span className="font-semibold">{latestApproval.responderName}</span></div>
                )}
              </div>
            </div>
          )}




          <div className="flex justify-end gap-2 pb-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const vId = visit.id;
                // Map visit status to default doc type
                const st = (visit.status || '').toLowerCase();
                const type = st === 'quotation' ? 'quote' : st === 'diagnosis' ? 'diagnosis' : st === 'in_progress' ? 'invoice' : 'invoice';
                window.location.href = `/print?type=${type}&vehicleId=${visit.vehicleId || visit.vehicle_id}&visitId=${vId}`;
              }}
              className="w-full sm:w-auto px-3 py-1.5 text-xs font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-2"
              title="طباعة هذه الزيارة"
              data-testid={`visit-print-button-${visit.id}`}
            >
              <Printer size={14} /> طباعة الزيارة
            </button>
          </div>

          {/* Actions Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            {isEditing ? (
              <>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  onClick={handleSave}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Save size={14} /> حفظ التغييرات
                </button>
                <button 
                  onClick={handleCloseVisit}
                  className="px-4 py-2 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2"
                >
                  <CheckCircle size={14} /> حفظ وإغلاق الزيارة
                </button>
              </>
            ) : (
              <button 
                onClick={handleReopen}
                className="px-4 py-2 text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors flex items-center gap-2"
              >
                <Edit2 size={14} /> إعادة فتح للتعديل
              </button>
            )}


          {canDelete && (visit.status || '').toLowerCase() === 'completed' && (
            <div className="flex justify-end pt-2">
              <button
                onClick={() => onDelete?.(visit.id)}
                className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2"
                data-testid={`visit-delete-button-${visit.id}`}
              >
                <Trash2 size={14} /> حذف الزيارة
              </button>
            </div>
          )}

          </div>
        </div>
      )}
    </div>
  );
};

// --- Main Page Component ---

const VehicleDetails = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [vehicle, setVehicle] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [showFiles, setShowFiles] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
  const [technicians, setTechnicians] = useState([]);
  const [visits, setVisits] = useState([]);
  const [servicesCatalog, setServicesCatalog] = useState([]);
  const [partsCatalog, setPartsCatalog] = useState([]);
  const [visitFilter, setVisitFilter] = useState('all');
  const [createVisitConfirmAt, setCreateVisitConfirmAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Status & Notes (Vehicle Level)
  const [status, setStatus] = useState('diagnosis');
  const [notes, setNotes] = useState('');
  const [assignedTech, setAssignedTech] = useState('');
  
  // Edit Vehicle & Customer State
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({});
  const [customerForm, setCustomerForm] = useState({});
  
  const [scannerOpen, setScannerOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [vehicleFiles, setVehicleFiles] = useState([]);
  const [fileType, setFileType] = useState('photo');
  const [capturedImage, setCapturedImage] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const API_URL = (
    process.env.NODE_ENV === 'production'
      ? '/api'
      : `${process.env.REACT_APP_BACKEND_URL}/api`.replace('//api', '/api')
  );

  const session = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('session'));
    } catch (e) {
      return null;
    }
  }, []);
  const guidanceEnabled = session?.guidanceEnabled !== false;

  const appendService = useCallback((service) => {
    if (!service) return;
    setServicesCatalog((prev) => {
      const exists = prev.some((s) => s.id === service.id || (s.name || '').trim() === (service.name || '').trim());
      return exists ? prev : [...prev, service];
    });
  }, []);

  const appendPart = useCallback((part) => {
    if (!part) return;
    setPartsCatalog((prev) => {
      const exists = prev.some((p) => p.id === part.id || (p.name || '').trim() === (part.name || '').trim());
      return exists ? prev : [...prev, part];
    });
  }, []);

  const activeVisit = useMemo(
    () => visits.find((v) => (v.status || '').toLowerCase() === 'in_progress'),
    [visits]
  );

  const guidanceSteps = useMemo(() => {
    const vehicleReady = Boolean(
      vehicle && (vehicle.customerName || vehicle.customerId) && vehicle.plateNumber
    );
    const hasItems = visits.some((visit) => (visit.items || []).length > 0);
    const statusUpdated = !activeVisit;

    return [
      {
        id: 'vehicle',
        title: 'بيانات العميل والمركبة',
        hint: 'تأكد من الاسم والجوال ولوحة المركبة لتجنب الأخطاء الإملائية.',
        done: vehicleReady,
      },
      {
        id: 'items',
        title: 'تسجيل البنود',
        hint: 'أضف الخدمات أو القطع وتحقق من الأسعار قبل الحفظ.',
        done: hasItems,
      },
      {
        id: 'status',
        title: 'تحديث حالة الزيارة',
        hint: 'غيّر الحالة عند الانتهاء لإغلاق الزيارة وعدم نسيانها.',
        done: statusUpdated,
      },
    ];
  }, [vehicle, visits, activeVisit]);

  const canDeleteVisit = ['manager', 'admin'].includes(session?.role);

  const filteredVisits = useMemo(() => {
    if (visitFilter === 'open') {
      return visits.filter((v) => (v.status || '').toLowerCase() !== 'completed');
    }
    if (visitFilter === 'closed') {
      return visits.filter((v) => (v.status || '').toLowerCase() === 'completed');
    }
    return visits;
  }, [visits, visitFilter]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadingProgress(10);

      const vehiclePromise = vehicleAPI.getById(id).then((r) => {
        setLoadingProgress(40);
        return r;
      });
      const techPromise = technicianAPI.getAll().then((r) => {
        setLoadingProgress(65);
        return r;
      });
      const visitsPromise = axios
        .get(`${API_URL}/vehicles/${id}/visits`)
        .catch(() => ({ data: [] }))
        .then((r) => {
          setLoadingProgress(80);
          return r;
        });

      // Load vehicle + technicians + visits first (core UI)
      const [vehicleRes, techniciansRes, visitsRes] = await Promise.all([
        vehiclePromise,
        techPromise,
        visitsPromise,
      ]);
      
      setVehicle(vehicleRes.data);
      setStatus(vehicleRes.data.status || 'diagnosis');
      setNotes(vehicleRes.data.notes || '');
      setAssignedTech(vehicleRes.data.technicianId || '');
      
      setVehicleForm({
        plateNumber: vehicleRes.data.plateNumber,
        brand: vehicleRes.data.brand,
        model: vehicleRes.data.model,
        vin: vehicleRes.data.vin,
        color: vehicleRes.data.color
      });
      setCustomerForm({
        name: vehicleRes.data.customerName,
        phone: vehicleRes.data.customerPhone,
        email: vehicleRes.data.customerEmail
      });
      
      setTechnicians(techniciansRes.data);
      setVisits(visitsRes.data || []);
      
      // Show loading state as false for core UI
      setLoadingProgress(85);
      setLoading(false);
      
      // Load files and approvals in background
      const filesPromise = fetch(`${API_URL}/vehicles/${id}/files`)
        .then((r) => r.json())
        .catch(() => ({ files: [] }))
        .then((r) => {
          setLoadingProgress(92);
          return r;
        });

      const approvalsPromise = axios
        .get(`${API_URL}/approvals?vehicle_id=${id}`)
        .catch(() => ({ data: [] }))
        .then((r) => {
          setLoadingProgress(98);
          return r;
        });

      const servicesPromise = serviceAPI.getAll().catch(() => ({ data: [] }));
      const partsPromise = partAPI.getAll().catch(() => ({ data: [] }));

      const [filesRes, approvalsRes, servicesRes, partsRes] = await Promise.all([
        filesPromise,
        approvalsPromise,
        servicesPromise,
        partsPromise,
      ]);
      
      setVehicleFiles(filesRes.files || []);
      setServicesCatalog(servicesRes.data || []);
      setPartsCatalog(partsRes.data || []);
      
      const approvalsRows = approvalsRes?.data || [];
      const approvalsByVisit = new Map();
      approvalsRows.forEach((a) => {
        const vId = a.visitId || a.visit_id;
        if (!vId) return;
        if (!approvalsByVisit.has(vId)) approvalsByVisit.set(vId, []);
        approvalsByVisit.get(vId).push(a);
      });
      setApprovals(approvalsRows);

    } catch (error) {
      console.error(error);
      toast({ title: 'خطأ', description: 'فشل تحميل البيانات', variant: 'destructive' });
      setLoading(false);
    } finally {
      setLoadingProgress(100);
    }
  }, [id, API_URL, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Handle Updates
  const handleUpdateVehicleInfo = async () => {
    try {
      await vehicleAPI.update(id, vehicleForm);
      setVehicle(prev => ({ ...prev, ...vehicleForm }));
      setIsEditingVehicle(false);
      toast({ title: 'تم الحفظ', description: 'تم تحديث بيانات المركبة' });
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل تحديث بيانات المركبة', variant: 'destructive' });
    }
  };

  const handleUpdateCustomerInfo = async () => {
    try {
      // If backend supports updating customer from vehicle update endpoint, use that
      // Or update customer directly. For MVP, we update vehicle record which often holds denormalized data
      // But ideally we update customer entity too.
      await vehicleAPI.update(id, {
        customerName: customerForm.name,
        customerPhone: customerForm.phone,
        customerEmail: customerForm.email
      });
      
      if (vehicle.customerId) {
        await customerAPI.update(vehicle.customerId, {
          name: customerForm.name,
          phone: customerForm.phone,
          email: customerForm.email
        });
      }
      
      setVehicle(prev => ({ 
        ...prev, 
        customerName: customerForm.name, 
        customerPhone: customerForm.phone,
        customerEmail: customerForm.email 
      }));
      setIsEditingCustomer(false);
      toast({ title: 'تم الحفظ', description: 'تم تحديث بيانات العميل' });
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل تحديث بيانات العميل', variant: 'destructive' });
    }
  };

  const handleDeleteVisit = async (visitId) => {
    if (!visitId) return;
    if (!window.confirm('هل أنت متأكد من حذف هذه الزيارة؟ سيتم حذف العمليات المرتبطة بها.')) return;
    try {
      await visitAPI.delete(visitId);
      toast({ title: 'تم الحذف', description: 'تم حذف الزيارة بنجاح' });
      fetchData();
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل حذف الزيارة', variant: 'destructive' });
    }
  };

  // Create new visit handler
  const handleCreateVisit = async () => {
    const missingCustomer = !vehicle?.customerName && !vehicle?.customerId;
    if (missingCustomer) {
      toast({
        title: 'تنبيه',
        description: 'يرجى إدخال بيانات العميل والمركبة قبل استقبال الزيارة.',
        variant: 'destructive',
      });
      return;
    }

    const hasOpenVisit = visits.some((v) => (v.status || '').toLowerCase() === 'in_progress');
    if (hasOpenVisit) {
      const now = Date.now();
      if (!createVisitConfirmAt || now - createVisitConfirmAt > 8000) {
        setCreateVisitConfirmAt(now);
        toast({
          title: 'تنبيه',
          description: 'يوجد زيارة مفتوحة بالفعل. اضغط مرة أخرى للتأكيد وتجنب التكرار.',
          variant: 'destructive',
        });
        return;
      }
    }

    const mileage = prompt("أدخل قراءة العداد الحالية (كم):");
    if (mileage === null) return; // Cancelled
    
    try {
      await axios.post(`${API_URL}/vehicles/${id}/visits`, {
        entryDate: new Date().toISOString(),
        status: 'in_progress',
        mileage: Number(mileage) || 0,
        technicianId: null, // Default none
        notes: JSON.stringify({ items: [], text: '' })
      });
      toast({ title: 'تم', description: 'تم فتح زيارة جديدة' });
      setCreateVisitConfirmAt(null);
      fetchData();
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل إنشاء زيارة', variant: 'destructive' });
    }
  };

  // Handle status update (Vehicle Level)
  const handleStatusUpdate = async () => {
    try {
      await vehicleAPI.update(id, { 
        status, 
        notes, 
        technicianId: assignedTech || null
      });
      toast({ title: 'تم الحفظ', description: 'تم تحديث حالة المركبة' });
      fetchData();
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل تحديث الحالة', variant: 'destructive' });
    }
  };

  // Scanner Functions
  const openScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      setScannerOpen(true);
    } catch (err) {
      toast({ title: 'خطأ', description: 'فشل في فتح الكاميرا', variant: 'destructive' });
    }
  };

  const closeScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setScannerOpen(false);
    setCapturedImage(null);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      canvas.toBlob(async (blob) => {
        const reader = new FileReader();
        reader.onload = (e) => setCapturedImage(e.target.result);
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.7);
    }
  };

  const uploadScannedImage = async () => {
    if (!capturedImage) return;
    try {
      const blob = await fetch(capturedImage).then(r => r.blob());
      const file = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${API_URL}/vehicles/${id}/upload-file?file_type=photo`, { method: 'POST', body: formData });
      if (response.ok) {
        toast({ title: 'تم الحفظ', description: 'تم حفظ الصورة بنجاح' });
        closeScanner();
        fetchData();
      }
    } catch (err) {
      toast({ title: 'خطأ', description: 'فشل في رفع الصورة', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
        <div className="text-xs text-gray-400">جاري التحميل... {loadingProgress}%</div>
      </div>
    );
  }
  if (!vehicle) return <div className="text-center py-20">المركبة غير موجودة</div>;

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 pt-4 px-4 sm:px-0">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowRight size={24} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{vehicle.plateNumber}</h1>
            <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getStatusColor(vehicle.status)} text-white`}>
              {getStatusLabel(vehicle.status)}
            </span>
          </div>
          <p className="text-gray-500 mt-1">{vehicle.brand} {vehicle.model} - {vehicle.year}</p>
        </div>
        <div className="flex gap-2">
          <div className="relative group">
            <button className="apple-button flex items-center gap-2">
              <Printer size={18} />
              <span className="hidden sm:inline">طباعة / PDF</span>
            </button>
            {/* Dropdown Menu */}
            <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden hidden group-hover:block z-50">
              <button 
                onClick={() => {
                  const active = visits.find(v => (v.status || '') === 'in_progress') || visits[0];
                  const vid = active?.id;
                  navigate(`/print?type=invoice&vehicleId=${id}${vid ? `&visitId=${vid}` : ''}`);
                }}
                className="w-full text-right px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 transition-colors"
              >
                <Receipt size={16} className="text-green-500" />
                فاتورة مبيعات
              </button>
              <button 
                onClick={() => {
                  const active = visits.find(v => (v.status || '') === 'in_progress') || visits[0];
                  const vid = active?.id;
                  navigate(`/print?type=quote&vehicleId=${id}${vid ? `&visitId=${vid}` : ''}`);
                }}
                className="w-full text-right px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 transition-colors border-t border-slate-100 dark:border-slate-700"
              >
                <FileCheck size={16} className="text-blue-500" />
                عرض سعر
              </button>
              <button 
                onClick={() => {
                  const active = visits.find(v => (v.status || '') === 'in_progress') || visits[0];
                  const vid = active?.id;
                  navigate(`/print?type=diagnosis&vehicleId=${id}${vid ? `&visitId=${vid}` : ''}`);
                }}
                className="w-full text-right px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 transition-colors border-t border-slate-100 dark:border-slate-700"
              >
                <ClipboardList size={16} className="text-orange-500" />
                تقرير تشخيص
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-0" data-testid="vehicle-guidance-stepper">
        <GuidanceStepper
          title="إرشادات ملف المركبة"
          subtitle="خطوات سريعة لتجنب التكرار والأخطاء الإملائية والمالية."
          steps={guidanceSteps}
          enabled={guidanceEnabled}
          storageKey={`guidance-vehicle-${session?.id || session?.name || 'default'}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 sm:px-0">
        
        {/* Left Column: Info */}
        <div className="space-y-6">
          
          {/* Vehicle Info Card */}
          <div className="apple-card p-6 relative group">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 text-blue-600">
                <Car size={20} />
                <h3 className="font-bold text-gray-900">{t('vehicle_details.vehicle_info')}</h3>
              </div>
              <button 
                onClick={() => setIsEditingVehicle(!isEditingVehicle)} 
                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
              >
                {isEditingVehicle ? <X size={18} /> : <Edit2 size={16} />}
              </button>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex flex-col py-2 border-b border-gray-50">
                <span className="text-gray-500 text-xs mb-1">{t('vehicles.plate_number')}</span>
                {isEditingVehicle ? (
                  <input className="text-sm border rounded p-1 w-full" value={vehicleForm.plateNumber} onChange={e => setVehicleForm({...vehicleForm, plateNumber: e.target.value})} />
                ) : (
                  <span className="font-medium">{vehicle.plateNumber}</span>
                )}
              </div>
              <div className="flex flex-col py-2 border-b border-gray-50">
                <span className="text-gray-500 text-xs mb-1">{t('vehicle_details.brand_model')}</span>
                {isEditingVehicle ? (
                  <div className="flex gap-2">
                    <input className="text-sm border rounded p-1 w-1/2" value={vehicleForm.brand} onChange={e => setVehicleForm({...vehicleForm, brand: e.target.value})} placeholder="الماركة" />
                    <input className="text-sm border rounded p-1 w-1/2" value={vehicleForm.model} onChange={e => setVehicleForm({...vehicleForm, model: e.target.value})} placeholder="الموديل" />
                  </div>
                ) : (
                  <span className="font-medium">{vehicle.brand} {vehicle.model}</span>
                )}
              </div>
              <div className="flex flex-col py-2 border-b border-gray-50">
                <span className="text-gray-500 text-xs mb-1">{t('vehicle_details.vin_number')}</span>
                {isEditingVehicle ? (
                  <input className="text-sm border rounded p-1 w-full" value={vehicleForm.vin} onChange={e => setVehicleForm({...vehicleForm, vin: e.target.value})} />
                ) : (
                  <span className="font-medium font-mono">{vehicle.vin || '-'}</span>
                )}
              </div>
              <div className="flex flex-col py-2">
                <span className="text-gray-500 text-xs mb-1">{t('vehicle_details.color')}</span>
                {isEditingVehicle ? (
                  <input className="text-sm border rounded p-1 w-full" value={vehicleForm.color} onChange={e => setVehicleForm({...vehicleForm, color: e.target.value})} />
                ) : (
                  <span className="font-medium">{vehicle.color || '-'}</span>
                )}
              </div>
              
              {isEditingVehicle && (
                <button 
                  onClick={handleUpdateVehicleInfo}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-2 rounded mt-2 font-bold"
                >
                  حفظ التعديلات
                </button>
              )}
            </div>
          </div>

          {/* Customer Info */}
          <div className="apple-card p-6 relative group">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 text-green-600">
                <User size={20} />
                <h3 className="font-bold text-gray-900">{t('vehicle_details.customer_info')}</h3>
              </div>
              <button 
                onClick={() => setIsEditingCustomer(!isEditingCustomer)} 
                className="p-1 text-gray-400 hover:text-green-600 transition-colors"
              >
                {isEditingCustomer ? <X size={18} /> : <Edit2 size={16} />}
              </button>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex flex-col py-2 border-b border-gray-50">
                <span className="text-gray-500 text-xs mb-1">{t('vehicles_page.customer_name')}</span>
                {isEditingCustomer ? (
                  <input className="text-sm border rounded p-1 w-full" value={customerForm.name} onChange={e => setCustomerForm({...customerForm, name: e.target.value})} />
                ) : (
                  <span className="font-medium">{vehicle.customerName}</span>
                )}
              </div>
              <div className="flex flex-col py-2 border-b border-gray-50">
                <span className="text-gray-500 text-xs mb-1">رقم الجوال</span>
                {isEditingCustomer ? (
                  <input className="text-sm border rounded p-1 w-full" value={customerForm.phone} onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} />
                ) : (
                  <span className="font-medium" dir="ltr">{vehicle.customerPhone}</span>
                )}
              </div>
              <div className="flex flex-col py-2">
                <span className="text-gray-500 text-xs mb-1">البريد الإلكتروني</span>
                {isEditingCustomer ? (
                  <input className="text-sm border rounded p-1 w-full" value={customerForm.email} onChange={e => setCustomerForm({...customerForm, email: e.target.value})} />
                ) : (
                  <span className="font-medium">{vehicle.customerEmail || '-'}</span>
                )}
              </div>

              {isEditingCustomer && (
                <button 
                  onClick={handleUpdateCustomerInfo}
                  className="w-full bg-green-600 hover:bg-green-700 text-white text-xs py-2 rounded mt-2 font-bold"
                >
                  حفظ التعديلات
                </button>
              )}
            </div>
          </div>

          {/* Files Section (Load on demand) */}
          <div className="apple-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 text-purple-600">
                <FileText size={20} />
                <h3 className="font-bold text-gray-900 text-sm sm:text-base">{t('vehicle_details.files')}</h3>
              </div>
              <button
                onClick={() => setShowFiles((v) => !v)}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                {showFiles ? 'إخفاء' : 'عرض'}
              </button>
            </div>

            {showFiles && (
              <>
                <div className="flex gap-2 mb-4">
                  <button onClick={openScanner} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600"><Scan size={16} /></button>
                  <label className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 cursor-pointer">
                    <Upload size={16} />
                    <input type="file" className="hidden" onChange={async (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const formData = new FormData();
                        formData.append('file', file);
                        await fetch(`${API_URL}/vehicles/${id}/upload-file?file_type=other`, { method: 'POST', body: formData });
                        fetchData();
                      }
                    }} />
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {vehicleFiles.slice(0, 6).map((file, idx) => (
                    <div key={idx} className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-500 overflow-hidden relative group cursor-pointer" onClick={() => setPreviewImage(`${FILE_BASE}/api/vehicles/${id}/files/${file.id}`)}>
                      {file.filename.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                        <img src={`${FILE_BASE}/api/vehicles/${id}/files/${file.id}`} alt="file" className="w-full h-full object-cover" />
                      ) : (
                        <FileText size={24} />
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {!showFiles && (
              <div className="text-xs text-gray-400">اضغط “عرض” لتحميل ملفات المركبة</div>
            )}
          </div>
        </div>

        {/* Center Column: Visits Timeline */}
        <div className="lg:col-span-1 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Wrench size={20} className="text-blue-600" />
              سجل الزيارات
            </h2>
            <button 
              onClick={handleCreateVisit}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1"
            >
              <Plus size={14} /> زيارة جديدة
            </button>
          </div>

          <div className="text-[11px] text-gray-500 -mt-2">
            {t('vehicle_details.items_edit_hint')}
          </div>

          <div className="flex flex-wrap gap-2 text-xs" data-testid="visit-filter-controls">
            {[
              { key: 'all', label: 'كل الزيارات', count: visits.length },
              { key: 'open', label: 'المفتوحة', count: visits.filter(v => (v.status || '').toLowerCase() !== 'completed').length },
              { key: 'closed', label: 'المغلقة', count: visits.filter(v => (v.status || '').toLowerCase() === 'completed').length },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setVisitFilter(filter.key)}
                className={`px-3 py-1.5 rounded-full border transition-all ${
                  visitFilter === filter.key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
                }`}
                data-testid={`visit-filter-${filter.key}`}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </div>

          {visitFilter !== 'all' && filteredVisits.length === 0 && visits.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 flex items-center justify-between">
              <span>لا توجد زيارات في هذا الفلتر. الزيارات موجودة في فلاتر أخرى.</span>
              <button onClick={() => setVisitFilter('all')} className="text-amber-700 font-bold underline mr-2">عرض الكل</button>
            </div>
          )}

          <div className="space-y-4">
            {filteredVisits.length === 0 && (visitFilter === 'all' || visits.length === 0) ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Calendar size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-xs text-gray-500">لا توجد زيارات بعد</p>
                <p className="text-[11px] text-gray-400 mt-1">اضغط "زيارة جديدة" لاستقبال المركبة</p>
              </div>
            ) : (
              filteredVisits.map(visit => {
                const normVisit = {
                  ...visit,
                  entryDate: visit.entryDate || visit.entry_date,
                  exitDate: visit.exitDate || visit.exit_date,
                  technicianId: visit.technicianId || visit.technician_id,
                  createdAt: visit.createdAt || visit.created_at,
                };
                const visitApprovals = approvals
                  .filter((a) => (a.visitId || a.visit_id) === normVisit.id)
                  .sort((x, y) => String(y.createdAt || y.created_at || '').localeCompare(String(x.createdAt || x.created_at || '')));

                return (
                  <VisitCard
                    key={normVisit.id}
                    visit={normVisit}
                    technicians={technicians}
                    onUpdate={fetchData}
                    approvals={visitApprovals}
                    onDelete={handleDeleteVisit}
                    servicesCatalog={servicesCatalog}
                    partsCatalog={partsCatalog}
                    onServiceAdded={appendService}
                    onPartAdded={appendPart}
                    canDelete={canDeleteVisit}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Status & Actions */}
        <div className="space-y-6">
          <div className="apple-card p-6">
            <div className="flex items-center gap-3 mb-6 text-orange-600">
              <Wrench size={20} />
              <h3 className="font-bold text-gray-900">{t('vehicle_details.status')}</h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{t('quick_actions.change_status')}</label>
                <select className="apple-input" value={status} onChange={e => setStatus(e.target.value)}>
                  {statusSteps.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">الفني المسؤول</label>
                <select className="apple-input" value={assignedTech} onChange={e => setAssignedTech(e.target.value)}>
                  <option value="">اختر الفني...</option>
                  {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">ملاحظات عامة</label>
                <textarea 
                  className="apple-input h-32 py-3 resize-none" 
                  placeholder="ملاحظات..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <button onClick={handleStatusUpdate} className="apple-button w-full mt-2">
                حفظ التحديثات
              </button>
            </div>
          </div>

          <div className="apple-card p-6">
            <div className="flex items-center gap-3 mb-4 text-gray-900">
              <Clock size={20} />
              <h3 className="font-bold">التواريخ</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">تاريخ الدخول</span>
                <span className="font-medium">{new Date(vehicle.entryDate).toLocaleDateString('ar-SA')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">آخر تحديث</span>
                <span className="font-medium">{new Date(vehicle.updatedAt).toLocaleDateString('ar-SA')}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Modals */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 relative">
            <button onClick={closeScanner} className="absolute top-4 left-4 p-2 bg-gray-100 rounded-full"><X size={20} /></button>
            <h3 className="text-lg font-bold mb-4 text-center">التقاط صورة</h3>
            {!capturedImage ? (
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
                <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
              </div>
            )}
            <div className="flex gap-3">
              {!capturedImage ? (
                <button onClick={captureImage} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold">التقاط</button>
              ) : (
                <>
                  <button onClick={() => setCapturedImage(null)} className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl font-bold">إعادة</button>
                  <button onClick={uploadScannedImage} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold">حفظ</button>
                </>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <button className="absolute top-4 left-4 text-white p-2" onClick={() => setPreviewImage(null)}><X size={32} /></button>
          <img src={previewImage} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}

    </div>
  );
};

export default VehicleDetails;
