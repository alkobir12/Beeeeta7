import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Droplets, GripVertical, Plus, Save, X } from 'lucide-react';
import { siteBuilderAPI } from '../services/siteBuilderAPI';
import { applyPageCustomizations, buildUiSnapshot } from '../utils/pageCustomization';

const createCard = () => ({
  id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  title: 'كرت جديد',
  description: '',
  fields: [{ id: `field-${Date.now()}`, label: 'عنوان', value: 'قيمة' }],
});

export const LiquidSiteBuilder = ({ session, currentPath, onCustomizationSaved }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('elements');
  const [snapshot, setSnapshot] = useState([]);
  const [config, setConfig] = useState({ labels: {}, hidden: {}, contents: {}, custom_cards: [] });
  const [saving, setSaving] = useState(false);
  const appliedRef = useRef([]);

  const canEdit = useMemo(() => ['manager', 'admin', 'مدير'].includes(String(session?.role || '').toLowerCase()), [session?.role]);
  const userId = String(session?.id || session?.userId || session?.name || 'manager').trim() || 'manager';

  useEffect(() => {
    if (!canEdit || !isOpen) return;
    setSnapshot(buildUiSnapshot());
    siteBuilderAPI.getCustomization({ user_id: userId, path: currentPath }).then((response) => {
      const nextConfig = response.data?.data || { labels: {}, hidden: {}, contents: {}, custom_cards: [] };
      setConfig(nextConfig);
    }).catch((error) => console.error('Failed to load builder customization', error));
  }, [canEdit, currentPath, isOpen, userId]);

  if (!canEdit) return null;

  const updateConfig = (nextConfig) => {
    setConfig(nextConfig);
    applyPageCustomizations(nextConfig, appliedRef);
    window.dispatchEvent(new CustomEvent('page-customization-preview', { detail: nextConfig }));
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
        path: currentPath,
        labels: config.labels || {},
        hidden: config.hidden || {},
        contents: config.contents || {},
        custom_cards: config.custom_cards || [],
      });
      const nextData = response.data?.data || config;
      setConfig(nextData);
      applyPageCustomizations(nextData, appliedRef);
      window.dispatchEvent(new CustomEvent('page-customization-updated', { detail: nextData }));
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
              <p className="mt-1 text-xs text-slate-400" data-testid="liquid-site-builder-path">{currentPath}</p>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-200" data-testid="liquid-site-builder-close-button">
              <X size={16} />
            </button>
          </div>

          <div className="flex gap-2 border-b border-white/10 px-5 py-3" data-testid="liquid-site-builder-tabs">
            {[
              { id: 'elements', label: 'العناصر' },
              { id: 'cards', label: 'الكروت' },
            ].map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-2xl px-4 py-2 text-sm transition ${activeTab === tab.id ? 'bg-cyan-400 text-slate-950' : 'bg-white/5 text-slate-200'}`} data-testid={`liquid-site-builder-tab-${tab.id}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {activeTab === 'elements' ? (
              <div className="space-y-3" data-testid="liquid-site-builder-elements-tab">
                {snapshot.map((item, index) => (
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
              </div>
            ) : (
              <div className="space-y-4" data-testid="liquid-site-builder-cards-tab">
                <button type="button" onClick={() => updateConfig({ ...config, custom_cards: [...(config.custom_cards || []), createCard()] })} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100" data-testid="liquid-site-builder-add-card-button">
                  <Plus size={14} /> إضافة كرت
                </button>
                {(config.custom_cards || []).map((card, cardIndex) => (
                  <div key={card.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4" data-testid={`liquid-site-builder-card-${cardIndex}`}>
                    <input value={card.title || ''} onChange={(event) => updateCard(card.id, { title: event.target.value })} placeholder="عنوان الكرت" className="mb-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none" data-testid={`liquid-site-builder-card-title-${cardIndex}`} />
                    <textarea value={card.description || ''} onChange={(event) => updateCard(card.id, { description: event.target.value })} placeholder="وصف مختصر" className="mb-3 min-h-[72px] w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none" data-testid={`liquid-site-builder-card-description-${cardIndex}`} />
                    <div className="space-y-2">
                      {(card.fields || []).map((field, fieldIndex) => (
                        <div key={field.id} className="rounded-2xl border border-white/10 bg-slate-900/80 p-3" data-testid={`liquid-site-builder-card-field-${cardIndex}-${fieldIndex}`}>
                          <input value={field.label || ''} onChange={(event) => updateField(card.id, field.id, { label: event.target.value })} placeholder="اسم الحقل" className="mb-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none" data-testid={`liquid-site-builder-card-field-label-${cardIndex}-${fieldIndex}`} />
                          <input value={field.value || ''} onChange={(event) => updateField(card.id, field.id, { value: event.target.value })} placeholder="قيمة الحقل" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none" data-testid={`liquid-site-builder-card-field-value-${cardIndex}-${fieldIndex}`} />
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
            )}
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