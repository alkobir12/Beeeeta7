import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { statusSteps, getStatusLabel, getStatusColor } from '../mock/data';
import { ArrowRight, Car, User, Phone, Calendar, Wrench, MessageSquare, CheckCircle, FileText, Upload } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { vehicleAPI, technicianAPI } from '../services/api';
import Layout from '../components/Layout';

const VehicleDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [vehicle, setVehicle] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('diagnosis');
  const [notes, setNotes] = useState('');
  const [assignedTech, setAssignedTech] = useState('');
  const [vehicleFiles, setVehicleFiles] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [statusImages, setStatusImages] = useState([]);
  const [approvals, setApprovals] = useState([]);

  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalForm, setApprovalForm] = useState({ title: 'طلب اعتماد إصلاح', amount: '', notes: '' });


  useEffect(() => {
    fetchData();

    // Poll approvals status for live update after customer responds
    const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
    const es = new EventSource(`${API_URL}/approvals/stream`);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.type === 'approval_updated' && data?.vehicleId === id) {
          fetchData();
        }
      } catch {}
    };

    const interval = setInterval(async () => {
      try {
        // If vehicle has approval(s), refresh vehicle data to reflect any derived changes
        const res = await fetch(`${API_URL}/approvals?vehicle_id=${id}`);
        if (res.ok) {
          const list = await res.json();
          // If any approval responded in the last 10s, refresh details
          const recent = list.find(a => a.respondedAt && (Date.now() - new Date(a.respondedAt).getTime()) < 10000);
          if (recent) {
            fetchData();
          }
        }
      } catch (e) {}
    }, 5000);
    return () => { try { es.close(); } catch {} clearInterval(interval); };
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
      const [vehicleRes, techniciansRes, filesRes, approvalsRes] = await Promise.all([
        vehicleAPI.getById(id),
        technicianAPI.getAll(),
        fetch(`${API_URL}/vehicles/${id}/files`).then(r => r.json()).catch(() => ({files: []})),
        fetch(`${API_URL}/approvals?vehicle_id=${id}`).then(r => r.json()).catch(() => [])
      ]);
      setVehicle(vehicleRes.data);
      setTechnicians(techniciansRes.data);
      setVehicleFiles(filesRes.files || []);
      setApprovals(approvalsRes || []);
      setStatus(vehicleRes.data.status || 'diagnosis');
      setNotes(vehicleRes.data.notes || '');
      setAssignedTech(vehicleRes.data.technicianId || '');
    } catch (error) {
      console.error('Error fetching vehicle:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل بيانات المركبة",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    try {
      // Upload images first if any
      if (statusImages.length > 0) {
        const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
        for (const img of statusImages) {
          const formData = new FormData();
          formData.append('file', img);
          formData.append('file_type', 'status_update');
          
          await fetch(`${API_URL}/vehicles/${id}/upload-file?file_type=status_update`, {
            method: 'POST',
            body: formData
          });
        }
      }
      
      await vehicleAPI.update(id, {
        status,
        notes,
        technicianId: assignedTech
      });
      
      toast({
        title: 'تم التحديث',
        description: `تم تحديث الحالة${statusImages.length > 0 ? ' وإرفاق ' + statusImages.length + ' صورة' : ''}. سيتم إرسال إشعار للعميل.`,
      });
      
      setStatusImages([]);
      fetchData();
    } catch (error) {
      console.error('Error updating vehicle:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحديث المركبة",
        variant: "destructive"
      });
    }
  };

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

  if (!vehicle) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center" dir="rtl">
          <Card className="shadow-lg">
            <CardContent className="p-12 text-center">
              <Car className="mx-auto text-slate-300 mb-4" size={64} />
              <p className="text-slate-500 text-lg">المركبة غير موجودة</p>
              <Button onClick={() => navigate('/')} className="mt-4">العودة للرئيسية</Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const handleNotify = () => {
    toast({
      title: 'تم الإرسال',
      description: 'تم إرسال رابط التتبع ورسالة واتساب للعميل.',
    });
  };

  const currentStepIndex = statusSteps.findIndex(s => s.key === status);

  return (
    <Layout>
      <div className="min-h-screen" dir="rtl">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="outline" 
            onClick={() => navigate('/')}
            className="hover:bg-slate-100 transition-colors"
          >
            <ArrowRight size={20} />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-800">{vehicle.plateNumber}</h1>
            <p className="text-slate-600">{vehicle.brand} {vehicle.model} - {vehicle.year}</p>
          </div>
          <Badge className={`${getStatusColor(status)} text-white px-4 py-2 text-base`}>
            {getStatusLabel(status)}
          </Badge>
        </div>

        {/* Status Progress */}
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <CardTitle>مراحل العمل</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between relative">
              {statusSteps.map((step, index) => (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center z-10">
                    <div 
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                        index <= currentStepIndex 
                          ? step.color + ' text-white shadow-lg' 
                          : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      {index < currentStepIndex ? (
                        <CheckCircle size={24} />
                      ) : (
                        <span className="font-bold">{index + 1}</span>
                      )}
                    </div>
                    <span className={`mt-2 text-sm font-medium ${
                      index <= currentStepIndex ? 'text-slate-800' : 'text-slate-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {index < statusSteps.length - 1 && (
                    <div className={`flex-1 h-1 mx-2 transition-all duration-300 ${
                      index < currentStepIndex ? 'bg-green-500' : 'bg-slate-200'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Vehicle & Customer Info */}
          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-blue-50 to-transparent">
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Car size={24} />
                  معلومات المركبة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">رقم اللوحة</span>
                  <span className="font-semibold text-slate-800">{vehicle.plateNumber}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">الماركة</span>
                  <span className="font-semibold text-slate-800">{vehicle.brand}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">الموديل</span>
                  <span className="font-semibold text-slate-800">{vehicle.model}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">السنة</span>
                  <span className="font-semibold text-slate-800">{vehicle.year}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-600">اللون</span>
                  <span className="font-semibold text-slate-800">{vehicle.color}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-green-50 to-transparent">
                <CardTitle className="flex items-center gap-2 text-green-900">
                  <User size={24} />
                  معلومات العميل
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">الاسم</span>
                  <span className="font-semibold text-slate-800">{vehicle.customerName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">رقم الجوال</span>
                  <span className="font-semibold text-slate-800">{vehicle.customerPhone}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-600">رابط التتبع</span>
                  <span className="font-mono text-blue-600">{vehicle.trackingLink}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Management Panel */}
          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-orange-50 to-transparent">
                <CardTitle className="flex items-center gap-2 text-orange-900">
                  <Wrench size={24} />
                  إدارة العمل
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">تحديث الحالة</label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusSteps.map(step => (
                        <SelectItem key={step.key} value={step.key}>
                          {step.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">الفني المسؤول</label>
                  <Select value={assignedTech} onValueChange={setAssignedTech}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الفني" />
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
                  <label className="text-sm font-medium text-slate-700 mb-2 block">الخدمات</label>
                  <div className="flex gap-2 flex-wrap">
                    {vehicle.services.map((service, idx) => (
                      <Badge key={idx} className="bg-blue-100 text-blue-700 border-blue-200">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={handleStatusUpdate}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  حفظ التحديثات
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-purple-50 to-transparent">
                <CardTitle className="flex items-center gap-2 text-purple-900">
                  <MessageSquare size={24} />
                  ملاحظات
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أضف ملاحظات حول حالة المركبة..."
                  className="min-h-32"
                />
                
                {/* Upload Images for Status Update */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                  <Label htmlFor="status-images" className="cursor-pointer block text-center">
                    <Upload className="mx-auto text-godaddy-green mb-2" size={32} />
                    <p className="text-sm font-semibold">إرفاق صور للإصلاح (اختياري)</p>
                    <p className="text-xs text-gray-600">صور قبل وبعد الإصلاح</p>
                  </Label>
                  <input
                    id="status-images"
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files);
                      setStatusImages(files);
                      toast({
                        title: '✅ تم اختيار الصور',
                        description: `${files.length} صورة`
                      });
                    }}
                  />
                  {statusImages.length > 0 && (
                    <div className="mt-2 text-sm text-green-700">
                      ✓ {statusImages.length} صورة جاهزة للإرفاق
                    </div>
                  )}
                </div>
                
                <Button 
                  onClick={handleNotify}
                  variant="outline"

            <Button 
              variant="outline"
              className="w-full border-purple-600 text-purple-700 hover:bg-purple-50 transition-colors"
              onClick={() => setShowApprovalModal(true)}
            >
              إنشاء طلب اعتماد للعميل
            </Button>

                  className="w-full border-green-600 text-green-700 hover:bg-green-50 transition-colors"
                >
                  <Phone className="ml-2" size={18} />
                  إرسال تحديث للعميل (واتساب)
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* التواريخ */}
        <Card className="mt-6 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar size={24} />
              التواريخ
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700 mb-1">تاريخ الاستقبال</p>
                <p className="font-semibold text-blue-900">{vehicle.entryDate ? new Date(vehicle.entryDate).toLocaleString('ar-SA') : '-'}</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-700 mb-1">التسليم المتوقع</p>
                <p className="font-semibold text-orange-900">{vehicle.estimatedCompletion ? new Date(vehicle.estimatedCompletion).toLocaleString('ar-SA') : '-'}</p>
              </div>
              {vehicle.completionDate && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700 mb-1">تاريخ الإنجاز</p>
                  <p className="font-semibold text-green-900">{new Date(vehicle.completionDate).toLocaleString('ar-SA')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* موافقات المركبة */}
        <Card className="mt-6 shadow-lg">
          <CardHeader>
            <CardTitle>موافقات المركبة</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {(!approvals || approvals.length === 0) ? (
              <p className="text-center text-slate-500 py-6">لا توجد طلبات اعتماد لهذه المركبة</p>
            ) : (
              <div className="space-y-3">
                {approvals.map((appr) => (
                  <div key={appr.id || appr.token} className="flex items-center justify-between p-3 rounded border hover:bg-slate-50">
                    <div>
                      <div className="font-bold">{appr.title || 'طلب اعتماد'} • {(() => { const n = Number(appr.amount); return isNaN(n) ? (appr.amount || '-') : n.toFixed(2); })()} ر.س</div>
                      <div className="text-xs text-slate-500">
                        الحالة: {appr.status === 'approved' ? 'تمت الموافقة' : appr.status === 'rejected' ? 'مرفوض' : appr.status === 'deferred' ? 'مؤجل' : appr.status === 'requote' ? 'إعادة تسعير' : 'بانتظار الموافقة'}
                        {appr.respondedAt && ` — ${new Date(appr.respondedAt).toLocaleString('ar-SA')}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${appr.status==='approved'?'bg-green-100 text-green-700': appr.status==='rejected'?'bg-red-100 text-red-700': 'bg-yellow-100 text-yellow-700'}`}>
                        {appr.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Vehicle Files Section */}
        <Card className="card-godaddy mt-6">
          <CardHeader className="bg-gradient-to-l from-purple-50">
            <CardTitle className="flex items-center gap-2">
              <FileText size={20} />
              ملفات وفيديوهات المركبة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-4">
              <Label htmlFor="vehicle-file-upload" className="cursor-pointer">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
                  <Upload className="mx-auto text-godaddy-green mb-2" size={32} />
                  <p className="font-semibold mb-1">رفع ملف تشخيص أو فيديو</p>
                  <p className="text-sm text-gray-600">PDF, DOCX, Video, Images</p>
                </div>
              </Label>
              <input
                id="vehicle-file-upload"
                type="file"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  
                  try {
                    setUploadingFile(true);
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('file_type', 'diagnostic');
                    
                    const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
                    await fetch(`${API_URL}/vehicles/${id}/upload-file?file_type=diagnostic`, {
                      method: 'POST',
                      body: formData
                    });
                    
                    toast({ title: '✅ تم الرفع', description: file.name });
                    fetchData();
                  } catch (err) {
                    toast({ title: 'خطأ', description: 'فشل رفع الملف', variant: 'destructive' });
                  } finally {
                    setUploadingFile(false);
                    e.target.value = '';
                  }
                }}
              />
            </div>
            
            {vehicleFiles.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold mb-2">الملفات المرفوعة ({vehicleFiles.length})</h4>
                {vehicleFiles.map((file, idx) => (

        {/* بطاقة حالة المركبة للطباعة */}
        <Card className="mt-6 shadow-lg">
          <CardHeader>
            <CardTitle>حالة المركبة (جاهزة للطباعة)</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-slate-600">العميل</div>
                <div className="font-semibold">{vehicle.customerName}</div>
              </div>
              <div>
                <div className="text-sm text-slate-600">رقم الجوال</div>
                <div className="font-semibold">{vehicle.customerPhone}</div>
              </div>
              <div>
                <div className="text-sm text-slate-600">السيارة</div>
                <div className="font-semibold">{vehicle.brand} {vehicle.model} {vehicle.year} — {vehicle.plateNumber}</div>
              </div>
              <div>
                <div className="text-sm text-slate-600">الحالة الحالية</div>
                <div className="font-semibold">{getStatusLabel(status)}</div>
              </div>
              <div>
                <div className="text-sm text-slate-600">ملاحظات</div>
                <div className="font-semibold whitespace-pre-wrap">{notes || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-slate-600">الخدمات</div>
                <div className="font-semibold">{(vehicle.services || []).join('، ') || '-'}</div>
              </div>
            </div>
            <div className="pt-4">
              <Button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700">طباعة الحالة</Button>
            </div>
          </CardContent>
        </Card>

                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <FileText className="text-godaddy-green" size={20} />
                      <div>
                        <p className="font-medium text-sm">{file.filename}</p>
                        <p className="text-xs text-gray-600">
                          {new Date(file.uploadedAt).toLocaleDateString('ar-SA')}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                      {file.fileType}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </Layout>
  );
};

export default VehicleDetails;