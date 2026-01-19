import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Plus, Trash2, FileText, Download, Eye, Loader2, Printer,
  Receipt, ClipboardList, FileCheck, Car, Save
} from 'lucide-react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DocumentPrint = () => {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [workshopSettings, setWorkshopSettings] = useState(null);
  
  // نوع المستند من URL أو افتراضي
  const initialType = searchParams.get('type') || 'invoice';
  const vehicleId = searchParams.get('vehicleId');
  
  const [docType, setDocType] = useState(initialType);
  
  const [formData, setFormData] = useState({
    workshop: {
      name: '',
      name_en: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      tax_number: ''
    },
    customer: {
      name: '',
      company: '',
      address: '',
      phone: '',
      email: ''
    },
    vehicle: {
      brand: '',
      model: '',
      year: '',
      plateNumber: '',
      vin: '',
      color: '',
      mileage: '',
      notes: ''
    },
    items: [{ description: '', quantity: 1, unit_price: 0, discount: 0 }],
    settings: {
      theme: 'أزرق',
      style: 'حديث',
      tax_rate: 15,
      description: '',
      notes: '',
      approval_token: ''
    }
  });

  const themes = ['أزرق', 'أخضر', 'بنفسجي', 'برتقالي', 'أحمر', 'تركوازي', 'ذهبي', 'رمادي'];
  const styles = ['حديث', 'كلاسيكي', 'فاخر'];
  
  const docTypes = {
    invoice: { label: isArabic ? 'فاتورة مبيعات' : 'Sales Invoice', icon: Receipt },
    diagnosis: { label: isArabic ? 'تقرير تشخيص' : 'Diagnosis Report', icon: ClipboardList },
    quote: { label: isArabic ? 'عرض سعر' : 'Price Quote', icon: FileCheck },
    receipt: { label: isArabic ? 'إيصال استلام' : 'Receipt', icon: FileText }
  };

  useEffect(() => {
    loadWorkshopSettings();
    if (vehicleId) {
      loadVehicleData(vehicleId);
      loadLatestApprovalToken(vehicleId);
    }
  }, [vehicleId]);

  // عند التحميل، نقرأ printDefaults إن وجدت
  useEffect(() => {
    const loadPrintDefaults = async () => {
      try {
        const res = await axios.get(`${API_URL}/settings`);
        const defaults = res.data?.printDefaults;
        if (defaults) {
          setFormData(prev => ({
            ...prev,
            settings: {
              ...prev.settings,
              theme: defaults.theme || prev.settings.theme,
              style: defaults.style || prev.settings.style,
              tax_rate: typeof defaults.tax_rate === 'number' ? defaults.tax_rate : prev.settings.tax_rate,
            }
          }));
        }
      } catch (e) {
        // تجاهل أي خطأ في قراءة الإعدادات، ليست حرجة
      }
    };

    loadPrintDefaults();
  }, []);

  const loadWorkshopSettings = async () => {
    try {
      // نجلب إعدادات النظام + ملف الورشة، ونعطي أولوية لبيانات "ملف الورشة"
      const [settingsRes, profileRes] = await Promise.all([
        axios.get(`${API_URL}/settings`),
        axios.get(`${API_URL}/profile`).catch(() => ({ data: null })),
      ]);

      const data = settingsRes.data || {};
      const profile = profileRes.data || {};

      setWorkshopSettings(data);
      setFormData(prev => ({
        ...prev,
        workshop: {
          // الاسم من ملف الورشة، وإن لم يوجد من الإعدادات القديمة
          name: profile.name || data.workshopName || '',
          name_en: profile.nameEnglish || data.workshopNameEn || '',
          address: profile.address || data.address || '',
          phone: profile.phone || data.phone || '',
          email: profile.email || data.email || '',
          website: data.website || '',
          tax_number: profile.taxNumber || data.taxNumber || '',
          // الشعار والسلوقان الجديدين
          logo: profile.logo || '',
          slogan: profile.slogan || '',
          slogan_en: profile.sloganEnglish || '',
          commercial_register: profile.commercialRegister || ''
        }
      }));
    } catch (e) {
      console.error('Error loading settings/profile:', e);
    }
  };

  const loadVehicleData = async (id) => {
    try {
      const { data } = await axios.get(`${API_URL}/vehicles/${id}`);
      if (data) {
        // تحويل البنود (parts) إلى تنسيق المستند
        const vehicleParts = data.parts || [];
        const itemsFromParts = vehicleParts.map(part => ({
          description: part.name || part.description || '',
          quantity: part.quantity || 1,
          unit_price: part.price || 0,
          discount: 0
        }));

        // إذا لم توجد بنود، استخدم الخدمات
        const finalItems = itemsFromParts.length > 0 
          ? itemsFromParts 
          : (data.services || []).map(s => ({
              description: s,
              quantity: 1,
              unit_price: 0,
              discount: 0
            }));

        setFormData(prev => ({
          ...prev,
          customer: {
            ...prev.customer,
            name: data.customerName || '',
            phone: data.customerPhone || ''
          },
          vehicle: {
            brand: data.brand || '',
            model: data.model || '',
            year: data.year || '',
            plateNumber: data.plateNumber || '',
            vin: data.vin || '',
            color: data.color || '',
            mileage: data.mileage || '',
            notes: data.notes || ''
          },
          items: finalItems.length > 0 ? finalItems : [{ description: '', quantity: 1, unit_price: 0, discount: 0 }]
        }));
      }
    } catch (e) {
      console.error('Error loading vehicle:', e);
    }
  };

  const loadLatestApprovalToken = async (id) => {
    try {
      const { data } = await axios.get(`${API_URL}/approvals?vehicle_id=${id}`);
      if (!Array.isArray(data) || data.length === 0) return;

      // نفضل الموافقات المعتمدة، وإن لم توجد نأخذ أحدث أي طلب
      const approved = data.filter(a => (a.status || '').toLowerCase() === 'approved');
      const candidates = approved.length > 0 ? approved : data;

      const sorted = [...candidates].sort((a, b) => {
        const aDate = a.respondedAt || a.responded_at || a.createdAt || a.created_at || a.requestedAt || a.requested_at;
        const bDate = b.respondedAt || b.responded_at || b.createdAt || b.created_at || b.requestedAt || b.requested_at;
        return new Date(bDate || 0) - new Date(aDate || 0);
      });

      const latest = sorted[0];
      if (latest && latest.token) {
        setFormData(prev => ({
          ...prev,
          settings: {
            ...prev.settings,
            approval_token: latest.token,
          },
        }));
      }
    } catch (e) {
      console.error('Error loading latest approval token:', e);
    }
  };


  const handleWorkshopChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      workshop: { ...prev.workshop, [field]: value }
    }));
  };

  const handleCustomerChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      customer: { ...prev.customer, [field]: value }
    }));
  };

  const handleVehicleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      vehicle: { ...prev.vehicle, [field]: value }
    }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { 
      ...newItems[index], 
      [field]: field === 'description' ? value : parseFloat(value) || 0 
    };
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unit_price: 0, discount: 0 }]
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  const handleSettingsChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      settings: { ...prev.settings, [field]: value }
    }));
  };

  const calculateTotal = () => {
    const subtotal = formData.items.reduce((sum, item) => {
      return sum + (item.quantity * item.unit_price) - item.discount;
    }, 0);
    const tax = subtotal * (formData.settings.tax_rate / 100);
    return { subtotal, tax, total: subtotal + tax };
  };

  const generateDocument = async (preview = false) => {
    setLoading(true);
    try {
      // Validate required fields
      if (!formData.workshop.name) {
        alert(isArabic ? 'الرجاء إدخال اسم الورشة' : 'Please enter workshop name');
        setLoading(false);
        return;
      }
      if (!formData.customer.name) {
        alert(isArabic ? 'الرجاء إدخال اسم العميل' : 'Please enter customer name');
        setLoading(false);
        return;
      }
      if (formData.items.filter(item => item.description).length === 0) {
        alert(isArabic ? 'الرجاء إضافة بند واحد على الأقل' : 'Please add at least one item');
        setLoading(false);
        return;
      }

      const response = await axios.post(`${API_URL}/documents/generate`, {
        doc_type: docType,
        workshop: formData.workshop,
        customer: formData.customer,
        vehicle: formData.vehicle,
        items: formData.items.filter(item => item.description),
        settings: {
          ...formData.settings,
          // مبدئياً نمرّر رمز الاعتماد فقط (يمكن توسيعه لاحقاً لمعلومات كاملة)
          approval_token: formData.settings.approval_token || undefined,
        },
      });

      if (response.data.success) {
        if (preview) {
          setPreviewHtml(response.data.html);
          setShowPreview(true);
        } else {
          // تحميل الملف
          const blob = new Blob([response.data.html], { type: 'text/html;charset=utf-8' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${docType}_${response.data.document_number}.html`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      } else {
        throw new Error(response.data.message || 'فشل في إنشاء المستند');
      }
    } catch (error) {
      console.error('Error generating document:', error);
      const errorMsg = error.response?.data?.detail || error.message || (isArabic ? 'حدث خطأ أثناء إنشاء المستند' : 'Error generating document');
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const printDocument = async () => {
    // Open window immediately to avoid popup blockers
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      alert(isArabic ? 'تم حظر النافذة المنبثقة. الرجاء السماح بالنوافذ المنبثقة لهذا الموقع.' : 'Popup blocked. Please allow popups for this site.');
      setLoading(false);
      return;
    }

    // Write initial loading state
    printWindow.document.write(isArabic ? '<h3 style="text-align:center; font-family: sans-serif; margin-top: 50px;">جاري إعداد المستند للطباعة...</h3>' : '<h3 style="text-align:center; font-family: sans-serif; margin-top: 50px;">Preparing document for printing...</h3>');

    setLoading(true);
    try {
      // Validate
      if (!formData.workshop.name || !formData.customer.name) {
        printWindow.close();
        alert(isArabic ? 'بيانات الورشة والعميل مطلوبة' : 'Workshop and Customer details are required');
        setLoading(false);
        return;
      }

      const response = await axios.post(`${API_URL}/documents/generate`, {
        doc_type: docType,
        workshop: formData.workshop,
        customer: formData.customer,
        vehicle: formData.vehicle,
        items: formData.items.filter(item => item.description),
        settings: {
          ...formData.settings,
          // مبدئياً نمرّر رمز الاعتماد فقط (يمكن توسيعه لاحقاً لمعلومات كاملة)
          approval_token: formData.settings.approval_token || undefined,
        },
      });

      if (response.data.success && response.data.html) {
        printWindow.document.open();
        printWindow.document.write(response.data.html);
        printWindow.document.close();
        
        // Wait for content to load then print
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          // Optional: Close after print (commented out to let user decide)
          // printWindow.close();
        }, 1000);
      } else {
        printWindow.close();
        throw new Error(response.data.message || 'Failed');
      }
    } catch (error) {
      printWindow.close();
      console.error('Error printing:', error);
      alert(isArabic ? 'فشل الطباعة' : 'Print failed');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotal();
  const DocIcon = docTypes[docType]?.icon || FileText;

  const saveDefaults = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_URL}/settings/print-defaults`, {
        theme: formData.settings.theme,
        style: formData.settings.style,
        tax_rate: formData.settings.tax_rate,
      });
      alert(isArabic ? 'تم حفظ الإعدادات الافتراضية للطباعة وعروض الأسعار' : 'Default print & quote settings saved');
    } catch (error) {
      console.error('Error saving defaults:', error);
      alert(isArabic ? 'فشل حفظ الإعدادات الافتراضية' : 'Failed to save default settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <DocIcon size={28} />
              {isArabic ? 'طباعة المستندات' : 'Document Printing'}
            </h1>
            <p className="text-muted-foreground">
              {isArabic ? 'فواتير - تشخيص - عروض أسعار - إيصالات' : 'Invoices - Diagnosis - Quotes - Receipts'}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => generateDocument(true)} disabled={loading}>
              <Eye size={18} className={isArabic ? 'ml-2' : 'mr-2'} />
              {isArabic ? 'معاينة' : 'Preview'}
            </Button>
            <Button variant="outline" onClick={printDocument} disabled={loading}>
              <Printer size={18} className={isArabic ? 'ml-2' : 'mr-2'} />
              {isArabic ? 'طباعة' : 'Print'}
            </Button>
            <Button onClick={() => generateDocument(false)} disabled={loading} className="bg-gradient-to-r from-blue-600 to-indigo-600">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} className={isArabic ? 'ml-2' : 'mr-2'} />}
              {isArabic ? 'تحميل' : 'Download'}
            </Button>
            <Button variant="outline" onClick={saveDefaults} disabled={loading}>
              <Save size={18} className={isArabic ? 'ml-2' : 'mr-2'} />
              {isArabic ? 'حفظ التعديلات كإعداد افتراضي' : 'Save as default'}
            </Button>
          </div>
        </div>

        {/* Document Type Selection */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(docTypes).map(([type, { label, icon: Icon }]) => (
                <Button
                  key={type}
                  variant={docType === type ? "default" : "outline"}
                  onClick={() => setDocType(type)}
                  className={docType === type ? "bg-blue-600" : ""}
                >
                  <Icon size={18} className={isArabic ? 'ml-2' : 'mr-2'} />
                  {label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="customer" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-md">
            <TabsTrigger value="customer">{isArabic ? 'العميل' : 'Customer'}</TabsTrigger>
            <TabsTrigger value="vehicle">{isArabic ? 'المركبة' : 'Vehicle'}</TabsTrigger>
            <TabsTrigger value="items">{isArabic ? 'البنود' : 'Items'}</TabsTrigger>
            <TabsTrigger value="settings">{isArabic ? 'الإعدادات' : 'Settings'}</TabsTrigger>
          </TabsList>

          {/* Customer Tab */}
          <TabsContent value="customer">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* بيانات الورشة */}
              <Card>
                <CardHeader>
                  <CardTitle>{isArabic ? 'بيانات الورشة' : 'Workshop Details'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Logo & Slogan */}
                  {(formData.workshop.logo || formData.workshop.slogan) && (
                    <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border">
                      {formData.workshop.logo && (
                        <img src={formData.workshop.logo} alt="شعار الورشة" className="w-16 h-16 object-contain rounded" />
                      )}
                      {formData.workshop.slogan && (
                        <p className="text-sm text-muted-foreground italic">{formData.workshop.slogan}</p>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{isArabic ? 'اسم الورشة' : 'Workshop Name'}</Label>
                      <Input value={formData.workshop.name} onChange={(e) => handleWorkshopChange('name', e.target.value)} />
                    </div>
                    <div>
                      <Label>{isArabic ? 'الهاتف' : 'Phone'}</Label>
                      <Input value={formData.workshop.phone} onChange={(e) => handleWorkshopChange('phone', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>{isArabic ? 'العنوان' : 'Address'}</Label>
                    <Input value={formData.workshop.address} onChange={(e) => handleWorkshopChange('address', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{isArabic ? 'البريد' : 'Email'}</Label>
                      <Input value={formData.workshop.email} onChange={(e) => handleWorkshopChange('email', e.target.value)} />
                    </div>
                    <div>
                      <Label>{isArabic ? 'الرقم الضريبي' : 'Tax Number'}</Label>
                      <Input value={formData.workshop.tax_number} onChange={(e) => handleWorkshopChange('tax_number', e.target.value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* بيانات العميل */}
              <Card>
                <CardHeader>
                  <CardTitle>{isArabic ? 'بيانات العميل' : 'Customer Details'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{isArabic ? 'اسم العميل' : 'Customer Name'}</Label>
                      <Input value={formData.customer.name} onChange={(e) => handleCustomerChange('name', e.target.value)} />
                    </div>
                    <div>
                      <Label>{isArabic ? 'الشركة' : 'Company'}</Label>
                      <Input value={formData.customer.company} onChange={(e) => handleCustomerChange('company', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>{isArabic ? 'العنوان' : 'Address'}</Label>
                    <Input value={formData.customer.address} onChange={(e) => handleCustomerChange('address', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{isArabic ? 'الهاتف' : 'Phone'}</Label>
                      <Input value={formData.customer.phone} onChange={(e) => handleCustomerChange('phone', e.target.value)} />
                    </div>
                    <div>
                      <Label>{isArabic ? 'البريد' : 'Email'}</Label>
                      <Input value={formData.customer.email} onChange={(e) => handleCustomerChange('email', e.target.value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Vehicle Tab */}
          <TabsContent value="vehicle">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car size={20} />
                  {isArabic ? 'بيانات المركبة' : 'Vehicle Details'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label>{isArabic ? 'الماركة' : 'Brand'}</Label>
                    <Input value={formData.vehicle.brand} onChange={(e) => handleVehicleChange('brand', e.target.value)} placeholder="تويوتا" />
                  </div>
                  <div>
                    <Label>{isArabic ? 'الموديل' : 'Model'}</Label>
                    <Input value={formData.vehicle.model} onChange={(e) => handleVehicleChange('model', e.target.value)} placeholder="كامري" />
                  </div>
                  <div>
                    <Label>{isArabic ? 'السنة' : 'Year'}</Label>
                    <Input value={formData.vehicle.year} onChange={(e) => handleVehicleChange('year', e.target.value)} placeholder="2022" />
                  </div>
                  <div>
                    <Label>{isArabic ? 'اللون' : 'Color'}</Label>
                    <Input value={formData.vehicle.color} onChange={(e) => handleVehicleChange('color', e.target.value)} placeholder="أبيض" />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <Label>{isArabic ? 'رقم اللوحة' : 'Plate Number'}</Label>
                    <Input value={formData.vehicle.plateNumber} onChange={(e) => handleVehicleChange('plateNumber', e.target.value)} />
                  </div>
                  <div>
                    <Label>{isArabic ? 'رقم الهيكل' : 'VIN'}</Label>
                    <Input value={formData.vehicle.vin} onChange={(e) => handleVehicleChange('vin', e.target.value)} />
                  </div>
                  <div>
                    <Label>{isArabic ? 'العداد (كم)' : 'Mileage (km)'}</Label>
                    <Input value={formData.vehicle.mileage} onChange={(e) => handleVehicleChange('mileage', e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>{isArabic ? 'ملاحظات' : 'Notes'}</Label>
                  <Textarea value={formData.vehicle.notes} onChange={(e) => handleVehicleChange('notes', e.target.value)} rows={3} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{isArabic ? 'البنود والخدمات' : 'Items & Services'}</CardTitle>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus size={16} className={isArabic ? 'ml-1' : 'mr-1'} />
                  {isArabic ? 'إضافة بند' : 'Add Item'}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(formData.items || []).map((item, index) => (
                    <div key={`item-${index}`} className="flex flex-wrap gap-2 items-end p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="flex-1 min-w-[200px]">
                        <Label>{isArabic ? 'الوصف' : 'Description'}</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          placeholder={isArabic ? 'وصف الخدمة أو القطعة' : 'Service or part description'}
                        />
                      </div>
                      <div className="w-20">
                        <Label>{isArabic ? 'الكمية' : 'Qty'}</Label>
                        <Input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} min="1" />
                      </div>
                      <div className="w-28">
                        <Label>{isArabic ? 'السعر' : 'Price'}</Label>
                        <Input type="number" value={item.unit_price} onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)} min="0" />
                      </div>
                      <div className="w-24">
                        <Label>{isArabic ? 'الخصم' : 'Discount'}</Label>
                        <Input type="number" value={item.discount} onChange={(e) => handleItemChange(index, 'discount', e.target.value)} min="0" />
                      </div>
                      <div className="w-28 text-center">
                        <Label>{isArabic ? 'المجموع' : 'Total'}</Label>
                        <p className="font-bold text-lg">{((item.quantity * item.unit_price) - item.discount).toLocaleString()}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(index)} disabled={formData.items.length === 1} className="text-red-500">
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* الإجماليات */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex justify-between py-2">
                    <span>{isArabic ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                    <span className="font-semibold">{totals.subtotal.toLocaleString()} {isArabic ? 'ر.س' : 'SAR'}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span>{isArabic ? `الضريبة (${formData.settings.tax_rate}%):` : `Tax (${formData.settings.tax_rate}%):`}</span>
                    <span className="font-semibold">{totals.tax.toLocaleString()} {isArabic ? 'ر.س' : 'SAR'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-t-2 border-blue-200 text-lg font-bold text-blue-600">
                    <span>{isArabic ? 'المجموع الكلي:' : 'Total:'}</span>
                    <span>{totals.total.toLocaleString()} {isArabic ? 'ر.س' : 'SAR'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>{isArabic ? 'إعدادات الطباعة' : 'Print Settings'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>{isArabic ? 'لون التصميم' : 'Theme Color'}</Label>
                    <Select value={formData.settings.theme} onValueChange={(v) => handleSettingsChange('theme', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {themes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{isArabic ? 'نمط التصميم' : 'Style'}</Label>
                    <Select value={formData.settings.style} onValueChange={(v) => handleSettingsChange('style', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {styles.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{isArabic ? 'نسبة الضريبة (%)' : 'Tax Rate (%)'}</Label>
                    <Input
                      type="number"
                      value={formData.settings.tax_rate}
                      onChange={(e) => handleSettingsChange('tax_rate', parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label>{isArabic ? 'ملاحظات إضافية' : 'Additional Notes'}</Label>
                    <Textarea
                      value={formData.settings.notes}
                      onChange={(e) => handleSettingsChange('notes', e.target.value)}
                      placeholder={isArabic ? 'ملاحظات تظهر في المستند...' : 'Notes to appear in document...'}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>{isArabic ? 'رمز طلب الاعتماد (APR-...)' : 'Approval Request Token (APR-...)'}</Label>
                    <Input
                      value={formData.settings.approval_token || ''}
                      onChange={(e) => handleSettingsChange('approval_token', e.target.value)}
                      readOnly={!!vehicleId}
                      placeholder={isArabic ? 'أدخل رمز طلب الاعتماد المطابق للمركبة (اختياري)' : 'Enter related approval token (optional)'}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isArabic
                        ? 'عند إدخال رمز طلب اعتماد تمت الموافقة عليه، سيتم إظهار التوقيع الإلكتروني ووقت الموافقة وباركود في أسفل الفاتورة.'
                        : 'If you enter an approved approval token, an electronic signature with timestamp & QR will be shown on the invoice.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Preview Modal */}
        {showPreview && previewHtml && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-lg">{isArabic ? 'معاينة المستند' : 'Document Preview'}</h3>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={printDocument}>
                    <Printer size={16} className={isArabic ? 'ml-1' : 'mr-1'} />
                    {isArabic ? 'طباعة' : 'Print'}
                  </Button>
                  <Button variant="outline" onClick={() => generateDocument(false)}>
                    <Download size={16} className={isArabic ? 'ml-1' : 'mr-1'} />
                    {isArabic ? 'تحميل' : 'Download'}
                  </Button>
                  <Button variant="ghost" onClick={() => setShowPreview(false)}>
                    {isArabic ? 'إغلاق' : 'Close'}
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <iframe srcDoc={previewHtml} className="w-full h-full min-h-[600px]" title="Document Preview" />
              </div>
            </div>
          </div>
        )}
        
        {/* Hidden Print Frame Removed */}
      </div>
    </Layout>
  );
};

export default DocumentPrint;
