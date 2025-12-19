import React, { useState } from 'react';
import { Bot, Sparkles, Wrench, MessageCircle } from 'lucide-react';
import GeminiChatBot from './GeminiChatBot';
import WorkshopAIBot from '../components/WorkshopAIBot';

const AIAssistantPage = () => {
  const [activeBot, setActiveBot] = useState('gemini'); // 'gemini' or 'workshop'

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-[20px] p-6 border border-[#D2D2D7] shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-semibold text-[#1D1D1F] tracking-tight">
              المساعدات الذكية
            </h1>
            <p className="text-[15px] text-[#86868B] mt-1">
              مساعدين AI متخصصين لخدمتك
            </p>
          </div>

          {/* Bot Selector */}
          <div className="flex gap-3">
            <button
              onClick={() => setActiveBot('gemini')}
              className={`px-6 py-3 rounded-[14px] transition-all flex items-center gap-3 ${
                activeBot === 'gemini'
                  ? 'bg-gradient-to-r from-[#007AFF] to-[#5856D6] text-white shadow-md'
                  : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E8E8ED]'
              }`}
            >
              <Sparkles size={20} />
              <div className="text-right">
                <div className="text-[15px] font-semibold">Gemini</div>
                <div className={`text-[12px] ${activeBot === 'gemini' ? 'opacity-90' : 'opacity-60'}`}>
                  ذكاء عام
                </div>
              </div>
            </button>

            <button
              onClick={() => setActiveBot('workshop')}
              className={`px-6 py-3 rounded-[14px] transition-all flex items-center gap-3 ${
                activeBot === 'workshop'
                  ? 'bg-gradient-to-r from-[#FF9500] to-[#FF6482] text-white shadow-md'
                  : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E8E8ED]'
              }`}
            >
              <Wrench size={20} />
              <div className="text-right">
                <div className="text-[15px] font-semibold">مساعد الورشة</div>
                <div className={`text-[12px] ${activeBot === 'workshop' ? 'opacity-90' : 'opacity-60'}`}>
                  تشخيص تقني
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Bot Content */}
      <div className="bg-white rounded-[20px] border border-[#D2D2D7] shadow-sm overflow-hidden" style={{ height: '700px' }}>
        {activeBot === 'gemini' ? (
          <GeminiChatBot />
        ) : (
          <WorkshopAIBot />
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[16px] p-6 border border-blue-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-500 rounded-[10px] flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <h3 className="text-[17px] font-semibold text-blue-900">Gemini AI</h3>
          </div>
          <p className="text-[14px] text-blue-800 leading-relaxed">
            مساعد ذكاء عام يستخدم Google Gemini 2.0. يجيب على جميع أسئلتك عن الورشة، الإدارة، والعمليات.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[12px]">محادثات طبيعية</span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[12px]">استشارات إدارية</span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[12px]">معلومات عامة</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-[16px] p-6 border border-orange-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-500 rounded-[10px] flex items-center justify-center">
              <Wrench size={20} className="text-white" />
            </div>
            <h3 className="text-[17px] font-semibold text-orange-900">مساعد الورشة</h3>
          </div>
          <p className="text-[14px] text-orange-800 leading-relaxed">
            مساعد تقني متخصص يفهم اللهجة السعودية. يشخص المشاكل ويعطي خطوات واضحة للفحص.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-[12px]">لهجة سعودية</span>
            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-[12px]">تشخيص سريع</span>
            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-[12px]">5 محركات</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantPage;