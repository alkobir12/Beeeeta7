import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Wrench, Search, Phone, Star, CheckCircle } from 'lucide-react';
import { technicianAPI } from '../services/api';
import { useToast } from '../hooks/use-toast';
import Layout from '../components/Layout';

const Technicians = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTechnicians();
  }, []);

  const fetchTechnicians = async () => {
    try {
      setLoading(true);
      const response = await technicianAPI.getAll();
      setTechnicians(response.data);
    } catch (error) {
      console.error('Error fetching technicians:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل الفنيين",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredTechnicians = technicians.filter(tech => 
    tech.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (tech.specialty && tech.specialty.toLowerCase().includes(searchQuery.toLowerCase()))
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
        <div className="flex items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">قائمة الفنيين</h1>
            <p className="text-slate-600">إدارة ومتابعة الفنيين</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-700 text-sm font-medium mb-1">إجمالي الفنيين</p>
                  <p className="text-3xl font-bold text-purple-900">{technicians.length}</p>
                </div>
                <div className="bg-purple-600 p-3 rounded-full">
                  <Wrench className="text-white" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-700 text-sm font-medium mb-1">أعمال جارية</p>
                  <p className="text-3xl font-bold text-orange-900">{technicians.reduce((sum, t) => sum + t.activeJobs, 0)}</p>
                </div>
                <div className="bg-orange-600 p-3 rounded-full">
                  <CheckCircle className="text-white" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-700 text-sm font-medium mb-1">أعمال مكتملة</p>
                  <p className="text-3xl font-bold text-green-900">{technicians.reduce((sum, t) => sum + t.completedJobs, 0)}</p>
                </div>
                <div className="bg-green-600 p-3 rounded-full">
                  <Star className="text-white" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-700 text-sm font-medium mb-1">متوسط التقييم</p>
                  <p className="text-3xl font-bold text-blue-900">
                    {(technicians.reduce((sum, t) => sum + t.rating, 0) / technicians.length).toFixed(1)}
                  </p>
                </div>
                <div className="bg-blue-600 p-3 rounded-full">
                  <Star className="text-white" size={24} fill="white" />
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
                placeholder="بحث بالاسم أو التخصص..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 border-slate-300 focus:border-blue-500 transition-colors"
              />
            </div>
          </CardContent>
        </Card>

        {/* Technicians Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTechnicians.map(tech => (
            <Card key={tech.id} className="shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="bg-gradient-to-br from-slate-50 to-white pb-4">
                <div className="flex items-center gap-4">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-full">
                    <Wrench className="text-white" size={28} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-800">{tech.name}</h3>
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 mt-1">
                      {tech.specialty}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone size={16} />
                  <span className="text-sm">{tech.phone}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-orange-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-orange-600">{tech.activeJobs}</p>
                    <p className="text-xs text-orange-700">أعمال جارية</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">{tech.completedJobs}</p>
                    <p className="text-xs text-green-700">مكتملة</p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 p-3 bg-yellow-50 rounded-lg">
                  <Star className="text-yellow-500" size={20} fill="#eab308" />
                  <span className="text-lg font-bold text-yellow-700">{tech.rating}</span>
                  <span className="text-sm text-yellow-600">/ 5.0</span>
                </div>

                {tech.activeJobs === 0 && (
                  <Badge className="w-full justify-center bg-green-100 text-green-700 border-green-300">
                    <CheckCircle size={14} className="ml-1" />
                    متاح لأعمال جديدة
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredTechnicians.length === 0 && (
          <Card className="shadow-md">
            <CardContent className="p-12 text-center">
              <Wrench className="mx-auto text-slate-300 mb-4" size={64} />
              <p className="text-slate-500 text-lg">لا توجد نتائج</p>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </Layout>
  );
};

export default Technicians;