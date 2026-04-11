import React from 'react';
import { MessageSquarePlus, Shield, Wrench, UserRound, Sparkles, Trash2 } from 'lucide-react';

const modeItems = [
  { id: 'admin', label: 'إداري', icon: Shield },
  { id: 'tech', label: 'فني', icon: Wrench },
  { id: 'client', label: 'عميل', icon: UserRound },
  { id: 'unified', label: 'موحّد', icon: Sparkles },
];

const formatTime = (value) => {
  if (!value) return 'الآن';
  return new Date(value).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
};

export const WorkshopBotSidebar = ({ summary, currentMode, onModeChange, conversations, currentSessionId, onNewChat, onSelectConversation, onDeleteConversation }) => {
  return (
    <aside className="flex h-full flex-col border-l border-white/10 bg-slate-950/80" data-testid="workshop-bot-sidebar">
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white" data-testid="workshop-bot-sidebar-title">ورشة الذكاء</p>
            <p className="mt-1 text-xs text-slate-400" data-testid="workshop-bot-sidebar-summary">{summary?.total_skills || 0} مهارة • {summary?.total_prompts || 0} برومبت</p>
          </div>
          <button type="button" onClick={onNewChat} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/15 text-cyan-100 transition hover:bg-cyan-500/25" data-testid="workshop-bot-new-chat-button">
            <MessageSquarePlus size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-white/10 p-4" data-testid="workshop-bot-mode-grid">
        {modeItems.map((item) => {
          const Icon = item.icon;
          const active = currentMode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onModeChange(item.id)}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm transition ${active ? 'bg-cyan-500 text-slate-950' : 'bg-white/5 text-slate-200 hover:bg-white/10'}`}
              data-testid={`workshop-bot-sidebar-mode-${item.id}`}
            >
              <Icon size={15} />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-3" data-testid="workshop-bot-conversations-list">
        {conversations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-xs text-slate-400" data-testid="workshop-bot-conversations-empty">
            لا توجد جلسات محفوظة بعد. ابدأ رسالة جديدة ليتم حفظها هنا.
          </div>
        ) : conversations.map((conversation, index) => {
          const active = conversation.id === currentSessionId;
          return (
            <div key={conversation.id} className={`mb-2 rounded-2xl border p-3 transition ${active ? 'border-cyan-400/30 bg-cyan-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`} data-testid={`workshop-bot-conversation-row-${index}`}>
              <button type="button" onClick={() => onSelectConversation(conversation.id)} className="w-full text-right" data-testid={`workshop-bot-conversation-select-${index}`}>
                <p className="text-sm font-medium text-white" data-testid={`workshop-bot-conversation-title-${index}`}>{conversation.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-400" data-testid={`workshop-bot-conversation-preview-${index}`}>{conversation.last_message || 'بدون رسائل بعد'}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span data-testid={`workshop-bot-conversation-count-${index}`}>{conversation.message_count || 0} رسالة</span>
                  <span data-testid={`workshop-bot-conversation-time-${index}`}>{formatTime(conversation.updated_at)}</span>
                </div>
              </button>
              <button type="button" onClick={() => onDeleteConversation(conversation.id)} className="mt-2 inline-flex items-center gap-1 text-[11px] text-rose-200 transition hover:text-rose-100" data-testid={`workshop-bot-conversation-delete-${index}`}>
                <Trash2 size={12} /> حذف
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
};