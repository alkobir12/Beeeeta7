import React, { useState, useRef, useEffect } from 'react';
import Layout from '../components/Layout';
import { ScrollArea } from '../components/ui/scroll-area';
import { Send, Bot, User } from 'lucide-react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PublicAgent = () => {
  const { i18n } = useTranslation();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: i18n.language === 'ar' ? 'مرحباً! كيف يمكنني مساعدتك اليوم؟' : 'Hello! How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/public-agent/chat`, {
        message: input,
        sessionId: localStorage.getItem('genspark_session_id') || undefined
      });
      const reply = res.data.response || (i18n.language === 'ar' ? 'عذراً، لم أتمكن من الرد.' : 'Sorry, I could not respond.');
      if (res.data.session_id) localStorage.setItem('genspark_session_id', res.data.session_id);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: i18n.language === 'ar' ? 'خطأ في الاتصال' : 'Connection error' }]);
    } finally { setLoading(false); }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto h-[calc(100vh-100px)] flex flex-col">
        <div className="flex items-center justify-between mb-6 pt-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">الوكيل الذكي</h1>
            <p className="text-gray-500 mt-1">مساعدك الشخصي للإجابة على الاستفسارات</p>
          </div>
        </div>

        <div className="apple-card flex-1 flex flex-col overflow-hidden border-0 shadow-xl">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50" ref={scrollRef}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-indigo-600 border border-indigo-100'
                }`}>
                  {msg.role === 'user' ? <User size={20} /> : <Bot size={24} />}
                </div>
                <div className={`p-4 rounded-2xl max-w-[80%] text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-white text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0 shadow-sm">
                  <Bot size={24} />
                </div>
                <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></span>
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 bg-white border-t border-gray-100">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="اكتب رسالتك هنا..."
                className="apple-input h-12 px-4 bg-gray-50 border-transparent focus:bg-white"
                disabled={loading}
              />
              <button 
                type="submit" 
                disabled={loading || !input.trim()}
                className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-md hover:shadow-lg"
              >
                <Send size={20} className={i18n.dir() === 'rtl' ? 'rotate-180' : ''} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PublicAgent;
