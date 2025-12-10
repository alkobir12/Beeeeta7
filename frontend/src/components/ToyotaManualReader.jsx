import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, ChevronLeft, ChevronDown, Maximize2, Minimize2, Book, ExternalLink, FileText, Download } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ToyotaManualReader = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('readme');
  const [expandedSections, setExpandedSections] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [contentUrl, setContentUrl] = useState('');

  // Load sections on mount
  useEffect(() => {
    loadSections();
  }, []);

  const loadSections = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/toyota-manual/sections`);
      setSections(data.sections || []);
      // Set initial content URL
      setContentUrl(`${process.env.REACT_APP_BACKEND_URL}/api/manuals/lc200/index2.html`);
    } catch (error) {
      console.error('Error loading sections:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectSection = (sectionId) => {
    setSelectedSection(sectionId);
    // You can map section IDs to specific HTML files if needed
    // For now, keeping main manual open
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const filteredSections = sections.filter(section => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return section.title.toLowerCase().includes(q) || 
           section.title_ar?.toLowerCase().includes(q);
  });

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      {/* Modern Header with Gradient */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-6 rounded-t-xl shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white bg-opacity-20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
              <Book size={28} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">قارئ دليل تويوتا المتقدم</h2>
              <p className="text-sm opacity-90 mt-1">
                لاندكروزر 200 - دليل الإصلاح الشامل (15,644 صفحة تقنية + 11,278 صورة)
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}/api/manuals/lc200/index2.html`, '_blank')}
              className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-lg transition-all shadow-md flex items-center gap-2"
            >
              <ExternalLink size={18} />
              <span className="text-sm">فتح في نافذة جديدة</span>
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-lg transition-all shadow-md"
            >
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex ${isFullscreen ? 'h-screen' : 'h-[750px]'} bg-gray-50`}>
        {/* Modern Sidebar Navigation */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto shadow-sm">
          {/* Search Bar */}
          <div className="p-4 bg-gradient-to-b from-gray-50 to-white border-b border-gray-200 sticky top-0 z-10">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="بحث في الأقسام..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm"
              />
            </div>
          </div>

          {/* Sections List */}
          <div className="p-3 space-y-1">
            {filteredSections.map((section, index) => (
              <button
                key={section.id}
                onClick={() => selectSection(section.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                  selectedSection === section.id 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md transform scale-[1.02]' 
                    : 'hover:bg-gray-50 text-gray-700 hover:shadow-sm'
                }`}
              >
                <span className="text-2xl">{section.icon}</span>
                <div className="flex-1 text-right">
                  <div className="font-semibold text-sm">{section.title}</div>
                  <div className={`text-xs mt-0.5 ${
                    selectedSection === section.id ? 'text-white opacity-90' : 'text-gray-500'
                  }`}>
                    {section.title_ar}
                  </div>
                </div>
                <ChevronLeft size={16} className={selectedSection === section.id ? 'opacity-100' : 'opacity-30'} />
              </button>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">إجراءات سريعة</h3>
            <div className="space-y-2">
              <button
                onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}/api/manuals/lc200/index2.html`, '_blank')}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Book size={16} />
                <span>دليل الإصلاح الكامل</span>
              </button>
              <button
                onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}/api/manuals/toyota-ewd/ewd/index.html`, '_blank')}
                className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center justify-center gap-2"
              >
                <FileText size={16} />
                <span>المخططات الكهربائية</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Viewer with Full Manual */}
        <div className="flex-1 bg-white overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center z-10">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600 font-medium">جاري تحميل الدليل...</p>
              <p className="text-sm text-gray-500 mt-2">15,644 صفحة تقنية</p>
            </div>
          )}
          
          <iframe
            src={contentUrl}
            className="w-full h-full border-0"
            title="Toyota Manual"
            onLoad={() => setLoading(false)}
          />
        </div>
      </div>

      {/* Footer Stats - Modern */}
      {!isFullscreen && (
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-4 rounded-b-xl">
          <div className="flex items-center justify-between text-sm">
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>15,644 صفحة تقنية</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <span>11,278 صورة توضيحية</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                <span>تويوتا لاندكروزر 200 - LC200</span>
              </div>
            </div>
            <div className="opacity-80">
              💡 استخدم القائمة الجانبية للتنقل - يمكن فتح في نافذة منفصلة للتكبير
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToyotaManualReader;
