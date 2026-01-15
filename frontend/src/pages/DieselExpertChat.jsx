import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, X, Paperclip, Minimize2, Database, Search, BookOpen, ExternalLink, Mic, Video } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DieselExpertChat = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isArabic = i18n.language === 'ar';
  
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: isArabic 
        ? 'مرحباً! أنا خبير صيانة الديزل المتصل بقاعدة المعرفة. يمكنني:\n\n🔍 البحث في قاعدة الأعطال المحفوظة\n📚 الاقتباس من حلول سابقة\n🌐 البحث على الإنترنت\n📷 تحليل الصور والفيديو\n\nكيف يمكنني مساعدتك؟ 🔧'
        : 'Hello! I\'m the diesel expert connected to the knowledge base. I can:\n\n🔍 Search saved faults\n📚 Quote previous solutions\n🌐 Search the web\n📷 Analyze images/videos\n\nHow can I help? 🔧'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [quickResults, setQuickResults] = useState([]);
  const [showQuickResults, setShowQuickResults] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [lastUserQuestion, setLastUserQuestion] = useState('');
  const [saveKbOpen, setSaveKbOpen] = useState(false);
  const [saveKbForm, setSaveKbForm] = useState({
    title: '',
    vehicle_type: '',
    vehicle_model: '',
    symptom_description: '',
    dtc_codes: '',
    diagnosis_steps: '',
    solution: '',
    vehicle_id: '',
    vehicle_plate: ''
  });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // TODO: لاحقًا يمكن تمرير vehicleId / plate من شاشة المركبة عبر URL
  const searchParams = new URLSearchParams(window.location.search);
  const vehicleIdFromUrl = searchParams.get('vehicleId') || '';
  const vehiclePlateFromUrl = searchParams.get('plate') || '';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Quick search as user types
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (input.length >= 3) {
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await axios.get(`${API_URL}/diesel-expert/quick-search`, {
            params: { q: input }
          });

          if (response.data.results?.length > 0) {
            setQuickResults(response.data.results);
            setShowQuickResults(true);
          } else {
            setShowQuickResults(false);
          }
        } catch (e) {
          setShowQuickResults(false);
        }
      }, 500);
    } else {
      setShowQuickResults(false);
    }
    
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [input]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    const MAX_AI_BYTES = 25 * 1024 * 1024; // 25MB حد OpenAI للتحليل

    const validFiles = [];
    for (const file of files) {
      if (file.size > MAX_AI_BYTES) {
        alert(
          isArabic
            ? 'الملف أكبر من 25MB، لا يمكن تحليله بالذكاء الاصطناعي. الرجاء تقصير المقطع أو ضغطه أو حفظه في قاعدة المعرفة فقط.'
            : 'File is larger than 25MB and cannot be analyzed by AI. Please trim/compress it or store it only in the knowledge base.'
        );
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;
    
    const newAttachments = await Promise.all(validFiles.map(async (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            file,
            name: file.name,
            type: file.type,
            url: URL.createObjectURL(file),
            base64: reader.result
          });
        };
        reader.readAsDataURL(file);
      });
    }));
    
    setAttachments([...attachments, ...newAttachments]);
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || loading) return;

    const textContent = input.trim();
    setLastUserQuestion(textContent);
    let displayContent = textContent;
    if (attachments.length > 0) {
      displayContent += (displayContent ? '\n\n' : '') + `[${isArabic ? 'المرفقات' : 'Attachments'}: ${attachments.map(a => a.name).join(', ')}]`;
    }

    const currentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    setLoading(true);
    setShowQuickResults(false);

    const newMessages = [...messages, { role: 'user', content: displayContent }];
    setMessages(newMessages);

    try {
      const payloadMessages = [...messages, { 
        role: 'user', 
        content: textContent || (isArabic ? 'تحليل المرفقات' : 'Analyze attachments'),
        // نرسل السؤال النصي فقط، بدون محاولة تضمين JSON أو بنية خاصة من الواجهة
        attachments: currentAttachments.map(a => ({
          name: a.name,
          type: a.type,
          base64: a.base64
        }))
      }];

      let assistantMessage = null;

      // إذا كانت هناك مرفقات (صوت/فيديو/صورة) نستخدم مسار تحليل الوسائط
      const allMedia = currentAttachments.length > 0 && currentAttachments.every(a => 
        a.type.startsWith('image/') || a.type.startsWith('video/') || a.type.startsWith('audio/')
      );

      if (allMedia && currentAttachments.length > 0) {
        const formData = new FormData();
        formData.append('description', textContent || '');
        if (vehicleIdFromUrl) formData.append('vehicle_id', vehicleIdFromUrl);
        if (vehiclePlateFromUrl) formData.append('vehicle_plate', vehiclePlateFromUrl);
        formData.append('media_file', currentAttachments[0].file);

        const response = await axios.post(`${API_URL}/diesel-expert/analyze-media`, formData);

        if (!response.data.success) {
          throw new Error('Failed to analyze media');
        }

        const rawAnalysis = typeof response.data.analysis === 'string' ? response.data.analysis : '';
        let assistantContent = rawAnalysis;

        if (response.data.dtc_codes_found?.length > 0) {
          assistantContent += `\n\n🔍 **${isArabic ? 'أكواد الأعطال المكتشفة' : 'Detected DTC Codes'}:** ${response.data.dtc_codes_found.join(', ')}`;
        }

        assistantMessage = {
          role: 'assistant',
          content: assistantContent,
          rankedCauses: response.data.ranked_causes || [],
          knowledgeUsed: (response.data.ranked_causes || []).length > 0,
          structuredReport: null,
          mediaMeta: {
            vehicleId: response.data.vehicle_id,
            vehiclePlate: response.data.vehicle_plate,
            mediaType: response.data.media_type,
          },
        };
      } else {
        // استخدام مسار الدردشة النصية العادي
        const response = await axios.post(`${API_URL}/diesel-expert`, {
          messages: payloadMessages,
          sessionId
        });

        if (!response.data.success) {
          throw new Error('Failed to get response');
        }

        const rawResponse = typeof response.data.response === 'string' ? response.data.response : '';
        let assistantContent = rawResponse;
        
        // Add sources info if available
        if (response.data.sources?.length > 0) {
          assistantContent += `\n\n📚 ${isArabic ? 'المصادر من قاعدة المعرفة:' : 'Knowledge Base Sources:'}`;
          response.data.sources.forEach((src, i) => {
            assistantContent += `\n${i + 1}. ${src.title}`;
          });
        }
        
        if (response.data.dtc_codes_found?.length > 0) {
          assistantContent += `\n\n🔍 ${isArabic ? 'أكواد الأعطال المكتشفة:' : 'Detected DTC Codes:'} ${response.data.dtc_codes_found.join(', ')}`;
        }

        assistantMessage = {
          role: 'assistant',
          content: assistantContent,
          sources: response.data.sources,
          knowledgeUsed: response.data.knowledge_used,
          rankedCauses: response.data.ranked_causes || [],
          dtcCodes: response.data.dtc_codes_found || [],
          structuredReport: parsed.structured || null,
        };
      }

      setMessages([...newMessages, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages([...newMessages, {
        role: 'assistant',
        content: isArabic 
          ? 'عذراً، حدث خطأ. الرجاء المحاولة مرة أخرى.'
          : 'Sorry, an error occurred. Please try again.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const openSaveToKbModal = (msg) => {
    const firstCause = (msg.rankedCauses && msg.rankedCauses[0]) || {};
    setSaveKbForm({
      title: firstCause.title || '',
      vehicle_type: '',
      vehicle_model: '',
      symptom_description: lastUserQuestion || '',
      dtc_codes: (msg.dtcCodes || []).join(', '),
      diagnosis_steps: '',
      solution: '',
      vehicle_id: vehicleIdFromUrl || '',
      vehicle_plate: vehiclePlateFromUrl || ''
    });
    setSaveKbOpen(true);
  };

  const handleSaveKbSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = new FormData();
      Object.entries(saveKbForm).forEach(([key, value]) => {
        if (value) data.append(key, value);
      });
      await axios.post(`${API_URL}/faults/add`, data);
      alert(
        isArabic
          ? 'تم حفظ العطل في قاعدة المعرفة بنجاح.'
          : 'Fault saved to knowledge base successfully.'
      );
      setSaveKbOpen(false);
    } catch (err) {
      console.error('Save KB error:', err);
      alert(
        isArabic
          ? 'حدث خطأ أثناء الحفظ في قاعدة المعرفة.'
          : 'An error occurred while saving to knowledge base.'
      );
    }
  };

  const handleQuickResultClick = (result) => {
    setInput(`${isArabic ? 'معلومات عن العطل' : 'Info about fault'}: ${result.title} - ${result.symptom}`);
    setShowQuickResults(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 left-6 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-full p-3 shadow-lg hover:scale-105 transition-transform"
        >
          <div className="flex items-center gap-2">
            <Database size={20} />
            <span className="text-sm font-bold">{isArabic ? 'خبير الديزل' : 'Diesel Expert'}</span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-2xl h-[90vh] sm:h-[600px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/90 to-primary px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center">
              <Database className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-primary-foreground leading-tight">
                {isArabic ? 'خبير الديزل المتكامل' : 'Integrated Diesel Expert'}
              </h2>
              <p className="text-xs text-primary-foreground/70 leading-tight flex items-center gap-1">
                <BookOpen size={10} />
                {isArabic ? 'متصل بقاعدة المعرفة' : 'Connected to Knowledge Base'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('/fault-knowledge')}
              className="text-primary-foreground/80 hover:text-primary-foreground p-1 rounded transition-colors"
              title={isArabic ? 'قاعدة المعرفة' : 'Knowledge Base'}
            >
              <Database className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="text-primary-foreground/80 hover:text-primary-foreground p-1 rounded transition-colors"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate(-1)}
              className="text-primary-foreground/80 hover:text-primary-foreground p-1 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 bg-background">
          <div className="space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Database className="w-3 h-3 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground border border-border'
                  }`}
                >
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>

                  {/* تقرير تشخيص منظم بأسلوب كروت */}
                  {msg.structuredReport && (
                    <div className="mt-3 space-y-2 text-xs">
                      {/* Card: Summary + Risk */}
                      {(msg.structuredReport.case_summary || msg.structuredReport.risk_level || msg.structuredReport.recommendation) && (
                        <div className="rounded-lg border border-border bg-card/80 p-2 flex gap-2">
                          <div className="mt-0.5 flex-shrink-0">
                            <Database className="w-3 h-3 text-primary" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                              {isArabic ? 'ملخص التشخيص' : 'Diagnostic summary'}
                            </p>
                            {msg.structuredReport.case_summary && (
                              <p className="text-[11px] leading-snug text-foreground">
                                {msg.structuredReport.case_summary}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1.5 text-[10px] mt-1">
                              {msg.structuredReport.risk_level && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/30">
                                  {isArabic ? 'الخطورة:' : 'Risk:'} {msg.structuredReport.risk_level}
                                </span>
                              )}
                              {msg.structuredReport.recommendation && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/30">
                                  {msg.structuredReport.recommendation}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Card: Ranked causes */}
                      {Array.isArray(msg.structuredReport.ranked_causes) && msg.structuredReport.ranked_causes.length > 0 && (
                        <div className="rounded-lg border border-border bg-card/70 p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <Search size={11} className="text-primary" />
                            <p className="text-[11px] font-semibold text-primary">
                              {isArabic ? 'الأسباب المشتبه بها' : 'Top suspected causes'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            {msg.structuredReport.ranked_causes.map((c, i) => (
                              <div key={i} className="rounded-md bg-background/80 px-2 py-1 border border-border/60">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium text-[11px] text-foreground">
                                    {c.human_readable_name || c.cause_key}
                                  </span>
                                  {typeof c.confidence === 'number' && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
                                      {Math.round(c.confidence * 100)}%
                                    </span>
                                  )}
                                </div>
                                {c.evidence_support && (
                                  <p className="mt-0.5 text-[10px] text-muted-foreground leading-snug">
                                    {c.evidence_support}
                                  </p>
                                )}
                                {c.conflicting_evidence && (
                                  <p className="mt-0.5 text-[10px] text-destructive leading-snug">
                                    {isArabic ? 'أدلة معاكسة:' : 'Conflicting:'} {c.conflicting_evidence}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Card: Confirmatory tests */}
                      {Array.isArray(msg.structuredReport.confirmatory_tests) && msg.structuredReport.confirmatory_tests.length > 0 && (
                        <div className="rounded-lg border border-border bg-card/70 p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <BookOpen size={11} className="text-primary" />
                            <p className="text-[11px] font-semibold text-primary">
                              {isArabic ? 'اختبارات تأكيدية' : 'Confirmatory tests'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            {msg.structuredReport.confirmatory_tests.map((t, i) => (
                              <div key={i} className="rounded-md bg-background/80 px-2 py-1 border border-border/60">
                                <p className="text-[11px] font-medium text-foreground">{t.test}</p>
                                {t.procedure && (
                                  <p className="mt-0.5 text-[10px] text-muted-foreground leading-snug">
                                    <span className="font-semibold">{isArabic ? 'الإجراء:' : 'Procedure:'}</span>{' '}
                                    {t.procedure}
                                  </p>
                                )}
                                {t.interpretation && (
                                  <p className="mt-0.5 text-[10px] text-muted-foreground leading-snug">
                                    <span className="font-semibold">{isArabic ? 'التفسير:' : 'Interpretation:'}</span>{' '}
                                    {t.interpretation}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Card: Diagnostic path */}
                      {Array.isArray(msg.structuredReport.diagnostic_path) && msg.structuredReport.diagnostic_path.length > 0 && (
                        <div className="rounded-lg border border-border bg-card/70 p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <ExternalLink size={11} className="text-primary" />
                            <p className="text-[11px] font-semibold text-primary">
                              {isArabic ? 'المسار التشخيصي المقترح' : 'Suggested diagnostic path'}
                            </p>
                          </div>
                          <ol className="list-decimal pl-4 space-y-0.5 text-[10px] text-foreground leading-snug">
                            {msg.structuredReport.diagnostic_path.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* Follow-up questions */}
                      {Array.isArray(msg.structuredReport.follow_up_questions) && msg.structuredReport.follow_up_questions.length > 0 && (
                        <div className="rounded-lg border border-border bg-card/70 p-2">
                          <p className="text-[11px] font-semibold text-primary mb-1">
                            {isArabic ? 'أسئلة متابعة مقترحة' : 'Follow-up questions'}
                          </p>
                          <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-foreground leading-snug">
                            {msg.structuredReport.follow_up_questions.map((q, i) => (
                              <li key={i}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* وسم يوضح استخدام قاعدة المعرفة */}
                  {msg.knowledgeUsed && (
                    <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1 text-xs text-primary">
                      <BookOpen size={12} />
                      {isArabic ? 'تم الاستعانة بقاعدة المعرفة' : 'Knowledge base referenced'}
                    </div>
                  )}

                  {/* عرض الأسباب المرتبة إن وُجدت */}
                  {msg.rankedCauses && msg.rankedCauses.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50 text-xs space-y-1">
                      <div className="font-semibold flex items-center gap-1">
                        <Search size={12} />
                        <span>{isArabic ? 'أعلى الأسباب المشتبه بها' : 'Top suspected causes'}</span>
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {msg.rankedCauses.map((c, i) => (
                          <li key={i}>
                            <span className="font-medium">{c.title}</span>
                            {typeof c.score === 'number' && (
                              <span className="ml-1 text-muted-foreground">({Math.round(c.score * 100)}%)</span>
                            )}
                            {c.evidence_notes && (
                              <span className="block text-[11px] text-muted-foreground mt-0.5">
                                {c.evidence_notes}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>

                      {/* زر حفظ في قاعدة المعرفة */}
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => openSaveToKbModal(msg)}
                          className="text-[11px] px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"
                        >
                          <BookOpen size={10} />
                          {isArabic ? 'حفظ هذا التحليل في قاعدة المعرفة' : 'Save this analysis to KB'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <Database className="w-3 h-3 text-primary" />
                </div>
                <div className="bg-muted rounded-xl px-3 py-2 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm">{isArabic ? 'جاري البحث والتحليل...' : 'Searching & analyzing...'}</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Quick Results */}
        {showQuickResults && quickResults.length > 0 && (
          <div className="border-t border-border bg-muted/50 px-3 py-2 max-h-32 overflow-y-auto">
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Search size={12} />
              {isArabic ? 'نتائج سريعة من قاعدة المعرفة:' : 'Quick results from knowledge base:'}
            </p>
            <div className="space-y-1">
              {quickResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickResultClick(result)}
                  className="w-full text-right p-2 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
                >
                  <p className="text-sm font-medium text-foreground">{result.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{result.symptom}</p>
                  {result.dtc_codes?.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {result.dtc_codes.slice(0, 2).map((code, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded font-mono">
                          {code}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="border-t border-border bg-muted/30 px-3 py-1.5">
            <div className="flex gap-1.5 flex-wrap">
              {attachments.map((att, idx) => (
                <div key={idx} className="relative bg-card rounded p-1.5 border border-border flex items-center gap-1.5">
                  {att.type.startsWith('image/') ? (
                    <img src={att.url} alt={att.name} className="w-8 h-8 object-cover rounded" />
                  ) : att.type.startsWith('audio/') ? (
                    <div className="w-8 h-8 bg-blue-500/20 rounded flex items-center justify-center">
                      <Mic className="w-4 h-4 text-blue-400" />
                    </div>
                  ) : att.type.startsWith('video/') ? (
                    <div className="w-8 h-8 bg-purple-500/20 rounded flex items-center justify-center">
                      <Video className="w-4 h-4 text-purple-400" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                      <Paperclip className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-xs text-foreground max-w-[80px] truncate">{att.name}</span>
                  <button onClick={() => removeAttachment(idx)} className="text-destructive hover:text-destructive/80">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border bg-card px-3 py-2">
          <div className="flex gap-2 items-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="bg-muted hover:bg-muted/80 disabled:opacity-50 text-foreground rounded-lg p-1.5 transition-colors"
              title={isArabic ? 'إرفاق صورة/فيديو/صوت' : 'Attach image/video/audio'}
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isArabic ? 'اكتب سؤالك أو كود العطل (P0087)...' : 'Ask or enter DTC code (P0087)...'}
              className="flex-1 bg-input border border-border rounded-lg px-3 py-1.5 text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && attachments.length === 0) || loading}
              className="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground rounded-lg px-3 py-1.5 transition-all disabled:cursor-not-allowed font-medium"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
            <button
              onClick={() => setInput('P0087')}
              className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full whitespace-nowrap hover:bg-red-500/30"
            >
              P0087
            </button>
            <button
              onClick={() => setInput('P0234')}
              className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full whitespace-nowrap hover:bg-red-500/30"
            >
              P0234
            </button>
            <button
              onClick={() => setInput(isArabic ? 'مشكلة التيربو' : 'Turbo issue')}
              className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full whitespace-nowrap hover:bg-blue-500/30"
            >
              {isArabic ? 'تيربو' : 'Turbo'}
            </button>
            <button
              onClick={() => setInput(isArabic ? 'ضغط الوقود منخفض' : 'Low fuel pressure')}
              className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full whitespace-nowrap hover:bg-yellow-500/30"
            >
              {isArabic ? 'ضغط الوقود' : 'Fuel Pressure'}
            </button>
            <button
              onClick={() => navigate('/fault-knowledge')}
              className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full whitespace-nowrap hover:bg-primary/30 flex items-center gap-1"
            >
              <Database size={10} />
              {isArabic ? 'قاعدة المعرفة' : 'Knowledge Base'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Modal حفظ في قاعدة المعرفة */}
      {saveKbOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4" dir={isArabic ? 'rtl' : 'ltr'}>
          <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="px-4 py-2 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {isArabic ? 'حفظ العطل في قاعدة المعرفة' : 'Save fault to Knowledge Base'}
              </h3>
              <button
                onClick={() => setSaveKbOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveKbSubmit} className="p-4 space-y-3 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium mb-1">{isArabic ? 'عنوان العطل' : 'Fault title'}</label>
                <input
                  value={saveKbForm.title}
                  onChange={(e) => setSaveKbForm({ ...saveKbForm, title: e.target.value })}
                  className="apple-input text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{isArabic ? 'وصف الأعراض' : 'Symptoms description'}</label>
                <textarea
                  rows={3}
                  value={saveKbForm.symptom_description}
                  onChange={(e) => setSaveKbForm({ ...saveKbForm, symptom_description: e.target.value })}
                  className="apple-input text-xs resize-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">DTC</label>
                <input
                  value={saveKbForm.dtc_codes}
                  onChange={(e) => setSaveKbForm({ ...saveKbForm, dtc_codes: e.target.value })}
                  className="apple-input text-xs"
                  placeholder="P0087, P0234"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">{isArabic ? 'معرّف المركبة' : 'Vehicle ID'}</label>
                  <input
                    value={saveKbForm.vehicle_id}
                    onChange={(e) => setSaveKbForm({ ...saveKbForm, vehicle_id: e.target.value })}
                    className="apple-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">{isArabic ? 'رقم اللوحة' : 'Plate'}</label>
                  <input
                    value={saveKbForm.vehicle_plate}
                    onChange={(e) => setSaveKbForm({ ...saveKbForm, vehicle_plate: e.target.value })}
                    className="apple-input text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSaveKbOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-muted text-muted-foreground hover:bg-muted/80"
                >
                  {isArabic ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isArabic ? 'حفظ' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DieselExpertChat;
