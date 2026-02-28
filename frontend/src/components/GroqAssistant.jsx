import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveBackendBase } from '../utils/backendBase';

const GroqAssistant = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const lang = i18n.language || (typeof window !== 'undefined' && localStorage.getItem('language')) || 'ar';
  const isRTL = lang === 'ar';

  const backendUrl =
    (typeof import.meta !== 'undefined' && import.meta.env && resolveBackendBase()) ||
    (typeof process !== 'undefined' && process.env && resolveBackendBase()) ||
    '';

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleSend = async (e) => {
    e && e.preventDefault();
    if (!input.trim() || !backendUrl) return;

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${backendUrl}/api/ai/groq-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage.content }),
      });

      if (!res.ok) {
        // حاول قراءة رسالة الخطأ من السيرفر لتوضيح سبب عدم الاستجابة
        const text = await res.text().catch(() => '');
        let detail = '';
        try {
          const parsed = JSON.parse(text);
          detail = parsed.detail || '';
        } catch (_) {
          detail = text;
        }

        if (detail.includes('GROQ_API_KEY is not configured')) {
          setError(
            lang === 'ar'
              ? 'المساعد غير مفعّل: يجب إعداد مفتاح GROQ_API_KEY في إعدادات الخادم.'
              : 'Assistant is not enabled: GROQ_API_KEY must be configured on the server.'
          );
        } else {
          setError(
            lang === 'ar'
              ? 'حدث خطأ أثناء الاتصال بالمساعد.'
              : 'An error occurred while contacting the assistant.'
          );
        }
        return;
      }

      const data = await res.json();
      const assistantMessage = { role: 'assistant', content: data.response };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Groq assistant error', err);
      setError(
        lang === 'ar'
          ? 'تعذّر الاتصال بالمساعد. تحقّق من الاتصال أو أعد المحاولة لاحقاً.'
          : 'Unable to reach the assistant. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={handleToggle}
        className={`fixed z-50 bottom-4 ${isRTL ? 'left-4' : 'right-4'} w-12 h-12 rounded-full bg-indigo-600 text-white shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors`}
        aria-label={lang === 'ar' ? 'المساعد الذكي' : 'AI assistant'}
      >
        <span className="font-semibold">AI</span>
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          className={`fixed z-50 bottom-20 ${isRTL ? 'left-4' : 'right-4'} w-80 max-h-[70vh] bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden`}
        >
          <div className="flex items-center justify-between px-3 py-2 bg-slate-900 text-white text-sm">
            <div className="flex flex-col">
              <span className="font-semibold">{lang === 'ar' ? 'مساعد الورشة الذكي' : 'Workshop AI Assistant'}</span>
              <span className="text-[11px] opacity-80">
                {lang === 'ar' ? 'اسأل عن أي شيء في الورشة' : 'Ask anything about the workshop'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggle}
              className="text-xs px-2 py-1 rounded hover:bg-slate-800"
            >
              {lang === 'ar' ? 'إغلاق' : 'Close'}
            </button>
          </div>

          <div className="flex-1 p-3 space-y-2 overflow-y-auto text-sm bg-slate-50">
            {messages.length === 0 && !error && (
              <div className="text-xs text-slate-500 text-center mt-4">
                {lang === 'ar'
                  ? 'ابدأ المحادثة بكتابة سؤالك عن السيارات أو إدارة الورشة.'
                  : 'Start by asking a question about vehicles or workshop management.'}
              </div>
            )}

            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : isRTL ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`px-3 py-2 rounded-2xl max-w-[85%] whitespace-pre-wrap text-[13px] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-800 border border-slate-200'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className={`flex ${isRTL ? 'justify-end' : 'justify-start'}`}>
                <div className="px-3 py-2 rounded-2xl bg-white border border-slate-200 text-[12px] text-slate-500">
                  {lang === 'ar' ? 'جاري التفكير…' : 'Thinking...'}
                </div>
              </div>
            )}

            {error && (
              <div className="text-[12px] text-red-600 text-center mt-2">{error}</div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="border-t border-slate-200 bg-white p-2 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                lang === 'ar' ? 'اكتب سؤالك هنا...' : 'Type your question here...'
              }
              className="flex-1 px-3 py-2 rounded-full border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-3 py-2 rounded-full bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {lang === 'ar' ? 'إرسال' : 'Send'}
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default GroqAssistant;