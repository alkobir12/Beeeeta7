import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { partAPI, fileAPI, api, operationsAPI } from '../services/api';
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
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [stockStatus, setStockStatus] = useState('');
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
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState('sale');
  const [saleMode, setSaleMode] = useState('instant');
  const [transactionVehicleId, setTransactionVehicleId] = useState('');
  const [transactionItems, setTransactionItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [selectedAccountCode, setSelectedAccountCode] = useState('');

  const [formData, setFormData] = useState({
    partNumber: '', name: '', category: '', purchasePrice: '', sellingPrice: '',
    quantity: '', minQuantity: '5', supplier: '', image: '', location: ''
  });

  useEffect(() => { loadParts(); }, []);

  useEffect(() => {
    if (transactionType !== 'sale') {
      setSaleMode('instant');
      setTransactionVehicleId('');
    }
    if (showTransactionModal) {
      loadAccounts();
      if (transactionType === 'sale') {
        loadCustomers();
      } else {
        loadSuppliers();
      }
    }
    setTransactionItems(prev => prev.map(item => {
      if (!item.partId) return item;
      const selected = parts.find(p => p.id === item.partId);
      if (!selected) return item;
      return {
        ...item,
        price: transactionType === 'sale'
          ? Number(selected.sellingPrice || item.price || 0)
          : Number(selected.purchasePrice || item.price || 0)
      };
    }));
  }, [transactionType, showTransactionModal]);

  const loadParts = async () => {
    try {
      setLoading(true);
      const response = await partAPI.getAll();
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

  const handleSellPart = async (part) => {
    openTransactionModal('sale', part);
  };

  const handleRestockPart = async (part) => {
    openTransactionModal('purchase', part);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedBrand('');
    setStockStatus('');
  };

  const loadVehicles = async () => {
    try {
      const res = await axios.get(`${API_URL}/vehicles`);
      setVehicles(res.data || []);
    } catch (error) {
      setVehicles([]);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await axios.get(`${API_URL}/customers`);
      setCustomers(res.data || []);
    } catch (error) {
      setCustomers([]);
    }
  };

  const loadSuppliers = async () => {
    try {
      const res = await axios.get(`${API_URL}/suppliers`);
      setSuppliers(res.data || []);
    } catch (error) {
      setSuppliers([]);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await axios.get(`${API_URL}/accounts-chart`);
      setAccounts(res.data?.accounts || []);
    } catch (error) {
      setAccounts([]);
    }
  };

  const openTransactionModal = (type, part = null) => {
    setTransactionType(type);
    setSaleMode(type === 'sale' ? 'instant' : 'instant');
    setTransactionVehicleId('');
    setSelectedPartnerId('');
    setSelectedAccountCode('');
    if (part) {
      setTransactionItems([
        {
          partId: part.id,
          name: part.name,
          quantity: 1,
          price: type === 'sale' ? Number(part.sellingPrice || 0) : Number(part.purchasePrice || 0),
        }
      ]);
    } else {
      setTransactionItems([{ partId: '', name: '', quantity: 1, price: 0 }]);
    }
    loadVehicles();
    loadAccounts();
    if (type === 'sale') {
      loadCustomers();
    } else {
      loadSuppliers();
    }
    setShowTransactionModal(true);
  };

  const updateTransactionItem = (index, field, value) => {
    setTransactionItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'partId') {
        const selected = parts.find(p => p.id === value);
        if (selected) {
          updated[index].name = selected.name;
          updated[index].price = transactionType === 'sale'
            ? Number(selected.sellingPrice || 0)
            : Number(selected.purchasePrice || 0);
        }
      }
      return updated;
    });
  };

  const addTransactionItem = () => {
    setTransactionItems(prev => [...prev, { partId: '', name: '', quantity: 1, price: 0 }]);
  };

  const removeTransactionItem = (index) => {
    setTransactionItems(prev => prev.filter((_, i) => i !== index));
  };

  const submitTransaction = async () => {
    const validItems = transactionItems.filter(item => item.partId && item.quantity > 0);
    if (!validItems.length) {
      toast({ title: 'خطأ', description: 'أضف قطعة واحدة على الأقل', variant: 'destructive' });
      return;
    }
    if (transactionType === 'sale' && saleMode === 'vehicle' && !transactionVehicleId) {
      toast({ title: 'خطأ', description: 'اختر المركبة المرتبطة بالبيع', variant: 'destructive' });
      return;
    }
    if (transactionType === 'sale' && saleMode !== 'vehicle' && !selectedPartnerId) {
      toast({ title: 'خطأ', description: 'اختر العميل', variant: 'destructive' });
      return;
    }
    if (transactionType === 'purchase' && !selectedPartnerId) {
      toast({ title: 'خطأ', description: 'اختر المورد', variant: 'destructive' });
      return;
    }
    if (!selectedAccountCode) {
      toast({ title: 'خطأ', description: 'اختر الحساب المحاسبي للعملية', variant: 'destructive' });
      return;
    }

    const itemsPayload = validItems.map(item => ({
      itemType: 'part',
      itemId: item.partId,
      name: item.name,
      quantity: Number(item.quantity || 1),
      price: Number(item.price || 0),
      total: Number(item.quantity || 1) * Number(item.price || 0)
    }));
    const total = itemsPayload.reduce((sum, item) => sum + item.total, 0);

    try {
      await operationsAPI.create({
        type: transactionType === 'sale' ? 'sale' : 'purchase',
        items: itemsPayload,
        subtotal: total,
        total,
        paymentMethod: transactionType === 'sale' && saleMode === 'vehicle' ? 'credit' : 'cash',
        vehicleId: transactionType === 'sale' && saleMode === 'vehicle' ? transactionVehicleId : undefined,
        partnerType: transactionType === 'sale' ? 'customer' : 'supplier',
        partnerId: selectedPartnerId,
        partnerName: (transactionType === 'sale'
          ? (customers.find(c => c.id === selectedPartnerId)?.name
            || vehicles.find(v => v.id === transactionVehicleId)?.ownerName
            || vehicles.find(v => v.id === transactionVehicleId)?.owner_name
          )
          : (suppliers.find(s => s.id === selectedPartnerId)?.name)
        ) || '',
        accountId: selectedAccountCode,
        notes: transactionType === 'sale' ? 'عملية بيع قطع' : 'عملية شراء قطع'
      });

      for (const item of itemsPayload) {
        if (transactionType === 'sale') {
          await axios.post(`${API_URL}/parts/${item.itemId}/sell`, null, { params: { quantity: item.quantity } });
        } else {
          await axios.post(`${API_URL}/parts/${item.itemId}/restock`, null, { params: { quantity: item.quantity } });
        }
      }

      toast({
        title: 'تمت العملية',
        description: transactionType === 'sale' ? 'تم تسجيل عملية البيع' : 'تم تسجيل عملية الشراء'
      });
      setShowTransactionModal(false);
      await loadParts();
    } catch (error) {
      const detail = error?.response?.data?.detail || 'تعذر حفظ العملية';
      toast({ title: 'خطأ', description: detail, variant: 'destructive' });
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
    .filter(p => !selectedCategory || p.category === selectedCategory)
    .filter(p => !selectedBrand || p.brand === selectedBrand)
    .filter(p => {
      if (!stockStatus) return true;
      if (stockStatus === 'low') return p.quantity > 0 && p.quantity <= p.minQuantity;
      if (stockStatus === 'out') return p.quantity === 0;
      if (stockStatus === 'good') return p.quantity > p.minQuantity;
      return true;
    });

  const lowStockCount = parts.filter(p => p.quantity <= p.minQuantity).length;
  const outOfStockCount = parts.filter(p => p.quantity <= 0).length;
  const inventoryValue = parts.reduce((sum, p) => sum + (Number(p.quantity || 0) * Number(p.sellingPrice || 0)), 0);
  const alertsParts = parts.filter(p => p.quantity <= p.minQuantity);
  const categories = Array.from(new Set(parts.map(p => p.category).filter(Boolean)));
  const brands = Array.from(new Set(parts.map(p => p.brand).filter(Boolean)));
  const categoryStats = categories.map(cat => {
    const catParts = parts.filter(p => p.category === cat);
    const low = catParts.filter(p => p.quantity > 0 && p.quantity <= p.minQuantity).length;
    return { name: cat, count: catParts.length, low };
  });
  const currentDate = useMemo(() => new Date().toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }), []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-white">🔧 نظام إدارة قطع الغيار</h1>
          <p className="text-slate-400">إدارة المخزون والبيع والشراء للقطع</p>
        </div>
        <div className="px-4 py-2 rounded-lg bg-white/10 text-sm text-white" data-testid="inventory-date-badge">
          {currentDate}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => openTransactionModal('sale')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            data-testid="inventory-pos-button"
          >
            نقطة بيع
          </Button>
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

      <Dialog open={showTransactionModal} onOpenChange={setShowTransactionModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>عملية بيع/شراء قطع</DialogTitle>
            <DialogDescription>
              اختر نوع العملية وأضف البنود المراد بيعها أو شراؤها.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-2">نوع العملية</label>
                <select
                  className="apple-input"
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value)}
                  data-testid="transaction-type-select"
                >
                  <option value="sale">بيع</option>
                  <option value="purchase">شراء</option>
                </select>
              </div>
              {transactionType === 'sale' && (
                <div>
                  <label className="block text-sm mb-2">نوع البيع</label>
                  <select
                    className="apple-input"
                    value={saleMode}
                    onChange={(e) => setSaleMode(e.target.value)}
                    data-testid="transaction-sale-mode"
                  >
                    <option value="instant">بيع فوري</option>
                    <option value="vehicle">مركبة</option>
                  </select>
                </div>
              )}
              {transactionType === 'sale' && saleMode === 'vehicle' && (
                <div className="md:col-span-2">
                  <label className="block text-sm mb-2">المركبة المرتبطة</label>
                  <select
                    className="apple-input"
                    value={transactionVehicleId}
                    onChange={(e) => setTransactionVehicleId(e.target.value)}
                    data-testid="transaction-vehicle-select"
                  >
                    <option value="">اختر مركبة</option>
                    {vehicles.map(vehicle => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.plateNumber || vehicle.license_plate || vehicle.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm mb-2">{transactionType === 'sale' ? 'العميل' : 'المورد'}</label>
                <select
                  className="apple-input"
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  data-testid="transaction-partner-select"
                >
                  <option value="">اختر</option>
                  {(transactionType === 'sale' ? customers : suppliers).map(partner => (
                    <option key={partner.id} value={partner.id}>{partner.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-2">الحساب المحاسبي</label>
                <select
                  className="apple-input"
                  value={selectedAccountCode}
                  onChange={(e) => setSelectedAccountCode(e.target.value)}
                  data-testid="transaction-account-select"
                >
                  <option value="">اختر الحساب</option>
                  {accounts
                    .filter(acc => acc.type === (transactionType === 'sale' ? 'revenue' : 'expense'))
                    .map(acc => (
                      <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>
                    ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {transactionItems.map((item, index) => (
                <div key={`transaction-item-${index}`} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-sm mb-2">القطعة</label>
                    <select
                      className="apple-input"
                      value={item.partId}
                      onChange={(e) => updateTransactionItem(index, 'partId', e.target.value)}
                      data-testid={`transaction-item-part-${index}`}
                    >
                      <option value="">اختر قطعة</option>
                      {parts.map(part => (
                        <option key={part.id} value={part.id}>{part.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-2">الكمية</label>
                    <input
                      type="number"
                      className="apple-input"
                      value={item.quantity}
                      onChange={(e) => updateTransactionItem(index, 'quantity', Number(e.target.value))}
                      data-testid={`transaction-item-qty-${index}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">السعر</label>
                    <input
                      type="number"
                      className="apple-input"
                      value={item.price}
                      onChange={(e) => updateTransactionItem(index, 'price', Number(e.target.value))}
                      data-testid={`transaction-item-price-${index}`}
                    />
                  </div>
                  {transactionItems.length > 1 && (
                    <button
                      className="text-sm text-red-500"
                      type="button"
                      onClick={() => removeTransactionItem(index)}
                      data-testid={`transaction-item-remove-${index}`}
                    >
                      حذف البند
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center">
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-white/10 text-white"
                onClick={addTransactionItem}
                data-testid="transaction-add-item"
              >
                + إضافة قطعة أخرى
              </button>
              <Button onClick={submitTransaction} data-testid="transaction-submit">
                حفظ العملية
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
        </div>
      </div>



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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-card p-5 border-t-4" style={{ borderColor: '#33b5e5' }}>
          <p className="text-sm text-slate-300 mb-1">إجمالي القطع</p>
          <p className="text-2xl font-bold text-white">{parts.length}</p>
        </div>
        <div className="glass-card p-5 border-t-4" style={{ borderColor: '#ffbb33' }}>
          <p className="text-sm text-slate-300 mb-1">منخفضة المخزون</p>
          <p className="text-2xl font-bold text-white">{lowStockCount}</p>
        </div>
        <div className="glass-card p-5 border-t-4" style={{ borderColor: '#ff4444' }}>
          <p className="text-sm text-slate-300 mb-1">نافدة</p>
          <p className="text-2xl font-bold text-white">{outOfStockCount}</p>
        </div>
        <div className="glass-card p-5 border-t-4" style={{ borderColor: '#00C851' }}>
          <p className="text-sm text-slate-300 mb-1">قيمة المخزون</p>
          <p className="text-2xl font-bold text-white">{inventoryValue.toLocaleString()} ر.س</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar mb-6">
        <input
          className="filter-input flex-1"
          placeholder="🔍 بحث عن قطعة..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="parts-search-input"
        />
        <select
          className="filter-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          data-testid="parts-category-filter"
        >
          <option value="">كل الفئات</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          data-testid="parts-brand-filter"
        >
          <option value="">كل الماركات</option>
          {brands.map(brand => (
            <option key={brand} value={brand}>{brand}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={stockStatus}
          onChange={(e) => setStockStatus(e.target.value)}
          data-testid="parts-stock-filter"
        >
          <option value="">كل الحالات</option>
          <option value="good">مخزون جيد</option>
          <option value="low">منخفض المخزون</option>
          <option value="out">نافد</option>
        </select>
        <button
          className="px-4 py-2 rounded-lg bg-white/10 text-white"
          onClick={handleResetFilters}
          data-testid="parts-reset-filters"
        >
          إعادة تعيين
        </button>
      </div>

      <div className="glass-card p-4 mb-6">
        <h3 className="text-lg font-semibold mb-3">📊 تصنيف المخزون</h3>
        <div className="space-y-2">
          {categoryStats.map(cat => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 transition rounded-lg px-3 py-2"
              data-testid={`inventory-category-${cat.name}`}
            >
              <span className="text-white">{cat.name}</span>
              <span className="text-xs text-slate-300">{cat.count} قطع • {cat.low} منخفض</span>
            </button>
          ))}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <button
              onClick={() => setStockStatus('out')}
              className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 transition rounded-lg px-3 py-2"
              data-testid="inventory-filter-out"
            >
              <span className="text-white">القطع النافدة</span>
              <span className="text-xs text-red-300">{outOfStockCount}</span>
            </button>
            <button
              onClick={() => setStockStatus('low')}
              className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 transition rounded-lg px-3 py-2"
              data-testid="inventory-filter-low"
            >
              <span className="text-white">القطع منخفضة المخزون</span>
              <span className="text-xs text-yellow-300">{lowStockCount}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div data-testid="parts-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredParts.map(part => {
            const statusColor = part.quantity === 0 ? '#ff4444' : part.quantity <= part.minQuantity ? '#ffbb33' : '#00C851';
            const statusText = part.quantity === 0 ? 'نافد' : part.quantity <= part.minQuantity ? 'منخفض' : 'جيد';
            const stockPercent = Math.min((part.quantity / Math.max(part.minQuantity, 1)) * 100, 100);
            return (
            <div data-testid={`part-card-${part.id}`} key={part.id} className="glass-card p-0 overflow-hidden group transition-all" style={{ borderColor: statusColor }}>
              <div className="h-40 bg-white/5 relative">
                {part.image ? (
                  <img src={part.image} alt={part.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <ImageIcon size={40} />
                  </div>
                )}
                <div className="absolute top-2 right-2 text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-sm" style={{ background: `${statusColor}30`, color: statusColor }}>
                  <AlertTriangle size={12} />
                  <span>{statusText}</span>
                </div>
              </div>
              
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-white truncate" title={part.name}>{part.name}</h3>
                    <p className="text-xs text-slate-400 font-mono">{part.partNumber || '-'}</p>
                  </div>
                  <span className="text-xs bg-white/10 px-2 py-1 rounded text-slate-200">{part.category || '-'}</span>
                </div>

                <div className="space-y-1 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-400">الكمية</span>
                    <span className="font-medium text-white">{part.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">سعر الشراء</span>
                    <span className="text-white">{part.purchasePrice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">سعر البيع</span>
                    <span className="font-bold text-emerald-300">{part.sellingPrice}</span>
                  </div>
                </div>

                <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                  <div className="h-full" style={{ width: `${stockPercent}%`, background: statusColor }} />
                </div>

                <div className="flex gap-2 pt-2 border-t border-white/10 flex-wrap">
                  <button
                    onClick={() => handleSellPart(part)}
                    className="flex-1 py-2 text-sm text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors flex items-center justify-center gap-2"
                    data-testid={`part-sell-${part.id}`}
                  >
                    بيع
                  </button>
                  <button
                    onClick={() => handleRestockPart(part)}
                    className="flex-1 py-2 text-sm text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors flex items-center justify-center gap-2"
                    data-testid={`part-restock-${part.id}`}
                  >
                    شراء
                  </button>
                  <button
                    onClick={() => openEditDialog(part)}
                    className="flex-1 py-2 text-sm text-slate-300 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center gap-2"
                    data-testid={`part-edit-${part.id}`}
                  >
                    <Edit size={14} /> تعديل
                  </button>
                  <button
                    onClick={() => handleDelete(part.id)}
                    className="flex-1 py-2 text-sm text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex items-center justify-center gap-2"
                    data-testid={`part-delete-${part.id}`}
                  >
                    <Trash2 size={14} /> حذف
                  </button>
                </div>
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
};

export default PartsInventory;
