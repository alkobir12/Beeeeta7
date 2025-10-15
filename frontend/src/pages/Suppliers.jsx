import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Users, Search, Phone, Mail, MapPin, Building2, Plus, Trash2, Edit } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import Layout from '../components/Layout';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Suppliers = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    category: '',
    rating: 5.0
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/suppliers`);
      setSuppliers(response.data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل الموردين",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/suppliers`, formData);
      toast({
        title: "نجح",
        description: "تم إضافة المورد بنجاح"
      });
      setShowAddForm(false);
      setFormData({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        category: '',
        rating: 5.0
      });
      fetchSuppliers();
    } catch (error) {
      console.error('Error adding supplier:', error);
      toast({
        title: "خطأ",
        description: "فشل في إضافة المورد",
        variant: "destructive"
      });
    }
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.phone?.includes(searchQuery) ||
    supplier.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <h1 className="text-4xl font-bold text-slate-800 mb-2">الموردين</h1>
              <p className="text-slate-600">إدارة الموردين وقطع الغيار</p>
            </div>
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus size={20} className="ml-2" />
              إضافة مورد
            </Button>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <Card className="mb-6 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4">إضافة مورد جديد</h3>
                <form onSubmit={handleAddSupplier} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      placeholder="اسم المورد *"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                    <Input
                      placeholder="اسم المسؤول"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                    />
                    <Input
                      placeholder="رقم الجوال *"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      required
                    />
                    <Input
                      placeholder="البريد الإلكتروني"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                    <Input
                      placeholder="المدينة"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                    />
                    <Input
                      placeholder="التصنيف (قطع غيار، زيوت، إطارات...)"
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                    />
                  </div>
                  <Input
                    placeholder="العنوان"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" className="bg-green-600 hover:bg-green-700">
                      حفظ
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddForm(false)}
                    >
                      إلغاء
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-none shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-700 text-sm font-medium mb-1">إجمالي الموردين</p>
                    <p className="text-3xl font-bold text-blue-900">{suppliers.length}</p>
                  </div>
                  <div className="bg-blue-600 p-3 rounded-full">
                    <Building2 className="text-white" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <Card className="mb-6 shadow-lg">
            <CardContent className="p-6">
              <div className="relative">
                <Search className="absolute right-3 top-3 text-slate-400" size={20} />
                <Input
                  placeholder="بحث بالاسم، الجوال، أو المدينة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 border-slate-300 focus:border-blue-500 transition-colors"
                />
              </div>
            </CardContent>
          </Card>

          {/* Suppliers List */}
          <div className="grid grid-cols-1 gap-4">
            {filteredSuppliers.map(supplier => (
              <Card key={supplier.id} className="shadow-md hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-6 flex-1">
                      <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-full">
                        <Building2 className="text-white" size={28} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-800 mb-1">{supplier.name}</h3>
                        <div className="flex gap-4 text-sm text-slate-600">
                          {supplier.contactPerson && (
                            <span className="flex items-center gap-1">
                              <Users size={14} />
                              {supplier.contactPerson}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Phone size={14} />
                            {supplier.phone}
                          </span>
                          {supplier.email && (
                            <span className="flex items-center gap-1">
                              <Mail size={14} />
                              {supplier.email}
                            </span>
                          )}
                        </div>
                        {(supplier.address || supplier.city) && (
                          <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                            <MapPin size={14} />
                            {supplier.city && <span>{supplier.city}</span>}
                            {supplier.address && supplier.city && <span> - </span>}
                            {supplier.address && <span>{supplier.address}</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {supplier.category && (
                        <Badge className="bg-blue-100 text-blue-700">
                          {supplier.category}
                        </Badge>
                      )}
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {supplier.totalPurchases?.toLocaleString('ar-SA') || '0'} ر.س
                        </p>
                        <p className="text-xs text-slate-500">إجمالي المشتريات</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredSuppliers.length === 0 && (
            <Card className="shadow-md">
              <CardContent className="p-12 text-center">
                <Building2 className="mx-auto text-slate-300 mb-4" size={64} />
                <p className="text-slate-500 text-lg">لا توجد نتائج</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Suppliers;
