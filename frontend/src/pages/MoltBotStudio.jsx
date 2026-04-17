import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CanvasEditor from '../components/CanvasEditor';
import { siteBuilderAPI } from '../services/siteBuilderAPI';
import { LIQUID_BUILDER_PAGES } from '../constants/liquidBuilderPages';
import { buildBlockSnapshot, buildUiSnapshot } from '../utils/pageCustomization';
import { useToast } from '../hooks/use-toast';

const EMPTY_CONFIG = { labels: {}, hidden: {}, contents: {}, custom_cards: [], block_order: [], positions: {}, styles: {}, assets: {}, page_manifest: {} };
const draftStorageKey = (userId, path) => `moltbot-studio-draft:${userId}:${path}`;
const toPageId = (path) => String(path || '/').replace(/^\//, '') || 'home';

const normalizeConfig = (value = {}) => ({
  ...EMPTY_CONFIG,
  ...value,
  labels: { ...(EMPTY_CONFIG.labels || {}), ...(value?.labels || {}) },
  hidden: { ...(EMPTY_CONFIG.hidden || {}), ...(value?.hidden || {}) },
  contents: { ...(EMPTY_CONFIG.contents || {}), ...(value?.contents || {}) },
  positions: { ...(EMPTY_CONFIG.positions || {}), ...(value?.positions || {}) },
  styles: { ...(EMPTY_CONFIG.styles || {}), ...(value?.styles || {}) },
  assets: { ...(EMPTY_CONFIG.assets || {}), ...(value?.assets || {}) },
  page_manifest: { ...(EMPTY_CONFIG.page_manifest || {}), ...(value?.page_manifest || {}) },
  custom_cards: Array.isArray(value?.custom_cards) ? value.custom_cards : [],
  block_order: Array.isArray(value?.block_order) ? value.block_order : [],
});

const resolveDisplayName = (item, index) => {
  const text = String(item?.text || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  return text || `بلوك ${index + 1}`;
};

const stylesToObject = (styles = {}) => ({
  backgroundColor: styles.backgroundColor || '',
  color: styles.color || '',
  fontSize: styles.fontSize || '',
  fontWeight: styles.fontWeight || '',
  opacity: styles.opacity || '',
  padding: styles.padding || '',
  margin: styles.margin || '',
  width: styles.width || '',
  height: styles.height || '',
  textAlign: styles.textAlign || '',
  borderRadius: styles.borderRadius || '',
  boxShadow: styles.boxShadow || '',
  backdropFilter: styles.backdropFilter || '',
});

const buildPageData = (path, blocks, config) => ({
  id: toPageId(path),
  name: LIQUID_BUILDER_PAGES.find((page) => page.path === path)?.label || path,
  blocks: (Array.isArray(blocks) ? blocks : []).map((block, index) => ({
    id: block.testid || `moltbot-block-${index + 1}`,
    type: config.assets?.[block.testid]?.src ? 'image' : config.assets?.[block.testid]?.href ? 'button' : 'text',
    name: resolveDisplayName(block, index),
    title: config.labels?.[block.testid] || resolveDisplayName(block, index),
    image: config.assets?.[block.testid]?.src || '',
    link: config.assets?.[block.testid]?.href || '',
    content: config.contents?.[block.testid] || block.text || '',
    liquidTemplate: '',
    styles: stylesToObject(config.styles?.[block.testid] || {}),
    stylesText: '',
  })),
  globalStyles: '',
  settings: {
    responsive: true,
    breakpoints: { mobile: 375, tablet: 768, desktop: 1280 },
    previewSrc: `${path}${String(path).includes('?') ? '&' : '?'}editor-preview=1`,
  },
});

const buildFallbackBlocks = (path, config) => {
  const refs = new Set([
    ...Object.keys(config.labels || {}),
    ...Object.keys(config.contents || {}),
    ...Object.keys(config.assets || {}),
    ...Object.keys(config.styles || {}),
  ]);

  if (!refs.size) {
    const pageLabel = LIQUID_BUILDER_PAGES.find((page) => page.path === path)?.label || 'الصفحة';
    return [
      { testid: `page-title-${String(path).replace(/\W+/g, '-')}`, text: pageLabel },
      { testid: `page-description-${String(path).replace(/\W+/g, '-')}`, text: `محتوى ${pageLabel}` },
    ];
  }

  return Array.from(refs).map((ref) => ({
    testid: ref,
    text: config.contents?.[ref] || config.labels?.[ref] || '',
  }));
};

const buildMeaningfulBlocks = (doc, path, config) => {
  const blockSnapshot = buildBlockSnapshot(260, doc);
  const uiSnapshot = buildUiSnapshot(500, doc)
    .filter((item) => {
      const text = String(item?.text || '').trim();
      return text.length >= 3 && !/^\d+$/.test(text);
    })
    .reduce((acc, item) => {
      if (acc.some((entry) => entry.testid === item.testid)) return acc;
      acc.push({ testid: item.testid, text: item.text });
      return acc;
    }, [])
    .slice(0, 80);

  const merged = [];
  const seen = new Set();
  const looksDynamicId = (value) => {
    const key = String(value || '');
    const hasUuid = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(key);
    const veryLongNumeric = /\d{7,}/.test(key);
    return hasUuid || veryLongNumeric;
  };
  [...blockSnapshot, ...uiSnapshot].forEach((item) => {
    const key = String(item?.testid || '').trim();
    if (!key || key.startsWith('generated-') || looksDynamicId(key) || seen.has(key)) return;
    seen.add(key);
    merged.push({ testid: key, text: item?.text || '' });
  });

  if (merged.length >= 6) return merged;
  return merged.length ? [...merged, ...buildFallbackBlocks(path, config)] : buildFallbackBlocks(path, config);
};

export default function MoltBotStudio() {
  const { toast } = useToast();
  const hiddenFrameRef = useRef(null);
  const [selectedPage, setSelectedPage] = useState('/');
  const [config, setConfig] = useState(EMPTY_CONFIG);
  const [pageData, setPageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [historyRows, setHistoryRows] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [draftMeta, setDraftMeta] = useState({ version: 0, status: 'draft', updated_at: null });

  const session = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('session') || '{}');
    } catch {
      return {};
    }
  }, []);

  const userId = String(session?.id || session?.userId || session?.name || 'manager').trim() || 'manager';

  const loadConfig = async (path) => {
    const draft = localStorage.getItem(draftStorageKey(userId, path));
    if (draft) {
      try {
        return normalizeConfig(JSON.parse(draft));
      } catch {
        localStorage.removeItem(draftStorageKey(userId, path));
      }
    }
    const [draftRes, customizationRes] = await Promise.all([
      siteBuilderAPI.getEditorDraft({ user_id: userId, path }).catch(() => null),
      siteBuilderAPI.getCustomization({ user_id: userId, path }).catch(() => null),
    ]);

    const draftData = draftRes?.data?.data || null;
    if (draftData?.config) {
      setDraftMeta({
        version: Number(draftData.version || 0),
        status: String(draftData.status || 'draft'),
        updated_at: draftData.updated_at || null,
      });
      return normalizeConfig(draftData.config || {});
    }

    setDraftMeta({ version: 0, status: 'published', updated_at: null });
    return normalizeConfig(customizationRes?.data?.data || {});
  };

  const loadCollabMeta = useCallback(async (pathArg = selectedPage) => {
    const [historyRes, commentsRes] = await Promise.all([
      siteBuilderAPI.getEditorHistory({ user_id: userId, path: pathArg, limit: 50 }).catch(() => ({ data: { data: [] } })),
      siteBuilderAPI.getEditorComments({ path: pathArg, limit: 120 }).catch(() => ({ data: { data: [] } })),
    ]);
    setHistoryRows(Array.isArray(historyRes?.data?.data) ? historyRes.data.data : []);
    setComments(Array.isArray(commentsRes?.data?.data) ? commentsRes.data.data : []);
  }, [selectedPage, userId]);

  const rebuildPageData = useCallback((pathArg = selectedPage, configArg = config) => {
    const doc = hiddenFrameRef.current?.contentDocument;
    if (!doc) return;
    const effectiveBlocks = buildMeaningfulBlocks(doc, pathArg, configArg);
    setPageData(buildPageData(pathArg, effectiveBlocks, configArg));
    setLoading(false);
  }, [selectedPage, config]);

  const rebuildPageDataWithRetries = useCallback((pathArg = selectedPage, configArg = config, attempt = 0) => {
    const doc = hiddenFrameRef.current?.contentDocument;
    if (!doc) return;
    const effectiveBlocks = buildMeaningfulBlocks(doc, pathArg, configArg);
    setPageData(buildPageData(pathArg, effectiveBlocks, configArg));
    const needRetry = effectiveBlocks.length < 10 && attempt < 3;
    if (needRetry) {
      window.setTimeout(() => rebuildPageDataWithRetries(pathArg, configArg, attempt + 1), 900 + (attempt * 550));
      return;
    }
    setLoading(false);
  }, [selectedPage, config]);

  useEffect(() => {
    if (!pageData) return;
    setPageData((prev) => {
      if (!prev || prev.id !== toPageId(selectedPage)) return prev;
      const fallbackBlocks = buildFallbackBlocks(selectedPage, config);
      const nextBlocks = (prev.blocks || []).map((block) => ({
        testid: block.id,
        text: block.content || block.title || '',
      }));
      return buildPageData(selectedPage, nextBlocks.length ? nextBlocks : fallbackBlocks, config);
    });
  }, [config, selectedPage]);

  useEffect(() => {
    setLoading(true);
    setPageData(null);
    setSelectedBlockId('');
    loadConfig(selectedPage)
      .then((nextConfig) => {
        setConfig(normalizeConfig(nextConfig));
        return loadCollabMeta(selectedPage);
      })
      .catch(() => toast({ title: 'خطأ', description: 'تعذر تحميل الصفحة', variant: 'destructive' }));
  }, [selectedPage, toast, loadCollabMeta]);

  useEffect(() => {
    localStorage.setItem(draftStorageKey(userId, selectedPage), JSON.stringify(config));
  }, [config, selectedPage, userId]);

  const handleSave = async (data, meta = {}) => {
    const nextConfig = normalizeConfig(config);
    const touched = new Set(Array.isArray(meta?.touchedIds) ? meta.touchedIds : []);
    const targetBlocks = touched.size
      ? (data.blocks || []).filter((block) => touched.has(block.id))
      : (data.blocks || []);
    targetBlocks.forEach((block) => {
      nextConfig.labels[block.id] = block.title || '';
      nextConfig.contents[block.id] = block.content || '';
      nextConfig.styles[block.id] = { ...(nextConfig.styles[block.id] || {}), ...(block.styles || {}) };
      nextConfig.assets[block.id] = {
        ...(nextConfig.assets[block.id] || {}),
        src: block.image || '',
        href: block.link || '',
      };
    });
    try {
      setSavingDraft(true);
      const draftRes = await siteBuilderAPI.saveEditorDraft({
        user_id: userId,
        path: selectedPage,
        config: nextConfig,
        note: 'manual_save',
        status: 'draft',
      });
      setConfig(nextConfig);
      setPageData(buildPageData(
        selectedPage,
        (data.blocks || []).map((block) => ({ testid: block.id, text: block.content || block.title || '' })),
        nextConfig,
      ));
      const saved = draftRes?.data?.data || {};
      setDraftMeta({
        version: Number(saved.version || draftMeta.version || 0),
        status: String(saved.status || 'draft'),
        updated_at: saved.updated_at || _nowIso(),
      });
      await loadCollabMeta(selectedPage);
      toast({ title: 'تم حفظ المسودة', description: 'تم حفظ نسخة مسودة جديدة بنجاح' });
    } catch {
      toast({ title: 'خطأ', description: 'تعذر حفظ المسودة', variant: 'destructive' });
    } finally {
      setSavingDraft(false);
    }
  };

  const _nowIso = () => new Date().toISOString();

  const handlePublish = async (data, meta = {}) => {
    const nextConfig = normalizeConfig(config);
    const touched = new Set(Array.isArray(meta?.touchedIds) ? meta.touchedIds : []);
    const targetBlocks = touched.size
      ? (data.blocks || []).filter((block) => touched.has(block.id))
      : (data.blocks || []);
    targetBlocks.forEach((block) => {
      nextConfig.labels[block.id] = block.title || '';
      nextConfig.contents[block.id] = block.content || '';
      nextConfig.styles[block.id] = { ...(nextConfig.styles[block.id] || {}), ...(block.styles || {}) };
      nextConfig.assets[block.id] = {
        ...(nextConfig.assets[block.id] || {}),
        src: block.image || '',
        href: block.link || '',
      };
    });

    try {
      setPublishing(true);
      const publishRes = await siteBuilderAPI.publishEditorDraft({
        user_id: userId,
        path: selectedPage,
        config: nextConfig,
        note: 'publish',
        status: 'published',
      });
      setConfig(nextConfig);
      const published = publishRes?.data?.data || {};
      setDraftMeta({
        version: Number(published.version || draftMeta.version || 0),
        status: 'published',
        updated_at: published.updated_at || _nowIso(),
      });
      try {
        localStorage.setItem(`moltbot-published:${userId}:${selectedPage}`, JSON.stringify(nextConfig));
      } catch (_error) {
        // ignore storage errors
      }
      localStorage.removeItem(draftStorageKey(userId, selectedPage));
      window.dispatchEvent(new CustomEvent('page-customization-updated', {
        detail: {
          path: selectedPage,
          customization: nextConfig,
        },
      }));
      await loadCollabMeta(selectedPage);
      toast({ title: 'تم النشر', description: 'تم نشر التعديلات على الصفحة بنجاح' });
    } catch {
      toast({ title: 'خطأ', description: 'تعذر نشر التعديلات', variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const handleAddComment = async () => {
    const message = String(commentText || '').trim();
    if (!message) {
      toast({ title: 'تنبيه', description: 'اكتب تعليقًا قبل الإضافة', variant: 'destructive' });
      return;
    }
    try {
      await siteBuilderAPI.addEditorComment({
        user_id: userId,
        path: selectedPage,
        block_id: selectedBlockId,
        message,
        author_name: session?.name || userId,
      });
      setCommentText('');
      await loadCollabMeta(selectedPage);
      toast({ title: 'تمت الإضافة', description: 'تم حفظ التعليق' });
    } catch {
      toast({ title: 'خطأ', description: 'تعذر حفظ التعليق', variant: 'destructive' });
    }
  };

  const handleResolveComment = async (commentId, resolved) => {
    try {
      await siteBuilderAPI.updateEditorComment(commentId, { resolved: !resolved });
      await loadCollabMeta(selectedPage);
    } catch {
      toast({ title: 'خطأ', description: 'تعذر تحديث التعليق', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1120] text-white" data-testid="moltbot-canvas-editor-page">
      <div className="border-b border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">MoltBot Canvas Editor</h1>
          <p className="text-xs text-white/60" data-testid="moltbot-editor-meta-status">نسخة {draftMeta.version || 0} • الحالة: {draftMeta.status === 'published' ? 'منشور' : 'مسودة'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[11px] text-white/60" data-testid="moltbot-editor-save-state">{savingDraft ? 'جاري حفظ المسودة...' : publishing ? 'جاري النشر...' : draftMeta.updated_at ? `آخر تحديث: ${new Date(draftMeta.updated_at).toLocaleString('ar-SA')}` : 'لم يتم الحفظ بعد'}</div>
          <select value={selectedPage} onChange={(e) => setSelectedPage(e.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-canvas-editor-page-select">
            {LIQUID_BUILDER_PAGES.map((page) => <option key={page.path} value={page.path}>{page.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <iframe
          key={selectedPage}
          ref={hiddenFrameRef}
          title="hidden-source-preview"
          src={`${selectedPage}${selectedPage.includes('?') ? '&' : '?'}editor-preview=1`}
          className="absolute pointer-events-none opacity-0 w-0 h-0"
          onLoad={() => window.setTimeout(() => rebuildPageDataWithRetries(selectedPage, config, 0), 500)}
        />
      ) : null}

      {loading || !pageData ? (
        <div className="flex min-h-[70vh] items-center justify-center text-sm text-white/70" data-testid="moltbot-canvas-editor-loading">جاري تجهيز المحرر...</div>
      ) : (
        <>
          <CanvasEditor
            key={`${selectedPage}-${pageData.blocks.length}`}
            pageData={pageData}
            onSave={handleSave}
            onPublish={handlePublish}
            onSelectionChange={setSelectedBlockId}
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4 border-t border-white/10 bg-[#0a1020]" data-testid="moltbot-editor-collab-panel">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4" data-testid="moltbot-editor-history-panel">
              <h3 className="text-sm font-bold mb-3">History (Save)</h3>
              <div className="space-y-2 max-h-56 overflow-y-auto" data-testid="moltbot-editor-history-list">
                {historyRows.length ? historyRows.map((row, idx) => (
                  <div key={row.id || idx} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2" data-testid={`moltbot-editor-history-item-${idx}`}>
                    <div className="text-xs text-white/90">v{row.version || 0} • {row.status === 'published' ? 'منشور' : 'مسودة'}</div>
                    <div className="text-[11px] text-white/60">{row.note || '-'} • {row.updated_at ? new Date(row.updated_at).toLocaleString('ar-SA') : '-'}</div>
                  </div>
                )) : <div className="text-xs text-white/60" data-testid="moltbot-editor-history-empty">لا يوجد تاريخ حفظ بعد</div>}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4" data-testid="moltbot-editor-comments-panel">
              <h3 className="text-sm font-bold mb-2">Comments</h3>
              <div className="text-[11px] text-white/60 mb-2" data-testid="moltbot-editor-comments-selected-block">العنصر المحدد: {selectedBlockId || 'غير محدد'}</div>
              <div className="flex gap-2 mb-3">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="أضف تعليقًا على العنصر/الصفحة"
                  className="flex-1 rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none"
                  data-testid="moltbot-editor-comment-input"
                />
                <button
                  type="button"
                  onClick={handleAddComment}
                  className="rounded-xl border border-cyan-300/40 bg-cyan-500/20 px-3 py-2 text-sm"
                  data-testid="moltbot-editor-comment-add-button"
                >
                  إضافة
                </button>
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto" data-testid="moltbot-editor-comments-list">
                {comments.length ? comments.map((comment, idx) => (
                  <div key={comment.id || idx} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2" data-testid={`moltbot-editor-comment-item-${idx}`}>
                    <div className="text-xs text-white/90">{comment.author_name || comment.user_id || 'مستخدم'} {comment.block_id ? `• ${comment.block_id}` : ''}</div>
                    <div className="text-xs text-white/70 mt-1">{comment.message || '-'}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-white/50">{comment.created_at ? new Date(comment.created_at).toLocaleString('ar-SA') : '-'}</span>
                      <button
                        type="button"
                        onClick={() => handleResolveComment(comment.id, Boolean(comment.resolved))}
                        className="text-[11px] px-2 py-1 rounded border border-white/15 bg-white/10"
                        data-testid={`moltbot-editor-comment-resolve-button-${idx}`}
                      >
                        {comment.resolved ? 'إعادة فتح' : 'تم الحل'}
                      </button>
                    </div>
                  </div>
                )) : <div className="text-xs text-white/60" data-testid="moltbot-editor-comments-empty">لا توجد تعليقات بعد</div>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}