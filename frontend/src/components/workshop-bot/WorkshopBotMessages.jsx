import React from 'react';
import { Sparkles, UserRound } from 'lucide-react';

const quickPrompts = [
  'السيارة تنتع وما تشد',
  'فيه صفير من المحرك',
  'أحتاج تقرير إداري سريع',
  'كم تكلفة صيانة كاملة تقريبًا؟',
];

const timeLabel = (value) => new Date(value || Date.now()).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

export const WorkshopBotMessages = ({ messages, loading, onQuickPrompt, currentMode, selectedSkillsCount }) => {
  return (
    <div className="flex h-full flex-col" data-testid="workshop-bot-messages-shell">
      <div className="border-b border-white/10 px-5 py-4" data-testid="workshop-bot-chat-header">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white" data-testid="workshop-bot-chat-title">ذكاء الورشة بأسلوب محادثة حديث</h2>
            <p className="mt-1 text-sm text-slate-400" data-testid="workshop-bot-chat-subtitle">جلسات محفوظة، أوضاع متعددة، ومهارات قابلة للتفعيل بدون تكرار.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-cyan-100" data-testid="workshop-bot-chat-mode-badge">الوضع: {currentMode}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300" data-testid="workshop-bot-chat-skills-badge">المهارات المفعلة: {selectedSkillsCount}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5" data-testid="workshop-bot-messages-panel">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-3xl rounded-[28px] border border-white/10 bg-white/5 p-6 text-right" data-testid="workshop-bot-empty-state">
            <p className="text-xl font-semibold text-white">مرحبًا 👋</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">ابدأ من تشخيص فني، سؤال عميل، أو طلب إداري — وسأبدّل النبرة تلقائيًا حسب السياق.</p>
            <div className="mt-5 flex flex-wrap gap-2" data-testid="workshop-bot-quick-prompts">
              {quickPrompts.map((prompt, index) => (
                <button key={prompt} type="button" onClick={() => onQuickPrompt(prompt)} className="rounded-full border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 transition hover:border-cyan-300/40 hover:bg-cyan-500/10" data-testid={`workshop-bot-quick-prompt-${index}`}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-4">
            {messages.map((message, index) => {
              const isUser = message.role === 'user';
              return (
                <div key={`${message.created_at || index}-${index}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`} data-testid={`workshop-bot-message-row-${index}`}>
                  <div className={`max-w-[82%] rounded-[24px] border px-4 py-3 ${isUser ? 'border-cyan-400/20 bg-cyan-500/15 text-cyan-50' : 'border-white/10 bg-slate-900/80 text-slate-100'}`} data-testid={`workshop-bot-message-bubble-${index}`}>
                    <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
                      {isUser ? <UserRound size={12} /> : <Sparkles size={12} />}
                      <span data-testid={`workshop-bot-message-role-${index}`}>{isUser ? 'أنت' : 'ورشة الذكاء'}</span>
                      <span data-testid={`workshop-bot-message-time-${index}`}>{timeLabel(message.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-7" data-testid={`workshop-bot-message-content-${index}`}>{message.content}</p>
                    {message.model ? <p className="mt-2 text-[11px] text-cyan-200" data-testid={`workshop-bot-message-model-${index}`}>النموذج: {message.model}</p> : null}
                  </div>
                </div>
              );
            })}

            {loading ? (
              <div className="flex justify-start" data-testid="workshop-bot-typing-row">
                <div className="rounded-[22px] border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-300" data-testid="workshop-bot-typing-indicator">
                  جاري التحليل...
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};