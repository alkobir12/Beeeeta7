import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { partAPI, fileAPI } from '../services/api';
import { Package, Plus, Search, AlertTriangle, Edit, Trash2, Upload, Image as ImageIcon, FileSpreadsheet } from 'lucide-react';
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{"Parts Management"}</h1>
          <p className="text-gray-500 mt-1">{"Parts Management"}</p>
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
                  {importing ? "Loading..." : "Import Excel"}
                </span>
              </Button>
            </label>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="apple-button">
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
                    <Input required value={formData.partNumber} onChange={e => setFormData({...formData, partNumber: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>{"Part Name"} *</Label>
                    <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>{"Category"} *</Label>
                    <Input required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>{"Supplier"}</Label>
                    <Input value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="A-12" />
                  </div>
                  <div className="space-y-2">
                    <Label>{"Quantity"} *</Label>
                    <Input required type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>{"Min Quantity"}</Label>
                    <Input type="number" value={formData.minQuantity} onChange={e => setFormData({...formData, minQuantity: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>{"Purchase Price"} *</Label>
                    <Input required type="number" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>{"Selling Price"} *</Label>
                    <Input required type="number" value={formData.sellingPrice} onChange={e => setFormData({...formData, sellingPrice: e.target.value})} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>{"Supplier"}</Label>
                    <Input value={formData.supplier} onChange={e => setFormData({...formData, supplier: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{"Image"}</Label>
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer apple-button-secondary flex items-center gap-2 px-4 py-2">
                      <Upload size={16} />
                      <span>{uploading ? "Loading..." : "Upload"}</span>
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                    {formData.image && <img src={formData.image} alt="Preview" className="h-12 w-12 object-cover rounded-lg border border-gray-200" />}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">{"Cancel"}</Button>
                  <Button type="submit" className="flex-1 apple-button">{"Save"}</Button>
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
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={loadParts} variant="outline">{"Refresh"}</Button>
          <Button
            variant={showLowStock ? 'default' : 'outline'}
            onClick={() => setShowLowStock(!showLowStock)}
            className={showLowStock ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
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
                  <button onClick={() => openEditDialog(part)} className="flex-1 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-center gap-2">
                    <Edit size={14} /> {"Edit"}
                  </button>
                  <button onClick={() => handleDelete(part.id)} className="flex-1 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2">
                    <Trash2 size={14} /> {"Delete"}
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
