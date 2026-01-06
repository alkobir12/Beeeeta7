import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, X, Paperclip, Minimize2 } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DieselExpertChat = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: isArabic 
        ? 'مرحباً! أنا خبير صيانة الديزل. كيف يمكنني مساعدتك؟ 🔧'
        : 'Hello! I\'m a diesel maintenance expert. How can I help you? 🔧'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = files.map(file => ({
      file,
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file)
    }));
    setAttachments([...attachments, ...newAttachments]);
  };

  const removeAttachment = (index) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    setAttachments(newAttachments);
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || loading) return;

    const userMessage = input.trim() || (attachments.length > 0 ? `[${attachments.length} ملف مرفق]` : '');
    setInput('');
    
    let messageContent = userMessage;
    if (attachments.length > 0) {
      messageContent += `\n\n[المرفقات: ${attachments.map(a => a.name).join(', ')}]`;
    }
    
    const newMessages = [...messages, { role: 'user', content: messageContent }];
    setMessages(newMessages);
    setAttachments([]);
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/diesel-chat`, {
        messages: newMessages.slice(1)
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

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 left-6 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-gradient-to-r from-blue-600 via-green-600 to-yellow-700 text-white rounded-full p-3 shadow-2xl hover:scale-105 transition-transform"
        >
          <div className="flex items-center gap-2">
            <img 
              src="https://www.genspark.ai/api/files/s/owCUM0vz" 
              alt="Expert"
              className="w-8 h-8 rounded-full border-2 border-white"
            />
            <span className="text-sm font-bold">خبير الديزل</span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl h-[600px] flex flex-col overflow-hidden">
        {/* Header - Very Compact */}
        <div className="bg-gradient-to-r from-blue-600 via-green-600 to-yellow-700 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <img 
                src="https://www.genspark.ai/api/files/s/owCUM0vz" 
                alt="Diesel Expert"
                className="w-8 h-8 rounded-full border-2 border-white"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border border-white animate-pulse"></div>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">
                {isArabic ? 'خبير الديزل 24/7' : 'Diesel Expert 24/7'}
              </h2>
              <p className="text-xs text-white/70 leading-tight">
                {isArabic ? 'تويوتا • إيسوزو • ميتسوبيشي' : 'Toyota • Isuzu • Mitsubishi'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="text-white/80 hover:text-white p-1 rounded transition-colors"
              title={isArabic ? 'تصغير' : 'Minimize'}
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate(-1)}
              className="text-white/80 hover:text-white p-1 rounded transition-colors"
              title={isArabic ? 'إغلاق' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages - Scrollable */}
        <div className="flex-1 overflow-y-auto px-3 py-3 bg-gray-900/50">
          <div className="space-y-2">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <img 
                    src="https://www.genspark.ai/api/files/s/owCUM0vz" 
                    alt="Expert"
                    className="w-6 h-6 rounded-full border border-blue-300 flex-shrink-0"
                  />
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                      : 'bg-gray-800 text-gray-100 border border-gray-700'
                  }`}
                >
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex gap-2 justify-start">
                <img 
                  src="https://www.genspark.ai/api/files/s/owCUM0vz" 
                  alt="Expert"
                  className="w-6 h-6 rounded-full border border-blue-300"
                />
                <div className="bg-gray-800 rounded-lg px-3 py-2 border border-gray-700">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">{isArabic ? 'جاري التحليل...' : 'Analyzing...'}</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Attachments Preview - Very Compact */}
        {attachments.length > 0 && (
          <div className="border-t border-gray-700 bg-gray-900/80 px-3 py-1.5">
            <div className="flex gap-1.5 flex-wrap">
              {attachments.map((att, idx) => (
                <div key={idx} className="relative bg-gray-800 rounded p-1.5 border border-gray-700 flex items-center gap-1.5">
                  {att.type.startsWith('image/') ? (
                    <img src={att.url} alt={att.name} className="w-8 h-8 object-cover rounded" />
                  ) : (
                    <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center">
                      <Paperclip className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                  <span className="text-xs text-gray-300 max-w-[80px] truncate">{att.name}</span>
                  <button onClick={() => removeAttachment(idx)} className="text-red-400 hover:text-red-300">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input - Very Compact */}
        <div className="border-t border-gray-700 bg-gray-900/80 px-3 py-2">
          <div className="flex gap-2 items-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800/50 text-gray-300 rounded-lg p-1.5 transition-colors"
              title={isArabic ? 'إرفاق ملف' : 'Attach file'}
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isArabic ? 'اكتب سؤالك... (P0087، ضغط وقود)' : 'Ask... (P0087, fuel pressure)'}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && attachments.length === 0) || loading}
              className="bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-700 disabled:to-gray-800 text-white rounded-lg px-3 py-1.5 transition-all disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DieselExpertChat;

const DieselExpertChat = () => {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: isArabic 
        ? 'مرحباً! أنا خبير صيانة الديزل. كيف يمكنني مساعدتك؟ 🔧'
        : 'Hello! I\'m a diesel maintenance expert. How can I help you? 🔧'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = files.map(file => ({
      file,
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file)
    }));
    setAttachments([...attachments, ...newAttachments]);
  };

  const removeAttachment = (index) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    setAttachments(newAttachments);
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || loading) return;

    const userMessage = input.trim() || (attachments.length > 0 ? `[${attachments.length} ملف مرفق]` : '');
    setInput('');
    
    // Build message with attachments info
    let messageContent = userMessage;
    if (attachments.length > 0) {
      messageContent += `\n\n[المرفقات: ${attachments.map(a => a.name).join(', ')}]`;
    }
    
    // Add user message
    const newMessages = [...messages, { role: 'user', content: messageContent }];
    setMessages(newMessages);
    setAttachments([]);
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
      {/* Header - Compact */}
      <div className="bg-gradient-to-r from-blue-600 via-green-600 to-yellow-700 shadow-lg">
        <div className="max-w-4xl mx-auto px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <img 
                src="https://www.genspark.ai/api/files/s/owCUM0vz" 
                alt="Diesel Expert"
                className="w-9 h-9 rounded-full border-2 border-white shadow-lg"
              />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-base font-bold text-white">
                {isArabic ? 'خبير صيانة الديزل 24/7' : 'Diesel Expert 24/7'}
              </h1>
              <p className="text-xs text-white/80">
                {isArabic ? 'تويوتا • إيسوزو • ميتسوبيشي' : 'Toyota • Isuzu • Mitsubishi'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages - Compact */}
      <div className="flex-1 overflow-y-auto px-3 py-4 max-w-4xl mx-auto w-full">
        <div className="space-y-3">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0">
                  <img 
                    src="https://www.genspark.ai/api/files/s/owCUM0vz" 
                    alt="Expert"
                    className="w-7 h-7 rounded-full border border-blue-300"
                  />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-xl px-3 py-2 ${
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
            <div className="flex gap-2 justify-start">
              <div className="flex-shrink-0">
                <img 
                  src="https://www.genspark.ai/api/files/s/owCUM0vz" 
                  alt="Expert"
                  className="w-7 h-7 rounded-full border border-blue-300"
                />
              </div>
              <div className="bg-gray-800 rounded-xl px-3 py-2 border border-gray-700">
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

      {/* Attachments Preview - Compact */}
      {attachments.length > 0 && (
        <div className="border-t border-gray-700 bg-gray-900/95">
          <div className="max-w-4xl mx-auto px-3 py-2">
            <div className="flex gap-2 flex-wrap">
              {attachments.map((att, idx) => (
                <div key={idx} className="relative bg-gray-800 rounded-lg p-2 border border-gray-700 flex items-center gap-2">
                  {att.type.startsWith('image/') ? (
                    <img src={att.url} alt={att.name} className="w-10 h-10 object-cover rounded" />
                  ) : (
                    <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center">
                      <Paperclip className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <span className="text-xs text-gray-300 max-w-[100px] truncate">{att.name}</span>
                  <button
                    onClick={() => removeAttachment(idx)}
                    className="text-red-400 hover:text-red-300 ml-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input - Compact */}
      <div className="border-t border-gray-700 bg-gray-900/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-3 py-2">
          <div className="flex gap-2 items-end">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800/50 text-gray-300 rounded-lg p-2 transition-all disabled:cursor-not-allowed"
              title={isArabic ? 'إرفاق ملف' : 'Attach file'}
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
            />
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isArabic ? 'اكتب سؤالك... (P0087، ضغط وقود، تيربو)' : 'Type your question... (P0087, fuel pressure, turbo)'}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
              rows="1"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && attachments.length === 0) || loading}
              className="bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-700 disabled:to-gray-800 text-white rounded-lg px-4 py-2 flex items-center justify-center transition-all shadow-lg disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1 text-center">
            {isArabic 
              ? 'خبير متخصص • متاح 24/7 • يدعم الصور والملفات'
              : 'Diesel Expert • 24/7 • Supports images & files'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default DieselExpertChat;
