import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  ClipboardPaste,
  Copy,
  Droplets,
  GripVertical,
  Layers3,
  LayoutPanelTop,
  ListFilter,
  PencilLine,
  Plus,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import { siteBuilderAPI } from '../services/siteBuilderAPI';
import { applyPageCustomizations, buildBlockSnapshot, buildUiSnapshot } from '../utils/pageCustomization';
import { LIQUID_BUILDER_PAGES } from '../constants/liquidBuilderPages';
import { LiquidBuilderBotTab } from './LiquidBuilderBotTab';
import { LiquidCanvasOverlay } from './LiquidCanvasOverlay';

const EMPTY_CONFIG = { labels: {}, hidden: {}, contents: {}, custom_cards: [], block_order: [], positions: {} };

const createCard = () => ({
  id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  title: 'كرت جديد',
  description: '',
  fields: [{ id: `field-${Date.now()}`, label: 'عنوان', value: 'قيمة' }],
});

const loadClipboard = () => {
  try {
    return JSON.parse(localStorage.getItem('liquid-builder-clipboard') || 'null');
  } catch {
    return null;
  }
};

const cloneConfig = (value) => JSON.parse(JSON.stringify(value || {}));
const draftStorageKey = (userId, path) => `liquid-builder-draft:${userId}:${path}`;

const humanizeTestid = (value = '') => String(value)
  .replace(/[-_]/g, ' ')
  .replace(/(page|card|panel|section|widget|dock|value|title|button|list|block|editor|custom)/gi, '')
  .replace(/[a-z]{1,3}/gi, '')
  .replace(/\d+\b/g, '')
  .replace(/\s{2,}/g, ' ')
  .trim() || 'عنصر في الصفحة';

const previewText = (value = '') => String(value).trim().replace(/\s+/g, ' ').slice(0, 80);

const resolveDisplayName = (item, index, kind = 'عنصر') => {
  const text = previewText(item?.text || '');
  const humanized = humanizeTestid(item?.testid || '');
  if (text && text.length >= 4) return text;
  if (humanized && humanized !== 'عنصر في الصفحة') return humanized;
  return `${kind} ${index + 1}`;
};

const MobileHandle = () => (
  <div className="mx-auto h-1.5 w-16 rounded-full bg-zinc-200 lg:hidden" />
);

export const LiquidSiteBuilder = ({ session, currentPath, onCustomizationSaved }) => {
  const navigate = useNavigate();
  const appliedRef = useRef([]);

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('elements');
  const [detailView, setDetailView] = useState({ type: 'main', id: null });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [snapshot, setSnapshot] = useState([]);
  const [blockSnapshot, setBlockSnapshot] = useState([]);
  const [config, setConfig] = useState(EMPTY_CONFIG);
  const [saving, setSaving] = useState(false);
  const [selectedPage, setSelectedPage] = useState(currentPath || '/');
  const [elementSearch, setElementSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [onlyCustomized, setOnlyCustomized] = useState(false);
  const [elementsPage, setElementsPage] = useState(1);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [cardMoveTargets, setCardMoveTargets] = useState({});
  const [clipboard, setClipboard] = useState(() => loadClipboard());
  const [canvasActive, setCanvasActive] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const canEdit = useMemo(() => ['manager', 'admin', 'مدير'].includes(String(session?.role || '').toLowerCase()), [session?.role]);
  const userId = String(session?.id || session?.userId || session?.name || 'manager').trim() || 'manager';
  const currentPageMeta = useMemo(() => LIQUID_BUILDER_PAGES.find((page) => page.path === selectedPage) || { path: selectedPage, label: humanizeTestid(selectedPage) }, [selectedPage]);

  useEffect(() => {
    setSelectedPage(currentPath || '/');
  }, [currentPath]);

  useEffect(() => {
    setDetailView({ type: 'main', id: null });
  }, [activeTab, selectedPage]);

  useEffect(() => {
    if (!canEdit || !isOpen) return;
    const draft = localStorage.getItem(draftStorageKey(userId, selectedPage));
    if (draft) {
      try {
        setConfig({ ...EMPTY_CONFIG, ...JSON.parse(draft) });
        setUndoStack([]);
        setRedoStack([]);
        return;
      } catch {
        localStorage.removeItem(draftStorageKey(userId, selectedPage));
      }
    }
    siteBuilderAPI.getCustomization({ user_id: userId, path: selectedPage })
      .then((response) => {
        setConfig({ ...EMPTY_CONFIG, ...(response.data?.data || {}) });
        setUndoStack([]);
        setRedoStack([]);
      })
      .catch((error) => console.error('Failed to load builder customization', error));
  }, [canEdit, selectedPage, isOpen, userId]);

  useEffect(() => {
    if (!canEdit || !isOpen) return;
    const refreshSnapshots = () => {
      setSnapshot(buildUiSnapshot());
      setBlockSnapshot(buildBlockSnapshot());
    };

    refreshSnapshots();
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(refreshSnapshots, 180);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const slowTimer = window.setTimeout(refreshSnapshots, 2200);
    return () => {
      observer.disconnect();
      window.clearTimeout(debounceTimer);
      window.clearTimeout(slowTimer);
    };
  }, [canEdit, isOpen, currentPath]);

  if (!canEdit) return null;

  const groupOptions = Array.from(new Set(snapshot.map((item) => String(item.testid || '').split('-')[0]).filter(Boolean)));
  const filteredSnapshot = snapshot.filter((item) => {
    const text = `${item.testid} ${item.text}`.toLowerCase();
    const matchesSearch = !elementSearch.trim() || text.includes(elementSearch.toLowerCase());
    const matchesGroup = groupFilter === 'all' || String(item.testid || '').startsWith(`${groupFilter}-`);
    const customized = config.labels?.[item.testid] || config.contents?.[item.testid] || config.hidden?.[item.testid];
    return matchesSearch && matchesGroup && (!onlyCustomized || customized);
  });
  const itemsPerPage = 8;
  const totalElementPages = Math.max(1, Math.ceil(filteredSnapshot.length / itemsPerPage));
  const paginatedSnapshot = filteredSnapshot.slice((elementsPage - 1) * itemsPerPage, elementsPage * itemsPerPage);
  const orderedBlocks = (config.block_order?.length ? config.block_order : blockSnapshot.map((item) => item.testid))
    .map((testid) => blockSnapshot.find((item) => item.testid === testid))
    .filter(Boolean);
  const namedElements = paginatedSnapshot.map((item, index) => ({ ...item, displayName: resolveDisplayName(item, index, 'عنصر') }));
  const namedBlocks = orderedBlocks.map((item, index) => ({ ...item, displayName: resolveDisplayName(item, index, 'كرت') }));

  const currentElement = snapshot.find((item) => item.testid === detailView.id) || null;
  const currentLiveBlock = orderedBlocks.find((item) => item.testid === detailView.id) || null;
  const currentCustomCard = (config.custom_cards || []).find((card) => card.id === detailView.id) || null;

  const setClipboardData = (nextClipboard) => {
    setClipboard(nextClipboard);
    localStorage.setItem('liquid-builder-clipboard', JSON.stringify(nextClipboard));
  };

  const applyDraftConfig = (nextConfig) => {
    setConfig(nextConfig);
    localStorage.setItem(draftStorageKey(userId, selectedPage), JSON.stringify(nextConfig));
    if (selectedPage === currentPath) {
      applyPageCustomizations(nextConfig, appliedRef);
      window.dispatchEvent(new CustomEvent('page-customization-preview', { detail: nextConfig }));
    }
  };

  const updateConfig = (nextConfig) => {
    setUndoStack((prev) => [...prev.slice(-39), cloneConfig(config)]);
    setRedoStack([]);
    applyDraftConfig(nextConfig);
  };

  const undoLast = () => {
    if (!undoStack.length) return;
    const previous = cloneConfig(undoStack[undoStack.length - 1]);
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, cloneConfig(config)]);
    applyDraftConfig(previous);
  };

  const redoLast = () => {
    if (!redoStack.length) return;
    const next = cloneConfig(redoStack[redoStack.length - 1]);
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, cloneConfig(config)]);
    applyDraftConfig(next);
  };

  const clearDraft = async () => {
    localStorage.removeItem(draftStorageKey(userId, selectedPage));
    setUndoStack([]);
    setRedoStack([]);
    const response = await siteBuilderAPI.getCustomization({ user_id: userId, path: selectedPage });
    const nextConfig = { ...EMPTY_CONFIG, ...(response.data?.data || {}) };
    setConfig(nextConfig);
    if (selectedPage === currentPath) {
      applyPageCustomizations(nextConfig, appliedRef);
      window.dispatchEvent(new CustomEvent('page-customization-preview', { detail: nextConfig }));
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      const response = await siteBuilderAPI.saveCustomization({
        user_id: userId,
        path: selectedPage,
        labels: config.labels || {},
        hidden: config.hidden || {},
        contents: config.contents || {},
        custom_cards: config.custom_cards || [],
        block_order: config.block_order || [],
        positions: config.positions || {},
      });
      const nextData = { ...EMPTY_CONFIG, ...(response.data?.data || config) };
      setConfig(nextData);
      localStorage.removeItem(draftStorageKey(userId, selectedPage));
      setUndoStack([]);
      setRedoStack([]);
      if (selectedPage === currentPath) {
        applyPageCustomizations(nextData, appliedRef);
        window.dispatchEvent(new CustomEvent('page-customization-updated', { detail: nextData }));
      }
      onCustomizationSaved?.(nextData);
    } catch (error) {
      console.error('Failed to save builder customization', error);
    } finally {
      setSaving(false);
    }
  };

  const navigateToPage = (path) => {
    setSelectedPage(path);
    setElementsPage(1);
    if (path !== currentPath) navigate(path);
  };

  const updateElement = (testid, key, value) => {
    updateConfig({
      ...config,
      [key]: {
        ...(config[key] || {}),
        [testid]: value,
      },
    });
  };

  const removeElementOverride = (testid, key) => {
    const bucket = { ...(config[key] || {}) };
    delete bucket[testid];
    updateConfig({ ...config, [key]: bucket });
  };

  const updateCard = (cardId, patch) => updateConfig({
    ...config,
    custom_cards: (config.custom_cards || []).map((card) => card.id === cardId ? { ...card, ...patch } : card),
  });

  const addField = (cardId) => updateCard(cardId, {
    fields: [
      ...((config.custom_cards || []).find((card) => card.id === cardId)?.fields || []),
      { id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, label: 'حقل جديد', value: 'قيمة جديدة' },
    ],
  });

  const updateField = (cardId, fieldId, patch) => {
    const card = (config.custom_cards || []).find((item) => item.id === cardId);
    const fields = (card?.fields || []).map((field) => field.id === fieldId ? { ...field, ...patch } : field);
    updateCard(cardId, { fields });
  };

  const removeField = (cardId, fieldId) => {
    const card = (config.custom_cards || []).find((item) => item.id === cardId);
    updateCard(cardId, { fields: (card?.fields || []).filter((field) => field.id !== fieldId) });
  };

  const copyLiveBlock = (testid) => {
    setSelectedBlockId(testid);
    setClipboardData({
      type: 'live-block',
      testid,
      label: config.labels?.[testid] || '',
      content: config.contents?.[testid] || '',
      hidden: Boolean(config.hidden?.[testid]),
      position: config.positions?.[testid] || { left: 0, top: 0 },
    });
  };

  const pasteLiveBlock = (targetTestid = selectedBlockId) => {
    if (!clipboard || clipboard.type !== 'live-block' || !targetTestid) return;
    updateConfig({
      ...config,
      labels: { ...(config.labels || {}), [targetTestid]: clipboard.label || '' },
      contents: { ...(config.contents || {}), [targetTestid]: clipboard.content || '' },
      hidden: { ...(config.hidden || {}), [targetTestid]: clipboard.hidden || false },
      positions: { ...(config.positions || {}), [targetTestid]: clipboard.position || { left: 0, top: 0 } },
    });
  };

  const copyCustomCard = (card) => {
    setSelectedCardId(card.id);
    setClipboardData({ type: 'custom-card', card: { ...card, id: undefined } });
  };

  const pasteCustomCard = () => {
    if (!clipboard || clipboard.type !== 'custom-card') return;
    const nextCard = {
      ...(clipboard.card || {}),
      id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `${clipboard.card?.title || 'كرت'} (نسخة)`,
    };
    updateConfig({ ...config, custom_cards: [...(config.custom_cards || []), nextCard] });
  };

  const moveCardToPage = async (cardId) => {
    const targetPath = cardMoveTargets[cardId];
    if (!targetPath || targetPath === selectedPage) return;
    const card = (config.custom_cards || []).find((item) => item.id === cardId);
    if (!card) return;
    try {
      const targetResponse = await siteBuilderAPI.getCustomization({ user_id: userId, path: targetPath });
      const targetConfig = { ...EMPTY_CONFIG, ...(targetResponse.data?.data || {}) };
      const movedCard = { ...card, id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
      await siteBuilderAPI.saveCustomization({
        user_id: userId,
        path: targetPath,
        labels: targetConfig.labels,
        hidden: targetConfig.hidden,
        contents: targetConfig.contents,
        custom_cards: [...(targetConfig.custom_cards || []), movedCard],
        block_order: targetConfig.block_order,
        positions: targetConfig.positions,
      });
      updateConfig({ ...config, custom_cards: (config.custom_cards || []).filter((item) => item.id !== cardId) });
      setDetailView({ type: 'main', id: null });
    } catch (error) {
      console.error('Failed to move card between pages', error);
    }
  };

  const reorderBlocks = (draggedId, targetId) => {
    const working = [...(config.block_order?.length ? config.block_order : blockSnapshot.map((item) => item.testid))];
    const from = working.indexOf(draggedId);
    const to = working.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = working.splice(from, 1);
    working.splice(to, 0, moved);
    updateConfig({ ...config, block_order: working });
  };

  const updateBlockPosition = (testid, nextPosition) => {
    updateConfig({
      ...config,
      positions: {
        ...(config.positions || {}),
        [testid]: nextPosition,
      },
    });
  };

  const inlineEditBlock = (testid, text) => updateElement(testid, 'contents', text);

  const handleLocalBotCommand = async (message) => {
    const text = String(message || '').trim();
    if (!text) return { handled: false };
    if (text.includes('اعرض') && text.includes('كروت') && text.includes('هذه الصفحة')) {
      setActiveTab('cards');
      return { handled: true, reply: 'فتحت لك كروت الصفحة الحالية بشكل مبسط.' };
    }
    if (text.includes('اعرض') && text.includes('عناصر')) {
      setActiveTab('elements');
      return { handled: true, reply: 'فتحت لك عناصر الصفحة الحالية.' };
    }
    if (text.includes('انتقل') && text.includes('صفحة')) {
      const matchedPage = LIQUID_BUILDER_PAGES.find((page) => text.includes(page.label) || text.includes(page.path));
      if (matchedPage) {
        navigateToPage(matchedPage.path);
        return { handled: true, reply: `تم الانتقال إلى صفحة ${matchedPage.label}.` };
      }
    }
    if (text.includes('اربط هذا الكرت') && text.includes('أعلى 3')) {
    const targetCard = (config.custom_cards || []).find((card) => card.id === selectedCardId) || (config.custom_cards || [])[0];
      if (!targetCard) {
        return { handled: true, reply: 'حدد كرتًا مخصصًا أولًا ثم أعد الطلب.' };
      }
      const topBlocks = orderedBlocks.slice(0, 3);
      updateCard(targetCard.id, {
        fields: topBlocks.map((block, index) => ({
          id: `field-${Date.now()}-${index}`,
          label: `مؤشر ${index + 1}`,
          value: block.text,
          source_testid: block.testid,
        })),
      });
      return { handled: true, reply: `تم ربط الكرت "${targetCard.title}" بأعلى 3 مؤشرات في الصفحة.` };
    }
    return { handled: false };
  };

  const renderDetailHeader = (title, subtitle) => (
    <div className="mb-4 flex items-start gap-3">
      <button type="button" onClick={() => setDetailView({ type: 'main', id: null })} className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm" data-testid="liquid-site-builder-detail-back-button">
        <ArrowRight size={16} />
      </button>
      <div>
        <p className="text-lg font-semibold text-zinc-900">{title}</p>
        {subtitle ? <p className="mt-1 text-xs text-zinc-500">{subtitle}</p> : null}
      </div>
    </div>
  );

  const renderElementDetail = () => {
    if (!currentElement) return null;
    return (
      <div className="space-y-4" data-testid="liquid-site-builder-element-detail-view">
        {renderDetailHeader('تحرير عنصر', resolveDisplayName(currentElement, 0, 'عنصر'))}
        <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 rounded-[20px] bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{previewText(currentElement.text) || 'بدون نص ظاهر'}</div>
          <input value={config.labels?.[currentElement.testid] || ''} onChange={(event) => updateElement(currentElement.testid, 'labels', event.target.value)} placeholder="اسم بديل يظهر لك داخل الواجهة" className="mb-3 w-full rounded-[20px] border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none" data-testid="liquid-site-builder-element-detail-label" />
          <textarea value={config.contents?.[currentElement.testid] || ''} onChange={(event) => updateElement(currentElement.testid, 'contents', event.target.value)} placeholder="محتوى بديل يظهر بدل النص الحالي" className="min-h-[120px] w-full rounded-[20px] border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none" data-testid="liquid-site-builder-element-detail-content" />
          <label className="mt-3 flex items-center justify-between rounded-[20px] border border-zinc-200 px-4 py-3 text-sm text-zinc-700">
            <span>إخفاء هذا العنصر</span>
            <input type="checkbox" checked={Boolean(config.hidden?.[currentElement.testid])} onChange={(event) => updateElement(currentElement.testid, 'hidden', event.target.checked)} data-testid="liquid-site-builder-element-detail-visibility" />
          </label>
          {showAdvanced ? <p className="mt-3 text-[11px] text-zinc-400">الاسم الداخلي محفوظ في النظام وغير ظاهر للمستخدم.</p> : null}
        </div>
      </div>
    );
  };

  const renderLiveCardDetail = () => {
    if (!currentLiveBlock) return null;
    return (
      <div className="space-y-4" data-testid="liquid-site-builder-live-card-detail-view">
        {renderDetailHeader('تحرير كرت حالي', resolveDisplayName(currentLiveBlock, 0, 'كرت'))}
        <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 rounded-[20px] bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{previewText(currentLiveBlock.text) || 'بدون نص ظاهر'}</div>
          <input value={config.labels?.[currentLiveBlock.testid] || ''} onChange={(event) => updateElement(currentLiveBlock.testid, 'labels', event.target.value)} placeholder="اسم بديل للكرت الحالي" className="mb-3 w-full rounded-[20px] border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none" data-testid="liquid-site-builder-live-card-detail-label" />
          <textarea value={config.contents?.[currentLiveBlock.testid] || ''} onChange={(event) => updateElement(currentLiveBlock.testid, 'contents', event.target.value)} placeholder="محتوى بديل للكرت الحالي" className="min-h-[120px] w-full rounded-[20px] border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none" data-testid="liquid-site-builder-live-card-detail-content" />
          <label className="mt-3 flex items-center justify-between rounded-[20px] border border-zinc-200 px-4 py-3 text-sm text-zinc-700">
            <span>إخفاء هذا الكرت</span>
            <input type="checkbox" checked={Boolean(config.hidden?.[currentLiveBlock.testid])} onChange={(event) => updateElement(currentLiveBlock.testid, 'hidden', event.target.checked)} data-testid="liquid-site-builder-live-card-detail-visibility" />
          </label>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => copyLiveBlock(currentLiveBlock.testid)} className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm" data-testid="liquid-site-builder-live-card-detail-copy">نسخ</button>
            <button type="button" onClick={() => pasteLiveBlock(currentLiveBlock.testid)} disabled={!clipboard || clipboard.type !== 'live-block'} className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm disabled:opacity-50" data-testid="liquid-site-builder-live-card-detail-paste">لصق</button>
          </div>
          {showAdvanced ? <p className="mt-3 text-[11px] text-zinc-400">الاسم الداخلي محفوظ في النظام وغير ظاهر للمستخدم.</p> : null}
        </div>
      </div>
    );
  };

  const renderCustomCardDetail = () => {
    if (!currentCustomCard) return null;
    return (
      <div className="space-y-4" data-testid="liquid-site-builder-custom-card-detail-view">
        {renderDetailHeader('تحرير كرت مخصص', currentCustomCard.title)}
        <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
          <input value={currentCustomCard.title || ''} onChange={(event) => updateCard(currentCustomCard.id, { title: event.target.value })} placeholder="عنوان الكرت" className="mb-3 w-full rounded-[20px] border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none" data-testid="liquid-site-builder-custom-editor-title" />
          <textarea value={currentCustomCard.description || ''} onChange={(event) => updateCard(currentCustomCard.id, { description: event.target.value })} placeholder="وصف مختصر" className="min-h-[110px] w-full rounded-[20px] border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none" data-testid="liquid-site-builder-custom-editor-description" />
        </div>

        <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-900">الحقول</p>
            <button type="button" onClick={() => addField(currentCustomCard.id)} className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700" data-testid="liquid-site-builder-custom-editor-add-field">إضافة حقل</button>
          </div>
          <div className="space-y-3">
            {(currentCustomCard.fields || []).map((field, fieldIndex) => (
              <div key={field.id} className="rounded-[20px] border border-zinc-200 bg-zinc-50 p-3" data-testid={`liquid-site-builder-custom-editor-field-${fieldIndex}`}>
                <input value={field.label || `حقل ${fieldIndex + 1}`} onChange={(event) => updateField(currentCustomCard.id, field.id, { label: event.target.value })} placeholder="اسم الحقل" className="mb-2 w-full rounded-[16px] border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none" data-testid={`liquid-site-builder-custom-editor-field-label-${fieldIndex}`} />
                <input value={field.value || ''} onChange={(event) => updateField(currentCustomCard.id, field.id, { value: event.target.value })} placeholder="القيمة" className="mb-2 w-full rounded-[16px] border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none" data-testid={`liquid-site-builder-custom-editor-field-value-${fieldIndex}`} />
                <select value={field.source_testid || ''} onChange={(event) => updateField(currentCustomCard.id, field.id, { source_testid: event.target.value })} className="w-full rounded-[16px] border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none" data-testid={`liquid-site-builder-custom-editor-field-source-${fieldIndex}`}>
                  <option value="">ربط يدوي فقط</option>
                  {snapshot.slice(0, 80).map((item, index) => <option key={item.testid} value={item.testid}>{resolveDisplayName(item, index, 'عنصر')}</option>)}
                </select>
                <button type="button" onClick={() => removeField(currentCustomCard.id, field.id)} className="mt-2 text-xs text-rose-600" data-testid={`liquid-site-builder-custom-editor-field-delete-${fieldIndex}`}>حذف الحقل</button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => copyCustomCard(currentCustomCard)} className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-700" data-testid="liquid-site-builder-custom-editor-copy">نسخ الكرت</button>
            <button type="button" onClick={pasteCustomCard} disabled={!clipboard || clipboard.type !== 'custom-card'} className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-700 disabled:opacity-50" data-testid="liquid-site-builder-paste-card-button">لصق كرت</button>
          </div>
          <div className="mt-3 flex gap-2">
            <select value={cardMoveTargets[currentCustomCard.id] || ''} onChange={(event) => setCardMoveTargets((prev) => ({ ...prev, [currentCustomCard.id]: event.target.value }))} className="flex-1 rounded-[18px] border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none" data-testid="liquid-site-builder-custom-editor-move-select">
              <option value="">انقل إلى صفحة...</option>
              {LIQUID_BUILDER_PAGES.filter((page) => page.path !== selectedPage).map((page) => <option key={page.path} value={page.path}>{page.label}</option>)}
            </select>
            <button type="button" onClick={() => moveCardToPage(currentCustomCard.id)} className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-700" data-testid="liquid-site-builder-custom-editor-move">نقل</button>
          </div>
          <button type="button" onClick={() => {
            updateConfig({ ...config, custom_cards: (config.custom_cards || []).filter((item) => item.id !== currentCustomCard.id) });
            setDetailView({ type: 'main', id: null });
          }} className="mt-3 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700" data-testid="liquid-site-builder-custom-editor-delete">حذف الكرت</button>
        </div>
      </div>
    );
  };

  const renderMainElements = () => (
    <div className="space-y-4" data-testid="liquid-site-builder-elements-tab">
      <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900"><ListFilter size={16} /> عناصر الصفحة</div>
        <div className="grid grid-cols-2 gap-2">
          <input value={elementSearch} onChange={(event) => { setElementSearch(event.target.value); setElementsPage(1); }} placeholder="ابحث عن عنصر" className="col-span-2 rounded-[18px] border border-zinc-200 px-4 py-3 text-sm outline-none" data-testid="liquid-site-builder-elements-search" />
          <select value={groupFilter} onChange={(event) => { setGroupFilter(event.target.value); setElementsPage(1); }} className="rounded-[18px] border border-zinc-200 px-3 py-3 text-sm outline-none" data-testid="liquid-site-builder-elements-group-filter">
            <option value="all">كل المجموعات</option>
            {groupOptions.map((group) => <option key={group} value={group}>{group}</option>)}
          </select>
          <label className="flex items-center justify-between rounded-[18px] border border-zinc-200 px-3 py-3 text-sm text-zinc-700">
            <span>المعدلة فقط</span>
            <input type="checkbox" checked={onlyCustomized} onChange={(event) => { setOnlyCustomized(event.target.checked); setElementsPage(1); }} data-testid="liquid-site-builder-elements-customized-filter" />
          </label>
        </div>
        <div className="mt-3 rounded-full bg-zinc-100 px-4 py-2 text-xs text-zinc-600" data-testid="liquid-site-builder-elements-meta">{filteredSnapshot.length} عنصر • صفحة {elementsPage} / {totalElementPages}</div>
      </div>

      <div className="space-y-2">
        {namedElements.map((item, index) => (
          <button key={item.testid} type="button" onClick={() => setDetailView({ type: 'element', id: item.testid })} className="w-full rounded-[24px] border border-zinc-200 bg-white px-4 py-4 text-right shadow-sm transition hover:border-zinc-300" data-testid={`liquid-site-builder-element-${index}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{item.displayName}</p>
                <p className="mt-1 text-xs text-zinc-500">{previewText(item.text) || 'بدون نص ظاهر'}</p>
              </div>
              <PencilLine size={16} className="text-zinc-400" />
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-[24px] border border-zinc-200 bg-white p-3 text-sm text-zinc-700 shadow-sm" data-testid="liquid-site-builder-elements-pagination">
        <button type="button" onClick={() => setElementsPage((page) => Math.max(1, page - 1))} className="rounded-full border border-zinc-200 px-4 py-2">السابق</button>
        <span>{elementsPage} / {totalElementPages}</span>
        <button type="button" onClick={() => setElementsPage((page) => Math.min(totalElementPages, page + 1))} className="rounded-full border border-zinc-200 px-4 py-2">التالي</button>
      </div>
    </div>
  );

  const renderMainCards = () => (
    <div className="space-y-4" data-testid="liquid-site-builder-cards-tab">
      <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm" data-testid="liquid-site-builder-live-cards-section">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">الكروت الحالية للصفحة</p>
            <p className="mt-1 text-xs text-zinc-500">اضغط على أي كرت لتعديله بشكل منفصل وواضح.</p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] text-zinc-600" data-testid="liquid-site-builder-live-cards-count">{orderedBlocks.length} كرت/بلوك</span>
        </div>
        <div className="space-y-2" data-testid="liquid-site-builder-live-cards-list">
          {namedBlocks.map((block, index) => (
            <button key={block.testid} type="button" onClick={() => setDetailView({ type: 'live-card', id: block.testid })} className="w-full rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-right transition hover:bg-zinc-100" data-testid={`liquid-site-builder-live-card-${index}`}>
              <p className="text-sm font-semibold text-zinc-900">{block.displayName}</p>
              <p className="mt-1 text-xs text-zinc-500">{previewText(block.text) || 'بدون نص ظاهر'}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm" data-testid="liquid-site-builder-custom-cards-section">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">الكروت المخصصة</p>
            <p className="mt-1 text-xs text-zinc-500">أنشئ كرتًا جديدًا أو الصق نسخة جاهزة.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={pasteCustomCard} disabled={!clipboard || clipboard.type !== 'custom-card'} className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 disabled:opacity-50" data-testid="liquid-site-builder-paste-card-button">لصق</button>
            <button type="button" onClick={() => {
              const next = createCard();
              updateConfig({ ...config, custom_cards: [...(config.custom_cards || []), next] });
              setSelectedCardId(next.id);
              setDetailView({ type: 'custom-card', id: next.id });
            }} className="rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white" data-testid="liquid-site-builder-add-card-button">إضافة كرت</button>
          </div>
        </div>
        <div className="space-y-2">
          {(config.custom_cards || []).map((card, index) => (
            <button key={card.id} type="button" onClick={() => { setSelectedCardId(card.id); setDetailView({ type: 'custom-card', id: card.id }); }} className="w-full rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-right transition hover:bg-zinc-100" data-testid={`liquid-site-builder-card-${index}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{card.title || 'كرت مخصص'}</p>
                  <p className="mt-1 text-xs text-zinc-500">{previewText(card.description) || `${(card.fields || []).length} حقول`}</p>
                </div>
                <Copy size={15} className="text-zinc-400" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMainLayout = () => (
    <div className="space-y-4" data-testid="liquid-site-builder-layout-tab">
      <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900"><LayoutPanelTop size={16} /> ترتيب البلوكات</div>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-[20px] bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">المجموعات</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900">{groupOptions.length}</p>
          </div>
          <div className="rounded-[20px] bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">البلوكات</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900">{orderedBlocks.length}</p>
          </div>
        </div>
      </div>
      <div className="space-y-2" data-testid="liquid-site-builder-layout-blocks-list">
        {namedBlocks.map((block, index) => (
          <div
            key={block.testid}
            draggable
            onDragStart={(event) => event.dataTransfer.setData('text/plain', block.testid)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              reorderBlocks(event.dataTransfer.getData('text/plain'), block.testid);
            }}
            className="rounded-[22px] border border-zinc-200 bg-white px-4 py-4 shadow-sm"
            data-testid={`liquid-site-builder-layout-block-${index}`}
          >
            <div className="flex items-center gap-3">
              <GripVertical size={15} className="text-zinc-400" />
              <div>
                <p className="text-sm font-semibold text-zinc-900">{block.displayName}</p>
                <p className="mt-1 text-xs text-zinc-500">{previewText(block.text) || 'بدون عنوان ظاهر'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderMainBot = () => (
    <LiquidBuilderBotTab
      session={session}
      selectedPage={selectedPage}
      snapshot={snapshot}
      onLocalCommand={handleLocalBotCommand}
      onCustomizationReceived={(customization) => updateConfig({
        ...config,
        labels: customization.labels || config.labels,
        hidden: customization.hidden || config.hidden,
        contents: customization.contents || config.contents,
        custom_cards: customization.custom_cards || config.custom_cards,
        block_order: customization.block_order || config.block_order,
        positions: customization.positions || config.positions,
      })}
    />
  );

  const renderBody = () => {
    if (detailView.type === 'element') return renderElementDetail();
    if (detailView.type === 'live-card') return renderLiveCardDetail();
    if (detailView.type === 'custom-card') return renderCustomCardDetail();
    if (activeTab === 'elements') return renderMainElements();
    if (activeTab === 'cards') return renderMainCards();
    if (activeTab === 'layout') return renderMainLayout();
    return renderMainBot();
  };

  return (
    <>
      <div className="fixed bottom-20 left-4 z-[75] lg:bottom-24 lg:left-6" data-testid="liquid-site-builder-toggle-wrap">
        <button type="button" onClick={() => setIsOpen((value) => !value)} className="inline-flex h-12 items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 text-sm font-semibold text-zinc-900 shadow-xl shadow-black/10 backdrop-blur-2xl transition hover:scale-[1.02]" data-testid="liquid-site-builder-toggle-button">
          <Droplets size={16} className="text-violet-600" /> Liquid Builder
        </button>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-[80] bg-black/10 backdrop-blur-[2px] lg:bg-transparent lg:backdrop-blur-0">
          <div className="fixed inset-0 flex w-full flex-col bg-[#FCFCFC] shadow-2xl shadow-black/20 md:inset-y-4 md:right-4 md:left-auto md:h-[calc(100vh-32px)] md:w-[min(92vw,560px)] md:rounded-[32px] md:border md:border-zinc-200" data-testid="liquid-site-builder-panel">
            <div className="border-b border-zinc-200 px-5 py-4">
              <MobileHandle />
              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold tracking-tight text-zinc-900" data-testid="liquid-site-builder-title">Liquid Builder</p>
                  <p className="mt-1 text-sm text-zinc-500" data-testid="liquid-site-builder-path">{currentPageMeta.label}</p>
                </div>
                <button type="button" onClick={() => setIsOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm" data-testid="liquid-site-builder-close-button">
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 rounded-[24px] border border-zinc-200 bg-white p-3" data-testid="liquid-site-builder-page-selector-wrap">
                <p className="mb-2 text-xs font-medium text-zinc-500">الصفحة</p>
                <select value={selectedPage} onChange={(event) => navigateToPage(event.target.value)} className="w-full rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-base font-medium text-zinc-900 outline-none" data-testid="liquid-site-builder-page-select">
                  {LIQUID_BUILDER_PAGES.map((page) => <option key={page.path} value={page.path}>{page.label}</option>)}
                </select>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2 rounded-full bg-zinc-100 p-1" data-testid="liquid-site-builder-tabs">
                {[
                  { id: 'elements', label: 'العناصر' },
                  { id: 'cards', label: 'الكروت' },
                  { id: 'layout', label: 'التخطيط' },
                  { id: 'bot', label: 'البوت' },
                ].map((tab) => (
                  <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-full px-2 py-3 text-sm font-semibold transition ${activeTab === tab.id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`} data-testid={`liquid-site-builder-tab-${tab.id}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5">
              {renderBody()}
            </div>

            <div className="border-t border-zinc-200 bg-[#FCFCFC] px-4 py-4">
              <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="mb-3 text-xs font-medium text-zinc-500">
                {showAdvanced ? 'إخفاء التفاصيل المتقدمة' : 'إظهار التفاصيل المتقدمة'}
              </button>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={clearDraft} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-medium text-rose-700" data-testid="liquid-site-builder-clear-draft-button">مسح المسودة</button>
                <button type="button" onClick={redoLast} disabled={!redoStack.length} className="rounded-full border border-zinc-200 bg-white px-3 py-3 text-sm font-medium text-zinc-700 disabled:opacity-40" data-testid="liquid-site-builder-redo-button">إعادة</button>
                <button type="button" onClick={undoLast} disabled={!undoStack.length} className="rounded-full border border-zinc-200 bg-white px-3 py-3 text-sm font-medium text-zinc-700 disabled:opacity-40" data-testid="liquid-site-builder-undo-button">تراجع</button>
              </div>
              <button type="button" onClick={saveConfig} disabled={saving} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-cyan-400 px-4 py-4 text-base font-bold text-zinc-950 transition hover:bg-cyan-300 disabled:opacity-60" data-testid="liquid-site-builder-save-button">
                <Save size={18} /> {saving ? 'جار النشر...' : 'حفظ ونشر التغييرات'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <LiquidCanvasOverlay
        active={canvasActive}
        blocks={orderedBlocks}
        selectedBlockId={selectedBlockId}
        onToggle={() => setCanvasActive((value) => !value)}
        onSelectBlock={setSelectedBlockId}
        onReorder={reorderBlocks}
        onCopyBlock={copyLiveBlock}
        onPasteBlock={pasteLiveBlock}
        canPaste={Boolean(clipboard && clipboard.type === 'live-block')}
        positions={config.positions || {}}
        onPositionChange={updateBlockPosition}
        onInlineEdit={inlineEditBlock}
      />
    </>
  );
};