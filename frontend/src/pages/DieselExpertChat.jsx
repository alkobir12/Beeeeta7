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
          className="bg-gradient-to-r from-emergent-green via-emergent-green to-emergent-green-dark text-emergent-black rounded-full p-3 shadow-glow-lg hover:scale-105 transition-transform animate-glow-pulse"
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="bg-gradient-to-br from-emergent-black via-emergent-dark to-emergent-black rounded-2xl shadow-2xl border border-border w-full max-w-2xl h-[600px] flex flex-col overflow-hidden">
        {/* Header - Emergent Style */}
        <div className="bg-gradient-to-r from-emergent-green/90 via-emergent-green to-emergent-green/90 px-3 py-2 flex items-center justify-between shadow-glow">
          <div className="flex items-center gap-2">
            <div className="relative">
              <img 
                src="https://www.genspark.ai/api/files/s/owCUM0vz" 
                alt="Diesel Expert"
                className="w-8 h-8 rounded-full border-2 border-white"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-white rounded-full border border-emergen t-green animate-glow-pulse"></div>
            </div>
            <div>
              <h2 className="text-sm font-bold text-emergent-black leading-tight">
                {isArabic ? 'خبير الديزل 24/7' : 'Diesel Expert 24/7'}
              </h2>
              <p className="text-xs text-emergent-black/70 leading-tight">
                {isArabic ? 'تويوتا • إيسوزو • ميتسوبيشي' : 'Toyota • Isuzu • Mitsubishi'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="text-emergent-black/80 hover:text-emergent-black p-1 rounded transition-colors"
              title={isArabic ? 'تصغير' : 'Minimize'}
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate(-1)}
              className="text-emergent-black/80 hover:text-emergent-black p-1 rounded transition-colors"
              title={isArabic ? 'إغلاق' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages - Scrollable */}
        <div className="flex-1 overflow-y-auto px-3 py-3 bg-emergent-black">
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
                    className="w-6 h-6 rounded-full border border-emergent-green flex-shrink-0 shadow-glow-sm"
                  />
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-emergent-green to-emergent-green-dark text-emergent-black shadow-glow'
                      : 'bg-emergent-dark text-foreground border border-border'
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
                  className="w-6 h-6 rounded-full border border-emergent-green shadow-glow-sm"
                />
                <div className="bg-emergent-dark rounded-lg px-3 py-2 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-emergent-green" />
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
          <div className="border-t border-border bg-emergent-dark px-3 py-1.5">
            <div className="flex gap-1.5 flex-wrap">
              {attachments.map((att, idx) => (
                <div key={idx} className="relative bg-emergent-gray rounded p-1.5 border border-border flex items-center gap-1.5 hover:border-primary transition-colors">
                  {att.type.startsWith('image/') ? (
                    <img src={att.url} alt={att.name} className="w-8 h-8 object-cover rounded" />
                  ) : (
                    <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                      <Paperclip className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-xs text-foreground max-w-[80px] truncate">{att.name}</span>
                  <button onClick={() => removeAttachment(idx)} className="text-destructive hover:text-destructive/80">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input - Very Compact */}
        <div className="border-t border-border bg-emergent-dark px-3 py-2">
          <div className="flex gap-2 items-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="bg-emergent-gray hover:bg-muted disabled:bg-emergent-gray/50 text-foreground rounded-lg p-1.5 transition-colors hover:shadow-glow-sm"
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
              className="flex-1 bg-input border border-border rounded-lg px-3 py-1.5 text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && attachments.length === 0) || loading}
              className="bg-gradient-to-br from-emergent-green to-emergent-green-dark hover:shadow-glow disabled:from-muted disabled:to-muted text-emergent-black rounded-lg px-3 py-1.5 transition-all disabled:cursor-not-allowed font-medium"
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
