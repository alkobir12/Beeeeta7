import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { CheckCircle, FileText, Printer, Trash2, X, Share2, BadgeCheck, Package, Wrench } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DocumentFormDialog from './DocumentFormDialog';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const VehicleQuickActions = ({ isOpen, onClose, vehicle, onStatusUpdate, onDelete }) => {
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
    { value: 'diagnosis', label: 'تشخيص', color: 'bg-yellow-500' },
    { value: 'quotation', label: 'تسعير', color: 'bg-blue-500' },
    { value: 'approved', label: 'معتمد', color: 'bg-green-500' },
    { value: 'repair', label: 'تحت الإصلاح', color: 'bg-orange-500' },
    { value: 'ready', label: 'جاهز للتسليم', color: 'bg-green-600' },
    { value: 'delivered', label: 'تم التسليم', color: 'bg-gray-500' }
  ];

  const handleStatusUpdate = async () => {
    try {
      setLoading(true);
      await onStatusUpdate(newStatus);
      toast({ title: 'تم بنجاح', description: 'تم تحديث حالة المركبة' });
      onClose();
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في تحديث الحالة', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const openDocumentDialog = (docType) => {
    setCurrentDocType(docType);
    setDocumentDialogOpen(true);
  };

  const handleDocumentSaved = (savedDoc) => {
    toast({ title: 'تم الحفظ', description: 'تم حفظ وطباعة المستند بنجاح' });
    setDocumentDialogOpen(false);
  };

  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalForm, setApprovalForm] = useState({
    title: 'طلب اعتماد الإصلاح',
    amount: '',
    expiryDays: '7',
    images: []
  });

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
      
      // Send to WhatsApp
      await sendToWhatsApp(
        'approval',
        approvalLink,
        `السلام عليكم ${vehicle?.customerName}\nطلب اعتماد: ${approvalForm.title}\nالمبلغ المتوقع: ${approvalForm.amount} ر.س\nللاعتماد: ${approvalLink}`
      );
      
      setNewStatus('quotation');
      setApprovalDialogOpen(false);
      setApprovalForm({ title: 'طلب اعتماد الإصلاح', amount: '', expiryDays: '7', images: [] });
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر إرسال طلب الاعتماد', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const sendToWhatsApp = async (type, link, customMessage) => {
    const phone = (vehicle?.customerPhone || '').replace(/[^0-9+]/g, '');
    if (!phone) {
      toast({ title: 'تنبيه', description: 'رقم هاتف العميل غير متوفر', variant: 'destructive' });
      return;
    }
    
    try {
      const prep = await axios.post(`${API_URL}/notifications/prepare`, { type, phone, link });
      setTimeout(() => {
        const wa = window.open(prep.data.whatsappDeeplink, '_blank', 'noopener,noreferrer');
        if (!wa) {
          toast({ 
            title: 'افتح الواتساب يدوياً', 
            description: 'المتصفح منع النافذة المنبثقة. انسخ الرابط وأرسله للعميل.',
            variant: 'destructive' 
          });
        }
      }, 300);
    } catch (_e) {
      // Fallback to direct WhatsApp link
      const msg = customMessage || `السلام عليكم ${vehicle?.customerName}\n${link}`;
      setTimeout(() => {
        const wa = window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
        if (!wa) {
          toast({ 
            title: 'افتح الواتساب يدوياً', 
            description: 'المتصفح منع النافذة المنبثقة',
            variant: 'destructive' 
          });
        }
      }, 300);
    }
  };

  const handlePrintAndSend = async (type) => {
    await handlePrint(type);
    
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
    if (!window.confirm(`هل أنت متأكد من حذف المركبة ${vehicle?.plateNumber}؟`)) return;
    try {
      setLoading(true);
      await onDelete();
      toast({ title: 'تم الحذف', description: 'تم حذف المركبة بنجاح' });
      onClose();
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في حذف المركبة', variant: 'destructive' });
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
        <DialogContent className="w-[95vw] max-w-[520px] max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader className="sticky top-0 bg-card z-10 pb-2">
            <DialogTitle className="flex items-center justify-between text-base sm:text-lg">
              <span>خيارات المركبة</span>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 sm:h-10 sm:w-10"><X size={18} /></Button>
            </DialogTitle>
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
              <Label className="text-sm sm:text-base font-semibold">تحديث الحالة</Label>
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
                <CheckCircle size={16} className="ml-2" />تحديث الحالة
              </Button>
            </div>

            {/* Quick Actions Grid - 2 columns on mobile */}
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-sm sm:text-base font-semibold">إجراءات سريعة</Label>

              <div className="grid grid-cols-2 gap-2">
                {/* Approval Request */}
                <Button onClick={handleRequestApproval} disabled={loading} variant="outline" className="h-auto py-3 px-2 flex-col gap-1 text-xs hover:bg-green-500/10 hover:text-green-400">
                  <BadgeCheck size={18} />
                  <span>طلب اعتماد</span>
                </Button>

                {/* Diagnosis Report - Navigate to print page */}
                <Button onClick={() => navigate(`/print?type=diagnosis&vehicleId=${vehicle.id}`)} disabled={loading} variant="outline" className="h-auto py-3 px-2 flex-col gap-1 text-xs hover:bg-blue-500/10 hover:text-blue-400">
                  <FileText size={18} />
                  <span>تقرير تشخيص</span>
                </Button>

                {/* Quote - Navigate to print page */}
                <Button onClick={() => navigate(`/print?type=quote&vehicleId=${vehicle.id}`)} disabled={loading} variant="outline" className="h-auto py-3 px-2 flex-col gap-1 text-xs hover:bg-amber-500/10 hover:text-amber-400">
                  <FileText size={18} />
                  <span>عرض سعر</span>
                </Button>

                {/* Invoice - Navigate to print page */}
                <Button onClick={() => navigate(`/print?type=invoice&vehicleId=${vehicle.id}`)} disabled={loading} variant="outline" className="h-auto py-3 px-2 flex-col gap-1 text-xs hover:bg-purple-500/10 hover:text-purple-400">
                  <Printer size={18} />
                  <span>فاتورة</span>
                </Button>

                {/* Receipt - Navigate to print page */}
                <Button onClick={() => navigate(`/print?type=receipt&vehicleId=${vehicle.id}`)} disabled={loading} variant="outline" className="h-auto py-3 px-2 flex-col gap-1 text-xs hover:bg-emerald-500/10 hover:text-emerald-400">
                  <FileText size={18} />
                  <span>سند قبض</span>
                </Button>

                {/* Details */}
                <Button onClick={() => navigate(`/vehicle/${vehicle.id}`)} disabled={loading} variant="outline" className="h-auto py-3 px-2 flex-col gap-1 text-xs hover:bg-slate-700/50">
                  <FileText size={18} />
                  <span>التفاصيل</span>
                </Button>

                {/* Parts - Navigate to vehicle page with parts tab */}
                <Button onClick={() => navigate(`/vehicle/${vehicle.id}?tab=parts`)} disabled={loading} variant="outline" className="h-auto py-3 px-2 flex-col gap-1 text-xs hover:bg-blue-500/10 hover:text-blue-400">
                  <Package size={18} />
                  <span>قطع الغيار</span>
                </Button>

                {/* Operations */}
                <Button
                  onClick={() => navigate(`/operations?vehicleId=${vehicle.id}&plate=${encodeURIComponent(vehicle.plateNumber || '')}`)}
                  disabled={loading}
                  variant="outline"
                  className="h-auto py-3 px-2 flex-col gap-1 text-xs hover:bg-orange-500/10 hover:text-orange-400"
                >
                  <Wrench size={18} />
                  <span>العمليات</span>
                </Button>
              </div>

              {/* Full Width Actions */}
              <div className="space-y-2 pt-2">
                <Button onClick={() => handleStatusUpdate('delivered')} disabled={loading} variant="outline" className="w-full h-10 justify-start text-sm hover:bg-green-500/10 hover:text-green-400">
                  <CheckCircle size={16} className="ml-2" />تسليم المركبة
                </Button>

                <Button onClick={handleDelete} disabled={loading} variant="destructive" className="w-full h-10 justify-start text-sm hover:bg-red-600">
                  <Trash2 size={16} className="ml-2" />حذف المركبة
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
    </>
  );
};

export default VehicleQuickActions;
