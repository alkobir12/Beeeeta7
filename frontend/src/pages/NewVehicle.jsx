import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Save, User, Car, Phone, Wrench } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { Checkbox } from '../components/ui/checkbox';
import { vehicleAPI, serviceAPI, technicianAPI } from '../services/api';
import Layout from '../components/Layout';

const NewVehicle = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [formData, setFormData] = useState({
    plateNumber: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    vin: '',
    fileNumber: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    services: [],
    technicianId: '',
    notes: ''
  });
  
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [servicesRes, techniciansRes] = await Promise.all([
        serviceAPI.getAll(),
        technicianAPI.getAll()
      ]);
      setServices(servicesRes.data);
      setTechnicians(techniciansRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.plateNumber || !formData.customerName || !formData.customerPhone || !formData.brand || !formData.model) {
      toast({
        title: 'خطأ',
        description: 'الرجاء تعبئة جميع الحقول المطلوبة',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      await vehicleAPI.create(formData);
      
      toast({
        title: 'تم بنجاح',
        description: 'تم استقبال المركبة بنجاح. سيتم إرسال رابط التتبع للعميل.',
      });

      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (error) {
      console.error('Error creating vehicle:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في إضافة المركبة. حاول مرة أخرى.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleServiceToggle = (serviceName) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(serviceName)
        ? prev.services.filter(name => name !== serviceName)
        : [...prev.services, serviceName]
    }));
  };
  
  const categories = ['all', ...new Set(services.map(s => s.category))];
  
  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(serviceSearch.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || service.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <Layout>
      <div className="min-h-screen" dir="rtl">
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">استقبال مركبة جديدة</h1>
            <p className="text-slate-600">تعبئة بيانات المركبة والعميل</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Vehicle Information */}
          <Card className="mb-6 shadow-lg">
            <CardHeader className="bg-gradient-to-l from-blue-50 to-transparent">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Car size={24} />
                بيانات المركبة
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="plateNumber" className="text-slate-700 mb-2 block">رقم اللوحة *</Label>
                  <Input
                    id="plateNumber"
                    placeholder="أ ب ج 1234"
                    value={formData.plateNumber}
                    onChange={(e) => setFormData({...formData, plateNumber: e.target.value})}
                    className="border-slate-300 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="brand" className="text-slate-700 mb-2 block">الماركة *</Label>
                  <Input
                    id="brand"
                    placeholder="تويوتا، هوندا، نيسان..."
                    value={formData.brand}
                    onChange={(e) => setFormData({...formData, brand: e.target.value})}
                    className="border-slate-300 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="model" className="text-slate-700 mb-2 block">الموديل *</Label>
                  <Input
                    id="model"
                    placeholder="كامري، أكورد، التيما..."
                    value={formData.model}
                    onChange={(e) => setFormData({...formData, model: e.target.value})}
                    className="border-slate-300 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="year" className="text-slate-700 mb-2 block">السنة *</Label>
                  <Input
                    id="year"
                    type="number"
                    placeholder="2020"
                    value={formData.year}
                    onChange={(e) => setFormData({...formData, year: e.target.value})}
                    className="border-slate-300 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="color" className="text-slate-700 mb-2 block">اللون</Label>
                  <Input
                    id="color"
                    placeholder="أبيض، أسود، فضي..."
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                    className="border-slate-300 focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <Label htmlFor="vin" className="text-slate-700 mb-2 block">رقم الهيكل (VIN)</Label>
                  <Input
                    id="vin"
                    placeholder="رقم الهيكل (اختياري)"
                    value={formData.vin}
                    onChange={(e) => setFormData({...formData, vin: e.target.value})}
                    className="border-slate-300 focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <Label htmlFor="fileNumber" className="text-slate-700 mb-2 block">رقم الملف</Label>
                  <Input
                    id="fileNumber"
                    placeholder="رقم الملف (اختياري)"
                    value={formData.fileNumber}
                    onChange={(e) => setFormData({...formData, fileNumber: e.target.value})}
                    className="border-slate-300 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card className="mb-6 shadow-lg">
            <CardHeader className="bg-gradient-to-l from-green-50 to-transparent">
              <CardTitle className="flex items-center gap-2 text-green-900">
                <User size={24} />
                بيانات العميل
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customerName" className="text-slate-700 mb-2 block">الاسم *</Label>
                  <Input
                    id="customerName"
                    placeholder="محمد أحمد"
                    value={formData.customerName}
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    className="border-slate-300 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="customerPhone" className="text-slate-700 mb-2 block">رقم الجوال *</Label>
                  <Input
                    id="customerPhone"
                    placeholder="0501234567"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                    className="border-slate-300 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="customerEmail" className="text-slate-700 mb-2 block">البريد الإلكتروني</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    placeholder="example@email.com"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                    className="border-slate-300 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Services */}
          <Card className="mb-6 shadow-lg">
            <CardHeader className="bg-gradient-to-l from-orange-50 to-transparent">
              <CardTitle className="flex items-center gap-2 text-orange-900">
                <Wrench size={24} />
                الخدمات المطلوبة ({formData.services.length} محددة)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {/* Search and Category Filter */}
              <div className="flex gap-4 mb-4">
                <Input
                  placeholder="بحث عن خدمة..."
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  className="flex-1"
                />
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="الفئة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الفئات</SelectItem>
                    {categories.filter(c => c !== 'all').map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
              {/* Manual service add */}
              <div className="mt-4 p-4 border rounded-lg">
                <div className="font-semibold mb-2">إضافة خدمة يدوية</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input placeholder="اسم الخدمة" onBlur={(e)=>{
                    const name = e.target.value?.trim();
                    if(!name) return;
                    setFormData(prev => ({...prev, services: [...prev.services, name]}));
                    e.target.value='';
                  }} />
                  <Input placeholder="السعر (اختياري)" type="number" onBlur={(e)=>{ e.target.value=''; }} />
                  <Button type="button" variant="outline" onClick={()=>{}} className="justify-center">إضافة</Button>
                </div>
                <div className="text-xs text-slate-500 mt-2">يمكنك كتابة اسم الخدمة وسيتم إضافتها مباشرة إلى القائمة المحددة.</div>
              </div>

                </Select>
              </div>
              
              {/* Services Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                {filteredServices.map(service => (
                  <div key={service.id} className="flex items-center space-x-2 space-x-reverse p-3 rounded-lg hover:bg-slate-50 transition-colors border border-slate-200">
                    <Checkbox
                      id={`service-${service.id}`}
                      checked={formData.services.includes(service.name)}
                      onCheckedChange={() => handleServiceToggle(service.name)}
                    />
                    <label
                      htmlFor={`service-${service.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="font-semibold text-slate-800 text-sm">{service.name}</div>
                      <div className="text-xs text-slate-500">{service.category}</div>
                      <div className="text-xs text-green-600 font-bold">{service.price} ر.س</div>
                    </label>
                  </div>
                ))}
              </div>
              
              {filteredServices.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  لا توجد خدمات مطابقة للبحث
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assignment and Notes */}
          <Card className="mb-6 shadow-lg">
            <CardHeader className="bg-gradient-to-l from-purple-50 to-transparent">
              <CardTitle className="text-purple-900">تعيين وملاحظات</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label htmlFor="technician" className="text-slate-700 mb-2 block">تعيين الفني</Label>
                <Select value={formData.technicianId} onValueChange={(value) => setFormData({...formData, technicianId: value})}>
                  <SelectTrigger className="border-slate-300 focus:border-blue-500">
                    <SelectValue placeholder="اختر الفني المسؤول" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map(tech => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.name} - {tech.specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes" className="text-slate-700 mb-2 block">ملاحظات</Label>
                <Textarea
                  id="notes"
                  placeholder="أي ملاحظات أو مشاكل مذكورة من العميل..."
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="border-slate-300 focus:border-blue-500 transition-colors min-h-32"
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex gap-4">
            <Button 
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  جاري الحفظ...
                </span>
              ) : (
                <>
                  <Save className="ml-2" size={20} />
                  حفظ واستقبال المركبة
                </>
              )}
            </Button>
            <Button 
              type="button"
              variant="outline"
              onClick={() => navigate('/')}
              className="px-8 py-6 hover:bg-slate-100 transition-colors"
            >
              إلغاء
            </Button>
          </div>
        </form>
      </div>
      </div>
    </Layout>
  );
};

export default NewVehicle;