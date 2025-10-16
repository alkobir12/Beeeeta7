import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { CheckCircle, FileText, Printer, Trash2, X, Share2, BadgeCheck } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const VehicleQuickActions = ({ isOpen, onClose, vehicle, onStatusUpdate, onDelete }) => {
  const { toast } = useToast();
  const [newStatus, setNewStatus] = useState(vehicle?.status || 'diagnosis');
  const [loading, setLoading] = useState(false);

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
      toast({
        title: "تم بنجاح",
        description: "تم تحديث حالة المركبة"
      });
      onClose();
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في تحديث الحالة",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fillTemplate = (html, invoiceLike) => {
    try {
      const workshopName = 'ورشتي';
      let output = html || '';
      const replacements = {
        '{{WORKSHOP_NAME}}': workshopName,
        '{{WORKSHOP_ADDRESS}}': '',
        '{{WORKSHOP_PHONE}}': vehicle?.customerPhone || '',
        '{{TAX_NUMBER}}': '',
        '{{INVOICE_NUMBER}}': invoiceLike?.invoiceNumber || '',
        '{{INVOICE_DATE}}': new Date().toLocaleDateString('ar-SA'),
        '{{CUSTOMER_NAME}}': vehicle?.customerName || '',
        '{{CUSTOMER_PHONE}}': vehicle?.customerPhone || '',
        '{{CUSTOMER_EMAIL}}': '',
        '{{VEHICLE_PLATE}}': vehicle?.plateNumber || '',
        '{{VEHICLE_MODEL}}': `${vehicle?.brand || ''} ${vehicle?.model || ''}`,
        '{{VEHICLE_YEAR}}': vehicle?.year?.toString() || '',
        '{{DIAGNOSIS_DATE}}': new Date().toLocaleDateString('ar-SA'),
        '{{TECHNICIAN_NAME}}': vehicle?.technicianName || ''
      };
      Object.keys(replacements).forEach(k => {
        output = output.split(k).join(replacements[k]);
      });
      output = output.replace('{{TOTAL}}', invoiceLike?.total?.toFixed?.(2) || '0.00');
      return output;
    } catch (e) {
      return html;
    }
  };

  const handlePrintReport = async () => {
    try {
      setLoading(true);
      const { data: templates } = await axios.get(`${API_URL}/templates`);
      const diag = (templates || []).find(t => (t.type === 'diagnosis'));
      const html = fillTemplate(diag?.content || diag?.html || defaultDiagnosisTemplate, {});
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 300);
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل تجهيز التقرير', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };


  const handlePrintInvoice = async () => {
    try {
      setLoading(true);
      const { data: templates } = await axios.get(`${API_URL}/templates`);
      const inv = (templates || []).find(t => (t.type === 'invoice'));
      const html = fillTemplate(inv?.content || inv?.html || defaultInvoiceTemplate, { total: 0 });
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 300);
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل تجهيز الفاتورة', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestApproval = async () => {
    try {
      const title = window.prompt('عنوان طلب التعميد', 'طلب اعتماد الإصلاح');
      if (title === null) return;
      const amountStr = window.prompt('المبلغ المتوقع (ريال)', '0');
      if (amountStr === null) return;
      const amount = parseFloat(amountStr || '0');
      setLoading(true);
      const payload = {
        vehicleId: vehicle?.id,
        customerId: vehicle?.customerId,
        title,
        amount
      };
      const { data } = await axios.post(`${API_URL}/approvals`, payload);
      toast({ title: 'تم الإرسال', description: 'تم إنشاء طلب الاعتماد' });
      const approvalLink = `${window.location.origin}/approval/${data.token}`;
      const trackingLink = `${window.location.origin}/track/${vehicle?.trackingLink}`;
      const msg = `السلام عليكم ${vehicle?.customerName}\nرابط تتبع مركبتك: ${trackingLink}\nطلب اعتماد: ${approvalLink}\nالمبلغ المتوقع: ${amount} ر.س`;
      const phone = (vehicle?.customerPhone || '').replace(/[^0-9]/g, '');
      if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
      setNewStatus('quotation');
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر إرسال طلب الاعتماد', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`هل أنت متأكد من حذف المركبة ${vehicle?.plateNumber}؟`)) {
      return;
    }
    
    try {
      setLoading(true);
      await onDelete();
      toast({
        title: "تم الحذف",
        description: "تم حذف المركبة بنجاح"
      });
      onClose();
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في حذف المركبة",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!vehicle) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>إدارة المركبة</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
            <Button onClick={handleRequestApproval} disabled={loading} variant="outline" className="w-full justify-start hover:bg-green-50">
              <BadgeCheck size={18} className="ml-2" />
              طلب اعتماد من العميل
            </Button>

              <X size={20} />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Vehicle Info */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <h3 className="font-bold text-lg text-slate-800 mb-2">{vehicle.plateNumber}</h3>
            <p className="text-slate-600 text-sm">{vehicle.brand} {vehicle.model} - {vehicle.year}</p>
            <p className="text-slate-600 text-sm">{vehicle.customerName}</p>
          </div>

          {/* Update Status */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">تحديث الحالة</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
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
            <Button
              onClick={handleStatusUpdate}
              disabled={loading || newStatus === vehicle.status}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle size={18} className="ml-2" />
              تحديث الحالة
            </Button>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">إجراءات سريعة</Label>
            
            <Button
              onClick={handleRequestApproval}
              disabled={loading}
              variant="outline"
              className="w-full justify-start hover:bg-green-50"
            >
              <CheckCircle size={18} className="ml-2" />
              طلب اعتماد من العميل
            </Button>

            <Button
              onClick={handlePrintReport}
              disabled={loading}
              variant="outline"
              className="w-full justify-start hover:bg-blue-50"
            >
              <FileText size={18} className="ml-2" />
              طباعة تقرير الحالة
            </Button>

            <Button
              onClick={handlePrintInvoice}
              disabled={loading}
              variant="outline"
              className="w-full justify-start hover:bg-purple-50"
            >
              <Printer size={18} className="ml-2" />
              طباعة الفاتورة
            </Button>

            <Button
              onClick={handleDelete}
              disabled={loading}
              variant="destructive"
              className="w-full justify-start hover:bg-red-600"
            >
              <Trash2 size={18} className="ml-2" />
              حذف المركبة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VehicleQuickActions;
