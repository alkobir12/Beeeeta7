import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Users, Search, Phone, Mail, Calendar, Car, ArrowRight, Trash2, Eye } from 'lucide-react';
import { customerAPI } from '../services/api';
import { useToast } from '../hooks/use-toast';
import Layout from '../components/Layout';

const Customers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomers();
  }, [searchQuery]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await customerAPI.getAll(searchQuery);
      setCustomers(response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل العملاء",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = async (customerId, e) => {
    e.stopPropagation();
    if (!window.confirm('هل أنت متأكد من حذف هذا العميل؟ سيتم حذف جميع البيانات المرتبطة به.')) {
      return;
    }
    
    try {
      await customerAPI.delete(customerId);
      toast({
        title: "نجح",
        description: "تم حذف العميل بنجاح"
      });
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: "خطأ",
        description: "فشل في حذف العميل",
        variant: "destructive"
      });
    }
  };

  const filteredCustomers = customers;

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
        <div className="flex items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">قائمة العملاء</h1>
            <p className="text-slate-600">إدارة بيانات العملاء</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-700 text-sm font-medium mb-1">إجمالي العملاء</p>
                  <p className="text-3xl font-bold text-blue-900">{customers.length}</p>
                </div>
                <div className="bg-blue-600 p-3 rounded-full">
                  <Users className="text-white" size={24} />
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
                placeholder="بحث بالاسم أو رقم الجوال..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 border-slate-300 focus:border-blue-500 transition-colors"
              />
            </div>
          </CardContent>
        </Card>

        {/* Customers List */}
        <div className="grid grid-cols-1 gap-4">
          {filteredCustomers.map(customer => (
            <Card key={customer.id} className="shadow-md hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-6 flex-1">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-full">
                      <Users className="text-white" size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 mb-1">{customer.name}</h3>
                      <div className="flex gap-4 text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <Phone size={14} />
                          {customer.phone}
                        </span>
                        {customer.email && (
                          <span className="flex items-center gap-1">
                            <Mail size={14} />
                            {customer.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{customer.totalVisits || 0}</p>
                      <p className="text-xs text-slate-500">الزيارات</p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-slate-500 mb-1">آخر زيارة</p>
                      <p className="text-sm font-semibold text-slate-700">
                        {customer.lastVisit ? new Date(customer.lastVisit).toLocaleDateString('ar-SA') : 'لا توجد'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/customer/${customer.id}`)}
                        className="hover:bg-blue-50"
                      >
                        <Eye size={16} />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => handleDeleteCustomer(customer.id, e)}
                        className="hover:bg-red-600"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredCustomers.length === 0 && (
          <Card className="shadow-md">
            <CardContent className="p-12 text-center">
              <Users className="mx-auto text-slate-300 mb-4" size={64} />
              <p className="text-slate-500 text-lg">لا توجد نتائج</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Customers;