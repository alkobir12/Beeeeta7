import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Search, Phone, Star, CheckCircle, Users } from 'lucide-react';
import { technicianAPI } from '../services/api';
import { useToast } from '../hooks/use-toast';
import { useLanguage } from '../contexts/LanguageContext';

const Technicians = () => {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTech, setShowAddTech] = useState(false);
  const [newTech, setNewTech] = useState({ name: '', phone: '', specialty: '' });
  const [saving, setSaving] = useState(false);

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
        title: t('common.error'),
        description: t('messages.error_occurred'),
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
      
        <div className="flex items-center justify-center h-[50vh]">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      
    );
  }

  return (
    
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الفنيين</h1>
          <p className="text-gray-500 mt-1">إدارة فريق العمل ومتابعة الأداء</p>
        <div className="flex items-center justify-between mt-4">
          <p className="text-gray-500 text-sm">
            يمكنك إضافة فنيين جدد وإدارتهم من هنا.
          </p>
          <button
            onClick={() => setShowAddTech(true)}
            className="apple-button px-4 py-2 text-sm"
          >
            + إضافة فني جديد
          </button>
        </div>

        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="apple-card p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">إجمالي الفنيين</p>
              <p className="text-2xl font-bold text-gray-900">{technicians.length}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
              <Users size={20} />
            </div>
          </div>

          <div className="apple-card p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">أعمال جارية</p>
              <p className="text-2xl font-bold text-gray-900">{technicians.reduce((sum, t) => sum + t.activeJobs, 0)}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
              <Wrench size={20} />
            </div>
          </div>

          <div className="apple-card p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">أعمال مكتملة</p>
              <p className="text-2xl font-bold text-gray-900">{technicians.reduce((sum, t) => sum + t.completedJobs, 0)}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <CheckCircle size={20} />
            </div>
          </div>

          <div className="apple-card p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">متوسط التقييم</p>
              <p className="text-2xl font-bold text-gray-900">
                {(technicians.reduce((sum, t) => sum + t.rating, 0) / (technicians.length || 1)).toFixed(1)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600">
              <Star size={20} fill="currentColor" />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="apple-card p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              placeholder="بحث بالاسم أو التخصص..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="apple-input pr-10"
            />
          </div>
        </div>

        {/* Technicians Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTechnicians.map(tech => (
            <div key={tech.id} className="apple-card p-6 hover:shadow-md transition-all duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-lg">
                    {tech.name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{tech.name}</h3>
                    <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium mt-1">
                      {tech.specialty}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg">
                  <Star size={14} className="text-yellow-500" fill="currentColor" />
                  <span className="text-sm font-bold text-yellow-700">{tech.rating}</span>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Phone size={16} />
                  <span dir="ltr">{tech.phone}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-gray-900">{tech.activeJobs}</p>
                  <p className="text-xs text-gray-500">جارية</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-gray-900">{tech.completedJobs}</p>
                  <p className="text-xs text-gray-500">مكتملة</p>
                </div>
              </div>

              {tech.activeJobs === 0 && (
                <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 py-2 rounded-lg text-sm font-medium">
                  <CheckCircle size={16} />
                  <span>متاح للعمل</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredTechnicians.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Wrench className="mx-auto text-gray-300 mb-4" size={48} />
            <p>لا توجد نتائج</p>
          </div>
        )}

        {showAddTech && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 mb-2">إضافة فني جديد</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-700">الاسم</label>
                  <input
                    className="apple-input mt-1"
                    value={newTech.name}
                    onChange={e => setNewTech({ ...newTech, name: e.target.value })}
                    placeholder="اسم الفني"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-700">رقم الجوال</label>
                  <input
                    className="apple-input mt-1"
                    value={newTech.phone}
                    onChange={e => setNewTech({ ...newTech, phone: e.target.value })}
                    placeholder="05xxxxxxxx"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-700">التخصص</label>
                  <input
                    className="apple-input mt-1"
                    value={newTech.specialty}
                    onChange={e => setNewTech({ ...newTech, specialty: e.target.value })}
                    placeholder="ميكانيكا / كهرباء / ..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setShowAddTech(false);
                    setNewTech({ name: '', phone: '', specialty: '' });
                  }}
                  disabled={saving}
                >
                  إلغاء
                </button>
                <button
                  className="apple-button px-4 py-2 text-sm"
                  onClick={async () => {
                    if (!newTech.name.trim()) {
                      toast({ title: 'تنبيه', description: 'الاسم مطلوب', variant: 'destructive' });
                      return;
                    }
                    try {
                      setSaving(true);
                      await technicianAPI.create(newTech);
                      await fetchTechnicians();
                      toast({ title: 'تم الحفظ', description: 'تم إضافة الفني بنجاح' });
                      setShowAddTech(false);
                      setNewTech({ name: '', phone: '', specialty: '' });
                    } catch (error) {
                      console.error('Error creating technician', error);
                      toast({ title: 'خطأ', description: 'فشل في إضافة الفني', variant: 'destructive' });
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                >
                  حفظ
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    
  );
};

export default Technicians;
