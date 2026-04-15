import React, { useEffect, useMemo, useRef, useState } from 'react';
import CanvasEditor from '../components/CanvasEditor';
import { siteBuilderAPI } from '../services/siteBuilderAPI';
import { LIQUID_BUILDER_PAGES } from '../constants/liquidBuilderPages';
import { buildBlockSnapshot } from '../utils/pageCustomization';
import { useToast } from '../hooks/use-toast';

const EMPTY_CONFIG = { labels: {}, hidden: {}, contents: {}, custom_cards: [], block_order: [], positions: {}, styles: {}, assets: {}, page_manifest: {} };
const draftStorageKey = (userId, path) => `moltbot-studio-draft:${userId}:${path}`;

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
  id: String(path || '/').replace(/^\//, '') || 'home',
  name: LIQUID_BUILDER_PAGES.find((page) => page.path === path)?.label || path,
  blocks: blocks.map((block, index) => ({
    id: block.testid,
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

export default function MoltBot() {
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
        return { ...EMPTY_CONFIG, ...JSON.parse(draft) };
      } catch {
        localStorage.removeItem(draftStorageKey(userId, path));
      }
    }
    const response = await siteBuilderAPI.getCustomization({ user_id: userId, path });
    return { ...EMPTY_CONFIG, ...(response.data?.data || {}) };
  };

  const rebuildPageData = () => {
    const doc = hiddenFrameRef.current?.contentDocument;
    if (!doc) return;
    const blocks = buildBlockSnapshot(220, doc);
    setPageData(buildPageData(selectedPage, blocks, config));
    setLoading(false);
  };

  useEffect(() => {
    if (!pageData) return;
    setPageData((prev) => prev ? buildPageData(selectedPage, prev.blocks.map((b) => ({ testid: b.id, text: b.content || b.title || '' })), config) : prev);
  }, [config]);

  useEffect(() => {
    setLoading(true);
    loadConfig(selectedPage)
      .then((nextConfig) => setConfig(nextConfig))
      .catch(() => toast({ title: 'خطأ', description: 'تعذر تحميل الصفحة', variant: 'destructive' }));
  }, [selectedPage]);

  useEffect(() => {
    localStorage.setItem(draftStorageKey(userId, selectedPage), JSON.stringify(config));
  }, [config, selectedPage, userId]);

  const handleSave = async (data) => {
    const nextConfig = { ...config };
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
        onLoad={() => window.setTimeout(rebuildPageData, 500)}
      />

      {loading || !pageData ? (
        <div className="flex min-h-[70vh] items-center justify-center text-sm text-white/70" data-testid="moltbot-canvas-editor-loading">جاري تجهيز المحرر...</div>
      ) : (
        <CanvasEditor pageData={pageData} onSave={handleSave} />
      )}
    </div>
  );
}