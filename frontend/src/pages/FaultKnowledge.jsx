import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Database, Plus, Search, Upload, Play, Volume2, Video, 
  Trash2, Eye, AlertTriangle, Wrench, Car, X, Check, Loader2
} from 'lucide-react';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FaultKnowledge = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isArabic = i18n.language === 'ar';
  
  const [faults, setFaults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(null);
  const [stats, setStats] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    vehicle_type: '',
    vehicle_model: '',
    symptom_description: '',
    dtc_codes: '',
    diagnosis_steps: '',
    solution: '',
    parts_needed: '',
    estimated_cost: '',
    difficulty_level: 'medium'
  });
  const [mediaFile, setMediaFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchFaults();
    fetchStats();
  }, []);

  const fetchFaults = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/faults/list`);
      setFaults(response.data.faults || []);
    } catch (error) {
      console.error('Error fetching faults:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/faults/stats/summary`);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchFaults();
      return;
    }
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('symptom', searchQuery);
      formData.append('dtc_code', searchQuery);
      const response = await axios.post(`${API_URL}/faults/search`, formData);
      setFaults(response.data.results || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFault = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value) data.append(key, value);
      });
      if (mediaFile) {
        data.append('media_file', mediaFile);
      }

      await axios.post(`${API_URL}/faults/add`, data);
      toast({ title: isArabic ? 'تم الحفظ' : 'Saved', description: isArabic ? 'تم إضافة العطل بنجاح' : 'Fault added successfully' });
      setShowAddModal(false);
      setFormData({
        title: '', vehicle_type: '', vehicle_model: '', symptom_description: '',
        dtc_codes: '', diagnosis_steps: '', solution: '', parts_needed: '',
        estimated_cost: '', difficulty_level: 'medium'
      });
      setMediaFile(null);
      fetchFaults();
      fetchStats();
    } catch (error) {
      toast({ title: isArabic ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(isArabic ? 'هل أنت متأكد من الحذف؟' : 'Are you sure?')) return;
    try {
      await axios.delete(`${API_URL}/faults/${id}`);
      toast({ title: isArabic ? 'تم الحذف' : 'Deleted' });
      fetchFaults();
      fetchStats();
    } catch (error) {
      toast({ title: isArabic ? 'خطأ' : 'Error', variant: 'destructive' });
    }
  };

  const getDifficultyColor = (level) => {
    switch (level) {
      case 'easy': return 'bg-green-500/20 text-green-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'hard': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const filteredFaults = faults.filter(f => 
    f.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.symptom_description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.dtc_codes?.some(code => code.includes(searchQuery.toUpperCase()))
  );

  return (
    <div className={`min-h-screen p-4 sm:p-6 ${isArabic ? 'rtl' : 'ltr'}`} dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <Database className="text-primary" />
            {isArabic ? 'قاعدة معرفة الأعطال' : 'Fault Knowledge Base'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isArabic ? 'نظام التعلم الذاتي للأعطال' : 'Self-learning fault diagnosis system'}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="apple-button flex items-center gap-2"
        >
          <Plus size={18} />
          {isArabic ? 'إضافة عطل' : 'Add Fault'}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="stat-card">
            <Database className="text-primary mb-2" size={24} />
            <h3 className="text-2xl font-bold">{stats.total_faults}</h3>
            <p className="text-sm text-muted-foreground">{isArabic ? 'إجمالي الأعطال' : 'Total Faults'}</p>
          </div>
          <div className="stat-card">
            <Video className="text-blue-400 mb-2" size={24} />
            <h3 className="text-2xl font-bold">{stats.with_media}</h3>
            <p className="text-sm text-muted-foreground">{isArabic ? 'مع وسائط' : 'With Media'}</p>
          </div>
          <div className="stat-card">
            <Car className="text-green-400 mb-2" size={24} />
            <h3 className="text-2xl font-bold">{Object.keys(stats.by_vehicle_type || {}).length}</h3>
            <p className="text-sm text-muted-foreground">{isArabic ? 'أنواع المركبات' : 'Vehicle Types'}</p>
          </div>
          <div className="stat-card">
            <AlertTriangle className="text-yellow-400 mb-2" size={24} />
            <h3 className="text-2xl font-bold">{Object.keys(stats.top_dtc_codes || {}).length}</h3>
            <p className="text-sm text-muted-foreground">{isArabic ? 'أكواد الأعطال' : 'DTC Codes'}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="apple-card p-4 mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className={`absolute ${isArabic ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} size={18} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={isArabic ? 'بحث بالعطل، الأعراض، أو كود DTC...' : 'Search by fault, symptoms, or DTC code...'}
              className={`apple-input ${isArabic ? 'pr-10' : 'pl-10'}`}
            />
          </div>
          <button onClick={handleSearch} className="apple-button">
            <Search size={18} />
          </button>
        </div>
      </div>

      {/* Faults List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredFaults.length === 0 ? (
        <div className="text-center py-12">
          <Database className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{isArabic ? 'لا توجد أعطال محفوظة' : 'No faults saved'}</p>
          <button onClick={() => setShowAddModal(true)} className="apple-button mt-4">
            {isArabic ? 'إضافة أول عطل' : 'Add First Fault'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFaults.map(fault => (
            <div key={fault.id} className="apple-card p-4 hover:border-primary/30 transition-all">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-foreground line-clamp-1">{fault.title}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(fault.difficulty_level)}`}>
                  {fault.difficulty_level === 'easy' ? (isArabic ? 'سهل' : 'Easy') :
                   fault.difficulty_level === 'medium' ? (isArabic ? 'متوسط' : 'Medium') :
                   (isArabic ? 'صعب' : 'Hard')}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Car size={14} />
                <span>{fault.vehicle_type}</span>
                {fault.vehicle_model && <span>• {fault.vehicle_model}</span>}
              </div>
              
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{fault.symptom_description}</p>
              
              {fault.dtc_codes?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {fault.dtc_codes.slice(0, 3).map((code, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-mono">
                      {code}
                    </span>
                  ))}
                  {fault.dtc_codes.length > 3 && (
                    <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs">
                      +{fault.dtc_codes.length - 3}
                    </span>
                  )}
                </div>
              )}
              
              {fault.media_url && (
                <div className="flex items-center gap-2 text-xs text-primary mb-3">
                  {fault.media_type === 'audio' ? <Volume2 size={14} /> : 
                   fault.media_type === 'video' ? <Video size={14} /> : null}
                  <span>{isArabic ? 'يحتوي على وسائط' : 'Has media'}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center pt-3 border-t border-border">
                <button
                  onClick={() => setShowDetailModal(fault)}
                  className="text-primary hover:text-primary/80 text-sm flex items-center gap-1"
                >
                  <Eye size={14} />
                  {isArabic ? 'التفاصيل' : 'Details'}
                </button>
                <button
                  onClick={() => handleDelete(fault.id)}
                  className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border">
            <div className="sticky top-0 bg-card border-b border-border p-4 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold">{isArabic ? 'إضافة عطل جديد' : 'Add New Fault'}</h2>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddFault} className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{isArabic ? 'عنوان العطل *' : 'Fault Title *'}</label>
                  <input
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="apple-input"
                    placeholder={isArabic ? 'مثال: تأخر استجابة التيربو' : 'e.g. Turbo lag issue'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{isArabic ? 'نوع المركبة *' : 'Vehicle Type *'}</label>
                  <select
                    required
                    value={formData.vehicle_type}
                    onChange={(e) => setFormData({...formData, vehicle_type: e.target.value})}
                    className="apple-input"
                  >
                    <option value="">{isArabic ? 'اختر...' : 'Select...'}</option>
                    <option value="Toyota">Toyota</option>
                    <option value="Isuzu">Isuzu</option>
                    <option value="Mitsubishi">Mitsubishi</option>
                    <option value="Nissan">Nissan</option>
                    <option value="Other">{isArabic ? 'أخرى' : 'Other'}</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">{isArabic ? 'موديل المركبة' : 'Vehicle Model'}</label>
                <input
                  value={formData.vehicle_model}
                  onChange={(e) => setFormData({...formData, vehicle_model: e.target.value})}
                  className="apple-input"
                  placeholder={isArabic ? 'مثال: Land Cruiser 300' : 'e.g. Land Cruiser 300'}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">{isArabic ? 'وصف الأعراض *' : 'Symptom Description *'}</label>
                <textarea
                  required
                  rows={3}
                  value={formData.symptom_description}
                  onChange={(e) => setFormData({...formData, symptom_description: e.target.value})}
                  className="apple-input resize-none"
                  placeholder={isArabic ? 'صف الأعراض بالتفصيل...' : 'Describe the symptoms in detail...'}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">{isArabic ? 'أكواد الأعطال (DTC)' : 'DTC Codes'}</label>
                <input
                  value={formData.dtc_codes}
                  onChange={(e) => setFormData({...formData, dtc_codes: e.target.value})}
                  className="apple-input"
                  placeholder={isArabic ? 'مثال: P0087, P0234' : 'e.g. P0087, P0234'}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">{isArabic ? 'خطوات التشخيص *' : 'Diagnosis Steps *'}</label>
                <textarea
                  required
                  rows={3}
                  value={formData.diagnosis_steps}
                  onChange={(e) => setFormData({...formData, diagnosis_steps: e.target.value})}
                  className="apple-input resize-none"
                  placeholder={isArabic ? '1. فحص...\n2. قياس...' : '1. Check...\n2. Measure...'}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">{isArabic ? 'الحل *' : 'Solution *'}</label>
                <textarea
                  required
                  rows={3}
                  value={formData.solution}
                  onChange={(e) => setFormData({...formData, solution: e.target.value})}
                  className="apple-input resize-none"
                  placeholder={isArabic ? 'الحل المطبق...' : 'Applied solution...'}
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{isArabic ? 'القطع المطلوبة' : 'Parts Needed'}</label>
                  <input
                    value={formData.parts_needed}
                    onChange={(e) => setFormData({...formData, parts_needed: e.target.value})}
                    className="apple-input"
                    placeholder={isArabic ? 'مثال: فلتر، حساس' : 'e.g. Filter, Sensor'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{isArabic ? 'التكلفة التقديرية' : 'Estimated Cost'}</label>
                  <input
                    type="number"
                    value={formData.estimated_cost}
                    onChange={(e) => setFormData({...formData, estimated_cost: e.target.value})}
                    className="apple-input"
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">{isArabic ? 'مستوى الصعوبة' : 'Difficulty Level'}</label>
                <select
                  value={formData.difficulty_level}
                  onChange={(e) => setFormData({...formData, difficulty_level: e.target.value})}
                  className="apple-input"
                >
                  <option value="easy">{isArabic ? 'سهل' : 'Easy'}</option>
                  <option value="medium">{isArabic ? 'متوسط' : 'Medium'}</option>
                  <option value="hard">{isArabic ? 'صعب' : 'Hard'}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">{isArabic ? 'ملف صوت/فيديو' : 'Audio/Video File'}</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                >
                  {mediaFile ? (
                    <div className="flex items-center justify-center gap-2">
                      {mediaFile.type.startsWith('audio/') ? <Volume2 className="text-primary" /> : <Video className="text-primary" />}
                      <span className="text-foreground">{mediaFile.name}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setMediaFile(null); }} className="text-red-400">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground text-sm">
                        {isArabic ? 'اضغط لرفع صوت أو فيديو العطل' : 'Click to upload fault audio/video'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">MP3, WAV, MP4, MOV</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,video/*"
                  onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="apple-button-secondary flex-1">
                  {isArabic ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" disabled={saving} className="apple-button flex-1 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                  {isArabic ? 'حفظ' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border">
            <div className="sticky top-0 bg-card border-b border-border p-4 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold">{showDetailModal.title}</h2>
              <button onClick={() => setShowDetailModal(null)} className="text-muted-foreground hover:text-foreground">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Car size={18} />
                <span>{showDetailModal.vehicle_type}</span>
                {showDetailModal.vehicle_model && <span>• {showDetailModal.vehicle_model}</span>}
              </div>
              
              {showDetailModal.dtc_codes?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">{isArabic ? 'أكواد الأعطال' : 'DTC Codes'}</h4>
                  <div className="flex flex-wrap gap-2">
                    {showDetailModal.dtc_codes.map((code, idx) => (
                      <span key={idx} className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg font-mono">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <h4 className="font-medium mb-2">{isArabic ? 'الأعراض' : 'Symptoms'}</h4>
                <p className="text-muted-foreground">{showDetailModal.symptom_description}</p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">{isArabic ? 'خطوات التشخيص' : 'Diagnosis Steps'}</h4>
                <p className="text-muted-foreground whitespace-pre-line">{showDetailModal.diagnosis_steps}</p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">{isArabic ? 'الحل' : 'Solution'}</h4>
                <p className="text-muted-foreground whitespace-pre-line">{showDetailModal.solution}</p>
              </div>
              
              {showDetailModal.parts_needed?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">{isArabic ? 'القطع المطلوبة' : 'Parts Needed'}</h4>
                  <div className="flex flex-wrap gap-2">
                    {showDetailModal.parts_needed.map((part, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg">
                        {part}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {showDetailModal.estimated_cost && (
                <div>
                  <h4 className="font-medium mb-2">{isArabic ? 'التكلفة التقديرية' : 'Estimated Cost'}</h4>
                  <p className="text-2xl font-bold text-primary">{showDetailModal.estimated_cost} {isArabic ? 'ر.س' : 'SAR'}</p>
                </div>
              )}
              
              {showDetailModal.media_url && (
                <div>
                  <h4 className="font-medium mb-2">{isArabic ? 'الوسائط' : 'Media'}</h4>
                  {showDetailModal.media_type === 'audio' ? (
                    <audio controls className="w-full" src={showDetailModal.media_url} />
                  ) : showDetailModal.media_type === 'video' ? (
                    <video controls className="w-full rounded-lg" src={showDetailModal.media_url} />
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FaultKnowledge;
