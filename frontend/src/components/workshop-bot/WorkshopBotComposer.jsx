import React from 'react';
import { SendHorizontal } from 'lucide-react';

export const WorkshopBotComposer = ({ value, onChange, onSend, loading }) => {
  return (
    <div className="border-t border-white/10 bg-slate-950/80 px-5 py-4" data-testid="workshop-bot-composer">
      <div className="mx-auto flex max-w-4xl gap-3 rounded-[26px] border border-white/10 bg-white/5 p-3">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          rows={2}
          placeholder="اكتب سؤالك أو وصف المشكلة..."
          className="min-h-[56px] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
          data-testid="workshop-bot-composer-input"
        />
        <button type="button" onClick={onSend} disabled={loading || !String(value || '').trim()} className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500 text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50" data-testid="workshop-bot-composer-send-button">
          <SendHorizontal size={18} />
        </button>
      </div>
    </div>
  );
};