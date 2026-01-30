import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { CheckCircle, FileText, Printer, Trash2, X, Share2, BadgeCheck, Package, Wrench, Upload, XCircle } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DocumentFormDialog from './DocumentFormDialog';
import { useTranslation } from 'react-i18next';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const VehicleQuickActions = ({ isOpen, onClose, vehicle, onStatusUpdate, onDelete }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { toast } = useToast();
  const navigate = useNavigate();
  const [newStatus, setNewStatus] = useState(vehicle?.status || 'diagnosis');
  const [loading, setLoading] = useState(false);
  
  // Document form dialogs
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [currentDocType, setCurrentDocType] = useState('');

  useEffect(() => {
    setNewStatus(vehicle?.status || 'diagnosis');
  }, [vehicle]);

  const statusOptions = [
    { value: 'diagnosis', label: t('status.diagnosis'), color: 'bg-yellow-500' },
    { value: 'quotation', label: t('status.quotation'), color: 'bg-blue-500' },
    { value: 'approved', label: t('status.approved'), color: 'bg-green-500' },
    { value: 'repair', label: t('status.repair'), color: 'bg-orange-500' },
    { value: 'ready', label: t('status.ready'), color: 'bg-green-600' },
    { value: 'delivered', label: t('status.delivered'), color: 'bg-gray-500' }
  ];

  const handleStatusUpdate = async () => {
    try {
      setLoading(true);
      await onStatusUpdate(newStatus);
      
      // Notify Dashboard and other pages to refresh
      window.dispatchEvent(new CustomEvent('vehicleUpdated', { 
        detail: { vehicleId: vehicle?.id, status: newStatus, timestamp: Date.now() } 
      }));
      
      toast({ title: t('common.success'), description: t('messages.success_updated') });
      onClose();
    } catch (error) {
      toast({ title: t('common.error'), description: t('messages.error_occurred'), variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const openDocumentDialog = (docType) => {
    setCurrentDocType(docType);
    setDocumentDialogOpen(true);
  };

  const handleDocumentSaved = (savedDoc) => {
    toast({ title: t('common.success'), description: t('messages.success_saved') });
    setDocumentDialogOpen(false);
  };

  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalForm, setApprovalForm] = useState({
    title: 'طلب اعتماد الإصلاح',
    amount: '',
    expiryDays: '7',
    images: []
  });
  const [workshopProfile, setWorkshopProfile] = useState(null);

  useEffect(() => {
    // Load workshop profile
    const loadProfile = async () => {
      try {
        const res = await axios.get(`${API_URL}/profile`);
        setWorkshopProfile(res.data);
      } catch (e) {
        console.error('Failed to load workshop profile:', e);
      }
    };
    loadProfile();
  }, []);

  const handleRequestApproval = async () => {
    setApprovalDialogOpen(true);
  };

  const handleApprovalImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length + approvalForm.images.length > 5) {
      toast({ title: 'تنبيه', description: 'الحد الأقصى 5 صور', variant: 'destructive' });
      return;
    }
    
    // Convert to base64
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setApprovalForm(prev => ({
          ...prev,
          images: [...prev.images, { data: e.target.result, name: file.name }]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeApprovalImage = (index) => {
    setApprovalForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const submitApprovalRequest = async () => {
    try {
      if (!approvalForm.title || !approvalForm.amount) {
        toast({ title: 'خطأ', description: 'الرجاء إدخال العنوان والمبلغ', variant: 'destructive' });
        return;
      }
      
      setLoading(true);
      const payload = {
        vehicleId: vehicle?.id,
        customerId: vehicle?.customerId,
        title: approvalForm.title,
        amount: parseFloat(approvalForm.amount || '0'),
        expiryDays: parseInt(approvalForm.expiryDays || '7'),
        images: approvalForm.images
      };
      
      const { data } = await axios.post(`${API_URL}/approvals`, payload);
      toast({ title: 'تم الإرسال', description: 'تم إنشاء طلب الاعتماد' });
      const approvalLink = `${window.location.origin}/approval/${data.token}`;
      
      // Get workshop name and slogan
      const workshopName = workshopProfile?.name || 'ورشة عبدالله الكبير';
      const workshopSlogan = workshopProfile?.sloganAr || workshopProfile?.slogan || '';
      
      // Build WhatsApp message with workshop identity
      let message = `*${workshopName}*\n`;
      if (workshopSlogan) {
        message += `${workshopSlogan}\n`;
      }
      message += `\nالسلام عليكم ${vehicle?.customerName}\n\n`;
      message += `📋 *${approvalForm.title}*\n`;
      message += `💰 المبلغ المتوقع: *${approvalForm.amount} ر.س*\n\n`;
      message += `للموافقة على الطلب، يرجى الضغط على الرابط:\n`;
      message += `${approvalLink}\n\n`;
      message += `🔒 الرابط آمن وصالح لمدة ${approvalForm.expiryDays} يوم`;
      
      // Send to WhatsApp
      await sendToWhatsApp('approval', approvalLink, message);
      
      setNewStatus('quotation');
      setApprovalDialogOpen(false);
      setApprovalForm({ title: 'طلب اعتماد الإصلاح', amount: '', expiryDays: '7', images: [] });
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر إرسال طلب الاعتماد', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const [lastWhatsappUrl, setLastWhatsappUrl] = useState('');

  const sendToWhatsApp = (type, link, customMessage) => {
    const phone = vehicle?.customerPhone || '';
    if (!phone) {
      toast({ title: 'تنبيه', description: 'رقم هاتف العميل غير متوفر', variant: 'destructive' });
      return;
    }

    // تطبيع الرقم لصيغة دولية سعودية 9665xxxxxxx
    let norm = phone.replace(/[^0-9+]/g, '');
    if (norm.startsWith('00')) norm = norm.slice(2);
    if (norm.startsWith('+')) norm = norm.slice(1);
    if (norm.startsWith('05')) {
      norm = '966' + norm.slice(1);
    } else if (norm.startsWith('5') && norm.length === 9) {
      norm = '966' + norm;
    } else if (!norm.startsWith('966')) {
      norm = '966' + norm;
    }

    // رسالة بسيطة وواضحة لتقليل مشاكل iOS
    const msg = customMessage || `السلام عليكم ${vehicle?.customerName} - ${link}`;
    const encoded = encodeURIComponent(msg);

    const whatsappUrl = `https://api.whatsapp.com/send?phone=${norm}&text=${encoded}`;
    setLastWhatsappUrl(whatsappUrl);

    // إغلاق نافذة طلب الاعتماد قبل الانتقال
    try {
      setApprovalDialogOpen(false);
    } catch (e) {
      // تجاهل أي خطأ
    }

    // فتح الرابط مباشرة في نفس التبويب (الأكثر استقراراً على iOS)
    window.location.href = whatsappUrl;
  };


  const handlePrintAndSend = async (type) => {
    // Generate link for sharing
    const trackingLink = `${window.location.origin}/track/${vehicle?.trackingLink || vehicle?.id}`;
    let message = `السلام عليكم ${vehicle?.customerName}\n`;
    
    if (type === 'diagnosis') {
      message += `تقرير التشخيص للمركبة ${vehicle?.plateNumber}\nللاطلاع: ${trackingLink}`;
    } else if (type === 'invoice') {
      message += `فاتورة المركبة ${vehicle?.plateNumber}\nللاطلاع: ${trackingLink}`;
    } else if (type === 'quote') {
      message += `عرض السعر للمركبة ${vehicle?.plateNumber}\nللاطلاع: ${trackingLink}`;
    } else if (type === 'receipt') {
      message += `سند القبض\nللاطلاع: ${trackingLink}`;
    }
    
    await sendToWhatsApp(type, trackingLink, message);
  };

  const handleDelete = async () => {
    if (!window.confirm(t('quick_actions.confirm_delete'))) return;
    try {
      setLoading(true);
      await onDelete();
      toast({ title: t('common.success'), description: t('messages.success_deleted') });
      onClose();
    } catch (error) {
      toast({ title: t('common.error'), description: t('messages.error_occurred'), variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleDialogOpenChange = (v) => {
    if (!v) {
      if (documentDialogOpen) setDocumentDialogOpen(false);
      onClose?.();
    }
  };

  if (!vehicle) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className={`w-[95vw] max-w-[520px] max-h-[90vh] overflow-y-auto ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader className="sticky top-0 bg-card z-10 pb-2">
            <DialogTitle className="flex items-center justify-between text-base sm:text-lg">
              <span>{t('quick_actions.title')}</span>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 sm:h-10 sm:w-10"><X size={18} /></Button>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
              {t('quick_actions.subtitle') || ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 sm:space-y-6 pb-4">
            {/* Vehicle Info Card */}
            <div className="bg-muted/50 p-3 sm:p-4 rounded-lg border border-border">
              <h3 className="font-bold text-base sm:text-lg text-foreground mb-1">{vehicle.plateNumber}</h3>
              <p className="text-muted-foreground text-xs sm:text-sm">{vehicle.brand} {vehicle.model} - {vehicle.year}</p>
              <p className="text-muted-foreground text-xs sm:text-sm">{vehicle.customerName}</p>
            </div>

            {/* Status Update */}
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-sm sm:text-base font-semibold">{t('quick_actions.change_status')}</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="w-full h-10 sm:h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map(option => (
                    <SelectItem key={`status-${option.value}`} value={option.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${option.color}`}></div>
                        <span className="text-sm">{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleStatusUpdate} disabled={loading || newStatus === vehicle.status} className="w-full h-10 sm:h-11 bg-blue-600 hover:bg-blue-700 text-white text-sm">
                <CheckCircle size={16} className="ml-2" />{t('quick_actions.change_status')}
              </Button>
            </div>

            {/* Quick Actions Grid - 2 columns on mobile */}
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-sm sm:text-base font-semibold">{t('quick_actions.title')}</Label>

              <div className="grid grid-cols-2 gap-2">
                {/* Approval Request */}
                <Button onClick={handleRequestApproval} disabled={loading} variant="outline" className="h-auto py-3 px-2 flex-col gap-1 text-xs hover:bg-green-500/10 hover:text-green-400">
                  <BadgeCheck size={18} />
                  <span>{t('quick_actions.send_approval')}</span>
                </Button>

                {/* Diagnosis Report - Navigate to print page */}
                <Button onClick={() => navigate(`/print?type=diagnosis&vehicleId=${vehicle.id}`)} disabled={loading} variant="outline" className="h-auto py-3 px-2 flex-col gap-1 text-xs hover:bg-blue-500/10 hover:text-blue-400">
                  <FileText size={18} />
                  <span>{t('quick_actions.diagnosis_report')}</span>
                </Button>

                {/* Quote - Navigate to print page */}
                <Button onClick={() => navigate(`/print?type=quote&vehicleId=${vehicle.id}`)} disabled={loading} variant="outline" className="h-auto py-3 px-2 flex-col gap-1 text-xs hover:bg-amber-500/10 hover:text-amber-400">
                  <FileText size={18} />
                  <span>{t('quick_actions.print_quotation')}</span>
                </Button>

                {/* Invoice - Navigate to print page */}
                <Button onClick={() => navigate(`/print?type=invoice&vehicleId=${vehicle.id}`)} disabled={loading} variant="outline" className="h-auto py-3 px-2 flex-col gap-1 text-xs hover:bg-purple-500/10 hover:text-purple-400">
                  <Printer size={18} />
                  <span>{t('quick_actions.print_invoice')}</span>
                </Button>

                {/* Receipt - Navigate to print page */}
                <Button onClick={() => navigate(`/print?type=receipt&vehicleId=${vehicle.id}`)} disabled={loading} variant="outline" className="h-auto py-3 px-2 flex-col gap-1 text-xs hover:bg-emerald-500/10 hover:text-emerald-400">
                  <FileText size={18} />
                  <span>{t('quick_actions.receipt')}</span>
                </Button>

                {/* Details */}
                <Button onClick={() => navigate(`/vehicle/${vehicle.id}`)} disabled={loading} variant="outline" className="h-auto py-3 px-2 flex-col gap-1 text-xs hover:bg-slate-700/50">
                  <FileText size={18} />
                  <span>{t('quick_actions.details')}</span>
                </Button>

                {/* Parts - Navigate to vehicle page with parts tab */}
                <Button onClick={() => navigate(`/vehicle/${vehicle.id}?tab=parts`)} disabled={loading} variant="outline" className="h-auto py-3 px-2 flex-col gap-1 text-xs hover:bg-blue-500/10 hover:text-blue-400">
                  <Package size={18} />
                  <span>{t('quick_actions.spare_parts')}</span>
                </Button>

                {/* Operations */}
                <Button
                  onClick={() => navigate(`/operations?vehicleId=${vehicle.id}&plate=${encodeURIComponent(vehicle.plateNumber || '')}`)}
                  disabled={loading}
                  variant="outline"
                  className="h-auto py-3 px-2 flex-col gap-1 text-xs hover:bg-orange-500/10 hover:text-orange-400"
                >
                  <Wrench size={18} />
                  <span>{t('quick_actions.operations')}</span>
                </Button>
              </div>

              {/* Full Width Actions */}
              <div className="space-y-2 pt-2">
                <Button onClick={() => handleStatusUpdate('delivered')} disabled={loading} variant="outline" className="w-full h-10 justify-start text-sm hover:bg-green-500/10 hover:text-green-400">
                  <CheckCircle size={16} className="ml-2" />{t('status.delivered')}
                </Button>

                <Button onClick={handleDelete} disabled={loading} variant="destructive" className="w-full h-10 justify-start text-sm hover:bg-red-600">
                  <Trash2 size={16} className="ml-2" />{t('quick_actions.delete_vehicle')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DocumentFormDialog
        isOpen={documentDialogOpen}
        onClose={() => setDocumentDialogOpen(false)}
        documentType={currentDocType}
        vehicle={vehicle}
        onSaved={handleDocumentSaved}
      />

      {/* Approval Request Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[520px] max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>طلب اعتماد من العميل</DialogTitle>
            <DialogDescription>أضف تفاصيل طلب الاعتماد وصور الأعطال</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>عنوان الطلب</Label>
              <Input 
                value={approvalForm.title} 
                onChange={(e) => setApprovalForm(prev => ({...prev, title: e.target.value}))}
                placeholder="مثال: طلب اعتماد إصلاح المحرك"
              />
            </div>

            <div>
              <Label>المبلغ المتوقع (ريال)</Label>
              <Input 
                type="number"
                value={approvalForm.amount} 
                onChange={(e) => setApprovalForm(prev => ({...prev, amount: e.target.value}))}
                placeholder="0"
              />
            </div>

            <div>
              <Label>صلاحية الرابط</Label>
              <Select 
                value={approvalForm.expiryDays} 
                onValueChange={(val) => setApprovalForm(prev => ({...prev, expiryDays: val}))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 أيام</SelectItem>
                  <SelectItem value="7">7 أيام (افتراضي)</SelectItem>
                  <SelectItem value="14">14 يوم</SelectItem>
                  <SelectItem value="30">30 يوم</SelectItem>
                  <SelectItem value="365">بدون انتهاء</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>صور الأعطال (اختياري - حتى 5 صور)</Label>
              <div className="mt-2 space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleApprovalImageChange}
                  className="hidden"
                  id="approval-images"
                />
                <label htmlFor="approval-images">
                  <Button type="button" variant="outline" className="w-full" asChild>
                    <span><Upload className="ml-2" size={16} />اختر صور</span>
                  </Button>
                </label>
                
                {approvalForm.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {approvalForm.images.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img src={img.data} alt={`صورة ${idx + 1}`} className="w-full h-20 object-cover rounded border" />
                        <button
                          onClick={() => removeApprovalImage(idx)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={submitApprovalRequest} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700">
                إرسال طلب الاعتماد
              </Button>
              <Button onClick={() => setApprovalDialogOpen(false)} variant="outline">
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VehicleQuickActions;
