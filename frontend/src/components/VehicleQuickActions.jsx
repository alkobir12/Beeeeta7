import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { CheckCircle, FileText, Printer, Trash2, X, Share2, BadgeCheck } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Fallback minimal templates if backend has none
const defaultInvoiceTemplate = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>فاتورة</title></head><body><h2 style="text-align:center">فاتورة</h2><p>العميل: {{CUSTOMER_NAME}}</p><p>المركبة: {{VEHICLE_PLATE}} - {{VEHICLE_MODEL}}</p><hr/><p>المجموع: {{TOTAL}} ر.س</p></body></html>`;
const defaultDiagnosisTemplate = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>تقرير تشخيص</title></head><body><h2 style="text-align:center">تقرير تشخيص</h2><p>العميل: {{CUSTOMER_NAME}}</p><p>المركبة: {{VEHICLE_PLATE}} - {{VEHICLE_MODEL}}</p><p>التاريخ: {{DIAGNOSIS_DATE}}</p><hr/></body></html>`;

const VehicleQuickActions = ({ isOpen, onClose, vehicle, onStatusUpdate, onDelete }) => {
  const { toast } = useToast();
  const [newStatus, setNewStatus] = useState(vehicle?.status || 'diagnosis');
  const [loading, setLoading] = useState(false);
  const [templatesCache, setTemplatesCache] = useState(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await axios.get(`${API_URL}/templates`, { timeout: 8000 });
        setTemplatesCache(res.data || []);
      } catch (e) {
        setTemplatesCache([]);
      }
    };
    if (isOpen) fetchTemplates();
  }, [isOpen]);


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

  const openPrintWindow = (rawHtml) => {
    const win = window.open('about:blank', '_blank', 'noopener');
    if (!win) throw new Error('حظر المنبثقات: الرجاء السماح بالنوافذ المنبثقة للطباعة');
    const hasHtmlTag = /<html[\s\S]*>/i.test(rawHtml || '');
    const content = hasHtmlTag ? rawHtml : `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>طباعة</title><style>@page{size:A4;margin:12mm;}body{font-family:Tahoma,Arial,sans-serif;color:#111;direction:rtl;padding:8mm;}h1,h2,h3{margin:0 0 8px;} .muted{color:#555;} .row{display:flex;gap:16px} .col{flex:1} hr{border:none;border-top:1px solid #ddd;margin:12px 0}</style></head><body>${rawHtml || ''}<script>window.onload=function(){try{window.focus();window.print();}catch(e){}};<\/script></body></html>`;
    win.document.open();
    win.document.write(content);
    win.document.close();
    // Fallback print after a short delay for Safari
    setTimeout(() => { try { win.focus(); win.print(); } catch(_) {} }, 700);
  };

  const handlePrintReport = async () => {
    let win;
    try {
      setLoading(true);
      // Open window immediately to avoid popup blockers
      win = window.open('about:blank', '_blank', 'noopener');
      if (!win) throw new Error('حظر المنبثقات: الرجاء السماح بالنوافذ المنبثقة للطباعة');
      // Show loading placeholder
      win.document.open();
      win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تجهيز التقرير</title><style>body{font-family:Tahoma,Arial;padding:20px} .muted{color:#666}</style></head><body><h3>جاري تجهيز تقرير التشخيص...</h3><p class="muted">يرجى الانتظار</p></body></html>`);
      win.document.close();

      const templates = Array.isArray(templatesCache) ? templatesCache : (await axios.get(`${API_URL}/templates`)).data;
      const diag = (templates || []).find(t => (t.type === 'diagnosis'));
      const html = fillTemplate(diag?.content || diag?.html || defaultDiagnosisTemplate, {});
      // Replace content with final HTML
      const hasHtmlTag = /<html[\s\S]*>/i.test(html || '');
      const content = hasHtmlTag ? html : `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تقرير تشخيص</title><style>@page{size:A4;margin:12mm;}body{font-family:Tahoma,Arial;padding:8mm}</style></head><body>${html || ''}<script>window.onload=function(){try{window.focus();window.print();}catch(e){}};<\/script></body></html>`;
      win.document.open();
      win.document.write(content);
      win.document.close();
      setTimeout(() => { try { win.focus(); win.print(); } catch(_) {} }, 600);
    } catch (e) {
      if (win) {
        try {
          win.document.open();
          win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>خطأ</title></head><body><h3>تعذر تجهيز التقرير</h3><p>${e?.message || ''}</p></body></html>`);
          win.document.close();
        } catch(_){}
      }
      toast({ title: 'خطأ', description: 'فشل تجهيز التقرير', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };


  const handlePrintInvoice = async () => {
    let win;
    try {
      setLoading(true);
      // Open first to avoid blockers
      win = window.open('about:blank', '_blank', 'noopener');
      if (!win) throw new Error('حظر المنبثقات: الرجاء السماح بالنوافذ المنبثقة للطباعة');
      win.document.open();
      win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تجهيز الفاتورة</title><style>body{font-family:Tahoma,Arial;padding:20px} .muted{color:#666}</style></head><body><h3>جاري تجهيز الفاتورة...</h3><p class="muted">يرجى الانتظار</p></body></html>`);
      win.document.close();

      const templates = Array.isArray(templatesCache) ? templatesCache : (await axios.get(`${API_URL}/templates`)).data;
      const inv = (templates || []).find(t => (t.type === 'invoice'));
      const html = fillTemplate(inv?.content || inv?.html || defaultInvoiceTemplate, { total: 0 });
      const hasHtmlTag = /<html[\s\S]*>/i.test(html || '');
      const content = hasHtmlTag ? html : `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>فاتورة</title><style>@page{size:A4;margin:12mm;}body{font-family:Tahoma,Arial;padding:8mm}</style></head><body>${html || ''}<script>window.onload=function(){try{window.focus();window.print();}catch(e){}};<\/script></body></html>`;
      win.document.open();
      win.document.write(content);
      win.document.close();
      setTimeout(() => { try { win.focus(); win.print(); } catch(_) {} }, 600);
    } catch (e) {
      if (win) {
        try {
          win.document.open();
          win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>خطأ</title></head><body><h3>تعذر تجهيز الفاتورة</h3><p>${e?.message || ''}</p></body></html>`);
          win.document.close();
        } catch(_){}
      }
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
      if (data.expiresAt) {
        toast({ title: 'صلاحية الرابط', description: `ينتهي خلال 7 أيام (${new Date(data.expiresAt).toLocaleString('ar-SA')})` });
      }
      const trackingLink = `${window.location.origin}/track/${vehicle?.trackingLink}`;
      const msg = `السلام عليكم ${vehicle?.customerName}\nرابط تتبع مركبتك: ${trackingLink}\nطلب اعتماد: ${approvalLink}\nالمبلغ المتوقع: ${amount} ر.س`;
      const phone = (vehicle?.customerPhone || '').replace(/[^0-9]/g, '');
      if (phone) {
        const wa = window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
        if (!wa) toast({ title: 'تنبيه', description: 'يبدو أن المتصفح منع فتح واتساب، الرجاء السماح بالنوافذ المنبثقة', variant: 'destructive' });
      }
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
              <BadgeCheck size={18} className="ml-2" />
              طلب اعتماد من العميل
            </Button>

            <Button
              onClick={handlePrintReport}
              disabled={loading}
              variant="outline"
              className="w-full justify-start hover:bg-blue-50"
            >
              <FileText size={18} className="ml-2" />
              صياغة وطباعة تقرير التشخيص
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
