import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { Brain, X, Send, Loader, Minimize2, Maximize2 } from 'lucide-react';
import { aiAPI } from '../services/api';

const AIHelper = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    const userMessage = { role: 'user', content: message };
    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setLoading(true);

    try {
      // Use enhanced AI endpoint
      const response = await aiAPI.enhancedChat(message, sessionId);
      
      if (!sessionId) {
        setSessionId(response.data.session_id);
      }

      const aiMessage = {
        role: 'assistant',
        content: response.data.response,
        knowledgeBaseUsed: response.data.knowledge_base_used,
        relevantSolutions: response.data.relevant_solutions
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('AI Error:', error);
      const errorMsg = {
        role: 'assistant',
        content: 'عذراً، حدث خطأ. الرجاء المحاولة مرة أخرى.'
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 left-6 z-50" dir="rtl">
        <Button
          onClick={() => setIsOpen(true)}
          className="h-16 w-16 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-110"
          title="المساعد الذكي"
        >
          <Brain size={28} className="text-white" />
        </Button>
        <div className="absolute -top-2 -right-2 h-4 w-4 bg-green-500 rounded-full animate-pulse" />
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-50" dir="rtl">
      <Card 
        className={`shadow-2xl border-2 border-purple-200 transition-all duration-300 ${
          isMinimized ? 'w-80 h-16' : 'w-96 h-[600px]'
        }`}
      >
        <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 cursor-pointer">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <Brain size={20} />
              </div>
              <div>
                <CardTitle className="text-base">المساعد الفني الذكي</CardTitle>
                <p className="text-xs text-purple-100">Claude AI - متصل</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => setIsOpen(false)}
              >
                <X size={16} />
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isMinimized && (
          <>
            <CardContent className="p-4 h-[440px] overflow-y-auto bg-slate-50">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Brain className="mx-auto mb-4 text-purple-600" size={48} />
                  <p className="mb-2 font-medium">مرحباً! كيف يمكنني مساعدتك؟</p>
                  <p className="text-sm">اسألني عن:</p>
                  <ul className="text-sm mt-2 space-y-1">
                    <li>• مشاكل السيارات وحلولها</li>
                    <li>• قطع الغيار المناسبة</li>
                    <li>• نصائح الصيانة</li>
                    <li>• أي استفسار فني</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] p-3 rounded-2xl ${
                          msg.role === 'user'
                            ? 'bg-purple-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-800'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-slate-200 p-3 rounded-2xl">
                        <Loader className="animate-spin text-purple-600" size={20} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>

            <div className="p-4 border-t bg-white">
              <div className="flex gap-2">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="اكتب سؤالك هنا..."
                  className="min-h-[60px] resize-none"
                  disabled={loading}
                />
                <Button
                  onClick={handleSend}
                  disabled={loading || !message.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Send size={20} />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default AIHelper;
