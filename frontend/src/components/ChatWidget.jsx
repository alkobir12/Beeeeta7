import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, X, Loader2, Search, ClipboardList, FileText, Receipt } from 'lucide-react';
import { aiAPI, vehicleAPI } from '../services/api';

// ويدجت مساعد الورشة الذكي العائم - يظهر في كل الصفحات داخل Layout
const ChatWidget = () => {
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('diagnosis'); // 'diagnosis' | 'technical' | 'invoice'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(null);

  // بيانات التشخيص
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [symptoms, setSymptoms] = useState('');
  const [diagnosisResult, setDiagnosisResult] = useState(null);

  // بحث تقني عام
  const [techQuery, setTechQuery] = useState('');
  const [techResult, setTechResult] = useState(null);

  // عند فتح الودجت لأول مرة: جلب معلومات الوكيل + قائمة المركبات
  useEffect(() => {
    if (!isOpen) return;

    const fetchMeta = async () => {
      try {
        setError('');
        const [infoRes, vehiclesRes] = await Promise.all([
          aiAPI.workshopInfo(),
          vehicleAPI.getAll(),
        ]);
        setInfo(infoRes.data);
        setVehicles(vehiclesRes.data || []);
      } catch (e) {
        console.error('Workshop AI meta error', e);
        setError('تعذر الاتصال بمساعد الورشة الذكي. تأكد من عمل الخادم ثم أعد المحاولة.');
      }
    };

    fetchMeta();
  }, [isOpen]);

  const handleRunDiagnosis = async () => {
    if (!selectedVehicleId && !symptoms.trim()) {
      setError('اختر مركبة أو اكتب الأعراض أولاً.');
      return;
    }

    setLoading(true);
    setError('');
    setDiagnosisResult(null);

    try {
      let vehicle = null;
      if (selectedVehicleId) {
        vehicle = vehicles.find((v) => v.id === selectedVehicleId) || null;
      }

      const payload = {
        vehicle_id: vehicle ? vehicle.id : undefined,
        make: vehicle?.brand || vehicle?.make || 'غير محدد',
        model: vehicle?.model || 'غير محدد',
        year: vehicle?.year || vehicle?.modelYear || '',
        mileage: vehicle?.mileage || undefined,
        fuel_type: vehicle?.fuelType || 'بنزين',
        symptoms: symptoms || 'لا توجد أعراض مذكورة',
      };

      const res = await aiAPI.workshopDiagnose(payload);
      setDiagnosisResult(res.data);
    } catch (e) {
      console.error('Diagnosis error', e);
      setError('حدث خطأ أثناء طلب التشخيص. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunTechnicalSearch = async () => {
    if (!techQuery.trim()) {
      setError('اكتب وصفاً تقنياً أو كلمة مفتاحية للبحث.');
      return;
    }
    setLoading(true);
    setError('');
    setTechResult(null);
    try {
      const res = await aiAPI.workshopSearchTechnical({ query: techQuery });
      setTechResult(res.data);
    } catch (e) {
      console.error('Technical search error', e);
      setError('تعذر تنفيذ البحث التقني حالياً.');
    } finally {
      setLoading(false);
    }
  };

  // تحديد المركبة الحالية من عنوان الصفحة مثل /vehicle/:id
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const currentVehicleIdFromPath = useMemo(() => {
    const match = currentPath.match(/^\/vehicle\/(.+)$/);
    return match ? match[1] : '';
  }, [currentPath]);

  const currentVehicle = useMemo(
    () => vehicles.find((v) => v.id === currentVehicleIdFromPath) || null,
    [vehicles, currentVehicleIdFromPath]
  );

  // اقتراح نوع المستند تلقائياً بناءً على حالة المركبة
  const suggestedDocType = useMemo(() => {
    if (!currentVehicle) return null;
    const status = currentVehicle.status || '';
    if (status === 'diagnosis') return 'diagnosis';
    if (status === 'quotation') return 'quote';
    if (status === 'ready' || status === 'delivered') return 'invoice';
    return null;
  }, [currentVehicle]);

  // لا نظهر الودجت داخل شاشة تسجيل الدخول أو الشاشات العامة (approval/report)
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (
      path.startsWith('/login') ||
      path.startsWith('/approval') ||
      path.startsWith('/report') ||
      path.startsWith('/track')
    ) {
      return null;
    }
  }

  const goToPrint = (type, vehicleId) => {
    if (!vehicleId) return;
    setIsOpen(false);
    navigate(`/print?type=${encodeURIComponent(type)}&vehicleId=${encodeURIComponent(vehicleId)}`);
  };

  const suggestedDocLabel =
    suggestedDocType === 'diagnosis'
      ? 'تقرير تشخيص'
      : suggestedDocType === 'quote'
      ? 'عرض سعر'
      : suggestedDocType === 'invoice'
      ? 'فاتورة مبيعات'
      : null;

  return (
    <>
      {/* زر عائم لفتح/إغلاق المساعد */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="fixed z-40 bottom-4 left-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-xl border border-white/10"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={26} />}
      </button>

      {/* نافذة المساعد */}
      {isOpen && (
        <div className="fixed z-40 bottom-24 left-4 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          {/* رأس النافذة */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-l from-blue-600 to-blue-700 text-white">
            <div className="flex items-center gap-2">
              <div className="bg-white/15 rounded-full w-8 h-8 flex items-center justify-center">
                <MessageCircle size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">مساعد الورشة الذكي</span>
                <span className="text-[11px] text-white/80">تشخيص – بحث تقني – مساعدة في اختيار الفاتورة</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* شريط الأوضاع */}
          <div className="flex text-xs border-b border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => {
                setMode('diagnosis');
                setError('');
              }}
              className={`flex-1 px-3 py-2 flex items-center justify-center gap-1 border-e border-slate-200 ${
                mode === 'diagnosis' ? 'bg-white text-blue-700 font-semibold' : 'text-slate-600'
              }`}
            >
              <ClipboardList size={14} />
              <span>تشخيص مركبة</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('technical');
                setError('');
              }}
              className={`flex-1 px-3 py-2 flex items-center justify-center gap-1 border-e border-slate-200 ${
                mode === 'technical' ? 'bg-white text-blue-700 font-semibold' : 'text-slate-600'
              }`}
            >
              <Search size={14} />
              <span>بحث تقني</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('invoice');
                setError('');
              }}
              className={`flex-1 px-3 py-2 flex items-center justify-center gap-1 ${
                mode === 'invoice' ? 'bg-white text-blue-700 font-semibold' : 'text-slate-600'
              }`}
            >
              <FileText size={14} />
              <span>مساعدة فاتورة</span>
            </button>
          </div>

          {/* محتوى النافذة */}
          <div className="p-3 max-h-96 overflow-y-auto text-[13px] space-y-3">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-xs">
                {error}
              </div>
            )}

            {/* تنبيه حالة مفتاح Genspark */}
            {info && !info.has_genspark_key && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md px-3 py-2 text-[11px] leading-relaxed">
                يعمل المساعد حالياً باستخدام الكتيبات المحلية فقط. لإتاحة ذكاء Genspark الكامل، قم بضبط GENSPARK_API_KEY في الخادم.
              </div>
            )}

            {mode === 'diagnosis' && (
              <>
                <p className="text-slate-700 mb-1">
                  اختر مركبة من القائمة أو اكتب الأعراض مباشرة لمساعدتك في التشخيص.
                </p>

                <label className="block text-xs text-slate-600 mb-1">المركبة</label>
                <select
                  className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                >
                  <option value="">— بدون اختيار —</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plateNumber || v.trackingLink} — {v.brand || v.make} {v.model}
                    </option>
                  ))}
                </select>

                <label className="block text-xs text-slate-600 mt-2 mb-1">الأعراض / الشكوى</label>
                <textarea
                  className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs min-h-[70px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="مثال: صعوبة في التشغيل صباحاً، دخان أسود من العادم، استهلاك وقود عالي"
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                />

                <button
                  type="button"
                  onClick={handleRunDiagnosis}
                  disabled={loading}
                  className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white py-1.5 text-xs font-semibold disabled:opacity-60"
                >
                  {loading ? <Loader2 className="animate-spin" size={14} /> : <ClipboardList size={14} />}
                  <span>تشخيص الآن</span>
                </button>

                {diagnosisResult && (
                  <div className="mt-3 bg-slate-50 border border-slate-200 rounded-md p-2.5 max-h-40 overflow-y-auto">
                    <p className="text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {diagnosisResult.diagnosis || 'لم يتم استلام تشخيص من العميل الذكي.'}
                    </p>
                    {Array.isArray(diagnosisResult.local_manuals_found) &&
                      diagnosisResult.local_manuals_found.length > 0 && (
                        <div className="mt-2 border-t pt-2 border-slate-200">
                          <div className="text-[11px] font-semibold mb-1 text-slate-700">
                            كتيبات ذات صلة:
                          </div>
                          <ul className="list-disc pr-4 text-[11px] text-slate-700 space-y-0.5">
                            {diagnosisResult.local_manuals_found.map((m) => (
                              <li key={m.manual_id}>
                                {m.name} — {m.engine}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                )}
              </>
            )}

            {mode === 'technical' && (
              <>
                <p className="text-slate-700 mb-1">
                  اكتب مشكلة تقنية أو مكوّناً (مثلاً: مضخة الحقن، DPF، تيربو...) لعرض معلومات وكتيبات ذات صلة.
                </p>
                <textarea
                  className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs min-h-[70px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="مثال: مضخة الحقن تويوتا لاند كروزر ديزل"
                  value={techQuery}
                  onChange={(e) => setTechQuery(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleRunTechnicalSearch}
                  disabled={loading}
                  className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white py-1.5 text-xs font-semibold disabled:opacity-60"
                >
                  {loading ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}
                  <span>بحث تقني</span>
                </button>

                {techResult && (
                  <div className="mt-3 bg-slate-50 border border-slate-200 rounded-md p-2.5 max-h-40 overflow-y-auto space-y-2">
                    <p className="text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {techResult.ai_analysis || 'لم يتم استلام تحليل من العميل الذكي.'}
                    </p>
                    {Array.isArray(techResult.local_manuals) && techResult.local_manuals.length > 0 && (
                      <div className="border-t pt-2 border-slate-200">
                        <div className="text-[11px] font-semibold mb-1 text-slate-700">كتيبات محلية:</div>
                        <ul className="list-disc pr-4 text-[11px] text-slate-700 space-y-0.5">
                          {techResult.local_manuals.map((m) => (
                            <li key={m.manual_id}>
                              {m.name} — {m.engine}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {mode === 'invoice' && (
              <>
                {currentVehicle ? (
                  <>
                    <p className="text-slate-700 mb-2">
                      أنت حالياً في صفحة مركبة رقم{' '}
                      <span className="font-semibold">{currentVehicle.plateNumber || currentVehicle.trackingLink}</span>.
                      اختر نوع المستند الذي تريد طباعته لهذه المركبة:
                    </p>
                    <div className="bg-slate-50 border border-slate-200 rounded-md p-2.5 mb-2 text-[12px]">
                      <div className="font-semibold mb-1 text-slate-800">ملخص سريع:</div>
                      <div className="space-y-1 text-slate-700">
                        <div>
                          العميل: <span className="font-medium">{currentVehicle.customerName || '-'}</span>
                        </div>
                        <div>
                          السيارة:{' '}
                          <span className="font-medium">
                            {[currentVehicle.brand, currentVehicle.model, currentVehicle.year]
                              .filter(Boolean)
                              .join(' ')}{' '}
                            — {currentVehicle.plateNumber || '-'}
                          </span>
                        </div>
                        <div>
                          الحالة الحالية:{' '}
                          <span className="font-medium">{currentVehicle.status || 'غير محددة'}</span>
                        </div>
                        {suggestedDocType && (
                          <div className="text-[11px] text-blue-700 mt-1">
                            اقتراح مساعد: الأنسب الآن هو{' '}
                            <span className="font-semibold">{suggestedDocLabel}</span>
                            {suggestedDocType === 'diagnosis'
                              ? ' (الحالة ما زالت في مرحلة التشخيص).'
                              : suggestedDocType === 'quote'
                              ? ' (المركبة في مرحلة التسعير، مناسب لإرسال عرض سعر للعميل).'
                              : ' (المركبة جاهزة/مسلمة، مناسب لإصدار فاتورة نهائية).'}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => goToPrint('diagnosis', currentVehicle.id)}
                        className="w-full inline-flex items-center justify-between rounded-md border border-orange-200 bg-orange-50 hover:bg-orange-100 px-3 py-2 text-[12px] text-orange-900"
                      >
                        <div className="flex items-center gap-2">
                          <ClipboardList size={16} />
                          <div className="flex flex-col items-start">
                            <span className="font-semibold">تقرير تشخيص</span>
                            <span className="text-[10px] text-orange-800/80">
                              يستخدم للأعطال والتقارير قبل الإصلاح
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px]">طباعة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => goToPrint('invoice', currentVehicle.id)}
                        className="w-full inline-flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-2 text-[12px] text-blue-900"
                      >
                        <div className="flex items-center gap-2">
                          <Receipt size={16} />
                          <div className="flex flex-col items-start">
                            <span className="font-semibold">فاتورة مبيعات</span>
                            <span className="text-[10px] text-blue-800/80">
                              بعد اعتماد العميل وإنهاء العمل
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px]">طباعة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => goToPrint('quote', currentVehicle.id)}
                        className="w-full inline-flex items-center justify-between rounded-md border border-green-200 bg-green-50 hover:bg-green-100 px-3 py-2 text-[12px] text-green-900"
                      >
                        <div className="flex items-center gap-2">
                          <FileText size={16} />
                          <div className="flex flex-col items-start">
                            <span className="font-semibold">عرض سعر</span>
                            <span className="text-[10px] text-green-800/80">
                              قبل الإصلاح أو لإرسال عرض مكتوب للعميل
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px]">طباعة</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-slate-700 mb-2">
                      لا يمكن تحديد مركبة حالياً.
                    </p>
                    <p className="text-[12px] text-slate-600 mb-2">
                      لتمكين مساعد الفاتورة:
                    </p>
                    <ol className="list-decimal pr-4 text-[12px] text-slate-600 space-y-1">
                      <li>اذهب إلى صفحة "تفاصيل المركبة" للمركبة المطلوبة.</li>
                      <li>افتح مساعد الورشة الذكي من الزر العائم في الأسفل.</li>
                      <li>اختر تبويب "مساعدة فاتورة" ليقترح عليك النوع المناسب ويحولك لصفحة الطباعة.</li>
                    </ol>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
