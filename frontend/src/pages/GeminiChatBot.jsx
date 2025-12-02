import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Bot, Send, Trash2, Sparkles, MessageSquare, Loader } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const GeminiChatBot = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [botInfo, setBotInfo] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    startNewConversation();
    checkBotHealth();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const checkBotHealth = async () => {
    try {
      const res = await axios.get(`${API_URL}/gemini-chat/health`);
      setBotInfo(res.data);
    } catch (e) {
      console.error('Failed to check bot health:', e);
    }
  };

  const startNewConversation = async () => {
    try {
      const res = await axios.post(`${API_URL}/gemini-chat/start`);
      setConversationId(res.data.conversation_id);
      setMessages([
        {
          role: 'bot',
          content: res.data.welcome_message,
          timestamp: new Date().toISOString()
        }
      ]);
    } catch (e) {
      toast({
        title: 'خطأ',
        description: 'فشل بدء المحادثة',
        variant: 'destructive'
      });
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/gemini-chat/chat`, {
        message: inputMessage,
        conversation_id: conversationId
      });

      const botMessage = {
        role: 'bot',
        content: res.data.response,
        timestamp: res.data.timestamp
      };

      setMessages(prev => [...prev, botMessage]);
      setConversationId(res.data.conversation_id);
    } catch (e) {
      console.error('Chat error:', e);
      toast({
        title: 'خطأ',
        description: e.response?.data?.detail || 'فشل إرسال الرسالة',
        variant: 'destructive'
      });

      // Remove user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = async () => {
    if (conversationId) {
      try {
        await axios.delete(`${API_URL}/gemini-chat/clear/${conversationId}`);
      } catch (e) {
        console.error('Failed to clear conversation:', e);
      }
    }
    await startNewConversation();
    toast({
      title: 'تم المسح',
      description: 'تم بدء محادثة جديدة'
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Bot className="text-white" size={28} />
            </div>
            <span>المساعد الذكي</span>
          </h1>
          <p className="text-gray-500 mt-2 mr-15">
            بوت ذكي متطور يعمل بتقنية Google Gemini 2.0 Flash ✨
          </p>
        </div>
        {botInfo?.api_key_configured && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <Sparkles size={16} />
            <span>متصل</span>
          </div>
        )}
      </div>

      {/* Chat Container */}
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare size={20} className="text-blue-600" />
              <span>المحادثة</span>
            </CardTitle>
            <Button
              onClick={clearConversation}
              variant="outline"
              size="sm"
              className="text-red-600 hover:bg-red-50"
            >
              <Trash2 size={16} className="ml-2" />
              مسح المحادثة
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] p-4 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-100 text-gray-900 rounded-bl-none border border-gray-200'
                }`}
              >
                {msg.role === 'bot' && (
                  <div className="flex items-center gap-2 mb-2 text-blue-600">
                    <Bot size={16} />
                    <span className="text-xs font-semibold">مساعد ذكي</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                <div
                  className={`text-xs mt-2 ${
                    msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString('ar-SA', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 p-4 rounded-2xl rounded-bl-none border border-gray-200">
                <div className="flex items-center gap-2 text-gray-600">
                  <Loader className="animate-spin" size={16} />
                  <span className="text-sm">جاري الكتابة...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input Area */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex gap-3">
            <Input
              type="text"
              placeholder="اكتب رسالتك هنا..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              className="flex-1 text-lg"
            />
            <Button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || loading}
              className="bg-blue-600 hover:bg-blue-700 px-6"
            >
              <Send size={20} className="ml-2" />
              إرسال
            </Button>
          </div>
        </div>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Sparkles className="text-blue-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">ذكاء صناعي متقدم</h3>
              <p className="text-sm text-gray-600">
                يعمل بتقنية Gemini 2.0 Flash من Google
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="text-green-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">محادثة طبيعية</h3>
              <p className="text-sm text-gray-600">
                يفهم العربية والإنجليزية بطلاقة
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bot className="text-purple-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">مساعد شامل</h3>
              <p className="text-sm text-gray-600">
                يساعدك في استفساراتك عن الصيانة والورشة
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GeminiChatBot;
