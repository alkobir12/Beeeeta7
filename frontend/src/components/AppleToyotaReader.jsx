import React, { useState, useEffect } from 'react';
import { Search, Home, ChevronRight, BookOpen, Image as ImageIcon, FileText, Maximize2, Minimize2, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AppleToyotaReader = () => {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [content, setContent] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState(['الرئيسية']);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stats, setStats] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  useEffect(() => {
    loadSections();
    loadStats();
  }, []);

  const loadSections = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/toyota-manual/sections`);
      setSections(data.sections || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadStats = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/toyota-manual/stats`);
      setStats(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadSectionContent = async (sectionId, sectionTitle) => {
    try {
      setLoading(true);
      setSelectedSection(sectionId);
      setBreadcrumb(['الرئيسية', sectionTitle]);
      
      const { data } = await axios.get(`${API_URL}/toyota-manual/content?limit=30`);
      setContent(data.content || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const goHome = () => {
    setSelectedSection(null);
    setContent([]);
    setBreadcrumb(['الرئيسية']);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) return;
    
    try {
      const { data } = await axios.get(`${API_URL}/toyota-manual/search?q=${encodeURIComponent(searchQuery)}&limit=50`);
      setSearchResults(data.results || []);
      setBreadcrumb(['الرئيسية', `نتائج البحث: "${searchQuery}"`]);
      setSelectedSection('search');
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : ''} bg-white`}>
      {/* Clean Apple Header */}
      <div className="bg-white border-b border-[#D2D2D7]">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-[#007AFF] rounded-[11px] flex items-center justify-center shadow-sm">
                <BookOpen size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-[28px] font-semibold text-[#1D1D1F] tracking-tight leading-none">
                  دليل تويوتا
                </h1>
                <p className="text-[13px] text-[#86868B] mt-1">
                  Land Cruiser 200
                </p>
              </div>
            </div>
            
            {stats && (
              <div className="flex items-center gap-6 text-[13px]">
                <div className="text-center">
                  <div className="text-[#1D1D1F] font-semibold">{stats.documents}</div>
                  <div className="text-[#86868B]">صفحة</div>
                </div>
                <div className="text-center">
                  <div className="text-[#1D1D1F] font-semibold">{stats.images}</div>
                  <div className="text-[#86868B]">صورة</div>
                </div>
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="px-4 py-2 bg-[#007AFF] hover:bg-[#0051D5] text-white rounded-[10px] transition-colors text-[13px] font-medium"
                >
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              </div>
            )}
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[13px] mb-4">
            {breadcrumb.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight size={14} className="text-[#86868B]" />}
                <button
                  onClick={() => idx === 0 && goHome()}
                  className={`${
                    idx === breadcrumb.length - 1
                      ? 'text-[#1D1D1F] font-medium'
                      : 'text-[#007AFF] hover:underline'
                  }`}
                >
                  {crumb}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-[#86868B]" size={18} />
            <input
              type="text"
              placeholder="ابحث في الدليل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pr-12 pl-4 py-3 bg-[#F5F5F7] border-0 rounded-[12px] text-[15px] text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  if (selectedSection === 'search') goHome();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F]"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`${isFullscreen ? 'h-[calc(100vh-200px)]' : 'h-[700px]'} overflow-y-auto px-6 py-6`}>
        {!selectedSection ? (
          /* Home View - Sections Grid */
          <div className="max-w-6xl mx-auto">
            <h2 className="text-[22px] font-semibold text-[#1D1D1F] mb-6">الأقسام</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sections.map(section => (
                <button
                  key={section.id}
                  onClick={() => loadSectionContent(section.id, section.title)}
                  className="bg-white hover:bg-[#FAFAFA] rounded-[16px] p-6 text-right transition-all border border-[#D2D2D7] hover:border-[#007AFF] hover:shadow-sm group"
                >
                  <div className="text-4xl mb-3">{section.icon}</div>
                  <h3 className="text-[17px] font-semibold text-[#1D1D1F] mb-1 group-hover:text-[#007AFF] transition-colors">
                    {section.title}
                  </h3>
                  <p className="text-[13px] text-[#86868B]">{section.title_ar}</p>
                  <div className="mt-4 flex items-center justify-end text-[#007AFF] text-[13px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>عرض المحتوى</span>
                    <ChevronRight size={16} className="mr-1" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : selectedSection === 'search' ? (
          /* Search Results */
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[22px] font-semibold text-[#1D1D1F]">
                نتائج البحث ({searchResults.length})
              </h2>
              <button
                onClick={goHome}
                className="px-4 py-2 bg-[#F5F5F7] hover:bg-[#E8E8ED] rounded-[10px] transition-colors text-[13px] font-medium text-[#1D1D1F] flex items-center gap-2"
              >
                <ArrowLeft size={16} />
                <span>رجوع</span>
              </button>
            </div>

            <div className="space-y-3">
              {searchResults.map((result, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-[16px] p-5 border border-[#D2D2D7] hover:border-[#007AFF] hover:shadow-sm transition-all cursor-pointer"
                >
                  <h3 className="text-[15px] font-semibold text-[#1D1D1F] mb-2">{result.title}</h3>
                  <p className="text-[13px] text-[#86868B] line-clamp-2">{result.preview}</p>
                  {result.images_count > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-[#007AFF] text-[12px]">
                      <ImageIcon size={14} />
                      <span>{result.images_count} صورة</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Content View */
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[22px] font-semibold text-[#1D1D1F]">
                المحتوى ({content.length})
              </h2>
              <button
                onClick={goHome}
                className="px-4 py-2 bg-[#F5F5F7] hover:bg-[#E8E8ED] rounded-[10px] transition-colors text-[13px] font-medium text-[#1D1D1F] flex items-center gap-2"
              >
                <ArrowLeft size={16} />
                <span>رجوع للأقسام</span>
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-10 h-10 border-3 border-[#E8E8ED] border-t-[#007AFF] rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {content.map((doc, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-[20px] overflow-hidden border border-[#D2D2D7] shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* Document Title */}
                    {doc.title && (
                      <div className="px-6 py-4 bg-[#FAFAFA] border-b border-[#D2D2D7]">
                        <h3 className="text-[17px] font-semibold text-[#1D1D1F]">{doc.title}</h3>
                      </div>
                    )}

                    <div className="p-6">
                      {/* Headings */}
                      {doc.content?.filter(c => c.type === 'heading').slice(0, 3).map((heading, i) => (
                        <div key={i} className="mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 bg-[#007AFF] rounded-full"></div>
                            <h4 className="text-[15px] font-semibold text-[#1D1D1F]">
                              {heading.text}
                            </h4>
                          </div>
                        </div>
                      ))}

                      {/* Paragraphs */}
                      {doc.content?.filter(c => c.type === 'paragraph').slice(0, 2).map((para, i) => (
                        <p key={i} className="text-[15px] text-[#1D1D1F] leading-[1.6] mb-4">
                          {para.text}
                        </p>
                      ))}

                      {/* Procedures */}
                      {doc.procedures?.slice(0, 1).map((proc, i) => (
                        <div key={i} className="bg-[#F5F5F7] rounded-[16px] p-5 mb-4">
                          <div className="flex items-center gap-2 mb-4">
                            <FileText size={18} className="text-[#007AFF]" />
                            <span className="text-[15px] font-semibold text-[#1D1D1F]">خطوات العمل</span>
                          </div>
                          <ol className="space-y-3 pr-6">
                            {proc.steps?.slice(0, 8).map((step, si) => (
                              <li key={si} className="text-[14px] text-[#1D1D1F] leading-[1.5] list-decimal">
                                {step}
                              </li>
                            ))}
                          </ol>
                          {proc.steps?.length > 8 && (
                            <div className="mt-3 text-[13px] text-[#007AFF]">
                              +{proc.steps.length - 8} خطوات إضافية
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Images */}
                      {doc.images && doc.images.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <ImageIcon size={18} className="text-[#007AFF]" />
                            <span className="text-[15px] font-semibold text-[#1D1D1F]">
                              الصور ({doc.images.length})
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {doc.images.slice(0, 6).map((img, imgIdx) => (
                              <div
                                key={imgIdx}
                                className="bg-[#F5F5F7] rounded-[12px] overflow-hidden aspect-[4/3] border border-[#E8E8ED]"
                              >
                                <img
                                  src={img.src}
                                  alt={img.alt || 'رسم توضيحي'}
                                  className="w-full h-full object-contain p-2"
                                  onError={(e) => {
                                    e.target.parentElement.innerHTML = '<div class="flex items-center justify-center h-full text-[#86868B] text-xs">صورة غير متوفرة</div>';
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                          {doc.images.length > 6 && (
                            <div className="mt-3 text-center text-[13px] text-[#007AFF]">
                              +{doc.images.length - 6} صور إضافية
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {content.length === 0 && !loading && selectedSection && (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 bg-[#F5F5F7] rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText size={28} className="text-[#86868B]" />
                    </div>
                    <p className="text-[#86868B] text-[15px]">لا يوجد محتوى متاح</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AppleToyotaReader;
