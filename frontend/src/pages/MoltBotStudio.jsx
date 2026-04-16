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
  const blockSnapshot = buildBlockSnapshot(220, doc);
  if (blockSnapshot.length >= 4) return blockSnapshot;

  const uiSnapshot = buildUiSnapshot(400, doc)
    .filter((item) => {
      const text = String(item?.text || '').trim();
      return text.length >= 3 && !/^\d+$/.test(text);
    })
    .reduce((acc, item) => {
      if (acc.some((entry) => entry.testid === item.testid)) return acc;
      acc.push({ testid: item.testid, text: item.text });
      return acc;
    }, [])
    .slice(0, 24);

  return uiSnapshot.length ? uiSnapshot : buildFallbackBlocks(path, config);
};

export default function MoltBotStudio() {
  const { toast } = useToast();
  const hiddenFrameRef = useRef(null);
  const [selectedPage, setSelectedPage] = useState('/');
  const [config, setConfig] = useState(EMPTY_CONFIG);
  const [pageData, setPageData] = useState(null);
  const [loading, setLoading] = useState(true);

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
    const response = await siteBuilderAPI.getCustomization({ user_id: userId, path });
    return normalizeConfig(response.data?.data || {});
  };

  const rebuildPageData = useCallback((pathArg = selectedPage, configArg = config) => {
    const doc = hiddenFrameRef.current?.contentDocument;
    if (!doc) return;
    const effectiveBlocks = buildMeaningfulBlocks(doc, pathArg, configArg);
    setPageData(buildPageData(pathArg, effectiveBlocks, configArg));
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
    loadConfig(selectedPage)
      .then((nextConfig) => setConfig(normalizeConfig(nextConfig)))
      .catch(() => toast({ title: 'خطأ', description: 'تعذر تحميل الصفحة', variant: 'destructive' }));
  }, [selectedPage, toast]);

  useEffect(() => {
    localStorage.setItem(draftStorageKey(userId, selectedPage), JSON.stringify(config));
  }, [config, selectedPage, userId]);

  const handleSave = async (data) => {
    const nextConfig = normalizeConfig(config);
    (data.blocks || []).forEach((block) => {
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
      await siteBuilderAPI.saveCustomization({ user_id: userId, path: selectedPage, ...nextConfig });
      setConfig(nextConfig);
      setPageData(buildPageData(
        selectedPage,
        (data.blocks || []).map((block) => ({ testid: block.id, text: block.content || block.title || '' })),
        nextConfig,
      ));
      localStorage.removeItem(draftStorageKey(userId, selectedPage));
      toast({ title: 'تم الحفظ', description: 'تم حفظ الصفحة بنجاح' });
    } catch {
      toast({ title: 'خطأ', description: 'تعذر حفظ الصفحة', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1120] text-white" data-testid="moltbot-canvas-editor-page">
      <div className="border-b border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">MoltBot Canvas Editor</h1>
          <p className="text-xs text-white/60">تحرير حي للموقع مع معاينة Liquid</p>
        </div>
        <select value={selectedPage} onChange={(e) => setSelectedPage(e.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" data-testid="moltbot-canvas-editor-page-select">
          {LIQUID_BUILDER_PAGES.map((page) => <option key={page.path} value={page.path}>{page.label}</option>)}
        </select>
      </div>

      <iframe
        key={selectedPage}
        ref={hiddenFrameRef}
        title="hidden-source-preview"
        src={`${selectedPage}${selectedPage.includes('?') ? '&' : '?'}editor-preview=1`}
        className="absolute pointer-events-none opacity-0 w-0 h-0"
        onLoad={() => window.setTimeout(() => rebuildPageData(selectedPage, config), 450)}
      />

      {loading || !pageData ? (
        <div className="flex min-h-[70vh] items-center justify-center text-sm text-white/70" data-testid="moltbot-canvas-editor-loading">جاري تجهيز المحرر...</div>
      ) : (
        <CanvasEditor key={`${selectedPage}-${pageData.blocks.length}`} pageData={pageData} onSave={handleSave} />
      )}
    </div>
  );
}