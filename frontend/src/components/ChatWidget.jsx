import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, X, Loader2, Search, ClipboardList, FileText, Receipt, Send, Wrench, Bot, AlertCircle } from 'lucide-react';
import { aiAPI, vehicleAPI } from '../services/api';

// ويدجت مساعد الورشة الذكي العائم - تصميم Dark/Glass مطابق لثيم الموقع
const ChatWidget = () => {
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('chat'); // 'chat' | 'diagnosis' | 'technical' | 'invoice'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // بيانات التشخيص
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [symptoms, setSymptoms] = useState('');
  
  // المحادثة الحرة (أبو فهد)
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'يا هلا! أنا أبو فهد، مدير خدمة العملاء. آمرني وش بغيت؟' }
  ]);

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

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      // إرسال الرسالة إلى أبو فهد (AlKabeer Bot)
      const res = await aiAPI.alkabeerChat({ message: userMsg });
      
      const botResponse = res.data.response;
      const isDevMode = res.data.mode === 'dev';
      
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

      const res = await aiAPI.alkabeerChat({ message });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.response }]);
      setSymptoms(''); // مسح الحقل بعد الإرسال
    } catch (e) {
      console.error('Diagnosis error', e);
      setMessages(prev => [...prev, { role: 'assistant', content: 'واجهت مشكلة أثناء التشخيص. يرجى المحاولة لاحقاً.' }]);
    } finally {
      setLoading(false);
    }
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

  const goToPrint = (type, vehicleId) => {
    if (!vehicleId) return;
    setIsOpen(false);
    navigate(`/print?type=${encodeURIComponent(type)}&vehicleId=${encodeURIComponent(vehicleId)}`);
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
        className="fixed z-50 bottom-6 left-6 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all hover:scale-110 active:scale-95 group border border-blue-400/30 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        }}
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
          className="fixed z-50 bottom-24 left-6 w-[360px] sm:w-[400px] rounded-2xl flex flex-col overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-slate-700/50 backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-300"
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            height: '600px',
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
                onClick={() => setMessages([])} 
                className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors text-[10px]"
                title="مسح المحادثة"
              >
                مسح
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
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
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
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
                    />
                    <button
                      type="submit"
                      disabled={loading || !chatInput.trim()}
                      className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
    </>
  );
};

export default ChatWidget;
