import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, ChevronLeft, ChevronDown, Maximize2, Minimize2, Book, Zap, AlertTriangle, Info, FileText } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ToyotaManualReader = () => {
  const [manualType, setManualType] = useState('repair');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [sectionContent, setSectionContent] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Load sections on mount
  useEffect(() => {
    loadSections();
  }, []);

  const loadSections = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/toyota-manual/sections`);
      setSections(data.sections || []);
      // Auto select first section
      if (data.sections && data.sections.length > 0) {
        selectSection(data.sections[0].id);
      }
    } catch (error) {
      console.error('Error loading sections:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectSection = async (sectionId) => {
    try {
      setSelectedSection(sectionId);
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/toyota-manual/section/${sectionId}`);
      setSectionContent(data);
    } catch (error) {
      console.error('Error loading content:', error);
      setSectionContent(null);
    } finally {
      setLoading(false);
    }
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
                لاندكروزر 200 - دليل الإصلاح الشامل (15,644 صفحة تقنية)
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
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
      <div className={`flex ${isFullscreen ? 'h-screen' : 'h-[700px]'} bg-gray-50`}>
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
        </div>

        {/* Content Viewer - Modern Design */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600 font-medium">جاري التحميل...</p>
            </div>
          ) : sectionContent ? (
            <div className="p-8 max-w-4xl mx-auto">
              {/* Section Header */}
              <div className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg">
                    {sectionContent.icon}
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">{sectionContent.title}</h1>
                    <p className="text-lg text-gray-600 mt-1">{sectionContent.title_ar}</p>
                  </div>
                </div>
                {sectionContent.content?.description && (
                  <p className="text-gray-700 text-lg leading-relaxed bg-blue-50 p-4 rounded-xl border border-blue-200">
                    {sectionContent.content.description}
                  </p>
                )}
              </div>

              {/* Content Items */}
              <div className="space-y-6">
                {/* Specs if available */}
                {sectionContent.content?.specs && (
                  <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
                    <h3 className="text-xl font-bold mb-4 text-gray-900">📊 المواصفات التقنية</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(sectionContent.content.specs).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <span className="font-medium text-gray-700">{key}</span>
                          <span className="text-blue-600 font-bold">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content Items */}
                {sectionContent.content?.items?.map((item, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-xl border ${
                      item.type === 'warning' ? 'bg-red-50 border-red-200' :
                      item.type === 'info' ? 'bg-blue-50 border-blue-200' :
                      item.type === 'note' ? 'bg-yellow-50 border-yellow-200' :
                      'bg-white border-gray-200 shadow-sm'
                    }`}
                  >
                    <p className={`text-sm ${
                      item.type === 'warning' ? 'text-red-800' :
                      item.type === 'info' ? 'text-blue-800' :
                      item.type === 'note' ? 'text-yellow-800' :
                      'text-gray-800'
                    }`}>
                      {item.text}
                    </p>
                  </div>
                ))}

                {/* Subsections */}
                {sectionContent.subsections && sectionContent.subsections.length > 0 && (
                  <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
                    <h3 className="text-xl font-bold mb-4 text-gray-900">📑 الأقسام الفرعية</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {sectionContent.subsections.map(sub => (
                        <div
                          key={sub.id}
                          className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                {sub.title}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">{sub.title_ar}</div>
                            </div>
                            <ChevronLeft size={18} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                <p>اختر قسماً من القائمة الجانبية</p>
              </div>
            </div>
          )}
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
                <span>تويوتا لاندكروزر 200</span>
              </div>
            </div>
            <div className="opacity-80">
              💡 نظام قراءة حديث بدون نوافذ خارجية
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToyotaManualReader;
