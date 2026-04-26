/* eslint-disable */
import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLocation } from 'react-router-dom';
import { Brain, Loader2, Paperclip, Send, X } from 'lucide-react';
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
  const [findings, setFindings] = useState([]);
  const [selectedEvidenceFile, setSelectedEvidenceFile] = useState(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

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

  const fetchFindings = async () => {
    try {
      const params = new URLSearchParams({
        workshop_id: process.env.REACT_APP_WORKSHOP_ID || 'finmodule-sync',
      });
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/finance/alerts?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      const alerts = json?.data?.alerts || [];
      const mapped = alerts.map((a) => ({
        finding_id: a.id,
        title: a.title,
        account: selectedAccountCode || '',
        period: 'current',
        actual_value: a.message || '',
        expected_range: '',
        severity: a.severity || 'medium',
        confidence: 0.9,
        related_accounts: [],
        operation_refs: [],
        message: a.action || a.message || '',
      }));
      setFindings(mapped);
    } catch {
      setFindings([]);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    loadChatFromStorage();
    // do not block opening
    fetchAccounts();
    fetchFindings();
    // eslint-disable-next-line
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchFindings();
    // eslint-disable-next-line
  }, [selectedAccountCode]);

  const uploadEvidence = async (file, sessionIdForUpload, findingId) => {
    const form = new FormData();
    form.append('file', file);
    form.append('session_id', sessionIdForUpload);
    if (findingId) form.append('finding_id', findingId);

    const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/finance-bot/evidence/upload`, {
      method: 'POST',
      body: form,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.success === false) {
      throw new Error(json?.detail || json?.error || 'تعذر رفع المرفق');
    }
    return json?.data;
  };

  const actionLabelMap = {
    open_investigation:   '🔍 فتح التحقيق',
    apply_suggested_fix:  '✅ تطبيق المعالجة',
    view_evidence:        '📎 عرض الأدلة',
    escalate:             '⚠️ تصعيد للمحاسب',
  };

  const stateLabels = {
    open:             'مفتوحة',
    probing:          'قيد التحقيق',
    pending_evidence: 'بانتظار مستند',
    resolved:         'محلولة',
    escalated:        'مصعّدة',
  };

  const stateBadgeColor = {
    open:             'bg-slate-600/60 text-slate-200',
    probing:          'bg-blue-600/40 text-blue-200',
    pending_evidence: 'bg-amber-600/40 text-amber-200',
    resolved:         'bg-emerald-600/40 text-emerald-200',
    escalated:        'bg-red-600/40 text-red-200',
  };

  // أزرار سياقية بناءً على الحالة الحالية
  const contextualActions = (state) => {
    if (state === 'open')             return ['open_investigation'];
    if (state === 'probing')          return ['apply_suggested_fix', 'view_evidence', 'escalate'];
    if (state === 'pending_evidence') return ['apply_suggested_fix', 'view_evidence', 'escalate'];
    if (state === 'resolved')         return [];
    if (state === 'escalated')        return [];
    return ['open_investigation'];
  };

  const runInteractiveAction = async (action, assistantMsg) => {
    if (!action) return;
    setChatLoading(true);
    try {
      const currentSessionId = conversationId || (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      let uploadedEvidence = null;
      if (selectedEvidenceFile) {
        setUploadingEvidence(true);
        uploadedEvidence = await uploadEvidence(selectedEvidenceFile, currentSessionId, assistantMsg?.findingId || undefined);
      }

      const payload = {
        message: actionLabelMap[action] || action,
        action,
        target_finding_id: assistantMsg?.findingId,
        session_id: currentSessionId,
        workshop_id: process.env.REACT_APP_WORKSHOP_ID,
        account_code: selectedAccountCode || undefined,
        conversation_id: conversationId || currentSessionId,
        findings,
        evidence_id: uploadedEvidence?.evidence_id,
        evidence_name: uploadedEvidence?.file_name,
      };

      const res = await aiAPI.financeBotChat(payload);
      const userActionMsg = { role: 'user', content: `إجراء: ${actionLabelMap[action] || action}` };
      const botMsg = {
        role: 'assistant',
        content: res.data?.response || t('abu_fahad.no_response'),
        findingId: res.data?.finding_id,
        state: res.data?.state || res.data?.finding_status,
        interactive: res.data?.interactive || null,
        linkedData: res.data?.linked_data || null,
        contradictions: res.data?.contradictions || null,
        autoEscalated: res.data?.auto_escalated || false,
        sessionId: res.data?.session_id,
      };

      const newId = res.data?.session_id || res.data?.conversation_id || conversationId || currentSessionId;
      const next = [...chatHistory, userActionMsg, botMsg];
      setChatHistory(next);
      if (newId && newId !== conversationId) setConversationId(newId);
      persistChatToStorage(next, newId);
      setSelectedEvidenceFile(null);
    } catch (err) {
      toast({ title: t('common.error'), description: err?.response?.data?.detail || t('abu_fahad.connection_error') });
    } finally {
      setUploadingEvidence(false);
      setChatLoading(false);
    }
  };

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
      const currentSessionId = conversationId || (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      let uploadedEvidence = null;
      if (selectedEvidenceFile) {
        setUploadingEvidence(true);
        uploadedEvidence = await uploadEvidence(selectedEvidenceFile, currentSessionId, undefined);
      }

      const payload = {
        message: userText,
        session_id: currentSessionId,
        workshop_id: process.env.REACT_APP_WORKSHOP_ID,
        account_code: selectedAccountCode || undefined,
        conversation_id: conversationId || currentSessionId,
        findings: findings,
        evidence_id: uploadedEvidence?.evidence_id,
        evidence_name: uploadedEvidence?.file_name,
      };

      const res = await aiAPI.financeBotChat(payload);
      const botMsg = {
        role: 'assistant',
        content: res.data?.response || t('abu_fahad.no_response'),
        findingId: res.data?.finding_id,
        state: res.data?.state || res.data?.finding_status,
        interactive: res.data?.interactive || null,
        linkedData: res.data?.linked_data || null,
        contradictions: res.data?.contradictions || null,
        autoEscalated: res.data?.auto_escalated || false,
        sessionId: res.data?.session_id,
      };

      const newId = res.data?.session_id || res.data?.conversation_id || conversationId || currentSessionId;
      const next = [...optimistic, botMsg];
      setChatHistory(next);
      if (newId && newId !== conversationId) setConversationId(newId);
      persistChatToStorage(next, newId);
      setSelectedEvidenceFile(null);
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
      setUploadingEvidence(false);
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
    setSelectedEvidenceFile(null);
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
        <div className="w-[92vw] max-w-[380px] sm:w-[380px] h-[78vh] max-h-[620px] sm:h-[520px] rounded-2xl border border-slate-800 bg-slate-950/95 backdrop-blur shadow-2xl overflow-hidden">
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
            <div className="h-[calc(78vh-250px)] min-h-[180px] sm:h-[310px] overflow-y-auto rounded-lg bg-slate-900/60 border border-slate-800 p-2 space-y-2 text-xs">
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
                      {msg?.state ? (
                        <div className="mt-1.5 flex items-center gap-2" data-testid={`finance-bot-msg-state-${idx}`}>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stateBadgeColor[msg.state] || 'bg-slate-600/60 text-slate-200'}`}>
                            {stateLabels[msg.state] || msg.state}
                          </span>
                          {msg.state === 'pending_evidence' && (
                            <span className="text-[10px] text-amber-300 animate-pulse">
                              ← أرفق مستنداً عبر زر المشبك
                            </span>
                          )}
                        </div>
                      ) : null}

                      {/* ─── التناقضات المكتشفة ─── */}
                      {msg?.contradictions?.length > 0 && (
                        <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/8 p-2 space-y-1" data-testid={`finance-bot-contradictions-${idx}`}>
                          <div className="text-[10px] font-semibold text-amber-300">تناقضات مرصودة ({msg.contradictions.length})</div>
                          {msg.contradictions.slice(0, 3).map((c, ci) => (
                            <div key={ci} className="text-[10px] text-amber-200">• {c.description}</div>
                          ))}
                        </div>
                      )}

                      {/* ─── القيود المرتبطة ─── */}
                      {msg?.linkedData?.journal_entries?.length > 0 && (
                        <div className="mt-2 rounded-lg border border-sky-500/25 bg-sky-500/6 p-2" data-testid={`finance-bot-linked-${idx}`}>
                          <div className="text-[10px] font-semibold text-sky-300 mb-1">
                            قيود مرتبطة ({msg.linkedData.journal_entries.length})
                          </div>
                          {msg.linkedData.journal_entries.slice(0, 3).map((je, ji) => (
                            <div key={ji} className="text-[10px] text-sky-200 flex justify-between">
                              <span>{je.description?.slice(0, 30) || je.account_name}</span>
                              <span className="opacity-70">{je.date?.slice(0, 10)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ─── زر تقرير التصعيد ─── */}
                      {(msg?.state === 'escalated' || msg?.autoEscalated) && msg?.sessionId && (
                        <a
                          href={`${process.env.REACT_APP_BACKEND_URL}/api/finance-bot/sessions/${msg.sessionId}/report?workshop_id=${process.env.REACT_APP_WORKSHOP_ID || 'finmodule-sync'}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1 text-[10px] text-red-300 hover:bg-red-500/20"
                          data-testid={`finance-bot-escalation-report-${idx}`}
                        >
                          تقرير التصعيد الكامل
                        </a>
                      )}

                      {/* ─── أزرار الإجراء السياقية ─── */}
                      {(() => {
                        const actions = contextualActions(msg?.state);
                        if (!actions.length) return null;
                        // فقط آخر رسالة bot تحمل الأزرار
                        const isLast = chatHistory.slice(idx + 1).every(m => m.role !== 'assistant');
                        if (!isLast) return null;
                        return (
                          <div className="mt-2 flex flex-wrap gap-1.5" data-testid={`finance-bot-action-card-${idx}`}>
                            {actions.map((action) => (
                              <button
                                key={`${idx}-${action}`}
                                type="button"
                                onClick={() => runInteractiveAction(action, msg)}
                                disabled={chatLoading}
                                className="rounded-lg border border-slate-600 bg-slate-800/60 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-700 hover:border-slate-500 active:scale-95 transition-all disabled:opacity-40"
                                data-testid={`finance-bot-action-${action}-${idx}`}
                              >
                                {actionLabelMap[action] || action}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
              <label
                htmlFor="finance-bot-evidence-input"
                className="h-9 w-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200 cursor-pointer"
                data-testid="finance-bot-evidence-picker-button"
                title="إرفاق مستند"
              >
                {uploadingEvidence ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </label>
              <input
                id="finance-bot-evidence-input"
                type="file"
                className="hidden"
                onChange={(e) => setSelectedEvidenceFile(e.target.files?.[0] || null)}
                data-testid="finance-bot-evidence-file-input"
              />

              <input
                type="text"
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                placeholder={t('abu_fahad.placeholder')}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={chatLoading || uploadingEvidence}
                className="h-9 w-9 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white disabled:opacity-50"
              >
                {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>

            {selectedEvidenceFile ? (
              <div className="mt-2 text-[11px] text-emerald-300" data-testid="finance-bot-selected-evidence-name">
                مرفق جاهز للإرسال: {selectedEvidenceFile.name}
              </div>
            ) : null}

            <div className="mt-2 text-[11px] text-slate-400">{t('abu_fahad.latency_note')}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AbuFahadFloatingChat;
