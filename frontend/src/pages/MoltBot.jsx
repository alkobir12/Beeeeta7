import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  LayoutTemplate,
  Link2,
  Monitor,
  PencilLine,
  Plus,
  Redo2,
  Save,
  Smartphone,
  Tablet,
  Undo2,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { siteBuilderAPI } from '../services/siteBuilderAPI';
import { LIQUID_BUILDER_PAGES } from '../constants/liquidBuilderPages';
import { applyPageCustomizations, buildBlockSnapshot, buildUiSnapshot } from '../utils/pageCustomization';
import { LiquidBuilderBotTab } from '../components/LiquidBuilderBotTab';
import { useCanvasEngine } from '../hooks/useCanvasEngine';

const EMPTY_CONFIG = { labels: {}, hidden: {}, contents: {}, custom_cards: [], block_order: [], positions: {}, styles: {}, assets: {} };
const draftStorageKey = (userId, path) => `moltbot-studio-draft:${userId}:${path}`;
const cloneConfig = (value) => JSON.parse(JSON.stringify(value || {}));

const resolveDisplayName = (item, index, kind = 'بلوك') => {
  const text = String(item?.text || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (text.length >= 4) return text;
  return `${kind} ${index + 1}`;
};

const createCard = () => ({
  id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  title: 'كرت جديد',
  description: '',
  fields: [{ id: `field-${Date.now()}`, label: 'عنوان', value: 'قيمة' }],
});

const DEVICE_PRESETS = {
  mobile: { width: 390, label: 'جوال', icon: Smartphone },
  tablet: { width: 820, label: 'تابلت', icon: Tablet },
  desktop: { width: 1280, label: 'سطح المكتب', icon: Monitor },
};

const buildDefaultManifest = (path, device = 'desktop') => {
  const page = LIQUID_BUILDER_PAGES.find((item) => item.path === path);
  const slug = String(path || '/').replace(/^\//, '') || 'home';
  return {
    pageId: slug,
    version: { current: 'draft', published: null },
    status: 'active',
    device,
    meta: {
      title: page?.label || 'صفحة',
      description: 'Visual editor page',
      slug,
    },
    activeFlags: {
      editable: true,
      locked: false,
      published: false,
      previewMode: false,
    },
    timestamps: {
      createdAt: null,
      updatedAt: null,
      publishedAt: null,
    },
    uiState: {
      selectedElementId: null,
      hoverElementId: null,
      zoom: 100,
      grid: true,
      snap: true,
    },
    security: {
      isValid: true,
      lastValidatedAt: null,
    },
  };
};

export default function MoltBot() {
  const { toast } = useToast();
  const iframeRef = useRef(null);
  const previewRef = useRef(null);
  const appliedRef = useRef([]);

  const [selectedPage, setSelectedPage] = useState('/');
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewWindow, setPreviewWindow] = useState(null);
  const [snapshot, setSnapshot] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [blockRects, setBlockRects] = useState([]);
  const [config, setConfig] = useState(EMPTY_CONFIG);
  const [pageManifest, setPageManifest] = useState(buildDefaultManifest('/'));
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [selectedCustomCardId, setSelectedCustomCardId] = useState('');
  const [leftTab, setLeftTab] = useState('properties');
  const [deviceMode, setDeviceMode] = useState('desktop');
  const [canvasActive, setCanvasActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [uploading, setUploading] = useState(false);

  const session = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('session') || '{}');
    } catch {
      return {};
    }
  }, []);

  const canAccess = useMemo(() => ['manager', 'admin', 'مدير'].includes(String(session?.role || '').toLowerCase()), [session]);
  const userId = String(session?.id || session?.userId || session?.name || 'manager').trim() || 'manager';
  const selectedBlock = useMemo(() => blocks.find((block) => block.testid === selectedBlockId) || null, [blocks, selectedBlockId]);
  const selectedCustomCard = useMemo(() => (config.custom_cards || []).find((card) => card.id === selectedCustomCardId) || null, [config.custom_cards, selectedCustomCardId]);
  const namedBlocks = useMemo(() => blocks.map((block, index) => ({ ...block, displayName: resolveDisplayName(block, index, 'بلوك') })), [blocks]);
  const baseRectMap = useMemo(() => Object.fromEntries(blockRects.map((item) => [item.testid, item])), [blockRects]);

  const canvasElements = useMemo(() => blockRects.map((item) => ({
    id: item.testid,
    x: item.left,
    y: item.top,
    width: item.width,
    height: item.height,
    type: 'block',
  })), [blockRects]);

  const syncPreviewElement = (elementState) => {
    if (!previewDoc || !previewRef.current) return;
    const base = baseRectMap[elementState.id];
    const element = previewDoc.querySelector(`[data-testid="${elementState.id}"]`);
    const frameRect = previewRef.current.getBoundingClientRect();
    if (!element || !base) return;
    const deltaLeft = elementState.x - (base.left || 0);
    const deltaTop = elementState.y - (base.top || 0);
    element.style.position = 'relative';
    element.style.left = `${deltaLeft}px`;
    element.style.top = `${deltaTop}px`;
    element.style.width = `${Math.max(24, elementState.width)}px`;
    element.style.height = `${Math.max(24, elementState.height)}px`;
    if (frameRect) {
      element.dataset.editorFrameLeft = String(frameRect.left);
    }
  };

  const canvasEngine = useCanvasEngine(
    { elements: canvasElements, selectedId: selectedBlockId },
    {
      onChange: (next) => {
        next.elements.forEach(syncPreviewElement);
      },
      onCommit: (next) => {
        const selected = next.elements.find((item) => item.id === next.selectedId) || next.elements.find((item) => item.id === selectedBlockId);
        if (!selected) return;
        const base = baseRectMap[selected.id];
        if (!base) return;
        updatePosition(selected.id, {
          left: selected.x - base.left,
          top: selected.y - base.top,
        });
        updateStyle(selected.id, 'width', `${Math.max(24, selected.width)}px`);
        updateStyle(selected.id, 'height', `${Math.max(24, selected.height)}px`);
      },
    }
  );

  const readDraftOrRemote = async (path) => {
    const draft = localStorage.getItem(draftStorageKey(userId, path));
    if (draft) {
      try {
        return { ...EMPTY_CONFIG, ...JSON.parse(draft) };
      } catch {
        localStorage.removeItem(draftStorageKey(userId, path));
      }
    }
    const response = await siteBuilderAPI.getCustomization({ user_id: userId, path });
    return { ...EMPTY_CONFIG, ...(response.data?.data || {}) };
  };

  const refreshSnapshots = () => {
    if (!previewDoc || !previewWindow) return;
    const nextSnapshot = buildUiSnapshot(260, previewDoc);
    const nextBlocks = buildBlockSnapshot(180, previewDoc);
    setSnapshot(nextSnapshot);
    setBlocks(nextBlocks);

    if (!previewRef.current) return;
    const frameRect = previewRef.current.getBoundingClientRect();
    const nextRects = nextBlocks.map((block) => {
      const element = previewDoc.querySelector(`[data-testid="${block.testid}"]`);
      if (!element) return {
        testid: block.testid,
        text: block.text,
        top: frameRect.top + 18 + (nextBlocks.indexOf(block) * 44),
        left: frameRect.left + 18,
        width: 220,
        height: 42,
      };
      const rect = element.getBoundingClientRect();
      return {
        testid: block.testid,
        text: block.text,
        top: frameRect.top + rect.top,
        left: frameRect.left + rect.left,
        width: rect.width,
        height: rect.height,
      };
    }).filter(Boolean);
    setBlockRects(nextRects);
  };

  useEffect(() => {
    if (!canAccess) return;
    setLoading(true);
    readDraftOrRemote(selectedPage)
      .then((nextConfig) => {
        setConfig(nextConfig);
        setPageManifest({ ...buildDefaultManifest(selectedPage, deviceMode), ...(nextConfig.page_manifest || {}) });
        setUndoStack([]);
        setRedoStack([]);
      })
      .catch(() => toast({ title: 'خطأ', description: 'تعذر تحميل إعدادات الصفحة', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [selectedPage, canAccess]);

  useEffect(() => {
    if (!previewDoc) return;
    applyPageCustomizations(config, appliedRef, previewDoc);
    localStorage.setItem(draftStorageKey(userId, selectedPage), JSON.stringify(config));
    refreshSnapshots();
  }, [config, previewDoc]);

  useEffect(() => {
    const slug = String(selectedPage || '/').replace(/^\//, '') || 'home';
    setPageManifest((prev) => ({
      ...prev,
      pageId: slug,
      device: deviceMode,
      meta: {
        ...(prev.meta || {}),
        title: LIQUID_BUILDER_PAGES.find((item) => item.path === selectedPage)?.label || prev.meta?.title,
        slug,
      },
      uiState: {
        ...(prev.uiState || {}),
        selectedElementId: selectedBlockId || null,
      },
    }));
  }, [deviceMode, selectedPage, selectedBlockId]);

  useEffect(() => {
    if (!previewWindow) return undefined;
    const handler = () => window.requestAnimationFrame(refreshSnapshots);
    previewWindow.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    const timer = window.setInterval(handler, 800);
    return () => {
      previewWindow.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
      window.clearInterval(timer);
    };
  }, [previewWindow, previewDoc, selectedPage]);

  const applyConfig = (nextConfig) => {
    setUndoStack((prev) => [...prev.slice(-49), cloneConfig(config)]);
    setRedoStack([]);
    setConfig(nextConfig);
  };

  const undo = () => {
    if (!undoStack.length) return;
    const previous = cloneConfig(undoStack[undoStack.length - 1]);
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, cloneConfig(config)]);
    setConfig(previous);
  };

  const redo = () => {
    if (!redoStack.length) return;
    const next = cloneConfig(redoStack[redoStack.length - 1]);
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, cloneConfig(config)]);
    setConfig(next);
  };

  const save = async () => {
    try {
      setSaving(true);
      const manifestToSave = {
        ...pageManifest,
        version: {
          current: pageManifest.version?.current || 'draft',
          published: 'published',
        },
        activeFlags: {
          ...(pageManifest.activeFlags || {}),
          published: true,
          previewMode: false,
        },
        timestamps: {
          ...(pageManifest.timestamps || {}),
          updatedAt: new Date().toISOString(),
          publishedAt: new Date().toISOString(),
        },
      };
      const response = await siteBuilderAPI.saveCustomization({ user_id: userId, path: selectedPage, ...config, page_manifest: manifestToSave });
      const nextData = { ...EMPTY_CONFIG, ...(response.data?.data || config) };
      setConfig(nextData);
      setPageManifest(manifestToSave);
      localStorage.removeItem(draftStorageKey(userId, selectedPage));
      setUndoStack([]);
      setRedoStack([]);
      toast({ title: 'تم الحفظ', description: 'يمكنك الآن معاينة الصفحة المعدلة.' });
      refreshSnapshots();
    } catch {
      toast({ title: 'خطأ', description: 'تعذر حفظ التعديلات', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const clearDraft = async () => {
    localStorage.removeItem(draftStorageKey(userId, selectedPage));
    setUndoStack([]);
    setRedoStack([]);
    const nextConfig = await readDraftOrRemote(selectedPage);
    setConfig(nextConfig);
  };

  const updateElement = (testid, bucket, value) => applyConfig({
    ...config,
    [bucket]: {
      ...(config[bucket] || {}),
      [testid]: value,
    },
  });

  const updatePosition = (testid, nextPosition) => applyConfig({
    ...config,
    positions: { ...(config.positions || {}), [testid]: nextPosition },
  });

  const reorderBlock = (draggedId, targetId) => {
    const working = [...(config.block_order?.length ? config.block_order : blocks.map((item) => item.testid))];
    const from = working.indexOf(draggedId);
    const to = working.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = working.splice(from, 1);
    working.splice(to, 0, moved);
    applyConfig({ ...config, block_order: working });
  };

  const updateCard = (cardId, patch) => applyConfig({
    ...config,
    custom_cards: (config.custom_cards || []).map((card) => card.id === cardId ? { ...card, ...patch } : card),
  });

  const addCard = () => {
    const next = createCard();
    applyConfig({ ...config, custom_cards: [...(config.custom_cards || []), next] });
    setSelectedCustomCardId(next.id);
    setLeftTab('properties');
  };

  const addField = (cardId) => updateCard(cardId, {
    fields: [...((config.custom_cards || []).find((card) => card.id === cardId)?.fields || []), { id: `field-${Date.now()}`, label: 'حقل جديد', value: '' }],
  });

  const updateField = (cardId, fieldId, patch) => {
    const card = (config.custom_cards || []).find((item) => item.id === cardId);
    updateCard(cardId, { fields: (card?.fields || []).map((field) => field.id === fieldId ? { ...field, ...patch } : field) });
  };

  const deleteField = (cardId, fieldId) => {
    const card = (config.custom_cards || []).find((item) => item.id === cardId);
    updateCard(cardId, { fields: (card?.fields || []).filter((field) => field.id !== fieldId) });
  };

  const copyBlockStyle = () => {
    if (!selectedBlock) return;
    localStorage.setItem('moltbot-block-clipboard', JSON.stringify({
      label: config.labels?.[selectedBlock.testid] || '',
      content: config.contents?.[selectedBlock.testid] || '',
      hidden: Boolean(config.hidden?.[selectedBlock.testid]),
      position: config.positions?.[selectedBlock.testid] || { left: 0, top: 0 },
      styles: config.styles?.[selectedBlock.testid] || {},
      assets: config.assets?.[selectedBlock.testid] || {},
    }));
    toast({ title: 'تم', description: 'تم نسخ تنسيق البلوك.' });
  };

  const pasteBlockStyle = () => {
    if (!selectedBlock) return;
    try {
      const data = JSON.parse(localStorage.getItem('moltbot-block-clipboard') || 'null');
      if (!data) return;
      applyConfig({
        ...config,
        labels: { ...(config.labels || {}), [selectedBlock.testid]: data.label || '' },
        contents: { ...(config.contents || {}), [selectedBlock.testid]: data.content || '' },
        hidden: { ...(config.hidden || {}), [selectedBlock.testid]: data.hidden || false },
        positions: { ...(config.positions || {}), [selectedBlock.testid]: data.position || { left: 0, top: 0 } },
        styles: { ...(config.styles || {}), [selectedBlock.testid]: data.styles || {} },
        assets: { ...(config.assets || {}), [selectedBlock.testid]: data.assets || {} },
      });
    } catch {
      return;
    }
  };

  const handleBotLocalCommand = async (message) => {
    const text = String(message || '').trim();
    if (text.includes('اعرض') && text.includes('كروت')) {
      setLeftTab('properties');
      return { handled: true, reply: `الكروت الحالية المعروضة: ${blocks.length}` };
    }
    if (text.includes('انتقل') && text.includes('صفحة')) {
      const matched = LIQUID_BUILDER_PAGES.find((page) => text.includes(page.label));
      if (matched) {
        setSelectedPage(matched.path);
        return { handled: true, reply: `تم الانتقال إلى صفحة ${matched.label}.` };
      }
    }
    return { handled: false };
  };

  const updateStyle = (testid, key, value) => applyConfig({
    ...config,
    styles: {
      ...(config.styles || {}),
      [testid]: {
        ...((config.styles || {})[testid] || {}),
        [key]: value,
      },
    },
  });

  const updateAsset = (testid, key, value) => applyConfig({
    ...config,
    assets: {
      ...(config.assets || {}),
      [testid]: {
        ...((config.assets || {})[testid] || {}),
        [key]: value,
      },
    },
  });

  const uploadImage = async (file) => {
    if (!file || !selectedBlock) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/alkabeer-bot/assets/upload?user_id=${encodeURIComponent(userId)}`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error('upload failed');
      const data = await response.json();
      updateAsset(selectedBlock.testid, 'src', data.asset?.download_url || '');
      toast({ title: 'تم الرفع', description: 'تم ربط الصورة بالبلوك الحالي.' });
    } catch {
      toast({ title: 'خطأ', description: 'تعذر رفع الصورة', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" data-testid="moltbot-access-denied">
        <div className="max-w-lg rounded-3xl border border-red-500/20 bg-red-500/5 p-10 text-center">
          <h1 className="text-2xl font-bold text-red-500">صلاحية الوصول مقيدة</h1>
          <p className="mt-2 text-sm text-slate-600">محرر الموقع الكامل متاح للمديرين فقط.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#130c12] text-white" data-testid="moltbot-site-editor-page">
      <div className="sticky top-0 z-30 border-b border-amber-300/10 bg-[#160d14]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={save} disabled={saving} className="rounded-2xl bg-amber-400 px-4 py-3 text-sm font-bold text-[#241512]" data-testid="moltbot-editor-save-button"><Save size={15} className="inline ml-2" />{saving ? 'جار الحفظ...' : 'حفظ'}</button>
            <a href={selectedPage} target="_blank" rel="noreferrer" className="rounded-2xl border border-amber-300/20 bg-white/5 px-4 py-3 text-sm text-amber-100" data-testid="moltbot-editor-preview-link">معاينة</a>
            <button onClick={clearDraft} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white" data-testid="moltbot-editor-clear-draft-button">إعادة ضبط</button>
            <button onClick={undo} disabled={!undoStack.length} className="rounded-2xl border border-white/10 bg-white/5 p-3 disabled:opacity-40" data-testid="moltbot-editor-undo-button"><Undo2 size={16} /></button>
            <button onClick={redo} disabled={!redoStack.length} className="rounded-2xl border border-white/10 bg-white/5 p-3 disabled:opacity-40" data-testid="moltbot-editor-redo-button"><Redo2 size={16} /></button>
            {Object.entries(DEVICE_PRESETS).map(([key, preset]) => {
              const Icon = preset.icon;
              return <button key={key} onClick={() => setDeviceMode(key)} className={`rounded-2xl border p-3 ${deviceMode === key ? 'border-amber-300/30 bg-amber-400/15 text-amber-100' : 'border-white/10 bg-white/5 text-white'}`} data-testid={`moltbot-editor-device-${key}`}><Icon size={16} /></button>;
            })}
          </div>
          <div className="flex items-center gap-4">
            <select value={selectedPage} onChange={(e) => setSelectedPage(e.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-editor-page-select">
              {LIQUID_BUILDER_PAGES.map((page) => <option key={page.path} value={page.path}>{page.label}</option>)}
            </select>
            <div className="hidden md:flex items-center gap-2 rounded-2xl border border-amber-300/10 bg-white/5 p-1" data-testid="moltbot-editor-page-tabs">
              {LIQUID_BUILDER_PAGES.slice(0, 6).map((page) => (
                <button key={page.path} onClick={() => setSelectedPage(page.path)} className={`rounded-2xl px-4 py-2 text-sm ${selectedPage === page.path ? 'bg-amber-400 text-[#241512] font-bold' : 'text-amber-50'}`} data-testid={`moltbot-editor-page-tab-${page.path.replace(/\//g, '-') || 'home'}`}>{page.label}</button>
              ))}
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-amber-50">محرر الصفحات</p>
              <p className="text-xs text-amber-100/60">MoltBot Studio</p>
            </div>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 px-4 pb-3 text-xs text-amber-100/60 lg:px-6">
          <span data-testid="moltbot-editor-manifest-pageid">pageId: {pageManifest.pageId}</span>
          <span data-testid="moltbot-editor-manifest-version">version: {pageManifest.version?.current}</span>
          <span data-testid="moltbot-editor-manifest-status">status: {pageManifest.status}</span>
          <span data-testid="moltbot-editor-manifest-device">device: {pageManifest.device}</span>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1800px] gap-3 p-3 lg:grid-cols-[360px_minmax(0,1fr)_360px] lg:p-4">
        <aside className="rounded-[28px] border border-amber-300/10 bg-[#1a1018] p-4" data-testid="moltbot-editor-left-sidebar">
          <div className="mb-4 flex items-center gap-2">
            <button onClick={() => setLeftTab('properties')} className={`rounded-full px-4 py-2 text-sm ${leftTab === 'properties' ? 'bg-amber-400 text-[#241512] font-bold' : 'bg-white/5 text-white'}`}>الخصائص</button>
            <button onClick={() => setLeftTab('bot')} className={`rounded-full px-4 py-2 text-sm ${leftTab === 'bot' ? 'bg-amber-400 text-[#241512] font-bold' : 'bg-white/5 text-white'}`}>الوكيل</button>
          </div>

          {leftTab === 'bot' ? (
            <LiquidBuilderBotTab session={session} selectedPage={selectedPage} snapshot={snapshot} onCustomizationReceived={(cust) => setConfig((prev) => ({ ...prev, ...cust }))} onLocalCommand={handleBotLocalCommand} />
          ) : selectedCustomCard ? (
            <div className="space-y-4" data-testid="moltbot-editor-custom-card-panel">
              <div className="rounded-3xl border border-cyan-300/15 bg-[#130c12] p-4">
                <p className="text-sm font-bold text-cyan-100">{selectedCustomCard.title || 'كرت مخصص'}</p>
                <p className="mt-1 text-xs text-cyan-100/50">{(selectedCustomCard.fields || []).length} حقول</p>
              </div>
              <div className="space-y-3 rounded-3xl border border-cyan-300/15 bg-[#130c12] p-4">
                <label className="text-xs text-cyan-100/60">عنوان الكرت</label>
                <input value={selectedCustomCard.title || ''} onChange={(e) => updateCard(selectedCustomCard.id, { title: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none" data-testid="moltbot-editor-custom-card-title" />
                <label className="text-xs text-cyan-100/60">الوصف</label>
                <textarea value={selectedCustomCard.description || ''} onChange={(e) => updateCard(selectedCustomCard.id, { description: e.target.value })} className="min-h-[100px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none" data-testid="moltbot-editor-custom-card-description" />
                <button onClick={() => addField(selectedCustomCard.id)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white" data-testid="moltbot-editor-custom-card-add-field">إضافة حقل</button>
              </div>
              <div className="space-y-3 rounded-3xl border border-cyan-300/15 bg-[#130c12] p-4">
                {(selectedCustomCard.fields || []).map((field, index) => (
                  <div key={field.id} className="rounded-2xl border border-white/10 bg-white/5 p-3" data-testid={`moltbot-editor-custom-card-field-${index}`}>
                    <input value={field.label || ''} onChange={(e) => updateField(selectedCustomCard.id, field.id, { label: e.target.value })} placeholder="اسم الحقل" className="mb-2 w-full rounded-xl border border-white/10 bg-[#120b13] px-3 py-2 text-sm text-white outline-none" />
                    <input value={field.value || ''} onChange={(e) => updateField(selectedCustomCard.id, field.id, { value: e.target.value })} placeholder="قيمة الحقل" className="mb-2 w-full rounded-xl border border-white/10 bg-[#120b13] px-3 py-2 text-sm text-white outline-none" />
                    <select value={field.source_testid || ''} onChange={(e) => updateField(selectedCustomCard.id, field.id, { source_testid: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#120b13] px-3 py-2 text-sm text-white outline-none">
                      <option value="">بدون ربط</option>
                      {snapshot.slice(0, 80).map((item) => <option key={item.testid} value={item.testid}>{resolveDisplayName(item, 0, 'عنصر')}</option>)}
                    </select>
                    <button onClick={() => deleteField(selectedCustomCard.id, field.id)} className="mt-2 text-xs text-rose-300">حذف الحقل</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setSelectedCustomCardId('')} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">العودة إلى خصائص الصفحة</button>
            </div>
          ) : selectedBlock ? (
            <div className="space-y-4" data-testid="moltbot-editor-properties-panel">
              <div className="rounded-3xl border border-amber-300/15 bg-[#130c12] p-4">
                <p className="text-sm font-bold text-amber-50">{resolveDisplayName(selectedBlock, 0, 'بلوك')}</p>
                <p className="mt-1 text-xs text-amber-100/50">عنصر حي من الصفحة الحالية</p>
              </div>

              <div className="space-y-3 rounded-3xl border border-amber-300/15 bg-[#130c12] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-100/50">Content</p>
                <label className="text-xs text-amber-100/60">النص</label>
                <textarea value={config.contents?.[selectedBlock.testid] || ''} onChange={(e) => updateElement(selectedBlock.testid, 'contents', e.target.value)} className="min-h-[100px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none" data-testid="moltbot-editor-content-input" />
                <label className="text-xs text-amber-100/60">الصورة (رابط)</label>
                <input value={config.assets?.[selectedBlock.testid]?.src || ''} onChange={(e) => updateAsset(selectedBlock.testid, 'src', e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-editor-image-url-input" />
                <label className="text-xs text-amber-100/60">رفع صورة</label>
                <input type="file" accept="image/*" onChange={(e) => uploadImage(e.target.files?.[0])} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-editor-image-upload-input" />
                <label className="text-xs text-amber-100/60">الرابط</label>
                <input value={config.assets?.[selectedBlock.testid]?.href || ''} onChange={(e) => updateAsset(selectedBlock.testid, 'href', e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-editor-link-input" />
              </div>

              <div className="space-y-3 rounded-3xl border border-amber-300/15 bg-[#130c12] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-100/50">Style</p>
                <div className="grid grid-cols-2 gap-2">
                  <input value={config.styles?.[selectedBlock.testid]?.color || ''} onChange={(e) => updateStyle(selectedBlock.testid, 'color', e.target.value)} placeholder="لون النص" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-editor-style-color" />
                  <input value={config.styles?.[selectedBlock.testid]?.backgroundColor || ''} onChange={(e) => updateStyle(selectedBlock.testid, 'backgroundColor', e.target.value)} placeholder="الخلفية" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-editor-style-background" />
                  <input value={config.styles?.[selectedBlock.testid]?.fontSize || ''} onChange={(e) => updateStyle(selectedBlock.testid, 'fontSize', e.target.value)} placeholder="حجم الخط" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-editor-style-fontsize" />
                  <input value={config.styles?.[selectedBlock.testid]?.fontWeight || ''} onChange={(e) => updateStyle(selectedBlock.testid, 'fontWeight', e.target.value)} placeholder="وزن الخط" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-editor-style-fontweight" />
                  <input value={config.styles?.[selectedBlock.testid]?.opacity || ''} onChange={(e) => updateStyle(selectedBlock.testid, 'opacity', e.target.value)} placeholder="الشفافية" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-editor-style-opacity" />
                  <input value={config.labels?.[selectedBlock.testid] || ''} onChange={(e) => updateElement(selectedBlock.testid, 'labels', e.target.value)} placeholder="اسم بديل" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-editor-label-input" />
                </div>
              </div>

              <div className="space-y-3 rounded-3xl border border-amber-300/15 bg-[#130c12] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-100/50">Layout</p>
                <div className="grid grid-cols-2 gap-2">
                  <input value={config.styles?.[selectedBlock.testid]?.padding || ''} onChange={(e) => updateStyle(selectedBlock.testid, 'padding', e.target.value)} placeholder="Padding" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-editor-layout-padding" />
                  <input value={config.styles?.[selectedBlock.testid]?.margin || ''} onChange={(e) => updateStyle(selectedBlock.testid, 'margin', e.target.value)} placeholder="Margin" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-editor-layout-margin" />
                  <input value={config.styles?.[selectedBlock.testid]?.width || ''} onChange={(e) => updateStyle(selectedBlock.testid, 'width', e.target.value)} placeholder="Width" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-editor-layout-width" />
                  <input value={config.styles?.[selectedBlock.testid]?.height || ''} onChange={(e) => updateStyle(selectedBlock.testid, 'height', e.target.value)} placeholder="Height" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-editor-layout-height" />
                  <input value={config.styles?.[selectedBlock.testid]?.textAlign || ''} onChange={(e) => updateStyle(selectedBlock.testid, 'textAlign', e.target.value)} placeholder="Alignment" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-editor-layout-alignment" />
                </div>
              </div>

              <div className="space-y-3 rounded-3xl border border-amber-300/15 bg-[#130c12] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-100/50">Effects</p>
                <div className="grid grid-cols-2 gap-2">
                  <input value={config.styles?.[selectedBlock.testid]?.borderRadius || ''} onChange={(e) => updateStyle(selectedBlock.testid, 'borderRadius', e.target.value)} placeholder="Border Radius" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-editor-effects-radius" />
                  <input value={config.styles?.[selectedBlock.testid]?.boxShadow || ''} onChange={(e) => updateStyle(selectedBlock.testid, 'boxShadow', e.target.value)} placeholder="Shadow" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-editor-effects-shadow" />
                  <input value={config.styles?.[selectedBlock.testid]?.backdropFilter || ''} onChange={(e) => updateStyle(selectedBlock.testid, 'backdropFilter', e.target.value)} placeholder="Blur" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-editor-effects-blur" />
                </div>
                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span className="text-sm text-white">ظاهر</span>
                  <input type="checkbox" checked={!config.hidden?.[selectedBlock.testid]} onChange={(e) => updateElement(selectedBlock.testid, 'hidden', !e.target.checked)} data-testid="moltbot-editor-visibility-toggle" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={copyBlockStyle} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white" data-testid="moltbot-editor-copy-block-button"><Copy size={14} className="inline ml-2" />نسخ</button>
                <button onClick={pasteBlockStyle} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white" data-testid="moltbot-editor-paste-block-button"><Check size={14} className="inline ml-2" />لصق</button>
                <button onClick={() => updateElement(selectedBlock.testid, 'hidden', true)} className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-200" data-testid="moltbot-editor-hide-block-button"><EyeOff size={14} className="inline ml-2" />إخفاء</button>
                <button onClick={() => setCanvasActive((prev) => !prev)} className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100" data-testid="moltbot-editor-canvas-button"><PencilLine size={14} className="inline ml-2" />Canvas</button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-amber-300/15 bg-[#130c12] p-6 text-center text-sm text-amber-100/60" data-testid="moltbot-editor-empty-properties">اختر بلوكًا من المعاينة أو من قائمة اليمين لتعديل خصائصه.</div>
          )}
        </aside>

        <section className="rounded-[32px] border border-amber-300/10 bg-[#120b13] p-3" data-testid="moltbot-editor-preview-column">
          <div className="mb-3 flex items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-white/5 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">المعاينة الحية</p>
              <p className="text-xs text-amber-100/50">{LIQUID_BUILDER_PAGES.find((page) => page.path === selectedPage)?.label || selectedPage}</p>
            </div>
            <button onClick={() => setCanvasActive((prev) => !prev)} className={`rounded-full px-4 py-2 text-sm ${canvasActive ? 'bg-cyan-400 text-[#241512] font-bold' : 'border border-white/10 bg-white/5 text-white'}`} data-testid="moltbot-editor-canvas-toggle">Canvas</button>
          </div>
          <div ref={previewRef} className="relative mx-auto overflow-hidden rounded-[28px] border border-amber-300/15 bg-black shadow-2xl shadow-black/35" style={{ width: `min(100%, ${DEVICE_PRESETS[deviceMode].width}px)`, minHeight: '78vh' }}>
            <iframe
              key={`${selectedPage}-${deviceMode}`}
              ref={iframeRef}
              title="moltbot-live-preview"
              src={`${selectedPage}${selectedPage.includes('?') ? '&' : '?'}editor-preview=1`}
              className="h-[78vh] w-full border-0 bg-white"
              data-testid="moltbot-editor-preview-iframe"
              onLoad={() => {
                const frame = iframeRef.current;
                const doc = frame?.contentDocument;
                const win = frame?.contentWindow;
                setPreviewDoc(doc || null);
                setPreviewWindow(win || null);
                window.setTimeout(refreshSnapshots, 400);
              }}
            />

            {canvasActive ? canvasEngine.state.elements.map((item, index) => {
              const frameRect = previewRef.current?.getBoundingClientRect();
              if (!frameRect) return null;
              const selected = selectedBlockId === item.id;
              return (
                <div key={item.id} className="absolute z-20" style={{ top: item.y - frameRect.top, left: item.x - frameRect.left, width: item.width, height: item.height }} data-testid={`moltbot-editor-canvas-element-${index}`}>
                  <div className={`pointer-events-none absolute inset-0 rounded-xl border-2 ${selected ? 'border-cyan-300 shadow-[0_0_0_4px_rgba(34,211,238,0.12)]' : 'border-white/30'}`} />
                  <button
                    type="button"
                    onClick={() => { setSelectedBlockId(item.id); canvasEngine.selectElement(item.id); }}
                    onMouseDown={(event) => canvasEngine.startDrag(event, item.id)}
                    className={`absolute -top-4 left-2 rounded-full px-3 py-1 text-[11px] shadow-lg backdrop-blur-md ${selected ? 'bg-cyan-400 text-[#241512]' : 'bg-black/75 text-white'}`}
                    data-testid={`moltbot-editor-live-handle-${index}`}
                  >
                    <GripVertical size={12} className="inline ml-1" /> {resolveDisplayName(item, index, 'بلوك')}
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => canvasEngine.startResize(event, item.id, 'right-bottom')}
                    className="absolute -bottom-2 -left-2 h-5 w-5 rounded-full border border-cyan-300 bg-cyan-400 shadow"
                    data-testid={`moltbot-editor-live-resize-${index}`}
                  />
                </div>
              );
            }) : null}
          </div>
        </section>

        <aside className="rounded-[28px] border border-amber-300/10 bg-[#1a1018] p-4" data-testid="moltbot-editor-right-sidebar">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-white">هيكل الصفحة</p>
              <p className="text-xs text-amber-100/50">{blocks.length} بلوك • {(config.custom_cards || []).length} كروت مخصصة</p>
            </div>
            <button onClick={addCard} className="rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-[#241512]" data-testid="moltbot-editor-add-card-button"><Plus size={14} className="inline ml-2" />كرت</button>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[78vh] pr-1" data-testid="moltbot-editor-blocks-list">
            {namedBlocks.map((block, index) => (
              <div
                key={block.testid}
                draggable
                onDragStart={(event) => event.dataTransfer.setData('text/plain', block.testid)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  reorderBlock(event.dataTransfer.getData('text/plain'), block.testid);
                }}
                onClick={() => { setSelectedBlockId(block.testid); canvasEngine.selectElement(block.testid); setLeftTab('properties'); }}
                className={`rounded-2xl border px-4 py-3 cursor-pointer ${selectedBlockId === block.testid ? 'border-amber-300/40 bg-amber-400/10' : 'border-white/10 bg-white/5'}`}
                data-testid={`moltbot-editor-block-${index}`}
              >
                <div className="flex items-center gap-3">
                  <GripVertical size={14} className="text-amber-100/50" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{block.displayName}</p>
                    <p className="truncate text-xs text-amber-100/50">بلوك قابل للتحرير</p>
                  </div>
                </div>
              </div>
            ))}

            {(config.custom_cards || []).length ? <div className="pt-3 text-xs font-bold text-amber-100/60">الكروت المخصصة</div> : null}
            {(config.custom_cards || []).map((card, index) => (
              <div key={card.id} onClick={() => { setSelectedCustomCardId(card.id); setLeftTab('properties'); }} className={`rounded-2xl border px-4 py-3 cursor-pointer ${selectedCustomCardId === card.id ? 'border-cyan-300/40 bg-cyan-500/10' : 'border-white/10 bg-white/5'}`} data-testid={`moltbot-editor-custom-card-${index}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{card.title || `كرت ${index + 1}`}</p>
                    <p className="text-xs text-amber-100/50">{(card.fields || []).length} حقول</p>
                  </div>
                  <LayoutTemplate size={14} className="text-cyan-200" />
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}