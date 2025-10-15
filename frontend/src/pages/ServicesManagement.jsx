import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Wrench, Search, Plus, Edit, Trash2, DollarSign } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import Layout from '../components/Layout';
import { serviceAPI } from '../services/api';

const ServicesManagement = () => {
  const { toast } = useToast();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    duration: ''
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await serviceAPI.getAll();
      setServices(response.data);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل الخدمات",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingService) {
        await serviceAPI.update(editingService.id, formData);
        toast({
          title: "نجح",
          description: "تم تحديث الخدمة بنجاح"
        });
      } else {
        await serviceAPI.create(formData);
        toast({
          title: "نجح",
          description: "تم إضافة الخدمة بنجاح"
        });
      }
      setShowForm(false);
      setEditingService(null);
      setFormData({ name: '', category: '', price: '', duration: '' });
      fetchServices();
    } catch (error) {
      console.error('Error saving service:', error);
      toast({
        title: "خطأ",
        description: "فشل في حفظ الخدمة",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (serviceId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return;
    
    try {
      await serviceAPI.delete(serviceId);
      toast({
        title: "نجح",
        description: "تم حذف الخدمة بنجاح"
      });
      fetchServices();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast({
        title: "خطأ",
        description: "فشل في حذف الخدمة",
        variant: "destructive"
      });
    }
  };

  const openEditForm = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      category: service.category,
      price: service.price.toString(),
      duration: service.duration.toString()
    });
    setShowForm(true);
  };

  const categories = [...new Set(services.map(s => s.category))];
  
  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const servicesByCategory = categories.map(category => ({
    category,
    services: filteredServices.filter(s => s.category === category)
  })).filter(g => g.services.length > 0);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">جاري التحميل...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen" dir="rtl">
        <div className="container mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">إدارة الخدمات</h1>
              <p className="text-slate-600">إضافة وتعديل الخدمات والأسعار</p>
            </div>
            <Button
              onClick={() => {
                setShowForm(true);
                setEditingService(null);
                setFormData({ name: '', category: '', price: '', duration: '' });
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus size={20} className="ml-2" />
              إضافة خدمة
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-none shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-700 text-sm font-medium mb-1">إجمالي الخدمات</p>
                    <p className="text-3xl font-bold text-blue-900">{services.length}</p>
                  </div>
                  <div className="bg-blue-600 p-3 rounded-full">
                    <Wrench className="text-white" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-none shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-700 text-sm font-medium mb-1">الفئات</p>
                    <p className="text-3xl font-bold text-green-900">{categories.length}</p>
                  </div>
                  <div className="bg-green-600 p-3 rounded-full">
                    <Wrench className="text-white" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-none shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-700 text-sm font-medium mb-1">متوسط السعر</p>
                    <p className="text-3xl font-bold text-purple-900">
                      {(services.reduce((sum, s) => sum + s.price, 0) / services.length || 0).toFixed(0)} ر.س
                    </p>
                  </div>
                  <div className="bg-purple-600 p-3 rounded-full">
                    <DollarSign className="text-white" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Add/Edit Form */}
          {showForm && (
            <Card className="mb-6 shadow-lg border-2 border-blue-200">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4">
                  {editingService ? 'تعديل خدمة' : 'إضافة خدمة جديدة'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>اسم الخدمة *</Label>
                      <Input
                        placeholder="مثال: تبديل زيت المحرك"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label>الفئة *</Label>
                      <Input
                        placeholder="مثال: محرك، كهرباء، فرامل..."
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        required
                        list="categories-list"
                      />
                      <datalist id="categories-list">
                        {categories.map(cat => (
                          <option key={cat} value={cat} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <Label>السعر (ريال) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="150.00"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label>المدة (دقيقة) *</Label>
                      <Input
                        type="number"
                        placeholder="60"
                        value={formData.duration}
                        onChange={(e) => setFormData({...formData, duration: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="bg-green-600 hover:bg-green-700">
                      {editingService ? 'تحديث' : 'حفظ'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowForm(false);
                        setEditingService(null);
                        setFormData({ name: '', category: '', price: '', duration: '' });
                      }}
                    >
                      إلغاء
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Search */}
          <Card className="mb-6 shadow-lg">
            <CardContent className="p-6">
              <div className="relative">
                <Search className="absolute right-3 top-3 text-slate-400" size={20} />
                <Input
                  placeholder="بحث عن خدمة بالاسم أو الفئة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Services List by Category */}
          {servicesByCategory.map(({ category, services }) => (
            <Card key={category} className="mb-6 shadow-lg">
              <CardHeader className="bg-gradient-to-l from-slate-50">
                <CardTitle className="flex items-center gap-2">
                  <Wrench size={20} />
                  {category} ({services.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {services.map(service => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-800">{service.name}</h4>
                        <div className="flex gap-4 mt-1 text-sm text-slate-600">
                          <span>{service.duration} دقيقة</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-left">
                          <p className="text-2xl font-bold text-green-600">{service.price.toFixed(2)} ر.س</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditForm(service)}
                            className="hover:bg-blue-50"
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(service.id)}
                            className="hover:bg-red-600"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredServices.length === 0 && (
            <Card className="shadow-md">
              <CardContent className="p-12 text-center">
                <Wrench className="mx-auto text-slate-300 mb-4" size={64} />
                <p className="text-slate-500 text-lg">لا توجد خدمات</p>
                <Button
                  onClick={() => setShowForm(true)}
                  className="mt-4 bg-green-600 hover:bg-green-700"
                >
                  <Plus size={20} className="ml-2" />
                  إضافة خدمة جديدة
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ServicesManagement;
