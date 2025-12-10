import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, ChevronDown, Maximize2, Minimize2, Book, Zap } from 'lucide-react';

const ToyotaManualReader = () => {
  const [manualType, setManualType] = useState('repair');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  // Manual sections structure
  const sections = {
    repair: [
      {
        id: 'readme',
        title: 'READ ME',
        icon: '📋',
        subtitle: 'معلومات مهمة'
      },
      {
        id: 'general',
        title: 'General',
        icon: '📖',
        subtitle: 'معلومات عامة',
        subsections: [
          { id: 'gen-1', title: 'Introduction' },
          { id: 'gen-2', title: 'How to Use' },
          { id: 'gen-3', title: 'Abbreviations' }
        ]
      },
      {
        id: 'engine',
        title: 'Engine / Hybrid System',
        icon: '🔩',
        subtitle: 'المحرك والهايبرد',
        subsections: [
          { id: 'eng-1', title: 'Engine Mechanical' },
          { id: 'eng-2', title: 'Engine Control System' },
          { id: 'eng-3', title: 'Fuel System' },
          { id: 'eng-4', title: 'Cooling System' },
          { id: 'eng-5', title: 'Lubrication System' }
        ]
      },
      {
        id: 'drivetrain',
        title: 'Drivetrain',
        icon: '⚙️',
        subtitle: 'نظام الدفع',
        subsections: [
          { id: 'drv-1', title: 'Clutch' },
          { id: 'drv-2', title: 'Transmission' },
          { id: 'drv-3', title: 'Transfer Case' },
          { id: 'drv-4', title: 'Propeller Shaft' },
          { id: 'drv-5', title: 'Differential' }
        ]
      },
      {
        id: 'suspension',
        title: 'Suspension',
        icon: '🏗️',
        subtitle: 'نظام التعليق',
        subsections: [
          { id: 'sus-1', title: 'Front Suspension' },
          { id: 'sus-2', title: 'Rear Suspension' },
          { id: 'sus-3', title: 'Shock Absorbers' }
        ]
      },
      {
        id: 'brake',
        title: 'Brake',
        icon: '🛑',
        subtitle: 'نظام الفرامل',
        subsections: [
          { id: 'brk-1', title: 'Brake System' },
          { id: 'brk-2', title: 'ABS' },
          { id: 'brk-3', title: 'Parking Brake' }
        ]
      },
      {
        id: 'steering',
        title: 'Steering',
        icon: '🎛️',
        subtitle: 'نظام التوجيه',
        subsections: [
          { id: 'str-1', title: 'Power Steering' },
          { id: 'str-2', title: 'Steering Column' }
        ]
      },
      {
        id: 'audio',
        title: 'Audio/Visual/Telematics',
        icon: '🎵',
        subtitle: 'الصوتيات والاتصالات',
        subsections: [
          { id: 'av-1', title: 'Audio System' },
          { id: 'av-2', title: 'Navigation' },
          { id: 'av-3', title: 'Telematics' }
        ]
      },
      {
        id: 'power',
        title: 'Power Source / Network',
        icon: '🔌',
        subtitle: 'الطاقة والشبكات',
        subsections: [
          { id: 'pwr-1', title: 'Battery' },
          { id: 'pwr-2', title: 'Charging System' },
          { id: 'pwr-3', title: 'CAN Network' }
        ]
      },
      {
        id: 'interior',
        title: 'Vehicle Interior',
        icon: '🪟',
        subtitle: 'الداخلية',
        subsections: [
          { id: 'int-1', title: 'Instrument Panel' },
          { id: 'int-2', title: 'Seats' },
          { id: 'int-3', title: 'Climate Control' }
        ]
      },
      {
        id: 'exterior',
        title: 'Vehicle Exterior',
        icon: '🚘',
        subtitle: 'الخارجية',
        subsections: [
          { id: 'ext-1', title: 'Body' },
          { id: 'ext-2', title: 'Doors & Windows' },
          { id: 'ext-3', title: 'Lighting' }
        ]
      }
    ]
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const filteredSections = sections.repair.filter(section => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return section.title.toLowerCase().includes(q) || 
           section.subtitle?.toLowerCase().includes(q) ||
           section.subsections?.some(sub => sub.title.toLowerCase().includes(q));
  });

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      {/* Modern Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
              {manualType === 'repair' ? <Book size={24} /> : <Zap size={24} />}
            </div>
            <div>
              <h2 className="text-2xl font-bold">قارئ دليل تويوتا المتقدم</h2>
              <p className="text-sm opacity-90">
                {manualType === 'repair' ? 'لاندكروزر 200 - دليل الإصلاح الشامل' : 'المخططات الكهربائية'}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setManualType(manualType === 'repair' ? 'electrical' : 'repair')}
              className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all"
            >
              {manualType === 'repair' ? '⚡ كهرباء' : '🔧 إصلاح'}
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all"
            >
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex ${isFullscreen ? 'h-screen' : 'h-[700px]'}`}>
        {/* Modern Sidebar Navigation */}
        <div className="w-80 bg-gray-50 border-r border-gray-200 overflow-y-auto">
          {/* Search Bar */}
          <div className="p-4 bg-white border-b border-gray-200 sticky top-0 z-10">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="بحث في الأقسام..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Sections List */}
          <div className="p-2">
            {filteredSections.map(section => (
              <div key={section.id} className="mb-1">
                <button
                  onClick={() => {
                    if (section.subsections) {
                      toggleSection(section.id);
                    } else {
                      setSelectedSection(section.id);
                    }
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                    selectedSection === section.id 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{section.icon}</span>
                    <div className="text-right">
                      <div className="font-medium text-sm">{section.title}</div>
                      <div className={`text-xs ${selectedSection === section.id ? 'text-white opacity-80' : 'text-gray-500'}`}>
                        {section.subtitle}
                      </div>
                    </div>
                  </div>
                  {section.subsections && (
                    expandedSections[section.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />
                  )}
                </button>

                {/* Subsections */}
                {section.subsections && expandedSections[section.id] && (
                  <div className="mr-8 mt-1 space-y-1">
                    {section.subsections.map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => setSelectedSection(sub.id)}
                        className={`w-full text-right p-2 rounded-lg text-sm transition-all ${
                          selectedSection === sub.id 
                            ? 'bg-blue-100 text-blue-900 font-medium' 
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {sub.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 bg-white overflow-hidden">
          <iframe
            src={manualType === 'repair' 
              ? `${process.env.REACT_APP_BACKEND_URL}/api/manuals/lc200/index2.html`
              : `${process.env.REACT_APP_BACKEND_URL}/api/manuals/toyota-ewd/ewd/index.html`
            }
            className="w-full h-full border-0"
            title="Toyota Manual"
          />
        </div>
      </div>

      {/* Footer Stats */}
      {!isFullscreen && (
        <div className="bg-gray-50 border-t border-gray-200 p-4 rounded-b-xl">
          <div className="flex items-center justify-between text-sm">
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-600">
                  {manualType === 'repair' ? '15,644 صفحة' : '36 صفحة'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600">
                  {manualType === 'repair' ? '11,278 صورة' : '18 صورة'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-gray-600">تويوتا لاندكروزر 200</span>
              </div>
            </div>
            <div className="text-gray-500">
              💡 استخدم القائمة الجانبية للتنقل السريع
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToyotaManualReader;
