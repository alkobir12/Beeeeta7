import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, X, Loader2, ClipboardList, FileText, Receipt, Send, Wrench, Bot, AlertCircle } from 'lucide-react';
import { aiAPI, vehicleAPI, API_BASE } from '../services/api';
import QuickPrintDialog from './QuickPrintDialog';
import { ArchiveSearchPanel } from './workshop-bot/ArchiveSearchPanel';
import { ArchiveVisitResultCard } from './workshop-bot/ArchiveVisitResultCard';

const INITIAL_CHAT_MESSAGES = [
  { role: 'assistant', content: 'يا هلا! أنا أبو فهد، مدير خدمة العملاء. آمرني وش بغيت؟' },
];

const createWorkshopBotSessionId = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `workshop-bot-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const ARCHIVE_INTENT_HINTS = [
  'آخر زيارة',
  'اخر زيارة',
  'تفاصيل آخر زيارة',
  'تفاصيل الزيارة',
  'لوحة',
  'لوحه',
  'مركبة',
  'مركبه',
  'سيارة',
  'سياره',
  'العميل',
  'اسم العميل',
  'الأرشيف',
  'الارشيف',
  'ابحث',
  'بحث',
];

const isArchiveIntent = (value) => {
  const text = String(value || '').trim();
  if (!text) return false;
  const hasHint = ARCHIVE_INTENT_HINTS.some((hint) => text.includes(hint));
  const hasDigits = /[0-9٠-٩]{3,}/.test(text);
  const hasVehicleWords = /(لوحه|لوحة|مركبه|مركبة|سياره|سيارة|عميل|زيارة|زياره)/.test(text);
  return hasHint || (hasDigits && hasVehicleWords);
};

// ويدجت مساعد الورشة الذكي العائم - تصميم Dark/Glass مطابق لثيم الموقع
const ChatWidget = () => {
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const archiveLookupTimerRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('chat'); // 'chat' | 'diagnosis' | 'technical' | 'invoice'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printDialogConfig, setPrintDialogConfig] = useState(null);
  
  // بيانات التشخيص
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [symptoms, setSymptoms] = useState('');
  
  // المحادثة الحرة (أبو فهد)
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState(INITIAL_CHAT_MESSAGES);
  const [chatSessionId, setChatSessionId] = useState(() => {
    if (typeof window === 'undefined') return createWorkshopBotSessionId();
    const existing = window.localStorage.getItem('workshop-bot-session-id');
    if (existing) return existing;
    const generated = createWorkshopBotSessionId();
    window.localStorage.setItem('workshop-bot-session-id', generated);
    return generated;
  });
  const [archiveQuery, setArchiveQuery] = useState('');
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [archiveResults, setArchiveResults] = useState([]);
  const [selectedArchiveResult, setSelectedArchiveResult] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !chatSessionId) return;
    window.localStorage.setItem('workshop-bot-session-id', chatSessionId);
  }, [chatSessionId]);

  const resetChatSession = useCallback(() => {
    const nextSessionId = createWorkshopBotSessionId();
    setChatSessionId(nextSessionId);
    setMessages(INITIAL_CHAT_MESSAGES);
    setArchiveQuery('');
    setArchiveError('');
    setArchiveResults([]);
    setSelectedArchiveResult(null);
  }, []);

  // عند فتح الودجت لأول مرة: جلب قائمة المركبات
  useEffect(() => {
    if (!isOpen) return;

    const fetchMeta = async () => {
      try {
        const [vehiclesRes] = await Promise.all([
          vehicleAPI.getAll(),
        ]);
        setVehicles(vehiclesRes.data || []);
      } catch (e) {
        console.error('Workshop AI meta error', e);
      }
    };

    fetchMeta();
  }, [isOpen]);

  // التمرير التلقائي لآخر رسالة
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, mode]);

  const runArchiveLookup = useCallback(async (rawQuery, options = {}) => {
    const query = String(rawQuery || '').trim();
    if (!query) {
      setArchiveResults([]);
      setSelectedArchiveResult(null);
      setArchiveError('');
      return null;
    }

    const { appendToChat = false, silent = false } = options;

    if (!silent) {
      setArchiveLoading(true);
    }
    setArchiveError('');

    try {
      const { data } = await vehicleAPI.archiveSearch(query, 5);
      const results = Array.isArray(data?.results) ? data.results : [];
      const bestMatch = data?.bestMatch || results[0] || null;

      setArchiveResults(results);
      setSelectedArchiveResult(bestMatch);

      if (appendToChat) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: bestMatch?.responseText || 'ما لقيت زيارة سابقة مطابقة لهذا البحث. جرّب الاسم أو اللوحة بشكل أقصر.',
            archiveResult: bestMatch,
          },
        ]);
      }

      if (!bestMatch && !silent) {
        setArchiveError('ما لقيت نتيجة مطابقة. جرّب اللوحة أو اسم العميل بشكل أقصر.');
      }

      return bestMatch;
    } catch (lookupError) {
      console.error('Archive lookup error', lookupError);
      const message = 'تعذر تنفيذ البحث الأرشيفي الآن. حاول مرة أخرى بعد قليل.';
      setArchiveError(message);
      if (appendToChat) {
        setMessages((prev) => [...prev, { role: 'assistant', content: message }]);
      }
      return null;
    } finally {
      setArchiveLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || mode !== 'chat') return undefined;
    const query = archiveQuery.trim();

    if (query.length < 2) {
      setArchiveResults([]);
      setArchiveError('');
      if (!query) {
        setSelectedArchiveResult(null);
      }
      return undefined;
    }

    archiveLookupTimerRef.current = window.setTimeout(() => {
      runArchiveLookup(query, { silent: true });
    }, 350);

    return () => {
      if (archiveLookupTimerRef.current) {
        window.clearTimeout(archiveLookupTimerRef.current);
      }
    };
  }, [archiveQuery, isOpen, mode, runArchiveLookup]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      if (isArchiveIntent(userMsg)) {
        await runArchiveLookup(userMsg, { appendToChat: true });
        return;
      }

      // إرسال الرسالة إلى أبو فهد (AlKabeer Bot)
      const res = await aiAPI.alkabeerChat({ message: userMsg, sessionId: chatSessionId });
      
      const botResponse = res.data.response;
      const isDevMode = res.data.mode === 'dev';
      if (res.data.sessionId) {
        setChatSessionId(res.data.sessionId);
      }
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: botResponse,
        isDev: isDevMode
      }]);

    } catch (e) {
      console.error('Chat error', e);
      setMessages(prev => [...prev, { role: 'assistant', content: 'المعذرة، صار عندي مشكلة بسيطة. حاول مرة ثانية لا هنت.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleRunDiagnosis = async () => {
    if (!selectedVehicleId && !symptoms.trim()) {
      setError('اختر مركبة أو اكتب الأعراض أولاً.');
      return;
    }

    setLoading(true);
    setError('');
    
    // إضافة طلب التشخيص كرسالة مستخدم
    let vehicle = null;
    if (selectedVehicleId) {
      vehicle = vehicles.find((v) => v.id === selectedVehicleId) || null;
    }
    
    const userText = `تشخيص عطل:\nالمركبة: ${vehicle ? `${vehicle.brand} ${vehicle.model}` : 'غير محدد'}\nالأعراض: ${symptoms}`;
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setMode('chat'); // التحويل لوضع الشات لعرض النتيجة

    try {
      const message = `تشخيص عطل:
      المركبة: ${vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : 'غير محددة'}
      الوقود: ${vehicle?.fuelType || 'غير محدد'}
      الأعراض: ${symptoms || 'لا توجد أعراض مذكورة'}
      
      يرجى تحليل المشكلة واقتراح الحلول وقطع الغيار المناسبة حسب خبرتك يا أبو فهد.`;

      const res = await aiAPI.alkabeerChat({ message, sessionId: chatSessionId });
      if (res.data.sessionId) {
        setChatSessionId(res.data.sessionId);
      }
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.response }]);
      setSymptoms(''); // مسح الحقل بعد الإرسال
    } catch (e) {
      console.error('Diagnosis error', e);
      setMessages(prev => [...prev, { role: 'assistant', content: 'واجهت مشكلة أثناء التشخيص. يرجى المحاولة لاحقاً.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveSearch = async () => {
    await runArchiveLookup(archiveQuery, { silent: false });
  };

  // تحديد المركبة الحالية من عنوان الصفحة
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const currentVehicleIdFromPath = useMemo(() => {
    const match = currentPath.match(/^\/vehicle\/(.+)$/);
    return match ? match[1] : '';
  }, [currentPath]);

  const currentVehicle = useMemo(
    () => vehicles.find((v) => v.id === currentVehicleIdFromPath) || null,
    [vehicles, currentVehicleIdFromPath]
  );

  const buildChatPayload = async (docType, vehicleId) => {
    if (!vehicleId) return null;
    const labelMap = {
      invoice: 'فاتورة',
      diagnosis: 'تقرير تشخيص',
      quote: 'عرض سعر',
      receipt: 'سند قبض',
    };
    const vehicleRes = await fetch(`${API_BASE}/vehicles/${vehicleId}`);
    const vehicleData = vehicleRes.ok ? await vehicleRes.json() : {};
    const visitsRes = await fetch(`${API_BASE}/vehicles/${vehicleId}/visits`);
    const visitsData = visitsRes.ok ? await visitsRes.json() : [];
    const visit = Array.isArray(visitsData) ? visitsData[0] : visitsData?.visits?.[0];
    let visitItems = [];
    if (visit?.items?.length) {
      visitItems = visit.items;
    } else if (typeof visit?.notes === 'string' && visit.notes.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(visit.notes);
        visitItems = parsed?.items || [];
      } catch (_) {
        visitItems = [];
      }
    }
    const items = visitItems.map((item) => {
      const quantity = Number(item?.quantity || item?.qty || 1);
      const price = Number(item?.price || item?.unitPrice || 0);
      return {
        name: item?.name || item?.description || 'عنصر',
        description: item?.itemType === 'service' ? 'خدمة' : 'قطعة',
        quantity,
        price,
        total: Number(item?.total || quantity * price),
        unit: item?.unit || 'حبة',
      };
    });

    return {
      doc_type: docType,
      items,
      customer: {
        name: vehicleData?.customerName || vehicleData?.ownerName || '',
        phone: vehicleData?.customerPhone || vehicleData?.ownerPhone || '',
      },
      vehicle: {
        plate: vehicleData?.plateNumber || vehicleData?.plate || '',
        model: vehicleData?.vehicleModel || vehicleData?.model || '',
        brand: vehicleData?.vehicleBrand || vehicleData?.brand || '',
      },
      notes: visit?.notes || '',
      date: visit?.created_at || visit?.createdAt || '',
      settings: {
        document_number: visit?.invoiceNumber || visit?.id || '',
        document_title: labelMap[docType] || 'مستند',
      },
    };
  };

  const openQuickPrintDialog = (docType, vehicleId) => {
    if (!vehicleId) return;
    const labelMap = {
      invoice: 'فاتورة',
      diagnosis: 'تشخيص',
      quote: 'عرض سعر',
      receipt: 'سند قبض',
    };
    setPrintDialogConfig({
      title: labelMap[docType] || 'طباعة مستند',
      phone: '',
      payloadBuilder: () => buildChatPayload(docType, vehicleId),
    });
    setPrintDialogOpen(true);
  };

  const goToPrint = (type, vehicleId) => {
    openQuickPrintDialog(type, vehicleId);
  };

  // لا نظهر الودجت داخل شاشات معينة
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (path.startsWith('/login') || path.startsWith('/approval') || path.startsWith('/report') || path.startsWith('/track')) {
      return null;
    }
  }

  return (
    <>
      {/* زر عائم */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="fixed z-50 bottom-20 left-4 sm:bottom-8 sm:left-6 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all hover:scale-110 active:scale-95 group border border-blue-400/30 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        }}
        data-testid="workshop-bot-toggle-button"
      >
        <div className="absolute inset-0 bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors" />
        {isOpen ? (
          <X size={24} className="text-white relative z-10" />
        ) : (
          <Bot size={28} className="text-blue-400 group-hover:text-blue-300 relative z-10" />
        )}
        {/* نبض إشعار */}
        {!isOpen && (
          <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]" />
        )}
      </button>

      {/* نافذة المساعد */}
      {isOpen && (
        <div 
          className="fixed z-50 bottom-28 left-1/2 -translate-x-1/2 w-[92vw] max-w-[420px] sm:left-6 sm:translate-x-0 sm:w-[400px] rounded-2xl flex flex-col overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-slate-700/50 backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-300"
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            height: '70vh',
            maxHeight: '80vh'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg border border-white/10">
                <Bot size={20} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">أبو فهد</span>
                <span className="text-[10px] text-blue-200/70 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  مدير الورشة الذكي
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={resetChatSession}
                className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors text-[10px]"
                title="مسح المحادثة"
                data-testid="workshop-bot-reset-chat-button"
              >
                مسح
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
                data-testid="workshop-bot-close-button"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex p-1 gap-1 bg-slate-900/30 m-2 rounded-xl border border-slate-800/50">
            {[
              { id: 'chat', icon: MessageCircle, label: 'محادثة' },
              { id: 'diagnosis', icon: Wrench, label: 'تشخيص' },
              { id: 'invoice', icon: Receipt, label: 'فاتورة' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                  mode === tab.id 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
                data-testid={`workshop-bot-tab-${tab.id}`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden relative">
            
            {/* Mode: CHAT */}
            {mode === 'chat' && (
              <div className="absolute inset-0 flex flex-col">
                <ArchiveSearchPanel
                  query={archiveQuery}
                  onQueryChange={setArchiveQuery}
                  onSearch={handleArchiveSearch}
                  loading={archiveLoading}
                  error={archiveError}
                  results={archiveResults}
                  selectedResult={selectedArchiveResult}
                  onSelectResult={setSelectedArchiveResult}
                />

                {selectedArchiveResult && (
                  <div className="max-h-[220px] overflow-y-auto border-b border-slate-800 bg-slate-950/35 p-3" data-testid="workshop-bot-selected-archive-result-panel">
                    <ArchiveVisitResultCard
                      result={selectedArchiveResult}
                      compact
                      testIdPrefix="workshop-bot-selected-archive-result"
                    />
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent" data-testid="workshop-bot-chat-messages-panel">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div 
                        className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed shadow-sm ${
                          msg.role === 'user' 
                            ? 'bg-blue-600 text-white rounded-br-none' 
                            : msg.isDev 
                              ? 'bg-purple-900/40 border border-purple-500/30 text-purple-100 rounded-bl-none'
                              : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                        }`}
                      >
                        {msg.isDev && <div className="text-[10px] font-bold text-purple-400 mb-1">🛠️ وضع المطور</div>}
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                        {msg.archiveResult && (
                          <div className="mt-3">
                            <ArchiveVisitResultCard
                              result={msg.archiveResult}
                              compact
                              testIdPrefix={`workshop-bot-message-archive-result-${idx}`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-800 rounded-2xl rounded-bl-none p-3 border border-slate-700">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                
                <div className="p-3 bg-slate-900/50 border-t border-slate-800">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="اكتب رسالتك لأبو فهد..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                      data-testid="workshop-bot-chat-input"
                    />
                    <button
                      type="submit"
                      disabled={loading || !chatInput.trim()}
                      className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      data-testid="workshop-bot-chat-send-button"
                    >
                      <Send size={18} />
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Mode: DIAGNOSIS */}
            {mode === 'diagnosis' && (
              <div className="h-full overflow-y-auto p-4 space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-200">
                  <div className="flex items-center gap-2 mb-1 font-semibold text-blue-400">
                    <ClipboardList size={14} />
                    مساعد التشخيص
                  </div>
                  اختر مركبة واكتب الأعراض ليقوم أبو فهد بتحليل المشكلة.
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">المركبة</label>
                    <select
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                      value={selectedVehicleId}
                      onChange={(e) => setSelectedVehicleId(e.target.value)}
                      data-testid="workshop-bot-diagnosis-vehicle-select"
                    >
                      <option value="">— اختر من القائمة —</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.plateNumber} — {v.brand} {v.model}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">الأعراض / الشكوى</label>
                    <textarea
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white min-h-[100px] focus:outline-none focus:border-blue-500 placeholder-slate-600 resize-none"
                      placeholder="مثال: السيارة تنتع عند سرعة 80، دخان أسود، صوت طقطقة..."
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                      data-testid="workshop-bot-diagnosis-symptoms-input"
                    />
                  </div>

                  {error && (
                    <div className="text-red-400 text-xs flex items-center gap-1.5 bg-red-900/20 p-2 rounded-lg border border-red-900/30">
                      <AlertCircle size={14} /> {error}
                    </div>
                  )}

                  <button
                    onClick={handleRunDiagnosis}
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
                    data-testid="workshop-bot-diagnosis-submit-button"
                  >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : <Wrench size={16} />}
                    تحليل العطل
                  </button>
                </div>
              </div>
            )}

            {/* Mode: INVOICE */}
            {mode === 'invoice' && (
              <div className="h-full overflow-y-auto p-4 space-y-4">
                {currentVehicle ? (
                  <>
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                      <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                        <Receipt size={16} className="text-green-400" />
                        المركبة الحالية
                      </h3>
                      <div className="space-y-2 text-xs text-slate-300">
                        <div className="flex justify-between">
                          <span>اللوحة:</span>
                          <span className="text-white font-mono">{currentVehicle.plateNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>النوع:</span>
                          <span className="text-white">{currentVehicle.brand} {currentVehicle.model}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>العميل:</span>
                          <span className="text-white">{currentVehicle.customerName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={() => goToPrint('diagnosis', currentVehicle.id)}
                        className="w-full p-3 rounded-xl border border-slate-700 bg-slate-800/30 hover:bg-slate-800 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 group-hover:text-orange-300">
                            <ClipboardList size={18} />
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-slate-200">تقرير تشخيص</div>
                            <div className="text-[10px] text-slate-500">قبل الإصلاح</div>
                          </div>
                        </div>
                        <Send size={16} className="text-slate-600 group-hover:text-slate-400" />
                      </button>

                      <button
                        onClick={() => goToPrint('quote', currentVehicle.id)}
                        className="w-full p-3 rounded-xl border border-slate-700 bg-slate-800/30 hover:bg-slate-800 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:text-blue-300">
                            <FileText size={18} />
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-slate-200">عرض سعر</div>
                            <div className="text-[10px] text-slate-500">للموافقة</div>
                          </div>
                        </div>
                        <Send size={16} className="text-slate-600 group-hover:text-slate-400" />
                      </button>

                      <button
                        onClick={() => goToPrint('invoice', currentVehicle.id)}
                        className="w-full p-3 rounded-xl border border-slate-700 bg-slate-800/30 hover:bg-slate-800 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400 group-hover:text-green-300">
                            <Receipt size={18} />
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-slate-200">فاتورة ضريبية</div>
                            <div className="text-[10px] text-slate-500">نهائية</div>
                          </div>
                        </div>
                        <Send size={16} className="text-slate-600 group-hover:text-slate-400" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500 px-4">
                    <Receipt size={32} className="mb-2 opacity-50" />
                    <p className="text-xs">
                      ادخل على صفحة "تفاصيل المركبة" لتفعيل خيارات الطباعة والفواتير لهذه المركبة.
                    </p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      <QuickPrintDialog
        open={printDialogOpen}
        title={printDialogConfig?.title || 'خيارات الطباعة'}
        description="اختر الطباعة أو إرسال PDF عبر واتس اب"
        onClose={() => setPrintDialogOpen(false)}
        onPrint={() => handleQuickPrintAction('print')}
        onWhatsApp={() => handleQuickPrintAction('whatsapp')}
      />
    </>
  );
};

export default ChatWidget;
