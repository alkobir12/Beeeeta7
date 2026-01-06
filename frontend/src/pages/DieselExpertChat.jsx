import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Bot } from 'lucide-react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DieselExpertChat = () => {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: isArabic 
        ? 'مرحباً! أنا خبير صيانة الديزل المتخصص في تويوتا، إيسوزو، وميتسوبيشي. كيف يمكنني مساعدتك اليوم؟ 🔧'
        : 'Hello! I\'m a diesel maintenance expert specializing in Toyota, Isuzu, and Mitsubishi. How can I help you today? 🔧'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/diesel-chat`, {
        messages: newMessages.slice(1) // Exclude initial welcome message
      });

      if (response.data.success) {
        setMessages([...newMessages, {
          role: 'assistant',
          content: response.data.response
        }]);
      } else {
        throw new Error('Failed to get response');
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages([...newMessages, {
        role: 'assistant',
        content: isArabic 
          ? 'عذراً، حدث خطأ. الرجاء المحاولة مرة أخرى.'
          : 'Sorry, an error occurred. Please try again.'
      }]);
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

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-green-600 to-yellow-700 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img 
                src="https://www.genspark.ai/api/files/s/owCUM0vz" 
                alt="Diesel Expert"
                className="w-12 h-12 rounded-full border-2 border-white shadow-lg"
              />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                {isArabic ? 'خبير صيانة الديزل 24/7' : 'Diesel Maintenance Expert 24/7'}
              </h1>
              <p className="text-sm text-white/80">
                {isArabic ? 'تويوتا • إيسوزو • ميتسوبيشي' : 'Toyota • Isuzu • Mitsubishi'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl mx-auto w-full">
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0">
                  <img 
                    src="https://www.genspark.ai/api/files/s/owCUM0vz" 
                    alt="Expert"
                    className="w-8 h-8 rounded-full border border-blue-300"
                  />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg'
                    : 'bg-gray-800 text-gray-100 shadow-md border border-gray-700'
                }`}
              >
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0">
                <img 
                  src="https://www.genspark.ai/api/files/s/owCUM0vz" 
                  alt="Expert"
                  className="w-8 h-8 rounded-full border border-blue-300"
                />
              </div>
              <div className="bg-gray-800 rounded-2xl px-4 py-3 border border-gray-700">
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">
                    {isArabic ? 'جاري التحليل...' : 'Analyzing...'}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-700 bg-gray-900/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isArabic ? 'اكتب سؤالك هنا... (مثال: كود P0087، ضغط الوقود، مشاكل التيربو)' : 'Type your question... (e.g., P0087 code, fuel pressure, turbo issues)'}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows="2"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-700 disabled:to-gray-800 text-white rounded-xl px-6 py-3 flex items-center justify-center transition-all shadow-lg disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            {isArabic 
              ? 'خبير متخصص في الديزل • متاح 24/7 • إجابات فورية'
              : 'Diesel Expert • Available 24/7 • Instant Answers'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default DieselExpertChat;
