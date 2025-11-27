import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Brain, Send, Loader, ArrowRight, Sparkles } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { aiAPI } from '../services/api';
import Layout from '../components/Layout';
import { useTranslation } from 'react-i18next';

const AIAssistant = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: t('ai.welcomeMessage') || 'مرحباً! أنا مساعد الذكاء الاصطناعي الخاص بورشتك. يمكنني مساعدتك في:\n\n• إيجاد حلول للمشاكل الميكانيكية\n• البحث عن قطع الغيار\n• تقديم نصائح الصيانة\n• الإجابة على الاستفسارات الفنية\n\nكيف يمكنني مساعدتك اليوم؟'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;

    const userMessage = { role: 'user', content: question };
    setMessages(prev => [...prev, userMessage]);
    setQuestion('');
    setIsLoading(true);

    try {
      const response = await aiAPI.chat(question, sessionId);
      
      if (!sessionId && response.data.sessionId) {
        setSessionId(response.data.sessionId);
      }

      const aiResponse = {
        role: 'assistant',
        content: response.data.response
      };
      
      setMessages(prev => [...prev, aiResponse]);
      
    } catch (error) {
      console.error('AI Error:', error);
      toast({
        title: t('common.error'),
        description: t('ai.connectionError') || 'حدث خطأ في الاتصال بالمساعد الذكي. الرجاء المحاولة مرة أخرى.',
        variant: 'destructive'
      });
      
      // Remove user message on error
      setMessages(prev => prev.slice(0, -1));
      setQuestion(question); // Restore question
      
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen" dir={i18n.dir()}>
        <div className="container mx-auto p-6 max-w-4xl">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-gradient-to-br from-purple-600 to-purple-700 p-3 rounded-full">
                  <Brain className="text-white" size={28} />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-slate-800">{t('nav.aiAssistant')}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Sparkles className="text-purple-600" size={16} />
                    <p className="text-slate-600">{t('ai.poweredBy')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Container */}
          <Card className="shadow-xl mb-6" style={{ height: 'calc(100vh - 300px)' }}>
            <CardHeader className="bg-gradient-to-l from-purple-50 to-transparent border-b">
              <CardTitle className="flex items-center gap-2 text-purple-900">
                <div className="bg-purple-600 p-2 rounded-full">
                  <Brain className="text-white" size={20} />
                </div>
                {t('ai.assistantTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto" style={{ height: 'calc(100% - 80px)' }}>
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-3xl p-4 rounded-2xl shadow-md ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-800 border border-slate-200'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-end">
                    <div className="bg-white text-slate-800 border border-slate-200 p-4 rounded-2xl shadow-md flex items-center gap-3">
                      <Loader className="animate-spin text-purple-600" size={20} />
                      <span className="text-purple-600">{t('ai.thinking')}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Input Form */}
          <Card className="shadow-xl">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="flex gap-4">
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t('ai.placeholder')}
                  className="flex-1 min-h-24 border-slate-300 focus:border-purple-500 transition-colors resize-none"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  disabled={isLoading || !question.trim()}
                  className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-8 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Send className="ml-2" size={20} />
                  {t('common.send')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default AIAssistant;