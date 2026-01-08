import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Car, User, Phone, Calendar, Wrench, MessageSquare, CheckCircle, FileText, Upload, Printer, Receipt, ClipboardList, Clock, Trash2, Camera, X } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { vehicleAPI, technicianAPI } from '../services/api';
import { statusSteps, getStatusLabel, getStatusColor } from '../mock/data';

const VehicleDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [vehicle, setVehicle] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('diagnosis');
  const [notes, setNotes] = useState('');
  const [assignedTech, setAssignedTech] = useState('');
  const [vehicleFiles, setVehicleFiles] = useState([]);
  const [vehicleOperations, setVehicleOperations] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [newService, setNewService] = useState('');
  const [fileType, setFileType] = useState('photo');
  const [newItem, setNewItem] = useState({ itemType: 'service', name: '', quantity: 1, price: 0 });
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => { fetchData(); }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
      const [vehicleRes, techniciansRes, filesRes, approvalsRes, opsRes] = await Promise.all([
        vehicleAPI.getById(id),
        technicianAPI.getAll(),
        fetch(`${API_URL}/vehicles/${id}/files`).then(r => r.json()).catch(() => ({files: []})),
        fetch(`${API_URL}/approvals?vehicle_id=${id}`).then(r => r.json()).catch(() => []),
        axios.get(`${API_URL}/operations?vehicle_id=${id}`)
      ]);
      setVehicle(vehicleRes.data);
      setTechnicians(techniciansRes.data);
      setVehicleFiles(filesRes.files || []);
      setApprovals(approvalsRes || []);
      setVehicleOperations(opsRes.data || []);
      setStatus(vehicleRes.data.status || 'diagnosis');
      setNotes(vehicleRes.data.notes || '');
      setAssignedTech(vehicleRes.data.technicianId || '');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    try {
      setLoading(true);
      const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
      
      // حفظ بيانات المركبة
      await vehicleAPI.update(id, { 
        status, 
        notes, 
        technicianId: assignedTech,
        parts: vehicle.parts,
        services: vehicle.services
      });
      
      // إنشاء أو تحديث عملية تلقائية إذا كان هناك بنود
      if (vehicle.parts && vehicle.parts.length > 0) {
        const operationItems = vehicle.parts.map(item => ({
          itemType: item.itemType || 'service',
          itemId: item.id,
          name: item.name,
          quantity: item.quantity || 1,
          price: item.price || 0,
          total: (item.quantity || 1) * (item.price || 0)
        }));
        
        // جلب العمليات الحالية للمركبة من الخادم
        const opsRes = await axios.get(`${API_URL}/operations?vehicle_id=${id}`);
        const currentOps = opsRes.data || [];
        
        // البحث عن عملية موجودة لنفس المركبة في نفس اليوم
        const today = new Date().toISOString().split('T')[0];
        const existingOps = currentOps.filter(op => {
          const opDate = new Date(op.date || op.createdAt).toISOString().split('T')[0];
          return opDate === today && op.type === 'sale';
        });
        
        const operationData = {
          vehicleId: id,
          type: 'sale',
          partnerType: 'customer',
          partnerName: vehicle.customerName || '',
          items: operationItems,
          paymentMethod: 'cash',
          notes: `عملية من ملف المركبة: ${vehicle.plateNumber}`
        };
        
        if (existingOps.length > 0) {
          // تحديث العملية الموجودة
          await axios.put(`${API_URL}/operations/${existingOps[0].id}`, operationData);
        } else {
          // إنشاء عملية جديدة
          await axios.post(`${API_URL}/operations`, operationData);
        }
      }
      
      toast({ title: 'تم الحفظ', description: 'تم حفظ جميع التحديثات بنجاح' });
      // Only fetch after successful save to sync with server
      await fetchData();
    } catch (error) {
      console.error('Save error:', error);
      toast({ title: "خطأ", description: "فشل الحفظ", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Helper to update parts locally
  const updatePartsLocally = (newParts) => {
    setVehicle(prev => ({ ...prev, parts: newParts }));
  };

  // Helper to update services locally
  const updateServicesLocally = (newServices) => {
    setVehicle(prev => ({ ...prev, services: newServices }));
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" /></div>;
  if (!vehicle) return <div className="text-center py-20">المركبة غير موجودة</div>;

  const currentStepIndex = statusSteps.findIndex(s => s.key === status);

  // Calculate totals
  const totalParts = vehicle?.parts?.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.price || 0)), 0) || 0;
  // Services don't have explicit prices in the current model unless we map them or change structure.
  // Assuming services might just be names for now or if we adapt them to be objects too.
  // Based on current 'parts' array usage for both parts and services (itemType), the total is already captured there.
  
  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 pt-4">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowRight size={24} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">{vehicle.plateNumber}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)} text-white`}>
                {getStatusLabel(status)}
              </span>
            </div>
            <p className="text-gray-500 mt-1">{vehicle.brand} {vehicle.model} - {vehicle.year}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate(`/print?type=invoice&vehicleId=${id}`)} className="apple-button flex items-center gap-2">
              <Printer size={18} />
              <span>طباعة</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="apple-card p-6 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[600px]">
            {statusSteps.map((step, index) => (
              <div key={step.key} className="flex flex-col items-center relative z-10 group">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  index <= currentStepIndex ? step.color + ' text-white shadow-md scale-110' : 'bg-gray-100 text-gray-400'
                }`}>
                  {index < currentStepIndex ? <CheckCircle size={20} /> : <span className="font-bold text-sm">{index + 1}</span>}
                </div>
                <span className={`mt-3 text-xs font-medium ${index <= currentStepIndex ? 'text-gray-900' : 'text-gray-400'}`}>
                  {step.label}
                </span>
                {index < statusSteps.length - 1 && (
                  <div className={`absolute top-5 right-1/2 w-[calc(100%+200%)] h-[2px] -z-10 ${
                    index < currentStepIndex ? 'bg-green-500' : 'bg-gray-100'
                  }`} style={{ width: 'calc(100% + 100px)', marginRight: '-50px' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Vehicle & Customer Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="apple-card p-6">
                <div className="flex items-center gap-3 mb-4 text-blue-600">
                  <Car size={20} />
                  <h3 className="font-bold text-gray-900">بيانات المركبة</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">رقم اللوحة</span>
                    <span className="font-medium">{vehicle.plateNumber}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">الماركة والموديل</span>
                    <span className="font-medium">{vehicle.brand} {vehicle.model}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">رقم الهيكل</span>
                    <span className="font-medium font-mono">{vehicle.vin || '-'}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-500">اللون</span>
                    <span className="font-medium">{vehicle.color || '-'}</span>
                  </div>
                {/* Registered Services for this vehicle */}
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <h4 className="text-sm font-semibold text-gray-100 mb-2 flex items-center gap-2">
                    <Wrench size={16} className="text-orange-400" />
                    <span>الخدمات المسجّلة لهذه المركبة</span>
                  </h4>

                  {/* إدارة البنود (الخدمات/القطع) كأساس للمبيعات */}
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-2">
                        <label className="text-[11px] text-gray-400 mb-1 block">النوع</label>
                        <select
                          className="apple-input h-8 text-xs"
                          value={newItem.itemType}
                          onChange={e => setNewItem({ ...newItem, itemType: e.target.value })}
                        >
                          <option value="service">خدمة</option>
                          <option value="part">قطعة غيار</option>
                        </select>
                      </div>
                      <div className="col-span-4">
                        <label className="text-[11px] text-gray-400 mb-1 block">الاسم</label>
                        <input
                          className="apple-input h-8 text-xs"
                          placeholder="وصف البند (خدمة/قطعة)"
                          value={newItem.name}
                          onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[11px] text-gray-400 mb-1 block">الكمية</label>
                        <input
                          type="number"
                          className="apple-input h-8 text-xs"
                          value={newItem.quantity}
                          onChange={e => setNewItem({ ...newItem, quantity: Number(e.target.value) || 1 })}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[11px] text-gray-400 mb-1 block">السعر</label>
                        <input
                          type="number"
                          className="apple-input h-8 text-xs"
                          value={newItem.price}
                          onChange={e => setNewItem({ ...newItem, price: Number(e.target.value) || 0 })}
                          placeholder="0"
                        />
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs rounded-lg bg-gray-700 text-white hover:bg-gray-600"
                          onClick={() => {
                            const name = (newItem.name || '').trim();
                            if (!name) {
                              toast({ title: 'تنبيه', description: 'الاسم مطلوب', variant: 'destructive' });
                              return;
                            }
                            const existing = vehicle.parts || [];
                            const item = {
                              id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                              itemType: newItem.itemType,
                              name,
                              quantity: newItem.quantity || 1,
                              price: newItem.price || 0,
                            };
                            const updatedParts = [...existing, item];
                            updatePartsLocally(updatedParts);
                            setNewItem({ itemType: 'service', name: '', quantity: 1, price: 0 });
                            toast({ title: 'تمت الإضافة', description: 'اضغط حفظ التحديثات للتثبيت' });
                          }}
                        >
                          إضافة بند
                        </button>
                      </div>
                    </div>

                    {vehicle.parts && vehicle.parts.length > 0 && (
                      <div className="mt-2 border border-gray-800 rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-800 text-gray-300">
                            <tr>
                              <th className="p-2 text-right font-medium">النوع</th>
                              <th className="p-2 text-right font-medium">الاسم</th>
                              <th className="p-2 text-right font-medium">الكمية</th>
                              <th className="p-2 text-right font-medium">السعر</th>
                              <th className="p-2 text-right font-medium">الإجمالي</th>
                              <th className="p-2"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800 bg-gray-900/50">
                            {(vehicle.parts || []).filter(Boolean).map((it, idx) => (
                              <tr key={`part-${it.id || idx}-${idx}`}>
                                <td className="p-2 text-gray-400">
                                  {it.itemType === 'part' ? 'قطعة غيار' : 'خدمة'}
                                </td>
                                <td className="p-2 text-gray-200 font-medium">{it.name}</td>
                                <td className="p-2 text-gray-400">{it.quantity || 1}</td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    className="w-20 px-2 py-1 text-xs border border-gray-700 bg-gray-800 rounded text-white"
                                    value={it.price || 0}
                                    onChange={(e) => {
                                      const newPrice = Number(e.target.value) || 0;
                                      const updatedParts = [...(vehicle.parts || [])];
                                      updatedParts[idx] = { ...updatedParts[idx], price: newPrice };
                                      updatePartsLocally(updatedParts);
                                    }}
                                  />
                                  <span className="text-xs text-gray-500 mr-1">ر.س</span>
                                </td>
                                <td className="p-2 text-gray-200 font-semibold">
                                  {((it.quantity || 1) * (it.price || 0)).toLocaleString('ar-SA')} ر.س
                                </td>
                                <td className="p-2 text-right">
                                  <button
                                    type="button"
                                    className="p-1 rounded-full hover:bg-red-900/20 text-red-500"
                                    onClick={() => {
                                      const updated = (vehicle.parts || []).filter((p, i) => i !== idx);
                                      updatePartsLocally(updated);
                                      toast({ title: 'تم الحذف مؤقتاً', description: 'اضغط حفظ التحديثات للتثبيت' });
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-100 border-t-2 border-gray-200">
                            <tr>
                              <td colSpan="4" className="p-3 text-left font-bold text-gray-700">المجموع الكلي:</td>
                              <td className="p-3 font-bold text-blue-700 text-sm">
                                {totalParts.toLocaleString('ar-SA')} ر.س
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>

                  </div>
                  
                  {(!vehicle.services || vehicle.services.length === 0) ? (
                    <p className="text-xs text-gray-500 mt-2">لا توجد خدمات مسجّلة.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(vehicle.services || []).filter(Boolean).map((service, i) => (
                        <span
                          key={`service-${i}-${typeof service === 'string' ? service.slice(0,10) : i}`}
                          className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20"
                        >
                          {service}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="apple-card p-6">
                <div className="flex items-center gap-3 mb-4 text-green-600">
                  <User size={20} />
                  <h3 className="font-bold text-gray-900">بيانات العميل</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">الاسم</span>
                    <span className="font-medium">{vehicle.customerName}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">رقم الجوال</span>
                    <span className="font-medium" dir="ltr">{vehicle.customerPhone}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-500">البريد الإلكتروني</span>
                    <span className="font-medium">{vehicle.customerEmail || '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Files & Images Section */}
            <div className="apple-card p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 text-purple-600">
                  <FileText size={20} />
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base">الملفات والمرفقات</h3>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="apple-input h-8 text-xs sm:text-sm flex-1 sm:w-32"
                    value={fileType}
                    onChange={e => setFileType(e.target.value)}
                  >
                    <option value="photo">📷 صورة</option>
                    <option value="diagnostic">🔧 تشخيص</option>
                    <option value="invoice">📄 فاتورة</option>
                    <option value="video">🎥 فيديو</option>
                    <option value="other">📎 أخرى</option>
                  </select>
                  <label className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap">
                    <Upload size={14} />
                    <span>رفع</span>
                    <input type="file" accept="image/*,video/*,.pdf,.doc,.docx" className="hidden" onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      try {
                        const formData = new FormData();
                        formData.append('file', file);
                        const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
                        const response = await fetch(`${API_URL}/vehicles/${id}/upload-file?file_type=${fileType}`, { 
                          method: 'POST', 
                          body: formData 
                        });
                        if (response.ok) {
                          toast({ title: 'تم الرفع', description: `تم رفع ${file.name} بنجاح` });
                          await fetchData();
                        } else {
                          throw new Error('فشل رفع الملف');
                        }
                      } catch (err) { 
                        console.error('Upload error:', err);
                        toast({ title: 'خطأ', description: 'فشل في رفع الملف', variant: 'destructive' }); 
                      }
                      e.target.value = '';
                    }} />
                  </label>
                </div>
              </div>
              
              {vehicleFiles.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Camera size={32} className="mx-auto mb-2 opacity-50" />
                  <p>لا توجد ملفات مرفقة</p>
                  <p className="text-xs mt-1">اضغط "رفع" لإضافة صور أو ملفات</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Images Grid */}
                  {vehicleFiles.filter(f => f.fileType === 'photo' || f.filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i)).length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2 font-medium">📷 الصور</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {vehicleFiles.filter(f => f.fileType === 'photo' || f.filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i)).map((file, idx) => (
                          <div key={`img-${file.id || idx}`} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                            <img
                              src={`${process.env.REACT_APP_BACKEND_URL}/api/vehicles/${id}/files/${file.id}`}
                              alt={file.filename}
                              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                              onClick={() => setPreviewImage(`${process.env.REACT_APP_BACKEND_URL}/api/vehicles/${id}/files/${file.id}`)}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('هل تريد حذف هذه الصورة؟')) {
                                  // TODO: Implement delete
                                  toast({ title: 'حذف', description: 'ميزة الحذف قيد التطوير' });
                                }
                              }}
                              className="absolute top-1 left-1 p-1 bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Other Files List */}
                  {vehicleFiles.filter(f => f.fileType !== 'photo' && !f.filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i)).length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2 font-medium">📄 ملفات أخرى</p>
                      <div className="space-y-2">
                        {vehicleFiles.filter(f => f.fileType !== 'photo' && !f.filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i)).map((file, idx) => (
                          <div key={`file-${file.id || idx}`} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <a 
                              href={`${process.env.REACT_APP_BACKEND_URL}/api/vehicles/${id}/files/${file.id}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity flex-1 min-w-0"
                            >
                              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-white flex items-center justify-center text-gray-400 border border-gray-100 flex-shrink-0">
                                <FileText size={14} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors truncate">{file.filename}</p>
                                <p className="text-[10px] sm:text-xs text-gray-500">{file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString('ar-SA') : '-'}</p>
                              </div>
                            </a>
                            <span className="text-[10px] sm:text-xs bg-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border border-gray-100 text-gray-500 uppercase flex-shrink-0">{file.fileType}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Image Preview Modal */}
            {previewImage && (
              <div 
                className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                onClick={() => setPreviewImage(null)}
              >
                <button 
                  className="absolute top-4 left-4 text-white p-2 bg-black/50 rounded-full hover:bg-black/70"
                  onClick={() => setPreviewImage(null)}
                >
                  <X size={24} />
                </button>
                <img 
                  src={previewImage} 
                  alt="معاينة الصورة" 
                  className="max-w-full max-h-[90vh] object-contain rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            </div>

            {/* Vehicle Operations Summary */}
            <div className="apple-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 text-blue-600">
                  <FileText size={20} />
                  <h3 className="font-bold text-gray-900">سجل الصيانة والعمليات</h3>
                </div>
                <span className="text-xs text-gray-500">
                  عدد الزيارات: {vehicleOperations.length}
                </span>
              </div>

              {vehicleOperations.length === 0 ? (
                <p className="text-sm text-gray-400">لا توجد عمليات مسجّلة لهذه المركبة بعد.</p>
              ) : (
                <div className="space-y-3">
                  {/* آخر عملية (أحدث سجل) */}
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-700">آخر عملية صيانة</p>
                      <p className="text-sm font-semibold text-blue-900">
                        {new Date(vehicleOperations[0].date || vehicleOperations[0].createdAt).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/operations?vehicleId=${id}`)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                      عرض جميع العمليات
                    </button>
                  </div>

                  {/* قائمة مختصرة لآخر 3 عمليات */}
                  <div className="space-y-2">
                    {(vehicleOperations || []).slice(0, 3).filter(Boolean).map((op, idx) => (
                      <div
                        key={`op-${op.id || idx}`}
                        className="p-3 rounded-lg border border-gray-100 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/operations?vehicleId=${id}`)}
                      >
                        <div className="text-xs text-gray-600">
                          <p className="font-medium text-gray-900">
                            {op.type === 'sale' ? 'عملية بيع / فاتورة' : op.type === 'purchase' ? 'عملية شراء / مصروف' : 'عملية'}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {op.partnerName || 'غير محدد'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">{Number(op.total || 0).toLocaleString('ar-SA')} ر.س</p>
                          <p className="text-[11px] text-gray-400">
                            {op.date ? new Date(op.date).toLocaleDateString('en-GB') : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Actions */}
          <div className="space-y-6">
            <div className="apple-card p-6">
              <div className="flex items-center gap-3 mb-6 text-orange-600">
                <Wrench size={20} />
                <h3 className="font-bold text-gray-900">إدارة العمل</h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">تحديث الحالة</label>
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
                  <label className="text-sm font-medium text-gray-700">ملاحظات</label>
                  <textarea 
                    className="apple-input h-32 py-3 resize-none" 
                    placeholder="ملاحظات الفني..."
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
      </div>
  );
};

export default VehicleDetails;
