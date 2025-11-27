import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { customerAPI } from '../services/api';
import { ArrowRight, User, Phone, Mail, Car, Calendar, DollarSign, Star, History } from 'lucide-react';
import Layout from '../components/Layout';
import AIHelper from '../components/AIHelper';

const CustomerDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [history, setHistory] = useState({ vehicles: [], invoices: [] });
  const [approvals, setApprovals] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomerData();
  }, [id]);

  const loadCustomerData = async () => {
    try {
      setLoading(true);
      const customerRes = await customerAPI.getById(id);
      setCustomer(customerRes.data);
      
      const historyRes = await customerAPI.getHistory(id);
      setHistory(historyRes.data);

      // Load approvals for this customer
      try {
        const approvalsRes = await customerAPI.getApprovals(id);
        setApprovals(approvalsRes.data || []);
      } catch (e) {
        setApprovals([]);
      }
    } catch (error) {
      console.error('Error loading customer:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center" dir="rtl">
          <p>جاري التحميل...</p>
        </div>
      </Layout>
    );
  }

  if (!customer) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center" dir="rtl">
          <p>العميل غير موجود</p>
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
            <Button 
              variant="outline" 
              onClick={() => navigate('/customers')}
              className="hover:bg-slate-100"
            >
              <ArrowRight size={20} />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">{customer.name}</h1>
              <p className="text-slate-600">معلومات العميل وسجل الصيانة</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Customer Info */}
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-blue-50 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <User size={24} />
                  معلومات الاتصال
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Phone className="text-slate-500" size={20} />
                  <div>
                    <p className="text-sm text-slate-500">رقم الجوال</p>
                    <p className="font-semibold">{customer.phone}</p>
                  </div>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="text-slate-500" size={20} />
                    <div>
                      <p className="text-sm text-slate-500">البريد الإلكتروني</p>
                      <p className="font-semibold">{customer.email}</p>
                    </div>
                  </div>
                )}
                <Separator />
                <div className="flex items-center gap-3">
                  <Car className="text-slate-500" size={20} />
                  <div>
                    <p className="text-sm text-slate-500">المركبات</p>
                    <p className="font-semibold">{customer.vehicles?.length || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="text-slate-500" size={20} />
                  <div>
                    <p className="text-sm text-slate-500">إجمالي الزيارات</p>
                    <p className="font-semibold">{customer.totalVisits}</p>
                  </div>
                </div>
                {customer.lastVisit && (
                  <div className="flex items-center gap-3">
                    <History className="text-slate-500" size={20} />
                    <div>
                      <p className="text-sm text-slate-500">آخر زيارة</p>
                      <p className="font-semibold">
                        {new Date(customer.lastVisit).toLocaleDateString('ar-SA')}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <Card className="lg:col-span-2 shadow-lg">
              <CardHeader className="bg-gradient-to-l from-green-50 to-transparent">
                <CardTitle>إحصائيات العميل</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-3xl font-bold text-blue-600">{history.vehicles?.length || 0}</p>
                    <p className="text-sm text-slate-600">عمليات صيانة</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">
                      {history.invoices?.reduce((sum, inv) => sum + inv.total, 0).toLocaleString() || 0}
                    </p>
                    <p className="text-sm text-slate-600">إجمالي المدفوعات (ر.س)</p>
                  </div>

          {/* Approvals List */}
          <Card className="shadow-lg mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                قائمة الموافقات
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {approvals.length === 0 ? (
                <p className="text-center text-slate-500 py-8">لا توجد طلبات اعتماد</p>
              ) : (
                <div className="space-y-3">
                  {approvals.map((appr) => (
                    <div key={appr.id} className="flex items-center justify-between p-3 rounded border hover:bg-slate-50">
                      <div>
                        <div className="font-bold">{appr.title || 'طلب اعتماد'} • {appr.amount?.toFixed ? appr.amount.toFixed(2) : appr.amount} ر.س</div>
                        <div className="text-xs text-slate-500">
                          {appr.status === 'approved' ? 'تمت الموافقة' : appr.status === 'rejected' ? 'مرفوض' : appr.status === 'deferred' ? 'مؤجل' : appr.status === 'requote' ? 'إعادة تسعير' : 'بانتظار الموافقة'}
                          {appr.respondedAt && ` — ${new Date(appr.respondedAt).toLocaleString('ar-SA')}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${appr.status==='approved'?'bg-green-100 text-green-700': appr.status==='rejected'?'bg-red-100 text-red-700': 'bg-yellow-100 text-yellow-700'}`}>
                          {appr.status}
                        </span>
                        {appr.signature && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded" title={`IP: ${appr.clientIp}`}>
                            موقع رقمياً
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-3xl font-bold text-purple-600">
                      {history.invoices?.length || 0}
                    </p>
                    <p className="text-sm text-slate-600">فواتير</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Maintenance History */}
          <Card className="shadow-lg mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History size={24} />
                سجل الصيانة (حسب التاريخ)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {history.vehicles?.length === 0 ? (
                <p className="text-center text-slate-500 py-8">لا يوجد سجل صيانة</p>
              ) : (
                <div className="space-y-4">
                  {history.vehicles
                    ?.sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate))
                    .map((vehicle, idx) => {
                      const invoice = history.invoices?.find(inv => inv.vehicleId === vehicle.id);
                      return (
                        <Card key={idx} className="border-r-4 border-r-blue-500 hover:shadow-md transition-shadow">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between flex-wrap gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <Car className="text-blue-600" size={24} />
                                  <div>
                                    <h3 className="text-lg font-bold text-slate-800">
                                      {vehicle.plateNumber}
                                    </h3>
                                    <p className="text-sm text-slate-600">
                                      {vehicle.brand} {vehicle.model} - {vehicle.year}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center gap-2 text-sm">
                                    <Calendar size={16} className="text-slate-500" />
                                    <span className="text-slate-600">تاريخ الدخول:</span>
                                    <span className="font-semibold">
                                      {new Date(vehicle.entryDate).toLocaleDateString('ar-SA')}
                                    </span>
                                  </div>
                                  
                                  {vehicle.completionDate && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <Calendar size={16} className="text-slate-500" />
                                      <span className="text-slate-600">تاريخ التسليم:</span>
                                      <span className="font-semibold">
                                        {new Date(vehicle.completionDate).toLocaleDateString('ar-SA')}
                                      </span>
                                    </div>
                                  )}
                                  
                                  <div className="flex gap-2 flex-wrap mt-2">
                                    {vehicle.services?.map((service, i) => (
                                      <Badge key={i} variant="outline" className="bg-blue-50">
                                        {service}
                                      </Badge>
                                    ))}
                                  </div>
                                  
                                  {vehicle.notes && (
                                    <p className="text-sm text-slate-600 mt-2 p-2 bg-slate-50 rounded">
                                      {vehicle.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              <div className="text-left space-y-2">
                                <Badge 
                                  className={`${
                                    vehicle.status === 'ready' ? 'bg-green-500' :
                                    vehicle.status === 'repair' ? 'bg-orange-500' :
                                    vehicle.status === 'quotation' ? 'bg-yellow-500' :
                                    'bg-blue-500'
                                  } text-white`}
                                >
                                  {vehicle.status === 'ready' ? 'مكتمل' :
                                   vehicle.status === 'repair' ? 'إصلاح' :
                                   vehicle.status === 'quotation' ? 'تعميد' : 'تشخيص'}
                                </Badge>
                                
                                {invoice && (
                                  <div className="bg-green-50 p-3 rounded-lg">
                                    <div className="flex items-center gap-2 text-green-700">
                                      <DollarSign size={18} />
                                      <span className="font-bold text-lg">
                                        {invoice.total.toLocaleString()} ر.س
                                      </span>
                                    </div>
                                    <p className="text-xs text-green-600">الفاتورة</p>
                                  </div>
                                )}
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/vehicle/${vehicle.id}`)}
                                  className="w-full"
                                >
                                  عرض التفاصيل
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <AIHelper />
      </div>
    </Layout>
  );
};

export default CustomerDetails;