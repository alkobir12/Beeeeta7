import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, Maximize2, Minimize2, Book, Image, List, X } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AppleToyotaReader = () => {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [content, setContent] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stats, setStats] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [sectionsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/toyota-manual/sections`),
        axios.get(`${API_URL}/toyota-manual/stats`)
      ]);
      
      setSections(sectionsRes.data.sections || []);
      setStats(statsRes.data);
      
      // Auto-select first section
      if (sectionsRes.data.sections && sectionsRes.data.sections.length > 0) {
        selectSection(sectionsRes.data.sections[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectSection = async (sectionId) => {
    try {
      setLoading(true);
      setSelectedSection(sectionId);
      const { data } = await axios.get(`${API_URL}/toyota-manual/content?limit=20&offset=${currentPage * 20}`);
      setContent(data.content || []);
    } catch (error) {
      console.error('Error loading section:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    
    try {
      const { data } = await axios.get(`${API_URL}/toyota-manual/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : ''} bg-[#F5F5F7]`}>
      {/* Apple-style Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-2xl flex items-center justify-center shadow-lg">
                <Book size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
                  دليل تويوتا التقني
                </h1>
                <p className="text-sm text-[#86868B] mt-0.5">
                  Land Cruiser 200 - {stats?.extracted_pages || 0} صفحة محسّنة
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="px-4 py-2 bg-[#F5F5F7] hover:bg-[#E8E8ED] rounded-full transition-all text-[#1D1D1F] text-sm font-medium"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className={`flex ${isFullscreen ? 'h-screen' : 'h-[calc(100vh-180px)]'}`}>
        {/* Apple-style Sidebar */}
        <div className="w-[280px] bg-white border-r border-gray-200 flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B]" size={16} />
              <input
                type="text"
                placeholder="بحث..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length >= 2) {
                    handleSearch();
                  } else {
                    setSearchResults([]);
                  }
                }}
                className="w-full pr-9 pl-3 py-2 bg-[#F5F5F7] border-0 rounded-lg text-sm text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:bg-white transition-all"
              />
            </div>
            
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-60 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-100">
                {searchResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="p-3 hover:bg-[#F5F5F7] cursor-pointer border-b border-gray-50 last:border-0"
                  >
                    <div className="text-sm font-medium text-[#1D1D1F]">{result.title}</div>
                    <div className="text-xs text-[#86868B] mt-1 line-clamp-2">{result.preview}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sections List */}
          <div className="flex-1 overflow-y-auto p-2">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => selectSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all mb-1 ${
                  selectedSection === section.id
                    ? 'bg-[#007AFF] text-white shadow-sm'
                    : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                }`}
              >
                <span className="text-xl">{section.icon}</span>
                <div className="flex-1 text-right">
                  <div className="text-sm font-medium">{section.title}</div>
                  <div className={`text-xs mt-0.5 ${
                    selectedSection === section.id ? 'text-white opacity-80' : 'text-[#86868B]'
                  }`}>
                    {section.title_ar}
                  </div>
                </div>
                {selectedSection === section.id && (
                  <ChevronLeft size={16} className="opacity-60" />
                )}
              </button>
            ))}
          </div>

          {/* Stats Footer */}
          {stats && (
            <div className="p-4 border-t border-gray-100 bg-[#F5F5F7]">
              <div className="space-y-2 text-xs text-[#86868B]">
                <div className="flex justify-between">
                  <span>المستندات</span>
                  <span className="font-medium text-[#1D1D1F]">{stats.documents}</span>
                </div>
                <div className="flex justify-between">
                  <span>الصور</span>
                  <span className="font-medium text-[#1D1D1F]">{stats.images}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content Area - Apple Design */}
        <div className="flex-1 overflow-y-auto bg-[#F5F5F7]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-3 border-[#E8E8ED] border-t-[#007AFF] rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-sm text-[#86868B]">جاري التحميل...</p>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto p-8">
              {content.map((doc, idx) => (
                <div key={idx} className="mb-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Document Header */}
                  {doc.title && (
                    <div className="px-6 py-4 border-b border-gray-100 bg-[#FAFAFA]">
                      <h2 className="text-lg font-semibold text-[#1D1D1F]">{doc.title}</h2>
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-6">
                    {/* Headings */}
                    {doc.content?.filter(c => c.type === 'heading').map((heading, i) => (
                      <h3 key={i} className="text-base font-semibold text-[#1D1D1F] mb-3 mt-4">
                        {heading.text}
                      </h3>
                    ))}

                    {/* Paragraphs */}
                    {doc.content?.filter(c => c.type === 'paragraph').slice(0, 3).map((para, i) => (
                      <p key={i} className="text-sm text-[#1D1D1F] leading-relaxed mb-3">
                        {para.text}
                      </p>
                    ))}

                    {/* Procedures */}
                    {doc.procedures?.map((proc, i) => (
                      <div key={i} className="mt-4 bg-[#F5F5F7] rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <List size={18} className="text-[#007AFF]" />
                          <span className="text-sm font-medium text-[#1D1D1F]">إجراء</span>
                        </div>
                        <ol className="space-y-2">
                          {proc.steps?.slice(0, 5).map((step, si) => (
                            <li key={si} className="text-sm text-[#1D1D1F] leading-relaxed pr-5">
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}

                    {/* Images Grid */}
                    {doc.images && doc.images.length > 0 && (
                      <div className="mt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Image size={18} className="text-[#007AFF]" />
                          <span className="text-sm font-medium text-[#1D1D1F]">
                            الصور التوضيحية ({doc.images.length})
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {doc.images.slice(0, 4).map((img, imgIdx) => (
                            <div key={imgIdx} className="bg-[#F5F5F7] rounded-xl overflow-hidden aspect-video flex items-center justify-center">
                              <img
                                src={img.src}
                                alt={img.alt || 'Technical diagram'}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Load More */}
              {content.length > 0 && (
                <button
                  onClick={() => {
                    setCurrentPage(prev => prev + 1);
                    selectSection(selectedSection);
                  }}
                  className="w-full px-6 py-3 bg-white hover:bg-[#F5F5F7] rounded-2xl transition-all text-[#007AFF] font-medium text-sm shadow-sm border border-gray-100"
                >
                  تحميل المزيد
                </button>
              )}

              {content.length === 0 && !loading && (
                <div className="text-center py-20">
                  <div className="w-20 h-20 bg-[#F5F5F7] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Book size={32} className="text-[#86868B]" />
                  </div>
                  <p className="text-[#86868B]">اختر قسماً من القائمة</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppleToyotaReader;
