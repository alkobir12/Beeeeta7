import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { partAPI, fileAPI, api } from '../services/api';
import { Package, Plus, Search, AlertTriangle, Edit, Trash2, Upload, Image as ImageIcon, FileSpreadsheet, Camera } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { useTranslation } from 'react-i18next';

const PartsInventory = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { toast } = useToast();
  const [parts, setParts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingPart, setEditingPart] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [ocrImage, setOcrImage] = useState('');
  const [ocrPreview, setOcrPreview] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrImporting, setOcrImporting] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrError, setOcrError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  const [formData, setFormData] = useState({
    partNumber: '', name: '', category: '', purchasePrice: '', sellingPrice: '',
    quantity: '', minQuantity: '5', supplier: '', image: '', location: ''
  });

  useEffect(() => { loadParts(); }, [showLowStock]);

  const loadParts = async () => {
    try {
      setLoading(true);
      const response = await partAPI.getAll(searchQuery, showLowStock);
      setParts(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setUploading(true);
      const response = await fileAPI.upload(file);
      setFormData({ ...formData, image: response.data.url });
      toast({ title: t('common.success'), description: t('messages.success_saved') });
    } catch (error) {
      toast({ title: t('common.error'), description: t('messages.error_occurred'), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleImportParts = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      setImporting(true);
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/import/parts`, {
        method: 'POST',
        body: formData
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result?.detail || 'Import failed');
      }

      toast({
        title: t('common.success'),
        description: result.imported_parts !== undefined
          ? `قطع: ${result.imported_parts || 0} | خدمات: ${result.imported_services || 0} | تمت المعالجة: ${result.processed || (result.total || 0)}`
          : `تم الاستيراد: ${result.imported || 0} / تم التحديث: ${result.updated || 0} / تمت المعالجة: ${result.processed || (result.total || 0)}`,
      });
      loadParts();
    } catch (error) {
      toast({ title: t('common.error'), description: t('messages.error_occurred'), variant: 'destructive' });
    } finally {
      setImporting(false);
      e.target.value = ''; // reset input
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
    if (!ocrImage) {
      toast({ title: 'تنبيه', description: 'يرجى رفع صورة الفاتورة أولاً', variant: 'destructive' });
      return;
    }
    setOcrLoading(true);
    setOcrError('');
    try {
      const { data } = await api.post('/parts/ocr', { image_base64: ocrImage });
      setOcrResult(data);
    } catch (error) {
      console.error('OCR error:', error);
      const detail = error?.response?.data?.detail;
      setOcrError(detail || 'تعذر قراءة الفاتورة. حاول بصورة أوضح.');
    } finally {
      setOcrLoading(false);
    }
  };

  const importOcrItems = async () => {
    if (!ocrResult?.items?.length) return;
    setOcrImporting(true);
    try {
      let imported = 0;
      for (const [index, item] of ocrResult.items.entries()) {
        const description = item.description || item.name || item.part_number || `بند OCR ${index + 1}`;
        const qty = Number(item.quantity || 1);
        const unitPrice = Number(item.unit_price || (item.total && qty ? item.total / qty : 0));
        const partNumber = item.part_number || `OCR-${Date.now()}-${index + 1}`;
        const existing = parts.find((p) => p.partNumber === partNumber);
        if (existing) {
          await partAPI.update(existing.id, {
            quantity: Number(existing.quantity || 0) + (qty || 1),
            purchasePrice: unitPrice || existing.purchasePrice || 0,
            sellingPrice: unitPrice || existing.sellingPrice || 0,
          });
        } else {
          await partAPI.create({
            partNumber,
            name: description,
            category: 'OCR',
            purchasePrice: unitPrice || 0,
            sellingPrice: unitPrice || 0,
            quantity: qty || 1,
            minQuantity: 1,
            supplier: ocrResult?.vendor || '',
          });
        }
        imported += 1;
      }
      await loadParts();
      toast({
        title: 'تم الاستيراد',
        description: `تم إضافة ${imported} بند للمخزون بنجاح`,
      });
    } catch (error) {
      console.error('Import OCR items error:', error);
      const detail = error?.response?.data?.detail || error?.message;
      toast({ title: 'خطأ', description: detail || 'تعذر استيراد البنود', variant: 'destructive' });
    } finally {
      setOcrImporting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      purchasePrice: parseFloat(formData.purchasePrice) || 0,
      sellingPrice: parseFloat(formData.sellingPrice) || 0,
      quantity: parseInt(formData.quantity) || 0,
      minQuantity: parseInt(formData.minQuantity) || 0
    };
    
    try {
      if (editingPart) {
        await partAPI.update(editingPart.id, payload);
        toast({ title: "Success", description: "Success" });
      } else {
        await partAPI.create(payload);
        toast({ title: "Success", description: "Success" });
      }
      setIsDialogOpen(false);
      resetForm();
      loadParts();
    } catch (error) {
      toast({ title: "Error", description: "Error", variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await partAPI.delete(id);
      toast({ title: "Success", description: "Success" });
      loadParts();
    } catch (error) {
      toast({ title: "Error", description: "Error", variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({
      partNumber: '', name: '', category: '', purchasePrice: '', sellingPrice: '',
      quantity: '', minQuantity: '5', supplier: '', image: '', location: ''
    });
    setEditingPart(null);
  };

  const openEditDialog = (part) => {
    setEditingPart(part);
    setFormData({
      partNumber: part.partNumber, name: part.name, category: part.category,
      purchasePrice: part.purchasePrice.toString(), sellingPrice: part.sellingPrice.toString(),
      quantity: part.quantity.toString(), minQuantity: part.minQuantity.toString(),
      supplier: part.supplier || '', image: part.image || '', location: part.location || ''
    });
    setIsDialogOpen(true);
  };

  const filteredParts = parts
    .filter(p => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.partNumber || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
      );
    })
    .filter(p => !showLowStock || p.quantity <= p.minQuantity);

  const lowStockCount = parts.filter(p => p.quantity <= p.minQuantity).length;
  const outOfStockCount = parts.filter(p => p.quantity <= 0).length;
  const inventoryValue = parts.reduce((sum, p) => sum + (Number(p.quantity || 0) * Number(p.sellingPrice || 0)), 0);
  const alertsParts = parts.filter(p => p.quantity <= p.minQuantity);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{"Parts Management"}</h1>
          <p className="text-gray-500 mt-1">{"Parts Management"}</p>
        </div>
        {activeTab === 'inventory' && (
        <div className="flex gap-2">
          <div className="relative">
            <input 
              type="file" 
              accept=".xlsx,.xls,.csv" 
              onChange={handleImportParts} 
              className="hidden" 
              id="import-excel"
              disabled={importing}
              data-testid="parts-import-input"
            />
            <label htmlFor="import-excel">
              <Button
                variant="outline"
                asChild
                className="cursor-pointer bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                data-testid="parts-import-button"
              >
                <span>
                  <FileSpreadsheet className="ml-2" size={18} />
                  {importing ? "Loading..." : "Import Excel"}
                </span>
              </Button>
            </label>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => { resetForm(); setIsDialogOpen(true); }}
                className="apple-button"
                data-testid="parts-add-button"
              >
                <Plus className="ml-2" size={18} />
                {"Add Part"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPart ? "Edit" : "Add Part"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{"Part Number"} *</Label>
                    <Input required value={formData.partNumber} onChange={e => setFormData({...formData, partNumber: e.target.value})} data-testid="part-number-input" />
                  </div>
                  <div className="space-y-2">
                    <Label>{"Part Name"} *</Label>
                    <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} data-testid="part-name-input" />
                  </div>
                  <div className="space-y-2">
                    <Label>{"Category"} *</Label>
                    <Input required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} data-testid="part-category-input" />
                  </div>
                  <div className="space-y-2">
                    <Label>{"Supplier"}</Label>
                    <Input value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="A-12" data-testid="part-location-input" />
                  </div>
                  <div className="space-y-2">
                    <Label>{"Quantity"} *</Label>
                    <Input required type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} data-testid="part-quantity-input" />
                  </div>
                  <div className="space-y-2">
                    <Label>{"Min Quantity"}</Label>
                    <Input type="number" value={formData.minQuantity} onChange={e => setFormData({...formData, minQuantity: e.target.value})} data-testid="part-min-quantity-input" />
                  </div>
                  <div className="space-y-2">
                    <Label>{"Purchase Price"} *</Label>
                    <Input required type="number" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} data-testid="part-purchase-price-input" />
                  </div>
                  <div className="space-y-2">
                    <Label>{"Selling Price"} *</Label>
                    <Input required type="number" value={formData.sellingPrice} onChange={e => setFormData({...formData, sellingPrice: e.target.value})} data-testid="part-selling-price-input" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>{"Supplier"}</Label>
                    <Input value={formData.supplier} onChange={e => setFormData({...formData, supplier: e.target.value})} data-testid="part-supplier-input" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{"Image"}</Label>
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer apple-button-secondary flex items-center gap-2 px-4 py-2">
                      <Upload size={16} />
                      <span>{uploading ? "Loading..." : "Upload"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        data-testid="part-image-input"
                      />
                    </label>
                    {formData.image && <img src={formData.image} alt="Preview" className="h-12 w-12 object-cover rounded-lg border border-gray-200" />}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1" data-testid="part-dialog-cancel">{"Cancel"}</Button>
                  <Button type="submit" className="flex-1 apple-button" data-testid="part-dialog-save">{"Save"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6" data-testid="inventory-tabs">
        {[
          { id: 'dashboard', label: 'الرئيسية' },
          { id: 'inventory', label: 'المخزون' },
          { id: 'alerts', label: 'التنبيهات' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-sm transition ${activeTab === tab.id ? 'bg-teal-500 text-white' : 'bg-slate-800/60 text-slate-300'}`}
            data-testid={`inventory-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 rounded-lg text-white">
              <h3 className="text-lg font-semibold">إجمالي القطع</h3>
              <p className="text-2xl font-bold">{parts.length}</p>
            </div>
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-4 rounded-lg text-white">
              <h3 className="text-lg font-semibold">منخفضة المخزون</h3>
              <p className="text-2xl font-bold">{lowStockCount}</p>
            </div>
            <div className="bg-gradient-to-r from-red-500 to-rose-500 p-4 rounded-lg text-white">
              <h3 className="text-lg font-semibold">نافدة</h3>
              <p className="text-2xl font-bold">{outOfStockCount}</p>
            </div>
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-4 rounded-lg text-white">
              <h3 className="text-lg font-semibold">قيمة المخزون</h3>
              <p className="text-2xl font-bold">{inventoryValue.toLocaleString()} ر.س</p>
            </div>
          </div>

          <div className="apple-card p-4">
            <h3 className="text-lg font-semibold mb-3">أحدث القطع</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {parts.slice(0, 6).map(part => (
                <div key={part.id} className="flex items-center justify-between bg-slate-800/40 p-3 rounded-lg">
                  <div>
                    <div className="font-semibold text-white">{part.name}</div>
                    <div className="text-xs text-slate-400">{part.partNumber}</div>
                  </div>
                  <div className="text-sm text-emerald-300">{part.quantity} قطعة</div>
                </div>
              ))}
              {!parts.length && <div className="text-sm text-slate-400">لا توجد قطع بعد.</div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="apple-card p-4 mb-6">
          <h3 className="text-lg font-semibold mb-3">تنبيهات المخزون</h3>
          {!alertsParts.length ? (
            <div className="text-sm text-slate-400">لا توجد تنبيهات حالياً.</div>
          ) : (
            <ul className="space-y-2">
              {alertsParts.map(part => (
                <li key={part.id} className="flex items-center justify-between bg-slate-800/40 p-3 rounded-lg">
                  <div>
                    <div className="font-semibold text-white">{part.name}</div>
                    <div className="text-xs text-slate-400">{part.partNumber}</div>
                  </div>
                  <div className="text-sm text-yellow-300">الكمية: {part.quantity}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div style={{ display: activeTab === 'inventory' ? 'block' : 'none' }}>

      {/* OCR Invoice */}
      <div className="apple-card p-5 mb-4" data-testid="parts-ocr-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">OCR فاتورة قطع الغيار</h3>
            <p className="text-sm text-gray-500">ارفع صورة الفاتورة لاستخراج البنود تلقائياً</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="apple-button flex items-center gap-2 cursor-pointer">
              <Camera size={16} />
              <span>التقاط بالكاميرا</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleOcrFileChange}
                data-testid="parts-ocr-camera-input"
              />
            </label>
            <label className="apple-button flex items-center gap-2 cursor-pointer">
              <Upload size={16} />
              <span>رفع ملف</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleOcrFileChange}
                data-testid="parts-ocr-file-input"
              />
            </label>
            <Button onClick={runOcr} disabled={ocrLoading} data-testid="parts-ocr-run-button">
              {ocrLoading ? 'جاري القراءة...' : 'تشغيل OCR'}
            </Button>
          </div>
        </div>

        {ocrPreview && (
          <div className="mt-4">
            <img
              src={ocrPreview}
              alt="OCR Preview"
              className="max-h-56 rounded-xl border border-gray-200"
              data-testid="parts-ocr-preview"
            />
          </div>
        )}

        {ocrError && (
          <div className="mt-3 text-sm text-red-600" data-testid="parts-ocr-error">
            {ocrError}
          </div>
        )}

        {ocrResult && (
          <div className="mt-4 space-y-3" data-testid="parts-ocr-result">
            <div className="flex flex-wrap gap-4 text-sm text-gray-700">
              <span data-testid="parts-ocr-vendor">المورد: {ocrResult.vendor || 'غير محدد'}</span>
              <span data-testid="parts-ocr-invoice">الفاتورة: {ocrResult.invoice_number || '—'}</span>
              <span data-testid="parts-ocr-date">التاريخ: {ocrResult.date || '—'}</span>
              <span data-testid="parts-ocr-tax">الرقم الضريبي: {ocrResult.tax_number || '—'}</span>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="p-2 text-right">رقم القطعة</th>
                    <th className="p-2 text-right">الوصف</th>
                    <th className="p-2 text-right">الكمية</th>
                    <th className="p-2 text-right">سعر الوحدة</th>
                    <th className="p-2 text-right">الإجمالي</th>
                    <th className="p-2 text-right">الثقة</th>
                  </tr>
                </thead>
                <tbody>
                  {(ocrResult.items || []).map((item, idx) => {
                    const confidence = typeof item.confidence === 'number' ? item.confidence : null;
                    const isLow = confidence !== null && confidence < 0.6;
                    return (
                      <tr
                        key={`${item.part_number}-${idx}`}
                        className={`border-b ${isLow ? 'bg-red-50' : ''}`}
                        data-testid={`parts-ocr-item-${idx}`}
                      >
                        <td className="p-2">{item.part_number || '—'}</td>
                        <td className="p-2">{item.description || '—'}</td>
                        <td className="p-2">{item.quantity || 1}</td>
                        <td className="p-2">{item.unit_price || '—'}</td>
                        <td className="p-2">{item.total || '—'}</td>
                        <td className="p-2">{confidence !== null ? `${Math.round(confidence * 100)}%` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-700">
              <span data-testid="parts-ocr-subtotal">المجموع: {ocrResult?.totals?.subtotal || '—'}</span>
              <span data-testid="parts-ocr-tax-total">الضريبة: {ocrResult?.totals?.tax || '—'}</span>
              <span data-testid="parts-ocr-grand-total">الإجمالي النهائي: {ocrResult?.totals?.grand_total || '—'}</span>
            </div>
            {!!ocrResult?.items?.length && (
              <Button
                onClick={importOcrItems}
                disabled={ocrImporting}
                data-testid="parts-ocr-import-button"
              >
                {ocrImporting ? 'جاري الاستيراد...' : 'استيراد البنود للمخزون'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="apple-card p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{"Total Parts"}</p>
            <p className="text-2xl font-bold text-gray-900">{parts.length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <Package size={20} />
          </div>
        </div>
        <div className="apple-card p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{"Low Stock"}</p>
            <p className="text-2xl font-bold text-red-600">{lowStockCount}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
            <AlertTriangle size={20} />
          </div>
        </div>
        <div className="apple-card p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{"Quantity"}</p>
            <p className="text-2xl font-bold text-green-600">{parts.reduce((sum, p) => sum + p.quantity, 0)}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
            <Package size={20} />
          </div>
        </div>
        <div className="apple-card p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{"Inventory Value"}</p>
            <p className="text-2xl font-bold text-purple-600">{parts.reduce((sum, p) => sum + (p.purchasePrice * p.quantity), 0).toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
            <Package size={20} />
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="apple-card p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            className="apple-input pr-10"
            placeholder={"Search..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="parts-search-input"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={loadParts} variant="outline" data-testid="parts-refresh-button">{"Refresh"}</Button>
          <Button
            variant={showLowStock ? 'default' : 'outline'}
            onClick={() => setShowLowStock(!showLowStock)}
            className={showLowStock ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
            data-testid="parts-low-stock-toggle"
          >
            <AlertTriangle className="ml-2" size={18} />
            {"Low Stock"}
          </Button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div data-testid="parts-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredParts.map(part => (
            <div data-testid={`part-card-${part.id}`} key={part.id} className="apple-card p-0 overflow-hidden group hover:shadow-md transition-all">
              <div className="h-40 bg-gray-100 relative">
                {part.image ? (
                  <img src={part.image} alt={part.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <ImageIcon size={40} />
                  </div>
                )}
                {part.quantity <= part.minQuantity && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                    <AlertTriangle size={12} />
                    <span>{"Low Stock"}</span>
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-gray-900 truncate" title={part.name}>{part.name}</h3>
                    <p className="text-xs text-gray-500 font-mono">{part.partNumber}</p>
                  </div>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{part.category}</span>
                </div>

                <div className="space-y-1 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{"Quantity"}</span>
                    <span className="font-medium">{part.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{"Purchase Price"}</span>
                    <span>{part.purchasePrice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{"Selling Price"}</span>
                    <span className="font-bold text-green-600">{part.sellingPrice}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-50">
                  <button
                    onClick={() => openEditDialog(part)}
                    className="flex-1 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                    data-testid={`part-edit-${part.id}`}
                  >
                    <Edit size={14} /> {"Edit"}
                  </button>
                  <button
                    onClick={() => handleDelete(part.id)}
                    className="flex-1 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                    data-testid={`part-delete-${part.id}`}
                  >
                    <Trash2 size={14} /> {"Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
};

export default PartsInventory;
