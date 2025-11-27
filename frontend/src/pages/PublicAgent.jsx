import React, { useState, useRef, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { Send, Bot, User, ExternalLink } from 'lucide-react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GENSPARK_DIRECT_LINK = "https://www.genspark.ai/agent/fe62398f-faa9-4a8f-bae9-4d0b5dc25680";

const PublicAgent = () => {
  const { i18n } = useTranslation();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'مرحباً! كيف يمكنني مساعدتك اليوم؟' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [useIframe, setUseIframe] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

      const reply = res.data.response || 'عذراً، لم أتمكن من الرد.';
      if (res.data.session_id) {
        localStorage.setItem('genspark_session_id', res.data.session_id);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'حدث خطأ في الاتصال بالوكيل.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-4 sm:p-6 max-w-4xl h-[calc(100vh-100px)] flex flex-col">
        {/* Header with actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            {i18n.language === 'ar' ? 'وكيل الجمهور الذكي' : 'Smart Public Agent'}
          </h2>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="default"
              onClick={() => window.open(GENSPARK_DIRECT_LINK, '_blank')}
              size="sm"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
            >
              <ExternalLink size={16} className={i18n.language === 'ar' ? 'ml-2' : 'mr-2'} />
              {i18n.language === 'ar' ? 'فتح الوكيل الكامل' : 'Open Full Agent'}
            </Button> 
              variant="ghost"
              onClick={() => window.open(GENSPARK_DIRECT_LINK, '_blank')}
              size="sm"
            >
              <ExternalLink size={16} className="ml-1" />
              {i18n.language === 'ar' ? 'فتح خارجي' : 'Open External'}
            </Button>
          </div>
        </div>

        {useIframe ? (
          <Card className="flex-1 shadow-lg border-0 overflow-hidden">
            <iframe 
              src={GENSPARK_DIRECT_LINK}
              className="w-full h-full min-h-[500px]"
              title="Genspark Agent"
              allow="microphone"
            />
          </Card>
        ) : (
          <Card className="flex-1 flex flex-col shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg py-3 sm:py-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Bot className="h-5 w-5 sm:h-6 sm:w-6" />
                {i18n.language === 'ar' ? 'وكيل الجمهور الذكي' : 'Smart Public Agent'}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden bg-slate-50 dark:bg-slate-900">
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'
                      }`}>
                        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                      </div>
                      <div className={`p-3 rounded-lg max-w-[80%] text-sm leading-relaxed shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border dark:border-slate-700 rounded-tl-none'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Bot size={16} />
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border dark:border-slate-700 rounded-tl-none shadow-sm">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              <div className="p-3 sm:p-4 bg-white dark:bg-slate-800 border-t dark:border-slate-700">
                <form 
                  onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                  className="flex gap-2"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={i18n.language === 'ar' ? 'اكتب رسالتك هنا...' : 'Type your message here...'}
                    className="flex-1"
                    disabled={loading}
                  />
                  <Button type="submit" disabled={loading || !input.trim()} className="bg-blue-600 hover:bg-blue-700">
                    <Send size={18} className={i18n.dir() === 'rtl' ? 'rotate-180' : ''} />
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default PublicAgent;
