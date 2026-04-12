import React, { useMemo, useState } from 'react';
import { ArrowLeft, Bot, SendHorizontal, Sparkles } from 'lucide-react';
import { aiAPI } from '../services/api';

const createSessionId = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `liquid-builder-bot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
};

const loadingSteps = [
  'جار تحليل طلبك',
  'تحديد التفاصيل الرئيسية',
  'العثور على المعلومات ذات الصلة',
  'المراجعة بعد جمع المعلومات',
  'جار توليد الرد',
];

export const LiquidBuilderBotTab = ({ session, selectedPage, snapshot, onCustomizationReceived, onLocalCommand }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'مرحبًا، أنا مساعد Liquid Builder. اطلب تعديل الصفحة الحالية بلغة بسيطة وسأنفّذه أو أوجهك مباشرة.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => createSessionId());

  const sessionInfo = useMemo(() => ({
    role: String(session?.role || '').trim(),
    userId: String(session?.id || session?.userId || session?.name || 'manager').trim() || 'manager',
  }), [session]);

  const sendMessage = async (preset) => {
    const message = String(preset ?? input).trim();
    if (!message || loading) return;
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setInput('');
    setLoading(true);
    try {
      const localResult = await onLocalCommand?.(message);
      if (localResult?.handled) {
        setMessages((prev) => [...prev, { role: 'assistant', content: localResult.reply || 'تم تنفيذ الطلب.' }]);
        return;
      }

      const response = await aiAPI.alkabeerChat({
        message,
        sessionId,
        role: sessionInfo.role,
        userId: sessionInfo.userId,
        currentPath: selectedPage,
        uiSnapshot: snapshot,
      });

      const botText = response.data?.response || 'تم التنفيذ.';
      setMessages((prev) => [...prev, { role: 'assistant', content: botText }]);
      if (response.data?.customization) {
        onCustomizationReceived?.(response.data.customization);
      }
    } catch (error) {
      console.error('Liquid builder bot failed', error);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'تعذر تنفيذ الطلب الآن، حاول بصياغة أبسط.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="liquid-site-builder-bot-tab">
      <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            <Bot size={18} />
          </div>
          <div>
            <p className="text-base font-semibold text-zinc-900">Kodee Builder</p>
            <p className="text-xs text-zinc-500">الصفحة الحالية: {selectedPage}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3" data-testid="liquid-site-builder-bot-messages">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'} data-testid={`liquid-site-builder-bot-message-${index}`}>
            <div className={`max-w-[88%] rounded-[24px] px-4 py-3 text-sm leading-7 ${message.role === 'user' ? 'bg-zinc-100 text-zinc-900' : 'border border-zinc-200 bg-white text-zinc-800 shadow-sm'}`}>
              {message.content}
            </div>
          </div>
        ))}

        {loading ? (
          <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm" data-testid="liquid-site-builder-bot-loading-card">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-base font-semibold text-zinc-900">Kodee</p>
                <p className="text-xs text-zinc-500">جاري تنفيذ طلبك</p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-zinc-700">
              {loadingSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-2" data-testid={`liquid-site-builder-bot-loading-step-${index}`}>
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${index < loadingSteps.length - 1 ? 'bg-zinc-300' : 'bg-violet-500 animate-pulse'}`} />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2" data-testid="liquid-site-builder-bot-quick-actions">
        {[
          { label: 'اعرض لي كروت هذه الصفحة فقط', command: 'اعرض لي كروت هذه الصفحة فقط' },
          { label: 'اعرض لي عناصر هذه الصفحة', command: 'اعرض لي عناصر هذه الصفحة' },
          { label: 'تفعيل وضع المطور', command: 'rrr' },
          { label: 'الخروج من وضع المطور', command: 'EXIT' },
        ].map((item, index) => (
          <button key={item.label} type="button" onClick={() => sendMessage(item.command)} className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50" data-testid={`liquid-site-builder-bot-quick-${index}`}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="rounded-[30px] border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') sendMessage();
            }}
            placeholder="اكتب سؤالك أو طلبك هنا"
            className="flex-1 bg-transparent px-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            data-testid="liquid-site-builder-bot-input"
          />
          <button type="button" onClick={() => sendMessage()} disabled={loading || !input.trim()} className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white disabled:opacity-50" data-testid="liquid-site-builder-bot-send-button">
            <SendHorizontal size={16} />
          </button>
        </div>
      </div>

      <div className="rounded-[24px] border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-500 shadow-sm">
        اكتب طلبًا مركبًا مثل: <span className="font-medium text-zinc-800">انسخ تنسيق هذا الكرت إلى صفحة العملاء ثم اربطه بصافي الربح</span>
      </div>
    </div>
  );
};