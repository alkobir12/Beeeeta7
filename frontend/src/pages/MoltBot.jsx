import React, { useEffect, useMemo, useState } from 'react';
import { Bot, RefreshCw, Rocket, ShieldCheck, Sparkles, Globe } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const API_URL = (
  process.env.NODE_ENV === 'production'
    ? '/api'
    : `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api')
);

const statusOptions = [
  { value: 'draft', label: 'مسودة' },
  { value: 'building', label: 'قيد البناء' },
  { value: 'ready', label: 'جاهز' },
  { value: 'archived', label: 'مؤرشف' },
];

const MoltBot = () => {
  const { toast } = useToast();
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildPrompt, setBuildPrompt] = useState('');
  const [buildResult, setBuildResult] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [mode, setMode] = useState('builder');
  const [targetFilesInput, setTargetFilesInput] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);
  const [previewStatus, setPreviewStatus] = useState(null);
  const [lastPatchId, setLastPatchId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    industry: '',
    domain: ''
  });

  const session = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('session') || 'null');
    } catch (e) {
      return null;
    }
  }, []);

  const canAccess = useMemo(() => {
    const role = session?.role;
    return role === 'manager' || role === 'admin';
  }, [session]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId) || null,
    [projects, selectedId]
  );

  const stats = useMemo(() => {
    const total = projects.length;
    const ready = projects.filter((p) => p.status === 'ready').length;
    const resale = projects.filter((p) => p.resale_ready).length;
    return { total, ready, resale };
  }, [projects]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/moltbot/projects`);
      if (!res.ok) throw new Error('فشل تحميل المشاريع');
      const data = await res.json();
      setProjects(data);
      if (data.length && !selectedId) setSelectedId(data[0].id);
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر تحميل مشاريع MoltBot', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canAccess) fetchProjects();
  }, [canAccess]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast({ title: 'تنبيه', description: 'أدخل اسم المشروع', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(`${API_URL}/moltbot/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          industry: form.industry.trim(),
          domain: form.domain.trim(),
        })
      });
      if (!res.ok) throw new Error('create failed');
      const created = await res.json();
      setProjects((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setForm({ name: '', description: '', industry: '', domain: '' });
      toast({ title: 'تم', description: 'تم إنشاء المشروع بنجاح' });
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر إنشاء المشروع', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateProject = async (updates) => {
    if (!selectedProject) return;
    try {
      setUpdating(true);
      const res = await fetch(`${API_URL}/moltbot/projects/${selectedProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('update failed');
      const updated = await res.json();
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر تحديث المشروع', variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  const runBuild = async () => {
    if (!selectedProject) {
      toast({ title: 'تنبيه', description: 'اختر مشروعاً أولاً', variant: 'destructive' });
      return;
    }
    if (!buildPrompt.trim()) {
      toast({ title: 'تنبيه', description: 'أدخل وصف البناء المطلوب', variant: 'destructive' });
      return;
    }
    try {
      setBuildLoading(true);
      const targetFiles = targetFilesInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      const res = await fetch(`${API_URL}/moltbot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProject.id,
          session_id: sessionId,
          message: buildPrompt,
          goal: selectedProject.description,
          mode,
          target_files: mode === 'editor' ? targetFiles : undefined,
        })
      });
      if (!res.ok) throw new Error('chat failed');
      const data = await res.json();
      setBuildResult(data);
      setSessionId(data.session_id);
      setPreviewStatus(null);
      setLastPatchId(null);
      fetchProjects();
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر تشغيل وكلاء MoltBot', variant: 'destructive' });
    } finally {
      setBuildLoading(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" data-testid="moltbot-access-denied">
        <div className="max-w-lg text-center bg-white/5 border border-red-500/30 rounded-3xl p-10">
          <h1 className="text-2xl font-bold text-red-400 mb-2">صلاحية الوصول مقيدة</h1>
          <p className="text-sm text-muted-foreground">مولتبوت متاح للمديرين فقط. يرجى التواصل مع مدير النظام.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10" data-testid="moltbot-page">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00E0FF] via-[#4F46E5] to-[#F97316] flex items-center justify-center text-white shadow-lg">
                <Bot size={26} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">MoltBot</h1>
                <p className="text-sm text-slate-300">منصة بناء مواقع مستقلة متعددة الوكلاء قابلة للبيع وإعادة التسويق.</p>
              </div>
            </div>
          </div>
          <button
            onClick={fetchProjects}
            className="px-4 py-2 rounded-xl bg-white/10 text-slate-100 border border-white/10 flex items-center gap-2 hover:bg-white/20"
            data-testid="moltbot-refresh-projects"
          >
            <RefreshCw size={16} />
            تحديث
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-[#0F172A] to-[#1E1B4B] rounded-2xl p-5 border border-white/10" data-testid="moltbot-stats-total">
            <p className="text-sm text-slate-400">إجمالي المشاريع</p>
            <h3 className="text-3xl font-semibold text-white mt-2">{stats.total}</h3>
          </div>
          <div className="bg-gradient-to-br from-[#0B1F1A] to-[#065F46] rounded-2xl p-5 border border-white/10" data-testid="moltbot-stats-ready">
            <p className="text-sm text-slate-300">مشاريع جاهزة</p>
            <h3 className="text-3xl font-semibold text-white mt-2">{stats.ready}</h3>
          </div>
          <div className="bg-gradient-to-br from-[#1F0A1E] to-[#7C2D12] rounded-2xl p-5 border border-white/10" data-testid="moltbot-stats-resale">
            <p className="text-sm text-slate-300">جاهزة للبيع</p>
            <h3 className="text-3xl font-semibold text-white mt-2">{stats.resale}</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.9fr] gap-6">
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">إنشاء مشروع جديد</h2>
              <div className="space-y-3">
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="اسم المشروع"
                  className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2 text-sm text-white"
                  data-testid="moltbot-project-name-input"
                />
                <input
                  value={form.industry}
                  onChange={(e) => setForm((prev) => ({ ...prev, industry: e.target.value }))}
                  placeholder="النشاط / المجال"
                  className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2 text-sm text-white"
                  data-testid="moltbot-project-industry-input"
                />
                <input
                  value={form.domain}
                  onChange={(e) => setForm((prev) => ({ ...prev, domain: e.target.value }))}
                  placeholder="نطاق مبدئي (اختياري)"
                  className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2 text-sm text-white"
                  data-testid="moltbot-project-domain-input"
                />
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="وصف مختصر للمشروع"
                  className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2 text-sm text-white min-h-[90px]"
                  data-testid="moltbot-project-description-input"
                />
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="w-full rounded-xl bg-gradient-to-r from-[#38BDF8] via-[#6366F1] to-[#F97316] text-white py-2 text-sm font-semibold"
                  data-testid="moltbot-create-project-button"
                >
                  {saving ? 'جارٍ الحفظ...' : 'إنشاء المشروع'}
                </button>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6" data-testid="moltbot-projects-list">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">مشاريع MoltBot</h2>
                {loading && <span className="text-xs text-slate-400">تحميل...</span>}
              </div>
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {projects.length === 0 && (
                  <p className="text-sm text-slate-400">لا توجد مشاريع بعد.</p>
                )}
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => setSelectedId(project.id)}
                    className={`w-full text-right rounded-2xl p-4 border transition-all ${
                      project.id === selectedId
                        ? 'border-sky-400/60 bg-sky-500/10'
                        : 'border-white/5 bg-white/5 hover:bg-white/10'
                    }`}
                    data-testid={`moltbot-project-card-${project.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-white">{project.name}</h3>
                        <p className="text-xs text-slate-400">{project.industry || 'مجال غير محدد'}</p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-slate-200">
                        {statusOptions.find((s) => s.value === project.status)?.label || project.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                      <span>{project.domain || 'بدون نطاق'}</span>
                      <span>{project.resale_ready ? 'جاهز للبيع' : 'خاص'}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">لوحة التحكم التفصيلية</h2>
                  <p className="text-sm text-slate-400">إدارة الموقع المستقل وخيارات إعادة البيع.</p>
                </div>
                {selectedProject && (
                  <span className="inline-flex items-center gap-2 text-xs text-slate-300">
                    <Globe size={14} />
                    {selectedProject.domain || 'نطاق غير محدد'}
                  </span>
                )}
              </div>

              {!selectedProject ? (
                <div className="mt-6 text-sm text-slate-400">اختر مشروعاً من القائمة لعرض التفاصيل.</div>
              ) : (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400">وصف المشروع</p>
                    <p className="text-sm text-slate-100" data-testid="moltbot-project-description">{selectedProject.description || 'لا يوجد وصف بعد.'}</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400">حالة المشروع</label>
                      <select
                        value={selectedProject.status}
                        onChange={(e) => updateProject({ status: e.target.value })}
                        disabled={updating}
                        className="mt-1 w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                        data-testid="moltbot-project-status-select"
                      >
                        {statusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value} className="text-slate-900">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => updateProject({ resale_ready: !selectedProject.resale_ready })}
                      disabled={updating}
                      className="w-full rounded-xl border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 py-2 text-sm flex items-center justify-center gap-2"
                      data-testid="moltbot-project-resale-toggle"
                    >
                      <ShieldCheck size={16} />
                      {selectedProject.resale_ready ? 'إلغاء الجاهزية للبيع' : 'تحديد كجاهز للبيع'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
              <div className="flex items-center gap-3">
                <Sparkles className="text-sky-400" />
                <div>
                  <h3 className="text-lg font-semibold text-white">وكلاء MoltBot متعددي النماذج</h3>
                  <p className="text-xs text-slate-400">
                    {mode === 'editor'
                      ? 'تحرير مشروع FastAPI قائم عبر diff فقط بدون إعادة كتابة كاملة.'
                      : 'توليد مخطط بناء شامل باستخدام GPT + Groq.'}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2" data-testid="moltbot-mode-toggle">
                <button
                  onClick={() => setMode('builder')}
                  className={`px-4 py-2 rounded-xl text-sm border ${
                    mode === 'builder'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-100'
                      : 'bg-white/5 border-white/10 text-slate-300'
                  }`}
                  data-testid="moltbot-builder-mode-button"
                >
                  بناء مشروع
                </button>
                <button
                  onClick={() => setMode('editor')}
                  className={`px-4 py-2 rounded-xl text-sm border ${
                    mode === 'editor'
                      ? 'bg-emerald-500/20 border-emerald-300 text-emerald-100'
                      : 'bg-white/5 border-white/10 text-slate-300'
                  }`}
                  data-testid="moltbot-editor-mode-button"
                >
                  تحرير مشروع قائم
                </button>
              </div>
              <textarea
                value={buildPrompt}
                onChange={(e) => setBuildPrompt(e.target.value)}
                placeholder={
                  mode === 'editor'
                    ? 'صف التعديل المطلوب (إضافة صفحة، تعديل API، إصلاح خطأ) بلغة عربية واضحة.'
                    : 'صف الموقع المطلوب (القطاع، الميزات، الجمهور المستهدف، أسلوب العلامة).'
                }
                className="mt-4 w-full rounded-2xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white min-h-[140px]"
                data-testid={mode === 'editor' ? 'moltbot-editor-prompt' : 'moltbot-build-prompt'}
              />
              {mode === 'editor' && (
                <input
                  value={targetFilesInput}
                  onChange={(e) => setTargetFilesInput(e.target.value)}
                  placeholder="ملفات مستهدفة (اختياري) — افصل بينها بفاصلة"
                  className="mt-3 w-full rounded-2xl bg-white/10 border border-white/10 px-4 py-2 text-sm text-white"
                  data-testid="moltbot-editor-target-files"
                />
              )}
              <button
                onClick={runBuild}
                disabled={buildLoading}
                className="mt-4 w-full rounded-2xl bg-gradient-to-r from-[#22D3EE] via-[#6366F1] to-[#A855F7] text-white py-3 text-sm font-semibold flex items-center justify-center gap-2"
                data-testid="moltbot-run-build-button"
              >
                <Rocket size={18} />
                {buildLoading ? 'جارٍ تشغيل الوكلاء...' : 'تشغيل البناء متعدد الوكلاء'}
              </button>

              {buildResult && (
                <div className="mt-6 space-y-4" data-testid="moltbot-build-results">
                  {buildResult.mode === 'editor' && buildResult.affected_files && (
                    <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4" data-testid="moltbot-affected-files">
                      <h4 className="text-sm font-semibold text-white mb-2">الملفات المتأثرة</h4>
                      <ul className="text-xs text-slate-200 space-y-1">
                        {buildResult.affected_files.map((file) => (
                          <li key={file}>- {file}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {buildResult.mode === 'editor' && buildResult.blocked_files && buildResult.blocked_files.length > 0 && (
                    <div className="bg-red-500/10 border border-red-400/30 rounded-2xl p-4" data-testid="moltbot-blocked-files">
                      <h4 className="text-sm font-semibold text-red-200 mb-2">ملفات تم منع إعادة إنشائها</h4>
                      <ul className="text-xs text-red-100 space-y-1">
                        {buildResult.blocked_files.map((file) => (
                          <li key={file}>- {file}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4">
                    <h4 className="text-sm font-semibold text-white mb-2">الخلاصة الموحدة</h4>
                    <pre className="text-xs text-slate-200 whitespace-pre-wrap" data-testid="moltbot-summary-output">{buildResult.summary}</pre>
                    {buildResult.mode === 'editor' && (
                      <div className="mt-3 space-y-2">
                        <button
                          onClick={async () => {
                            if (!selectedProject) return;
                            if (!buildResult?.summary?.trim()) {
                              toast({ title: 'تنبيه', description: 'لا يوجد patch للمعاينة', variant: 'destructive' });
                              return;
                            }
                            if (buildResult.blocked_files && buildResult.blocked_files.length > 0) {
                              toast({ title: 'تنبيه', description: 'يوجد ملفات محجوبة، راجع النتائج أولاً', variant: 'destructive' });
                              return;
                            }
                            try {
                              setApplyLoading(true);
                              const res = await fetch(`${API_URL}/moltbot/apply`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  project_id: selectedProject.id,
                                  patch: buildResult.summary,
                                  session_id: buildResult.session_id,
                                  dry_run: true
                                })
                              });
                              const data = await res.json();
                              if (!res.ok || data?.success === false) {
                                setPreviewStatus({ success: false, message: data?.message || 'فشل التحقق من التعديل' });
                                toast({ title: 'خطأ', description: data?.message || 'فشل التحقق من التعديل', variant: 'destructive' });
                                return;
                              }
                              setPreviewStatus({ success: true, message: data?.message || 'الـ patch صالح للتطبيق' });
                              toast({ title: 'نجاح', description: data?.message || 'الـ patch صالح للتطبيق' });
                            } catch (e) {
                              setPreviewStatus({ success: false, message: 'تعذر معاينة التعديل' });
                              toast({ title: 'خطأ', description: 'تعذر معاينة التعديل', variant: 'destructive' });
                            } finally {
                              setApplyLoading(false);
                            }
                          }}
                          disabled={applyLoading}
                          className="w-full rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-100 py-2 text-sm"
                          data-testid="moltbot-preview-patch-button"
                        >
                          {applyLoading ? 'جارٍ المعاينة...' : 'معاينة وفحص التعديل'}
                        </button>
                        <button
                          onClick={async () => {
                            if (!selectedProject) return;
                            if (!buildResult?.summary?.trim()) {
                              toast({ title: 'تنبيه', description: 'لا يوجد patch للتطبيق', variant: 'destructive' });
                              return;
                            }
                            if (!previewStatus?.success) {
                              toast({ title: 'تنبيه', description: 'يجب معاينة التعديل أولاً بنجاح', variant: 'destructive' });
                              return;
                            }
                            try {
                              setApplyLoading(true);
                              const res = await fetch(`${API_URL}/moltbot/apply`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  project_id: selectedProject.id,
                                  patch: buildResult.summary,
                                  session_id: buildResult.session_id
                                })
                              });
                              const data = await res.json();
                              if (!res.ok || data?.success === false) {
                                toast({ title: 'خطأ', description: data?.message || 'فشل تطبيق التعديل', variant: 'destructive' });
                                return;
                              }
                              if (data?.patch_id) setLastPatchId(data.patch_id);
                              toast({ title: 'تم', description: data?.message || 'تم تطبيق التعديل بنجاح' });
                            } catch (e) {
                              toast({ title: 'خطأ', description: 'تعذر تطبيق التعديل', variant: 'destructive' });
                            } finally {
                              setApplyLoading(false);
                            }
                          }}
                          disabled={applyLoading}
                          className="w-full rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 py-2 text-sm"
                          data-testid="moltbot-apply-patch-button"
                        >
                          {applyLoading ? 'جارٍ التطبيق...' : 'تطبيق التعديل الآن'}
                        </button>
                        {previewStatus && (
                          <div
                            className={`text-xs rounded-xl px-3 py-2 border ${
                              previewStatus.success
                                ? 'border-emerald-400/40 text-emerald-100 bg-emerald-500/10'
                                : 'border-red-400/40 text-red-100 bg-red-500/10'
                            }`}
                            data-testid="moltbot-preview-status"
                          >
                            {previewStatus.message}
                          </div>
                        )}
                        {lastPatchId && (
                          <button
                            onClick={async () => {
                              if (!selectedProject) return;
                              try {
                                setApplyLoading(true);
                                const res = await fetch(`${API_URL}/moltbot/rollback`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    project_id: selectedProject.id,
                                    patch_id: lastPatchId
                                  })
                                });
                                const data = await res.json();
                                if (!res.ok || data?.success === false) {
                                  toast({ title: 'خطأ', description: data?.message || 'فشل التراجع عن التعديل', variant: 'destructive' });
                                  return;
                                }
                                toast({ title: 'تم', description: data?.message || 'تم التراجع بنجاح' });
                                setLastPatchId(null);
                              } catch (e) {
                                toast({ title: 'خطأ', description: 'تعذر التراجع عن التعديل', variant: 'destructive' });
                              } finally {
                                setApplyLoading(false);
                              }
                            }}
                            disabled={applyLoading}
                            className="w-full rounded-xl bg-red-500/20 border border-red-400/40 text-red-100 py-2 text-sm"
                            data-testid="moltbot-rollback-button"
                          >
                            {applyLoading ? 'جارٍ التراجع...' : 'تراجع (Rollback)'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <h5 className="text-xs font-semibold text-sky-300 mb-2">وكيل التخطيط (GPT)</h5>
                      <pre className="text-xs text-slate-200 whitespace-pre-wrap" data-testid="moltbot-agent-planner-output">{buildResult.agents?.planner}</pre>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <h5 className="text-xs font-semibold text-emerald-300 mb-2">وكيل البناء (GPT)</h5>
                      <pre className="text-xs text-slate-200 whitespace-pre-wrap" data-testid="moltbot-agent-builder-output">{buildResult.agents?.builder}</pre>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <h5 className="text-xs font-semibold text-amber-300 mb-2">وكيل المراجعة (Groq)</h5>
                      <pre className="text-xs text-slate-200 whitespace-pre-wrap" data-testid="moltbot-agent-reviewer-output">{buildResult.agents?.reviewer}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoltBot;
