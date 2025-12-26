import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, BookOpen, Image as ImageIcon, FileText, Maximize2, Minimize2, ArrowLeft, X } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AppleToyotaReader = () => {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [content, setContent] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState(['الرئيسية']);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stats, setStats] = useState(null);

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
      setSelectedDoc(null);
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
    setSelectedDoc(null);
    setContent([]);
    setBreadcrumb(['الرئيسية']);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleSearch = async () => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/toyota-manual/search?q=${encodeURIComponent(searchQuery.trim())}&limit=50`);
      setSearchResults(data.results || []);
      setBreadcrumb(['الرئيسية', `نتائج البحث: "${searchQuery}"`]);
      setSelectedSection('search');
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {

  const openDocument = async (doc) => {
    try {
      setLoading(true);
      setSelectedDoc(null);
      const file = doc.file;
      if (!file) {
        setSelectedDoc(doc);
        return;
      }
      const { data } = await axios.get(`${API_URL}/toyota-manual/content/by-file`, {
        params: { file },
      });
      setSelectedDoc(data.doc || doc);
      setBreadcrumb(['الرئيسية', doc.title || 'مستند']);
    } catch (error) {
      console.error('Open doc error:', error);
      setSelectedDoc(doc);
    } finally {
      setLoading(false);
    }
  };

      setLoading(false);
    }
  };

  // Render Home View (Sections Grid)
  const renderHome = () => (
    <div className="max-w-6xl mx-auto">
      {/* Info Banner */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-[16px] p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="text-5xl">🚗</div>
          <div>
            <h2 className="text-[20px] font-semibold mb-1">دليل تويوتا الفني</h2>
            <p className="text-[14px] opacity-90">
              دليل شامل لـ Land Cruiser 200 و Hilux - 2,870 صفحة تقنية + 9,477 صورة توضيحية
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-[22px] font-semibold text-[#1D1D1F] mb-6">الأقسام الرئيسية</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => loadSectionContent(section.id, section.title)}
            className="bg-white hover:bg-[#FAFAFA] rounded-[18px] p-6 text-right transition-all border border-[#D2D2D7] hover:border-[#007AFF] hover:shadow-md group"
          >
            <div className="text-5xl mb-4">{section.icon}</div>
            <h3 className="text-[17px] font-semibold text-[#1D1D1F] mb-2 group-hover:text-[#007AFF] transition-colors">
              {section.title}
            </h3>
            <p className="text-[14px] text-[#86868B] mb-4">{section.title_ar}</p>
            <div className="flex items-center justify-end text-[#007AFF] text-[14px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              <span>فتح القسم</span>
              <ChevronRight size={18} className="mr-1" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // Render Search Results
  const renderSearchResults = () => (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[22px] font-semibold text-[#1D1D1F]">
          نتائج البحث ({searchResults.length})
        </h2>
        <button

  const renderSelectedDoc = () => {
    if (!selectedDoc) return null;

    const doc = selectedDoc;
    const headings = doc.content?.filter(c => c.type === 'heading') || [];
    const paragraphs = doc.content?.filter(c => c.type === 'paragraph') || [];
    const procedures = doc.procedures || [];

    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[22px] font-semibold text-[#1D1D1F]">
            {doc.title || 'تفاصيل المستند'}
          </h2>
          <button
            onClick={() => setSelectedDoc(null)}
            className="px-4 py-2 bg-[#F5F5F7] hover:bg-[#E8E8ED] rounded-[10px] transition-colors text-[14px] font-medium text-[#1D1D1F] flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            <span>رجوع</span>
          </button>
        </div>

        <div className="bg-white rounded-[20px] p-6 border border-[#D2D2D7] shadow-sm space-y-6">
          {headings.length > 0 && (
            <div className="space-y-2">
              {headings.map((h, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-1.5 h-6 bg-[#007AFF] rounded-full mt-0.5"></div>
                  <h3 className="text-[16px] font-semibold text-[#1D1D1F] flex-1">
                    {h.text}
                  </h3>
                </div>
              ))}
            </div>
          )}

          {paragraphs.length > 0 && (
            <div className="space-y-3">
              {paragraphs.map((p, idx) => (
                <p key={idx} className="text-[15px] text-[#1D1D1F] leading-[1.7] pr-1">
                  {p.text}
                </p>
              ))}
            </div>
          )}

          {procedures.length > 0 && (
            <div className="bg-[#F5F5F7] rounded-[16px] p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-[#007AFF] rounded-lg flex items-center justify-center">
                  <FileText size={16} className="text-white" />
                </div>
                <span className="text-[16px] font-semibold text-[#1D1D1F]">خطوات العمل</span>
              </div>
              {procedures.map((proc, idx) => (
                <ol key={idx} className="space-y-3 pr-6 list-decimal mb-4">
                  {proc.steps?.map((step, si) => (
                    <li key={si} className="text-[14px] text-[#1D1D1F] leading-[1.6] marker:text-[#007AFF] marker:font-semibold">
                      {step}
                    </li>
                  ))}
                </ol>
              ))}
            </div>
          )}

          {doc.images && doc.images.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-[#34C759] rounded-lg flex items-center justify-center">
                  <ImageIcon size={16} className="text-white" />
                </div>
                <span className="text-[16px] font-semibold text-[#1D1D1F]">
                  الصور التوضيحية ({doc.images.length})
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {doc.images.map((img, imgIdx) => (
                  <div
                    key={imgIdx}
                    className="bg-[#F5F5F7] rounded-[14px] overflow-hidden aspect-[4/3] border border-[#E8E8ED] hover:border-[#007AFF] transition-all"
                  >
                    <img
                      src={img.src}
                      alt={img.alt || 'رسم توضيحي'}
                      className="w-full h-full object-contain p-3"
                      onError={(e) => {
                        e.target.parentElement.innerHTML = '<div class="flex items-center justify-center h-full text-[#86868B] text-xs">صورة غير متوفرة</div>';
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

          onClick={goHome}
          className="px-4 py-2 bg-[#F5F5F7] hover:bg-[#E8E8ED] rounded-[10px] transition-colors text-[14px] font-medium text-[#1D1D1F] flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          <span>رجوع</span>
        </button>
      </div>

      <div className="space-y-3">
        {searchResults.map((result, idx) => (
          <button
            type="button"
            key={idx}
            onClick={() => openDocument(result)}
            className="w-full text-right bg-white rounded-[16px] p-5 border border-[#D2D2D7] hover:border-[#007AFF] hover:shadow-sm transition-all"
          >
            <h3 className="text-[16px] font-semibold text-[#1D1D1F] mb-2">{result.title}</h3>
            <p className="text-[14px] text-[#86868B] line-clamp-2">{result.preview}</p>
            {result.images_count > 0 && (
              <div className="mt-3 flex items-center gap-2 text-[#007AFF] text-[13px]">
                <ImageIcon size={14} />
                <span>{result.images_count} صورة توضيحية</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  // Render Content View
  const renderContent = () => (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[22px] font-semibold text-[#1D1D1F]">
          المستندات ({content.length})
        </h2>
        <button
          onClick={goHome}
          className="px-5 py-2.5 bg-[#007AFF] hover:bg-[#0051D5] text-white rounded-[10px] transition-colors text-[14px] font-medium flex items-center gap-2 shadow-sm"
        >
          <ArrowLeft size={16} />
          <span>رجوع للأقسام</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-[#E8E8ED] border-t-[#007AFF] rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-5">
          {content.map((doc, idx) => (
            <button
              type="button"
              key={idx}
              onClick={() => openDocument(doc)}
              className="w-full text-right bg-white rounded-[20px] overflow-hidden border border-[#D2D2D7] shadow-sm hover:border-[#007AFF] transition-all"
            >
              {doc.title && (
                <div className="px-6 py-4 bg-gradient-to-r from-[#F5F5F7] to-white border-b border-[#E8E8ED]">
                  <h3 className="text-[18px] font-semibold text-[#1D1D1F]">{doc.title}</h3>
                </div>
              )}

              <div className="p-6 space-y-5">
                {/* Headings */}
                {doc.content?.filter(c => c.type === 'heading').slice(0, 5).map((heading, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-6 bg-[#007AFF] rounded-full mt-0.5"></div>
                    <h4 className="text-[16px] font-semibold text-[#1D1D1F] flex-1">
                      {heading.text}
                    </h4>
                  </div>
                ))}

                {/* Paragraphs */}
                {doc.content?.filter(c => c.type === 'paragraph').slice(0, 3).map((para, i) => (
                  <p key={i} className="text-[15px] text-[#1D1D1F] leading-[1.7] pr-5">
                    {para.text}
                  </p>
                ))}

                {/* Procedures */}
                {doc.procedures?.slice(0, 1).map((proc, i) => (
                  <div key={i} className="bg-[#F5F5F7] rounded-[16px] p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-[#007AFF] rounded-lg flex items-center justify-center">
                        <FileText size={16} className="text-white" />
                      </div>
                      <span className="text-[16px] font-semibold text-[#1D1D1F]">خطوات العمل</span>
                    </div>
                    <ol className="space-y-3 pr-6 list-decimal">
                      {proc.steps?.slice(0, 10).map((step, si) => (
                        <li key={si} className="text-[14px] text-[#1D1D1F] leading-[1.6] marker:text-[#007AFF] marker:font-semibold">
                          {step}
                        </li>
                      ))}
                    </ol>
                    {proc.steps?.length > 10 && (
                      <div className="mt-4 pt-4 border-t border-[#E8E8ED] text-[13px] text-[#007AFF] font-medium">
                        + {proc.steps.length - 10} خطوات إضافية
                      </div>
                    )}
                  </div>
                ))}

                {/* Images Grid */}
                {doc.images && doc.images.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-[#34C759] rounded-lg flex items-center justify-center">
                        <ImageIcon size={16} className="text-white" />
                      </div>
                      <span className="text-[16px] font-semibold text-[#1D1D1F]">
                        الصور التوضيحية ({doc.images.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {doc.images.slice(0, 6).map((img, imgIdx) => (
                        <div
                          key={imgIdx}
                          className="bg-[#F5F5F7] rounded-[14px] overflow-hidden aspect-[4/3] border border-[#E8E8ED] hover:border-[#007AFF] transition-all"
                        >
                          <img
                            src={img.src}
                            alt={img.alt || 'رسم توضيحي'}
                            className="w-full h-full object-contain p-3"
                            onError={(e) => {
                              e.target.parentElement.innerHTML = '<div class="flex items-center justify-center h-full text-[#86868B] text-xs">صورة غير متوفرة</div>';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    {doc.images.length > 6 && (
                      <div className="mt-3 text-center">
                        <span className="inline-block px-4 py-2 bg-[#F5F5F7] rounded-full text-[13px] text-[#007AFF] font-medium">
                          + {doc.images.length - 6} صور إضافية
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </button>
          ))}

          {content.length === 0 && !loading && (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-[#F5F5F7] rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText size={32} className="text-[#86868B]" />
              </div>
              <p className="text-[#86868B] text-[15px]">لا يوجد محتوى متاح</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : ''} bg-[#F5F5F7]`}>
      {/* Apple Header */}
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
                      : 'text-[#007AFF] hover:underline cursor-pointer'
                  }`}
                  disabled={idx === breadcrumb.length - 1}
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
              className="w-full pr-12 pl-12 py-3 bg-[#F5F5F7] border-0 rounded-[12px] text-[15px] text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  if (selectedSection === 'search') goHome();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className={`${isFullscreen ? 'h-[calc(100vh-200px)]' : 'h-[700px]'} overflow-y-auto px-6 py-6`}>
        {!selectedSection && renderHome()}
        {selectedSection === 'search' && renderSearchResults()}
        {selectedSection && selectedSection !== 'search' && renderContent()}
      </div>
    </div>
  );
};

export default AppleToyotaReader;
