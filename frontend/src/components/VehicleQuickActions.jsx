import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { CheckCircle, FileText, Printer, Trash2, X, Share2, BadgeCheck } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';
import DocumentFormDialog from './DocumentFormDialog';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const VehicleQuickActions = ({ isOpen, onClose, vehicle, onStatusUpdate, onDelete }) => {
  const { toast } = useToast();
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

  const handleRequestApproval = async () => {
    try {
      const title = window.prompt('عنوان طلب التعميد', 'طلب اعتماد الإصلاح');
      if (title === null) return;
      const amountStr = window.prompt('المبلغ المتوقع (ريال)', '0');
      if (amountStr === null) return;
      const amount = parseFloat(amountStr || '0');
      setLoading(true);
      const payload = { vehicleId: vehicle?.id, customerId: vehicle?.customerId, title, amount };
      const { data } = await axios.post(`${API_URL}/approvals`, payload);
      toast({ title: 'تم الإرسال', description: 'تم إنشاء طلب الاعتماد' });
      const approvalLink = `${window.location.origin}/approval/${data.token}`;
      
      // Send to WhatsApp
      await sendToWhatsApp(
        'approval',
        approvalLink,
        `السلام عليكم ${vehicle?.customerName}\nطلب اعتماد: ${title}\nالمبلغ المتوقع: ${amount} ر.س\nللاعتماد: ${approvalLink}`
      );
      
      setNewStatus('quotation');
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

  if (!vehicle) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[520px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>إدارة المركبة</span>
              <Button variant="ghost" size="icon" onClick={onClose}><X size={20} /></Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="font-bold text-lg text-slate-800 mb-2">{vehicle.plateNumber}</h3>
              <p className="text-slate-600 text-sm">{vehicle.brand} {vehicle.model} - {vehicle.year}</p>
              <p className="text-slate-600 text-sm">{vehicle.customerName}</p>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">تحديث الحالة</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${option.color}`}></div>
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleStatusUpdate} disabled={loading || newStatus === vehicle.status} className="w-full bg-blue-600 hover:bg-blue-700">
                <CheckCircle size={18} className="ml-2" />تحديث الحالة
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">إجراءات سريعة</Label>

              <Button onClick={handleRequestApproval} disabled={loading} variant="outline" className="w-full justify-start hover:bg-green-50">
                <BadgeCheck size={18} className="ml-2" />طلب اعتماد من العميل
              </Button>

              <Button onClick={() => openDocumentDialog('diagnosis')} disabled={loading} variant="outline" className="w-full justify-start hover:bg-blue-50">
                <FileText size={18} className="ml-2" />إنشاء تقرير التشخيص
              </Button>

              <Button onClick={() => openDocumentDialog('quote')} disabled={loading} variant="outline" className="w-full justify-start hover:bg-amber-50">
                <FileText size={18} className="ml-2" />إنشاء عرض السعر
              </Button>

              <Button onClick={() => openDocumentDialog('invoice')} disabled={loading} variant="outline" className="w-full justify-start hover:bg-purple-50">
                <Printer size={18} className="ml-2" />إنشاء الفاتورة
              </Button>

              <Button onClick={() => openDocumentDialog('receipt')} disabled={loading} variant="outline" className="w-full justify-start hover:bg-emerald-50">
                <FileText size={18} className="ml-2" />إنشاء سند قبض
              </Button>

              <Button onClick={handleDelete} disabled={loading} variant="destructive" className="w-full justify-start hover:bg-red-600">
                <Trash2 size={18} className="ml-2" />حذف المركبة
              </Button>
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
