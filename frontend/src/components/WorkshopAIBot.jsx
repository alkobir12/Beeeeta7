import React, { useState, useEffect } from 'react';
import { Send, Wrench, User, Shield, Zap, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DEFAULT_DEV_PROMPT = `You are an Autonomous Full-Stack Startup Builder.

Your job:
Transform any startup idea into a complete, production-ready full-stack codebase using a standardized modern stack.

You do NOT produce vague architecture notes.
You produce structured, executable output.

======================================
STANDARD TECH STACK (NON-NEGOTIABLE)
======================================

Frontend:
- Next.js (App Router)
- TypeScript
- TailwindCSS

Backend:
- Next.js API routes
- Zod validation
- Service layer pattern

Database:
- PostgreSQL
- Prisma ORM

Auth:
- NextAuth

Payments:
- Stripe

Deployment:
- Vercel

======================================
OUTPUT FORMAT (MANDATORY)
======================================

When given an idea, respond with:

1. PRODUCT SUMMARY (clear and sharp)

2. MVP SCOPE
   - Must-have features
   - Explicitly excluded features

3. DATABASE SCHEMA (Prisma format)

4. PROJECT STRUCTURE (folder tree)

5. CORE FILES
   - package.json
   - prisma/schema.prisma
   - lib/db.ts
   - auth configuration
   - main API routes
   - example React pages
   - Stripe integration
   - middleware

6. ENV VARIABLES LIST

7. DEPLOYMENT STEPS
   - DB setup
   - Vercel deployment
   - Stripe setup
   - Production checklist

8. ITERATION MODE
   When user requests a change:
   - Identify impacted layers
   - Regenerate only affected files
   - Maintain architectural consistency

======================================
RULES
======================================

- Use clean architecture
- Keep MVP lean
- Avoid overengineering
- Code must be coherent and internally consistent
- Do not skip essential files
- Assume limited budget
- Default to subscription monetization unless specified

You are building real deployable systems.
Not prototypes.`;

const WorkshopAIBot = () => {
  const [mode, setMode] = useState('client'); // client, tech, admin
  const [message, setMessage] = useState('');
  const [engine, setEngine] = useState('');
  const [engines, setEngines] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('multi');
  const [developerMode, setDeveloperMode] = useState(false);
  const [developerPrompt, setDeveloperPrompt] = useState(DEFAULT_DEV_PROMPT);
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEngines();
    loadModels();
    addSystemMessage('مرحباً! أنا مساعدك الذكي للورشة. وش المشكلة في السيارة؟ 🚗');
  }, []);

  const loadEngines = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/workshop-bot/engines`);
      setEngines(data.engines || []);
    } catch (error) {
      console.error('Error loading engines:', error);
    }
  };

  const loadModels = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/workshop-bot/models`);
      const list = data.models || [];
      setModels(list);
      if (list.length > 0) {
        const preferred = list.find((m) => m.id === 'gpt-5.1') || list.find((m) => m.id === 'multi') || list[0];
        setSelectedModel(preferred.id);
      }
    } catch (error) {
      console.error('Error loading models:', error);
    }
  };

  const getModelLabel = (modelId) => models.find((m) => m.id === modelId)?.label || modelId || '';

  const promptPreview = developerMode
    ? `${developerPrompt}\n\nUSER REQUEST:\n${message || ''}`
    : '';

  const addSystemMessage = (text) => {
    setConversation(prev => [...prev, {
      type: 'bot',
      text,
      timestamp: new Date()
    }]);
  };

  const addUserMessage = (text) => {
    setConversation(prev => [...prev, {
      type: 'user',
      text,
      timestamp: new Date()
    }]);
  };

  const sendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = message;
    addUserMessage(userMessage);
    setMessage('');
    setLoading(true);

    try {
      const { data } = await axios.post(`${API_URL}/workshop-bot/respond`, {
        mode,
        message: userMessage,
        engine: engine || undefined,
        model: selectedModel,
        developer_mode: developerMode,
        developer_prompt: developerMode ? developerPrompt : undefined,
      });

      // Add bot response
      setConversation(prev => [...prev, {
        type: 'bot',
        text: data.reply,
        modelUsed: data.model_used,
        probable: data.probable,
        nextQuestion: data.next_question,
        confidence: data.confidence,
        status: data.status,
        timestamp: new Date()
      }]);

    } catch (error) {
      console.error('Error:', error);
      addSystemMessage('عذراً، حدث خطأ. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#F5F5F7]">
      {/* Header */}
      <div className="bg-white border-b border-[#D2D2D7] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-[11px] flex items-center justify-center shadow-sm">
              <Wrench size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-[#1D1D1F]">مساعد الورشة الذكي</h1>
              <p className="text-[13px] text-[#86868B]">تشخيص سريع باللهجة السعودية</p>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('client')}
              className={`px-4 py-2 rounded-[10px] text-[13px] font-medium transition-all ${
                mode === 'client'
                  ? 'bg-[#007AFF] text-white shadow-sm'
                  : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E8E8ED]'
              }`}
              data-testid="workshop-bot-mode-client"
            >
              <User size={16} className="inline mr-1" />
              عميل
            </button>
            <button
              onClick={() => setMode('tech')}
              className={`px-4 py-2 rounded-[10px] text-[13px] font-medium transition-all ${
                mode === 'tech'
                  ? 'bg-[#007AFF] text-white shadow-sm'
                  : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E8E8ED]'
              }`}
              data-testid="workshop-bot-mode-tech"
            >
              <Wrench size={16} className="inline mr-1" />
              فني
            </button>
            <button
              onClick={() => setMode('admin')}
              className={`px-4 py-2 rounded-[10px] text-[13px] font-medium transition-all ${
                mode === 'admin'
                  ? 'bg-[#007AFF] text-white shadow-sm'
                  : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E8E8ED]'
              }`}
              data-testid="workshop-bot-mode-admin"
            >
              <Shield size={16} className="inline mr-1" />
              إداري
            </button>
          </div>
        </div>

        {/* Engine Selector */}
        <div className="mt-4">
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value)}
            className="w-full md:w-auto px-4 py-2 bg-[#F5F5F7] border-0 rounded-[10px] text-[14px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:bg-white transition-all"
            data-testid="workshop-bot-engine-select"
          >
            <option value="">اختر نوع المحرك (اختياري)</option>
            {engines.map(eng => (
              <option key={eng.id} value={eng.id}>
                {eng.name} - {eng.name_ar}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full md:w-auto px-4 py-2 bg-[#F5F5F7] border-0 rounded-[10px] text-[14px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:bg-white transition-all"
            data-testid="workshop-bot-model-select"
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 rounded-[16px] bg-[#F5F5F7] p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[14px] font-semibold text-[#1D1D1F]">وضع المطوّر</div>
              <div className="text-[12px] text-[#6E6E73]">اكتب البرومبت الأساسي وسيتم دمجه مع طلب المستخدم</div>
            </div>
            <label className="flex items-center gap-2 text-[12px] text-[#1D1D1F]">
              <input
                type="checkbox"
                checked={developerMode}
                onChange={(e) => setDeveloperMode(e.target.checked)}
                data-testid="workshop-bot-developer-toggle"
              />
              تفعيل
            </label>
          </div>

          {developerMode && (
            <div className="mt-3 space-y-3">
              <textarea
                value={developerPrompt}
                onChange={(e) => setDeveloperPrompt(e.target.value)}
                className="w-full min-h-[160px] rounded-[12px] p-3 text-[12px] text-[#1D1D1F] border border-[#E5E5EA] bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                data-testid="workshop-bot-developer-prompt"
              />
              <textarea
                value={promptPreview}
                readOnly
                className="w-full min-h-[140px] rounded-[12px] p-3 text-[12px] text-[#1D1D1F] border border-[#E5E5EA] bg-[#FAFAFA]"
                data-testid="workshop-bot-prompt-preview"
              />
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {conversation.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[80%] ${msg.type === 'user' ? 'order-2' : ''}`}>
                {/* Message Bubble */}
                <div className={`rounded-[18px] px-5 py-3 ${
                  msg.type === 'user'
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-white border border-[#D2D2D7] text-[#1D1D1F]'
                }`}>
                  <p className="text-[15px] leading-[1.5] whitespace-pre-line">{msg.text}</p>

                  {msg.type !== 'user' && msg.modelUsed && (
                    <div
                      className="mt-2 text-[11px] text-[#007AFF]"
                      data-testid={`workshop-bot-model-${idx}`}
                    >
                      النموذج: {getModelLabel(msg.modelUsed)}
                    </div>
                  )}
                  
                  {/* Confidence Badge */}
                  {msg.confidence && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[#E8E8ED] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#34C759] rounded-full transition-all"
                          style={{ width: `${msg.confidence}%` }}
                        ></div>
                      </div>
                      <span className="text-[12px] opacity-70">{msg.confidence}% دقة</span>
                    </div>
                  )}

                  {/* Probable Causes */}
                  {msg.probable && msg.probable.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[#E8E8ED]">
                      <div className="text-[13px] font-semibold mb-2">الأسباب المحتملة:</div>
                      <div className="space-y-2">
                        {msg.probable.map((cause, i) => (
                          <div key={i} className="flex items-center justify-between text-[13px]">
                            <span>{cause.cause}</span>
                            <span className="px-2 py-1 bg-[#007AFF] bg-opacity-10 text-[#007AFF] rounded-md font-medium">
                              {cause.probability}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Next Question */}
                  {msg.nextQuestion && (
                    <div className="mt-3 pt-3 border-t border-[#E8E8ED] text-[13px] opacity-80">
                      <HelpCircle size={14} className="inline ml-1" />
                      {msg.nextQuestion}
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <div className={`text-[11px] text-[#86868B] mt-1 px-2 ${
                  msg.type === 'user' ? 'text-left' : 'text-right'
                }`}>
                  {new Date(msg.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-[#D2D2D7] px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="اكتب المشكلة... (مثال: السيارة تنتع وما تشد)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !loading && sendMessage()}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-[#F5F5F7] border-0 rounded-[12px] text-[15px] text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:bg-white transition-all disabled:opacity-50"
              data-testid="workshop-bot-message-input"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !message.trim()}
              className="px-6 py-3 bg-[#007AFF] hover:bg-[#0051D5] text-white rounded-[12px] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              data-testid="workshop-bot-send-button"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
          
          {/* Quick Examples */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setMessage('السيارة تنتع وما تشد')}
              className="px-3 py-1.5 bg-[#F5F5F7] hover:bg-[#E8E8ED] rounded-full text-[12px] text-[#1D1D1F] transition-all"
              data-testid="workshop-bot-example-1"
            >
              السيارة تنتع وما تشد
            </button>
            <button
              onClick={() => setMessage('فيه صفير من المحرك')}
              className="px-3 py-1.5 bg-[#F5F5F7] hover:bg-[#E8E8ED] rounded-full text-[12px] text-[#1D1D1F] transition-all"
              data-testid="workshop-bot-example-2"
            >
              فيه صفير من المحرك
            </button>
            <button
              onClick={() => setMessage('المحرك يحمو')}
              className="px-3 py-1.5 bg-[#F5F5F7] hover:bg-[#E8E8ED] rounded-full text-[12px] text-[#1D1D1F] transition-all"
              data-testid="workshop-bot-example-3"
            >
              المحرك يحمو
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkshopAIBot;
