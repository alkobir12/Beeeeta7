import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplets, GripVertical, Plus, Save, X } from 'lucide-react';
import { siteBuilderAPI } from '../services/siteBuilderAPI';
import { applyPageCustomizations, buildBlockSnapshot, buildUiSnapshot } from '../utils/pageCustomization';
import { LIQUID_BUILDER_PAGES } from '../constants/liquidBuilderPages';
import { LiquidBuilderBotTab } from './LiquidBuilderBotTab';

const createCard = () => ({
  id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  title: 'كرت جديد',
  description: '',
  fields: [{ id: `field-${Date.now()}`, label: 'عنوان', value: 'قيمة' }],
});

export const LiquidSiteBuilder = ({ session, currentPath, onCustomizationSaved }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('elements');
  const [snapshot, setSnapshot] = useState([]);
  const [blockSnapshot, setBlockSnapshot] = useState([]);
  const [config, setConfig] = useState({ labels: {}, hidden: {}, contents: {}, custom_cards: [], block_order: [] });
  const [saving, setSaving] = useState(false);
  const appliedRef = useRef([]);
  const [selectedPage, setSelectedPage] = useState(currentPath || '/');
  const [elementSearch, setElementSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [onlyCustomized, setOnlyCustomized] = useState(false);
  const [elementsPage, setElementsPage] = useState(1);

  const canEdit = useMemo(() => ['manager', 'admin', 'مدير'].includes(String(session?.role || '').toLowerCase()), [session?.role]);
  const userId = String(session?.id || session?.userId || session?.name || 'manager').trim() || 'manager';

  useEffect(() => {
    setSelectedPage(currentPath || '/');
  }, [currentPath]);

  useEffect(() => {
    if (!canEdit || !isOpen) return;
    setSnapshot(buildUiSnapshot());
    setBlockSnapshot(buildBlockSnapshot());
    siteBuilderAPI.getCustomization({ user_id: userId, path: selectedPage }).then((response) => {
      const nextConfig = response.data?.data || { labels: {}, hidden: {}, contents: {}, custom_cards: [], block_order: [] };
      setConfig(nextConfig);
    }).catch((error) => console.error('Failed to load builder customization', error));
  }, [canEdit, selectedPage, isOpen, userId]);

  if (!canEdit) return null;

  const groupOptions = Array.from(new Set(snapshot.map((item) => String(item.testid || '').split('-')[0]).filter(Boolean)));
  const filteredSnapshot = snapshot.filter((item) => {
    const text = `${item.testid} ${item.text}`.toLowerCase();
    const matchesSearch = !elementSearch.trim() || text.includes(elementSearch.toLowerCase());
    const matchesGroup = groupFilter === 'all' || String(item.testid || '').startsWith(`${groupFilter}-`);
    const customized = config.labels?.[item.testid] || config.contents?.[item.testid] || config.hidden?.[item.testid];
    const matchesCustomized = !onlyCustomized || customized;
    return matchesSearch && matchesGroup && matchesCustomized;
  });
  const itemsPerPage = 20;
  const totalElementPages = Math.max(1, Math.ceil(filteredSnapshot.length / itemsPerPage));
  const paginatedSnapshot = filteredSnapshot.slice((elementsPage - 1) * itemsPerPage, elementsPage * itemsPerPage);
  const orderedBlocks = (config.block_order?.length ? config.block_order : blockSnapshot.map((item) => item.testid))
    .map((testid) => blockSnapshot.find((item) => item.testid === testid))
    .filter(Boolean);

  const updateConfig = (nextConfig) => {
    setConfig(nextConfig);
    if (selectedPage === currentPath) {
      applyPageCustomizations(nextConfig, appliedRef);
      window.dispatchEvent(new CustomEvent('page-customization-preview', { detail: nextConfig }));
    }
  };

  const navigateToPage = (path) => {
    setSelectedPage(path);
    setElementsPage(1);
    if (path !== currentPath) {
      navigate(path);
    }
  };

  const updateElement = (testid, key, value) => {
    const nextConfig = {
      ...config,
      [key]: {
        ...(config[key] || {}),
        [testid]: value,
      },
    };
    updateConfig(nextConfig);
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

  const reorderBlocks = (draggedId, targetId) => {
    const working = [...(config.block_order?.length ? config.block_order : blockSnapshot.map((item) => item.testid))];
    const from = working.indexOf(draggedId);
    const to = working.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = working.splice(from, 1);
    working.splice(to, 0, moved);
    updateConfig({ ...config, block_order: working });
  };

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
      });
      const nextData = response.data?.data || config;
      setConfig(nextData);
      if (selectedPage === currentPath) {
        applyPageCustomizations(nextData, appliedRef);
        window.dispatchEvent(new CustomEvent('page-customization-updated', { detail: nextData }));
      }
      onCustomizationSaved?.(nextData);
    } catch (error) {
      console.error('Failed to save site builder config', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-20 left-4 z-[75] lg:bottom-24 lg:left-6" data-testid="liquid-site-builder-toggle-wrap">
        <button type="button" onClick={() => setIsOpen((value) => !value)} className="inline-flex h-12 items-center gap-2 rounded-[20px] border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(59,130,246,0.22))] px-4 text-sm font-medium text-cyan-50 shadow-[0_18px_45px_-20px_rgba(34,211,238,0.5)] backdrop-blur-2xl transition hover:scale-[1.02]" data-testid="liquid-site-builder-toggle-button">
          <Droplets size={16} /> Liquid Builder
        </button>
      </div>

      {isOpen ? (
        <div className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-[440px] flex-col border-l border-white/10 bg-slate-950/95 shadow-2xl shadow-black/40 backdrop-blur-2xl" data-testid="liquid-site-builder-panel">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-base font-semibold text-white" data-testid="liquid-site-builder-title">Liquid Builder</p>
              <p className="mt-1 text-xs text-slate-400" data-testid="liquid-site-builder-path">{selectedPage}</p>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-200" data-testid="liquid-site-builder-close-button">
              <X size={16} />
            </button>
          </div>

          <div className="border-b border-white/10 px-5 py-3" data-testid="liquid-site-builder-page-selector-wrap">
            <label className="mb-2 block text-[11px] text-slate-400">الصفحة</label>
            <select value={selectedPage} onChange={(event) => navigateToPage(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none" data-testid="liquid-site-builder-page-select">
              {LIQUID_BUILDER_PAGES.map((page) => (
                <option key={page.path} value={page.path}>{page.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 border-b border-white/10 px-5 py-3" data-testid="liquid-site-builder-tabs">
            {[
              { id: 'elements', label: 'العناصر' },
              { id: 'cards', label: 'الكروت' },
              { id: 'layout', label: 'التخطيط' },
              { id: 'bot', label: 'البوت' },
            ].map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-2xl px-4 py-2 text-sm transition ${activeTab === tab.id ? 'bg-cyan-400 text-slate-950' : 'bg-white/5 text-slate-200'}`} data-testid={`liquid-site-builder-tab-${tab.id}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {activeTab === 'elements' ? (
              <div className="space-y-3" data-testid="liquid-site-builder-elements-tab">
                <div className="grid grid-cols-2 gap-2 rounded-[24px] border border-white/10 bg-white/5 p-3">
                  <input value={elementSearch} onChange={(event) => { setElementSearch(event.target.value); setElementsPage(1); }} placeholder="بحث في عناصر الصفحة" className="col-span-2 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none" data-testid="liquid-site-builder-elements-search" />
                  <select value={groupFilter} onChange={(event) => { setGroupFilter(event.target.value); setElementsPage(1); }} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none" data-testid="liquid-site-builder-elements-group-filter">
                    <option value="all">كل المجموعات</option>
                    {groupOptions.map((group) => <option key={group} value={group}>{group}</option>)}
                  </select>
                  <label className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-200" data-testid="liquid-site-builder-elements-customized-filter">
                    <span>المعدلة فقط</span>
                    <input type="checkbox" checked={onlyCustomized} onChange={(event) => { setOnlyCustomized(event.target.checked); setElementsPage(1); }} />
                  </label>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400" data-testid="liquid-site-builder-elements-meta">
                  {filteredSnapshot.length} عنصر • صفحة {elementsPage} / {totalElementPages}
                </div>

                {paginatedSnapshot.map((item, index) => (
                  <div key={item.testid} className="rounded-[24px] border border-white/10 bg-white/5 p-3" data-testid={`liquid-site-builder-element-${index}`}>
                    <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400"><GripVertical size={12} />{item.testid}</div>
                    <p className="mb-3 text-xs text-slate-300">{item.text || 'بدون نص ظاهر'}</p>
                    <input value={config.labels?.[item.testid] || ''} onChange={(event) => updateElement(item.testid, 'labels', event.target.value)} placeholder="إعادة تسمية" className="mb-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none" data-testid={`liquid-site-builder-element-label-${index}`} />
                    <input value={config.contents?.[item.testid] || ''} onChange={(event) => updateElement(item.testid, 'contents', event.target.value)} placeholder="تعديل المحتوى الظاهر" className="mb-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none" data-testid={`liquid-site-builder-element-content-${index}`} />
                    <label className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-200" data-testid={`liquid-site-builder-element-visibility-${index}`}>
                      <span>إخفاء العنصر</span>
                      <input type="checkbox" checked={Boolean(config.hidden?.[item.testid])} onChange={(event) => updateElement(item.testid, 'hidden', event.target.checked)} />
                    </label>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => removeElementOverride(item.testid, 'labels')} className="rounded-xl border border-white/10 px-3 py-1 text-[11px] text-slate-300" data-testid={`liquid-site-builder-element-clear-label-${index}`}>مسح الاسم</button>
                      <button type="button" onClick={() => removeElementOverride(item.testid, 'contents')} className="rounded-xl border border-white/10 px-3 py-1 text-[11px] text-slate-300" data-testid={`liquid-site-builder-element-clear-content-${index}`}>مسح المحتوى</button>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between rounded-[24px] border border-white/10 bg-white/5 p-3 text-xs text-slate-300" data-testid="liquid-site-builder-elements-pagination">
                  <button type="button" onClick={() => setElementsPage((page) => Math.max(1, page - 1))} className="rounded-xl border border-white/10 px-3 py-2" data-testid="liquid-site-builder-elements-prev-page">السابق</button>
                  <span>{elementsPage} / {totalElementPages}</span>
                  <button type="button" onClick={() => setElementsPage((page) => Math.min(totalElementPages, page + 1))} className="rounded-xl border border-white/10 px-3 py-2" data-testid="liquid-site-builder-elements-next-page">التالي</button>
                </div>
              </div>
            ) : activeTab === 'cards' ? (
              <div className="space-y-4" data-testid="liquid-site-builder-cards-tab">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4" data-testid="liquid-site-builder-live-cards-section">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">الكروت الحالية للصفحة المختارة</p>
                      <p className="mt-1 text-xs text-slate-400">هذه هي البطاقات/البلوكات الظاهرة الآن على الصفحة ويمكن تعديلها مباشرة.</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-[11px] text-slate-300" data-testid="liquid-site-builder-live-cards-count">{orderedBlocks.length} كرت/بلوك</span>
                  </div>

                  <div className="space-y-3" data-testid="liquid-site-builder-live-cards-list">
                    {orderedBlocks.map((block, index) => (
                      <div key={block.testid} className="rounded-2xl border border-white/10 bg-slate-900/80 p-3" data-testid={`liquid-site-builder-live-card-${index}`}>
                        <p className="text-[11px] text-slate-400" data-testid={`liquid-site-builder-live-card-testid-${index}`}>{block.testid}</p>
                        <p className="mt-2 text-sm text-slate-100" data-testid={`liquid-site-builder-live-card-text-${index}`}>{block.text || 'بدون نص ظاهر'}</p>
                        <input value={config.labels?.[block.testid] || ''} onChange={(event) => updateElement(block.testid, 'labels', event.target.value)} placeholder="اسم بديل للكرت الحالي" className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none" data-testid={`liquid-site-builder-live-card-label-${index}`} />
                        <input value={config.contents?.[block.testid] || ''} onChange={(event) => updateElement(block.testid, 'contents', event.target.value)} placeholder="محتوى بديل للكرت الحالي" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none" data-testid={`liquid-site-builder-live-card-content-${index}`} />
                        <label className="mt-2 flex items-center justify-between rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-200" data-testid={`liquid-site-builder-live-card-visibility-${index}`}>
                          <span>إخفاء هذا الكرت</span>
                          <input type="checkbox" checked={Boolean(config.hidden?.[block.testid])} onChange={(event) => updateElement(block.testid, 'hidden', event.target.checked)} />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4" data-testid="liquid-site-builder-custom-cards-section">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">الكروت المخصصة</p>
                      <p className="mt-1 text-xs text-slate-400">أنشئ كروت إضافية أو اربط حقولها ببيانات حقيقية من الصفحة.</p>
                    </div>
                    <button type="button" onClick={() => updateConfig({ ...config, custom_cards: [...(config.custom_cards || []), createCard()] })} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100" data-testid="liquid-site-builder-add-card-button">
                      <Plus size={14} /> إضافة كرت
                    </button>
                  </div>

                  {(config.custom_cards || []).map((card, cardIndex) => (
                  <div key={card.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4" data-testid={`liquid-site-builder-card-${cardIndex}`}>
                    <input value={card.title || ''} onChange={(event) => updateCard(card.id, { title: event.target.value })} placeholder="عنوان الكرت" className="mb-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none" data-testid={`liquid-site-builder-card-title-${cardIndex}`} />
                    <textarea value={card.description || ''} onChange={(event) => updateCard(card.id, { description: event.target.value })} placeholder="وصف مختصر" className="mb-3 min-h-[72px] w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none" data-testid={`liquid-site-builder-card-description-${cardIndex}`} />
                    <div className="space-y-2">
                      {(card.fields || []).map((field, fieldIndex) => (
                        <div key={field.id} className="rounded-2xl border border-white/10 bg-slate-900/80 p-3" data-testid={`liquid-site-builder-card-field-${cardIndex}-${fieldIndex}`}>
                          <input value={field.label || ''} onChange={(event) => updateField(card.id, field.id, { label: event.target.value })} placeholder="اسم الحقل" className="mb-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none" data-testid={`liquid-site-builder-card-field-label-${cardIndex}-${fieldIndex}`} />
                          <input value={field.value || ''} onChange={(event) => updateField(card.id, field.id, { value: event.target.value })} placeholder="قيمة الحقل" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none" data-testid={`liquid-site-builder-card-field-value-${cardIndex}-${fieldIndex}`} />
                          <select value={field.source_testid || ''} onChange={(event) => updateField(card.id, field.id, { source_testid: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none" data-testid={`liquid-site-builder-card-field-source-${cardIndex}-${fieldIndex}`}>
                            <option value="">بدون ربط مباشر</option>
                            {snapshot.slice(0, 80).map((item) => <option key={item.testid} value={item.testid}>{item.testid}</option>)}
                          </select>
                          <button type="button" onClick={() => removeField(card.id, field.id)} className="mt-2 text-[11px] text-rose-200" data-testid={`liquid-site-builder-card-field-delete-${cardIndex}-${fieldIndex}`}>حذف الحقل</button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => addField(card.id)} className="rounded-xl border border-white/10 px-3 py-1 text-[11px] text-slate-200" data-testid={`liquid-site-builder-card-add-field-${cardIndex}`}>إضافة حقل</button>
                      <button type="button" onClick={() => updateConfig({ ...config, custom_cards: (config.custom_cards || []).filter((item) => item.id !== card.id) })} className="rounded-xl border border-rose-300/20 px-3 py-1 text-[11px] text-rose-200" data-testid={`liquid-site-builder-card-delete-${cardIndex}`}>حذف الكرت</button>
                    </div>
                  </div>
                  ))}
                </div>
              </div>
            ) : activeTab === 'layout' ? (
              <div className="space-y-4" data-testid="liquid-site-builder-layout-tab">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                  <p className="font-semibold text-white">مركز الصفحة المختارة</p>
                  <p className="mt-2 text-xs leading-6 text-slate-400">اختر أي صفحة من الأعلى وسيتم تحميل عناصرها الحالية داخل تبويب العناصر. هذا يجعل تعديل الصفحة نفسها أسرع بدل قائمة واحدة طويلة على مستوى النظام.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4" data-testid="liquid-site-builder-layout-groups-card">
                    <p className="text-xs text-slate-400">المجموعات المكتشفة</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{groupOptions.length}</p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4" data-testid="liquid-site-builder-layout-elements-card">
                    <p className="text-xs text-slate-400">عناصر الصفحة الحالية</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{snapshot.length}</p>
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-xs text-slate-300" data-testid="liquid-site-builder-layout-groups-list">
                  {groupOptions.length ? groupOptions.join(' • ') : 'لا توجد مجموعات ظاهرة بعد على هذه الصفحة.'}
                </div>
                <div className="space-y-2" data-testid="liquid-site-builder-layout-blocks-list">
                  {orderedBlocks.map((block, index) => (
                    <div
                      key={block.testid}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData('text/plain', block.testid)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        reorderBlocks(event.dataTransfer.getData('text/plain'), block.testid);
                      }}
                      className="rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-slate-200"
                      data-testid={`liquid-site-builder-layout-block-${index}`}
                    >
                      <div className="flex items-center gap-2 text-slate-400"><GripVertical size={12} /> {block.testid}</div>
                      <div className="mt-1 text-slate-300">{block.text || 'بدون عنوان ظاهر'}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : activeTab === 'bot' ? (
              <LiquidBuilderBotTab
                session={session}
                selectedPage={selectedPage}
                snapshot={snapshot}
                onCustomizationReceived={(customization) => updateConfig({
                  ...config,
                  labels: customization.labels || config.labels,
                  hidden: customization.hidden || config.hidden,
                  contents: customization.contents || config.contents,
                  custom_cards: customization.custom_cards || config.custom_cards,
                  block_order: customization.block_order || config.block_order,
                })}
              />
            ) : null}
          </div>

          <div className="border-t border-white/10 px-5 py-4">
            <button type="button" onClick={saveConfig} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-[20px] bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60" data-testid="liquid-site-builder-save-button">
              <Save size={15} /> {saving ? 'جار الحفظ...' : 'حفظ التغييرات'}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
};