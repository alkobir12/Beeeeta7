import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { partAPI, fileAPI } from '../services/api';
import { Package, Plus, Search, AlertTriangle, Edit, Trash2, Upload, Image as ImageIcon } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import Layout from '../components/Layout';

const PartsInventory = () => {
  const { toast } = useToast();
  const [parts, setParts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingPart, setEditingPart] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    partNumber: '',
    name: '',
    category: '',
    purchasePrice: '',
    sellingPrice: '',
    quantity: '',
    minQuantity: '5',
    supplier: '',
    image: ''
  });

  useEffect(() => {
    loadParts();
  }, [showLowStock]);

  const loadParts = async () => {
    try {
      setLoading(true);
      const response = await partAPI.getAll(searchQuery, showLowStock);
      setParts(response.data);
    } catch (error) {
      console.error('Error loading parts:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تحميل قطع الغيار',
        variant: 'destructive'
      });
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
      toast({
        title: 'تم الرفع',
        description: 'تم رفع الصورة بنجاح'
      });
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل رفع الصورة',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingPart) {
        await partAPI.update(editingPart.id, formData);
        toast({ title: 'تم التحديث', description: 'تم تحديث القطعة بنجاح' });
      } else {
        await partAPI.create(formData);
        toast({ title: 'تمت الإضافة', description: 'تمت إضافة القطعة بنجاح' });
      }
      
      setIsDialogOpen(false);
      resetForm();
      loadParts();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشلت العملية',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه القطعة؟')) return;
    
    try {
      await partAPI.delete(id);
      toast({ title: 'تم الحذف', description: 'تم حذف القطعة بنجاح' });
      loadParts();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل الحذف',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      partNumber: '',
      name: '',
      category: '',
      purchasePrice: '',
      sellingPrice: '',
      quantity: '',
      minQuantity: '5',
      supplier: '',
      image: ''
    });
    setEditingPart(null);
  };

  const openEditDialog = (part) => {
    setEditingPart(part);
    setFormData({
      partNumber: part.partNumber,
      name: part.name,
      category: part.category,
      purchasePrice: part.purchasePrice.toString(),
      sellingPrice: part.sellingPrice.toString(),
      quantity: part.quantity.toString(),
      minQuantity: part.minQuantity.toString(),
      supplier: part.supplier || '',
      image: part.image || ''
    });
    setIsDialogOpen(true);
  };

  const lowStockCount = parts.filter(p => p.quantity <= p.minQuantity).length;

  return (
    <Layout>
      <div className="min-h-screen" dir="rtl">
        <div className="container mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">إدارة قطع الغيار</h1>
              <p className="text-slate-600">المخزون وإدارة القطع</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={resetForm}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg"
                >
                  <Plus className="ml-2" size={20} />
                  إضافة قطعة جديدة
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                  <DialogTitle>{editingPart ? 'تعديل قطعة غيار' : 'إضافة قطعة غيار جديدة'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>رقم القطعة *</Label>
                      <Input
                        value={formData.partNumber}
                        onChange={(e) => setFormData({...formData, partNumber: e.target.value})}
                        placeholder="PN-001"
                        required
                      />
                    </div>
                    <div>
                      <Label>اسم القطعة *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="فلتر زيت"
                        required
                      />
                    </div>
                    <div>
                      <Label>التصنيف *</Label>
                      <Input
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        placeholder="محرك، فرامل، كهرباء"
                        required
                      />
                    </div>
                    <div>
                      <Label>سعر الشراء *</Label>
                      <Input
                        type="number"
                        value={formData.purchasePrice}
                        onChange={(e) => setFormData({...formData, purchasePrice: e.target.value})}
                        placeholder="100"
                        required
                      />
                    </div>
                    <div>
                      <Label>سعر البيع *</Label>
                      <Input
                        type="number"
                        value={formData.sellingPrice}
                        onChange={(e) => setFormData({...formData, sellingPrice: e.target.value})}
                        placeholder="150"
                        required
                      />
                    </div>
                    <div>
                      <Label>الكمية *</Label>
                      <Input
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                        placeholder="50"
                        required
                      />
                    </div>
                    <div>
                      <Label>الحد الأدنى</Label>
                      <Input
                        type="number"
                        value={formData.minQuantity}
                        onChange={(e) => setFormData({...formData, minQuantity: e.target.value})}
                        placeholder="5"
                      />
                    </div>
                    <div>
                      <Label>المورد</Label>
                      <Input
                        value={formData.supplier}
                        onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                        placeholder="اسم المورد"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>صورة القطعة</Label>
                    <div className="flex gap-4 items-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="image-upload"
                      />
                      <label htmlFor="image-upload">
                        <Button type="button" variant="outline" className="cursor-pointer" asChild>
                          <span>
                            {uploading ? 'جاري الرفع...' : (
                              <>
                                <Upload className="ml-2" size={18} />
                                رفع صورة
                              </>
                            )}
                          </span>
                        </Button>
                      </label>
                      {formData.image && (
                        <img src={formData.image} alt="Preview" className="h-20 w-20 object-cover rounded" />
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button type="submit" className="flex-1">حفظ</Button>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-none shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-700 text-sm font-medium mb-1">إجمالي القطع</p>
                    <p className="text-3xl font-bold text-blue-900">{parts.length}</p>
                  </div>
                  <div className="bg-blue-600 p-3 rounded-full">
                    <Package className="text-white" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-50 to-red-100 border-none shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-700 text-sm font-medium mb-1">قطع قليلة المخزون</p>
                    <p className="text-3xl font-bold text-red-900">{lowStockCount}</p>
                  </div>
                  <div className="bg-red-600 p-3 rounded-full">
                    <AlertTriangle className="text-white" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-none shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-700 text-sm font-medium mb-1">إجمالي الكمية</p>
                    <p className="text-3xl font-bold text-green-900">
                      {parts.reduce((sum, p) => sum + p.quantity, 0)}
                    </p>
                  </div>
                  <div className="bg-green-600 p-3 rounded-full">
                    <Package className="text-white" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-none shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-700 text-sm font-medium mb-1">قيمة المخزون</p>
                    <p className="text-3xl font-bold text-purple-900">
                      {parts.reduce((sum, p) => sum + (p.purchasePrice * p.quantity), 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-purple-600 p-3 rounded-full">
                    <Package className="text-white" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <Card className="mb-6 shadow-lg">
            <CardContent className="p-6">
              <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-64">
                  <div className="relative">
                    <Search className="absolute right-3 top-3 text-slate-400" size={20} />
                    <Input
                      placeholder="بحث برقم القطعة أو الاسم..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-10"
                    />
                  </div>
                </div>
                <Button onClick={loadParts}>بحث</Button>
                <Button
                  variant={showLowStock ? 'default' : 'outline'}
                  onClick={() => setShowLowStock(!showLowStock)}
                >
                  <AlertTriangle className="ml-2" size={18} />
                  قطع قليلة المخزون
                <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" id="parts-import" className="hidden" onChange={async (e)=>{
                  const f = e.target.files?.[0];
                  if(!f) return;
                  const fd = new FormData();
                  fd.append('file', f);
                  try{
                    await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/import/parts`, { method:'POST', body: fd });
                    toast({ title: 'تم الاستيراد', description: 'تم استيراد قائمة القطع من الملف' });
                    await loadParts();
                  }catch(err){
                    toast({ title: 'فشل الاستيراد', description: 'تأكد من الأعمدة: partNumber, name, category, purchasePrice, sellingPrice, quantity, minQuantity, supplier (أو عناوين عربية مكافئة)', variant: 'destructive' });
                  }
                }} />
                <label htmlFor="parts-import">
                  <Button variant="outline" asChild>
                    <span><Upload className="ml-2" size={18}/>استيراد قطع (Excel)</span>
                  </Button>
                </label>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Parts Grid */}
          {loading ? (
            <div className="text-center py-12">
              <Package className="animate-spin mx-auto text-blue-600 mb-4" size={48} />
              <p className="text-slate-600">جاري التحميل...</p>
            </div>
          ) : parts.length === 0 ? (
            <Card className="shadow-lg">
              <CardContent className="p-12 text-center">
                <Package className="mx-auto text-slate-300 mb-4" size={64} />
                <p className="text-slate-500 text-lg">لا توجد قطع غيار</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {parts.map(part => (
                <Card key={part.id} className="shadow-lg hover:shadow-xl transition-all">
                  <CardContent className="p-6">
                    {part.image && (
                      <img src={part.image} alt={part.name} className="w-full h-40 object-cover rounded-lg mb-4" />
                    )}
                    {!part.image && (
                      <div className="w-full h-40 bg-slate-100 rounded-lg mb-4 flex items-center justify-center">
                        <ImageIcon className="text-slate-400" size={48} />
                      </div>
                    )}
                    
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">{part.name}</h3>
                        <p className="text-sm text-slate-500">رقم: {part.partNumber}</p>
                      </div>
                      {part.quantity <= part.minQuantity && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle size={14} />
                          قليل
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">التصنيف:</span>
                        <Badge variant="outline">{part.category}</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">الكمية:</span>
                        <span className="font-bold text-slate-800">{part.quantity}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">سعر الشراء:</span>
                        <span className="text-slate-800">{part.purchasePrice} ر.س</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">سعر البيع:</span>
                        <span className="font-bold text-green-600">{part.sellingPrice} ر.س</span>
                      </div>
                      {part.supplier && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">المورد:</span>
                          <span className="text-slate-800">{part.supplier}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        onClick={() => openEditDialog(part)}
                        variant="outline" 
                        className="flex-1"
                      >
                        <Edit size={16} className="ml-2" />
                        تعديل
                      </Button>
                      <Button 
                        onClick={() => handleDelete(part.id)}
                        variant="destructive" 
                        className="flex-1"
                      >
                        <Trash2 size={16} className="ml-2" />
                        حذف
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PartsInventory;