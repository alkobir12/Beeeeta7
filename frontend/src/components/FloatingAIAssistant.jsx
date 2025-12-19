import React, { useState } from 'react';
import { MessageCircle, X, Send, Minimize2, Maximize2 } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FloatingAIAssistant = ({ context = 'general', contextData = {} }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(false);

  // Context-specific prompts
  const contextPrompts = {
    operations: {
      title: 'مساعد التحليل المالي',
      icon: '💰',
      placeholder: 'اسأل عن التحليل المالي أو العمليات...',
      examples: [
        'كم إجمالي المبيعات هذا الشهر؟',
        'وش أكثر خدمة مربحة؟',
        'عندي عجز مالي، وش الحل؟'
      ]
    },
    catalog: {
      title: 'مساعد حل المشاكل',
      icon: '🔧',
      placeholder: 'اكتب المشكلة التقنية...',
      examples: [
        'السيارة تنتع وما تشد',
        'فيه صفير من التيربو',
        'المحرك يحمو'
      ]
    },
    vehicles: {
      title: 'مساعد المركبات',
      icon: '🚗',
      placeholder: 'اسأل عن المركبات أو الصيانة...',
      examples: [
        'كم مركبة في الورشة؟',
        'وش المركبات الجاهزة؟',
        'متى موعد تسليم المركبة؟'
      ]
    },
    general: {
      title: 'المساعد الذكي',
      icon: '🤖',
      placeholder: 'اكتب سؤالك هنا...',
      examples: [
        'كيف استقبل مركبة جديدة؟',
        'كيف أضيف خدمة؟',
        'كيف أطبع فاتورة؟'
      ]
    }
  };

  const currentContext = contextPrompts[context] || contextPrompts.general;

  const sendMessage = async () => {
    if (!message.trim() || loading) return;

    const userMessage = message;
    setConversation(prev => [...prev, { type: 'user', text: userMessage }]);
    setMessage('');
    setLoading(true);

    try {
      // Use different endpoint based on context
      let response;
      
      if (context === 'catalog') {
        // Use Workshop Bot for technical issues
        response = await axios.post(`${API_URL}/workshop-bot/respond`, {
          mode: 'tech',
          message: userMessage,
          engine: contextData.engine
        });
      } else {
        // Use Gemini for other contexts
        response = await axios.post(`${API_URL}/gemini-chat/chat`, {
          message: userMessage,
          context: context,
          contextData: contextData
        });
      }

      setConversation(prev => [...prev, {
        type: 'bot',
        text: response.data.reply || response.data.response,
        probable: response.data.probable,
        confidence: response.data.confidence
      }]);

    } catch (error) {
      console.error('Error:', error);
      setConversation(prev => [...prev, {
        type: 'bot',
        text: 'عذراً، حدث خطأ. حاول مرة أخرى.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 w-14 h-14 bg-[#007AFF] hover:bg-[#0051D5] text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-40"
        title={currentContext.title}
      >
        <MessageCircle size={24} />
      </button>
    );
  }

  return (
    <div className={`fixed ${isExpanded ? 'inset-4' : 'bottom-6 left-6 w-[400px] h-[600px]'} bg-white rounded-[20px] shadow-2xl border border-[#D2D2D7] z-40 flex flex-col transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#D2D2D7] bg-gradient-to-r from-[#007AFF] to-[#5856D6] text-white rounded-t-[20px]">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{currentContext.icon}</span>
          <div>
            <h3 className="text-[16px] font-semibold">{currentContext.title}</h3>
            <p className="text-[12px] opacity-80">اسأل أي سؤال</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-8 h-8 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors flex items-center justify-center"
          >
            {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {conversation.length === 0 && (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">{currentContext.icon}</div>
            <p className="text-[14px] text-[#86868B] mb-4">جرب أحد الأمثلة:</p>
            <div className="space-y-2">
              {currentContext.examples.map((ex, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setMessage(ex);
                    setTimeout(() => sendMessage(), 100);
                  }}
                  className="w-full px-4 py-2 bg-[#F5F5F7] hover:bg-[#E8E8ED] rounded-[12px] text-[13px] text-[#1D1D1F] text-right transition-all"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {conversation.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] rounded-[16px] px-4 py-3 ${
              msg.type === 'user'
                ? 'bg-[#007AFF] text-white'
                : 'bg-[#F5F5F7] text-[#1D1D1F]'
            }`}>
              <p className="text-[14px] leading-[1.5] whitespace-pre-line">{msg.text}</p>
              
              {msg.probable && (
                <div className="mt-3 pt-3 border-t border-white border-opacity-20 space-y-2">
                  {msg.probable.map((cause, i) => (
                    <div key={i} className="flex items-center justify-between text-[12px]">
                      <span>{cause.cause}</span>
                      <span className="px-2 py-0.5 bg-white bg-opacity-20 rounded-md">
                        {cause.probability}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-end">
            <div className="bg-[#F5F5F7] rounded-[16px] px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-[#86868B] rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-[#86868B] rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-[#86868B] rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[#D2D2D7]">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={currentContext.placeholder}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-[#F5F5F7] border-0 rounded-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:bg-white transition-all"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !message.trim()}
            className="w-10 h-10 bg-[#007AFF] hover:bg-[#0051D5] text-white rounded-[12px] transition-all disabled:opacity-50 flex items-center justify-center shadow-sm"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingAIAssistant;
