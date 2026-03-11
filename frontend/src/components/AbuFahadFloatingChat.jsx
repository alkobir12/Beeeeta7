/* eslint-disable */
import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLocation } from 'react-router-dom';
import { Brain, Loader2, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../hooks/use-toast';
import { Button } from './ui/button';
import { aiAPI, financeAPI } from '../services/api';

const STORAGE_KEYS = {
  conversationId: 'finance_bot_session_id',
  history: 'finance_bot_chat_history_v1',
};

const AbuFahadFloatingChat = ({
  enabledPaths = ['/operations', '/accounting/chart-of-accounts', '/accounting/comprehensive'],
}) => {
  const location = useLocation();
  const path = location.pathname || '';
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isRTL = i18n.language === 'ar';

  const enabled = useMemo(() => {
    // exact match only (to avoid showing in unrelated pages)
    return enabledPaths.includes(path);
  }, [enabledPaths, path]);

  const [isOpen, setIsOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatQuery, setChatQuery] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountCode, setSelectedAccountCode] = useState('');

  const [conversationId, setConversationId] = useState('');
  const [chatHistory, setChatHistory] = useState([
    {
      role: 'assistant',
      content: t('abu_fahad.greeting'),
    },
  ]);

  const persistChatToStorage = (nextHistory, nextConversationId) => {
    try {
      localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(nextHistory));
    } catch (e) {}

    try {
      if (nextConversationId) {
        localStorage.setItem(STORAGE_KEYS.conversationId, nextConversationId);
      }
    } catch (e) {}
  };

  const loadChatFromStorage = () => {
    try {
      const storedId = localStorage.getItem(STORAGE_KEYS.conversationId);
      if (storedId) setConversationId(storedId);
    } catch (e) {}

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.history);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          setChatHistory(parsed);
        }
      }
    } catch (e) {}
  };

  const fetchAccounts = async () => {
    try {
      const res = await financeAPI.getChartOfAccounts();
      const data = res.data?.data ?? res.data?.accounts ?? res.data;
      setAccounts(Array.isArray(data) ? data : []);
    } catch (e) {
      setAccounts([]);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    loadChatFromStorage();
    // do not block opening
    fetchAccounts();
    // eslint-disable-next-line
  }, [enabled]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!chatQuery.trim()) return;

    const userText = chatQuery;
    const userMsg = { role: 'user', content: userText };

    const optimistic = [...chatHistory, userMsg];
    setChatHistory(optimistic);
    setChatQuery('');
    setChatLoading(true);

    try {
      const payload = {
        message: userText,
        workshop_id: process.env.REACT_APP_WORKSHOP_ID,
        account_code: selectedAccountCode || undefined,
        conversation_id: conversationId || undefined,
      };

      const res = await aiAPI.financeBotChat(payload);
      const botMsg = {
        role: 'assistant',
        content: res.data?.response || t('abu_fahad.no_response'),
      };

      const newId = res.data?.conversation_id || conversationId;
      const next = [...optimistic, botMsg];
      setChatHistory(next);
      if (newId && newId !== conversationId) setConversationId(newId);
      persistChatToStorage(next, newId);
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message;
      const errorText = detail
        ? `${t('abu_fahad.connection_error')}\n${t('abu_fahad.details')}: ${detail}`
        : t('abu_fahad.connection_error');

      toast({
        title: t('common.error'),
        description: t('abu_fahad.connection_error'),
      });

      const next = [...optimistic, { role: 'assistant', content: errorText }];
      setChatHistory(next);
      persistChatToStorage(next, conversationId);
    } finally {
      setChatLoading(false);
    }
  };

  const clearChat = () => {
    const next = [
      {
        role: 'assistant',
        content: t('abu_fahad.new_chat_greeting'),
      },
    ];
    setChatHistory(next);
    setConversationId('');
    setSelectedAccountCode('');
    persistChatToStorage(next, '');
  };

  if (!enabled) return null;

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Floating button */}
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 shadow-xl ring-1 ring-blue-500/30 hover:scale-105 transition-transform flex items-center justify-center"
          aria-label={t('abu_fahad.open_chat')}
        >
          <Brain className="h-6 w-6 text-white" />
        </button>
      ) : null}

      {/* Chat panel */}
      {isOpen ? (
        <div className="w-[92vw] max-w-[380px] sm:w-[380px] h-[70vh] sm:h-[520px] rounded-2xl border border-slate-800 bg-slate-950/95 backdrop-blur shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Brain className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-100">{t('abu_fahad.title')}</div>
                <div className="text-[11px] text-slate-400">{t('abu_fahad.subtitle')}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="h-8" onClick={clearChat}>
                {t('abu_fahad.new_chat')}
              </Button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 rounded-xl hover:bg-slate-800 flex items-center justify-center"
                aria-label={t('buttons.close')}
              >
                <X className="h-4 w-4 text-slate-300" />
              </button>
            </div>
          </div>

          <div className="px-4 py-3">
            <label className="block text-xs font-medium text-slate-300 mb-1">{t('abu_fahad.account_optional')}</label>
            <select
              value={selectedAccountCode}
              onChange={(e) => setSelectedAccountCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">{t('abu_fahad.no_account')}</option>
              {(Array.isArray(accounts) ? accounts : []).map((acc) => (
                <option key={acc.id || acc.code} value={acc.code}>
                  {acc.code} - {acc.name_ar || acc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="px-4 pb-3">
            <div className="h-[310px] overflow-y-auto rounded-lg bg-slate-900/60 border border-slate-800 p-2 space-y-2 text-xs">
              {chatHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg px-2 py-1.5 whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-500/10 text-blue-100 ml-6 text-right'
                      : 'bg-slate-800/80 text-slate-100 mr-6 text-right'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                placeholder={t('abu_fahad.placeholder')}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={chatLoading}
                className="h-9 w-9 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white disabled:opacity-50"
              >
                {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>

            <div className="mt-2 text-[11px] text-slate-400">{t('abu_fahad.latency_note')}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AbuFahadFloatingChat;
