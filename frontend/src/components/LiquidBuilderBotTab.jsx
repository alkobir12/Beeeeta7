import React, { useMemo, useState } from 'react';
import { Bot, SendHorizontal } from 'lucide-react';
import { aiAPI } from '../services/api';

const createSessionId = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `liquid-builder-bot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
};

export const LiquidBuilderBotTab = ({ session, selectedPage, snapshot, onCustomizationReceived }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'أنا بوت الـ Liquid Builder. اكتب rrr أو اطلب تعديلًا مباشرًا على الصفحة المختارة.' },
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
      setMessages((prev) => [...prev, { role: 'assistant', content: 'تعذر تنفيذ الطلب الآن.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="liquid-site-builder-bot-tab">
      <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white"><Bot size={15} /> بوت Liquid Builder</div>
        <div className="max-h-[340px] space-y-2 overflow-y-auto" data-testid="liquid-site-builder-bot-messages">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`rounded-2xl px-3 py-2 text-sm ${message.role === 'assistant' ? 'bg-slate-900 text-slate-100' : 'bg-cyan-500/15 text-cyan-50'}`} data-testid={`liquid-site-builder-bot-message-${index}`}>
              {message.content}
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendMessage(); }} placeholder="اكتب أمر rrr أو طلب تعديل..." className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none" data-testid="liquid-site-builder-bot-input" />
          <button type="button" onClick={() => sendMessage()} disabled={loading || !input.trim()} className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400 text-slate-950 disabled:opacity-50" data-testid="liquid-site-builder-bot-send-button">
            <SendHorizontal size={15} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" data-testid="liquid-site-builder-bot-quick-actions">
        {['rrr', 'EXIT', 'اخف كرت صافي الربح', 'غير اسم زر تحديث إلى مزامنة'].map((item, index) => (
          <button key={item} type="button" onClick={() => sendMessage(item)} className="rounded-full border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-100" data-testid={`liquid-site-builder-bot-quick-${index}`}>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
};