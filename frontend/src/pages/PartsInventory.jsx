import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { partAPI, fileAPI } from '../services/api';
import { Package, Plus, Search, AlertTriangle, Edit, Trash2, Upload, Image as ImageIcon, FileSpreadsheet } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';

const PartsInventory = () => {
  const { toast } = useToast();
  const [parts, setParts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingPart, setEditingPart] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);

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
      toast({ title: 'تم الرفع', description: 'تم رفع الصورة بنجاح' });
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل رفع الصورة', variant: 'destructive' });
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
      
      if (!res.ok) throw new Error('Import failed');
      
      const result = await res.json();
      toast({ 
        title: 'تم الاستيراد', 
        description: `تم استيراد ${result.imported} وتحديث ${result.updated} قطعة بنجاح` 
      });
      loadParts();
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل استيراد الملف. تأكد من الصيغة والأعمدة.', variant: 'destructive' });
    } finally {
      setImporting(false);
      e.target.value = ''; // reset input
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
        toast({ title: 'تم التحديث', description: 'تم تحديث القطعة بنجاح' });
      } else {
        await partAPI.create(payload);
        toast({ title: 'تمت الإضافة', description: 'تمت إضافة القطعة بنجاح' });
      }
      setIsDialogOpen(false);
      resetForm();
      loadParts();
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشلت العملية', variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه القطعة؟')) return;
    try {
      await partAPI.delete(id);
      toast({ title: 'تم الحذف', description: 'تم حذف القطعة بنجاح' });
      loadParts();
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل الحذف', variant: 'destructive' });
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

  const lowStockCount = parts.filter(p => p.quantity <= p.minQuantity).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة المخزون</h1>
          <p className="text-gray-500 mt-1">إدارة قطع الغيار والمستودع</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <input 
              type="file" 
              accept=".xlsx,.xls,.csv" 
              onChange={handleImportParts} 
              className="hidden" 
              id="import-excel"
              disabled={importing}
            />
            <label htmlFor="import-excel">
              <Button variant="outline" asChild className="cursor-pointer bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
                <span>
                  <FileSpreadsheet className="ml-2" size={18} />
                  {importing ? 'جاري الاستيراد...' : 'استيراد Excel'}
                </span>
              </Button>
            </label>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="apple-button">
                <Plus className="ml-2" size={18} />
                إضافة قطعة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPart ? 'تعديل قطعة' : 'إضافة قطعة جديدة'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>رقم القطعة *</Label>
                    <Input required value={formData.partNumber} onChange={e => setFormData({...formData, partNumber: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>اسم القطعة *</Label>
                    <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>التصنيف *</Label>
                    <Input required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>الموقع/الرف</Label>
                    <Input value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="A-12" />
                  </div>
                  <div className="space-y-2">
                    <Label>الكمية *</Label>
                    <Input required type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>الحد الأدنى</Label>
                    <Input type="number" value={formData.minQuantity} onChange={e => setFormData({...formData, minQuantity: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>سعر الشراء *</Label>
                    <Input required type="number" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>سعر البيع *</Label>
                    <Input required type="number" value={formData.sellingPrice} onChange={e => setFormData({...formData, sellingPrice: e.target.value})} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>المورد</Label>
                    <Input value={formData.supplier} onChange={e => setFormData({...formData, supplier: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>صورة القطعة</Label>
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer apple-button-secondary flex items-center gap-2 px-4 py-2">
                      <Upload size={16} />
                      <span>{uploading ? 'جاري الرفع...' : 'رفع صورة'}</span>
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                    {formData.image && <img src={formData.image} alt="Preview" className="h-12 w-12 object-cover rounded-lg border border-gray-200" />}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">إلغاء</Button>
                  <Button type="submit" className="flex-1 apple-button">حفظ</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="apple-card p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">إجمالي القطع</p>
            <p className="text-2xl font-bold text-gray-900">{parts.length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <Package size={20} />
          </div>
        </div>
        <div className="apple-card p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">منخفضة المخزون</p>
            <p className="text-2xl font-bold text-red-600">{lowStockCount}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
            <AlertTriangle size={20} />
          </div>
        </div>
        <div className="apple-card p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">إجمالي الكمية</p>
            <p className="text-2xl font-bold text-green-600">{parts.reduce((sum, p) => sum + p.quantity, 0)}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
            <Package size={20} />
          </div>
        </div>
        <div className="apple-card p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">قيمة المخزون</p>
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
            placeholder="بحث برقم القطعة أو الاسم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={loadParts} variant="outline">بحث</Button>
          <Button
            variant={showLowStock ? 'default' : 'outline'}
            onClick={() => setShowLowStock(!showLowStock)}
            className={showLowStock ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
          >
            <AlertTriangle className="ml-2" size={18} />
            منخفض
          </Button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {parts.map(part => (
            <div key={part.id} className="apple-card p-0 overflow-hidden group hover:shadow-md transition-all">
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
                    <span>منخفض</span>
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
                    <span className="text-gray-500">الكمية</span>
                    <span className="font-medium">{part.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">سعر الشراء</span>
                    <span>{part.purchasePrice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">سعر البيع</span>
                    <span className="font-bold text-green-600">{part.sellingPrice}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-50">
                  <button onClick={() => openEditDialog(part)} className="flex-1 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-center gap-2">
                    <Edit size={14} /> تعديل
                  </button>
                  <button onClick={() => handleDelete(part.id)} className="flex-1 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2">
                    <Trash2 size={14} /> حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PartsInventory;
