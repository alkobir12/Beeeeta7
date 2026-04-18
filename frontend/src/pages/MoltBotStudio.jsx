import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CanvasEditor from '../components/CanvasEditor';
import { siteBuilderAPI } from '../services/siteBuilderAPI';
import { LIQUID_BUILDER_PAGES } from '../constants/liquidBuilderPages';
import { buildBlockSnapshot, buildUiSnapshot } from '../utils/pageCustomization';
import { useToast } from '../hooks/use-toast';

const EMPTY_CONFIG = { labels: {}, hidden: {}, contents: {}, custom_cards: [], block_order: [], positions: {}, styles: {}, assets: {}, page_manifest: {} };
const draftStorageKey = (userId, path) => `moltbot-studio-draft:${userId}:${path}`;
const toPageId = (path) => String(path || '/').replace(/^\//, '') || 'home';
const LIVE_PREVIEW_PATHS = new Set(['/', '/operations', '/parts', '/accounting/comprehensive', '/settings']);

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

const prettifyTestId = (testid = '') => {
  const source = String(testid || '').trim();
  if (!source) return '';
  const cleaned = source
    .replace(/[-_]+/g, ' ')
    .replace(/\b\d+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const dictionary = {
    dashboard: 'لوحة التحكم',
    operations: 'العمليات',
    customers: 'العملاء',
    vehicles: 'المركبات',
    parts: 'المخزون',
    title: 'العنوان',
    label: 'التسمية',
    button: 'زر',
    input: 'حقل إدخال',
    table: 'جدول',
    card: 'كرت',
    stat: 'إحصائية',
    value: 'قيمة',
    row: 'صف',
    tab: 'تبويب',
    menu: 'قائمة',
    page: 'صفحة',
    search: 'بحث',
    filter: 'تصفية',
    amount: 'مبلغ',
    date: 'تاريخ',
  };

  const words = cleaned.split(' ').filter(Boolean).map((word) => dictionary[word.toLowerCase()] || word);
  return words.join(' ').trim();
};

const resolveDisplayName = (item, index) => {
  const rawText = String(item?.text || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const isNumericOnly = /^\d+(?:[.,]\d+)?$/.test(rawText);
  const fromTestId = prettifyTestId(item?.testid || '');
  if (rawText && !isNumericOnly) return rawText;
  if (fromTestId) return fromTestId;
  return `عنصر ${index + 1}`;
};

const classifyBlock = (testid = '') => {
  const key = String(testid || '').toLowerCase();
  if (key.includes('table') || key.includes('row') || key.includes('cell')) return 'جدول';
  if (key.includes('card') || key.includes('stat')) return 'كرت';
  if (key.includes('button') || key.includes('btn') || key.includes('submit')) return 'زر';
  if (key.includes('input') || key.includes('field') || key.includes('select') || key.includes('textarea')) return 'حقل';
  if (key.includes('title') || key.includes('heading') || key.includes('label')) return 'عنوان';
  if (key.includes('image') || key.includes('icon') || key.includes('avatar')) return 'صورة';
  if (key.includes('nav') || key.includes('menu') || key.includes('tab')) return 'تنقل';
  return 'نص';
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
  blocks: (Array.isArray(blocks) ? blocks : []).map((block, index) => {
    const blockId = block.testid || `moltbot-block-${index + 1}`;
    const fallbackLabel = resolveDisplayName({ ...block, testid: blockId }, index);
    const savedLabel = String(config.labels?.[blockId] || '').trim();
    const savedContent = String(config.contents?.[blockId] || '').trim();
    const labelLooksNumeric = /^\d+(?:[.,]\d+)?$/.test(savedLabel);
    const contentLooksNumeric = /^\d+(?:[.,]\d+)?$/.test(savedContent);
    return {
      id: blockId,
      type: config.assets?.[blockId]?.src ? 'image' : config.assets?.[blockId]?.href ? 'button' : 'text',
      category: classifyBlock(blockId),
      name: fallbackLabel,
      title: savedLabel && !labelLooksNumeric ? savedLabel : fallbackLabel,
      image: config.assets?.[blockId]?.src || '',
      link: config.assets?.[blockId]?.href || '',
      content: savedContent && !contentLooksNumeric ? savedContent : (String(block.text || '').trim() || fallbackLabel),
      liquidTemplate: '',
      styles: stylesToObject(config.styles?.[blockId] || {}),
      stylesText: '',
    };
  }),
  globalStyles: '',
  settings: {
    responsive: true,
    breakpoints: { mobile: 375, tablet: 768, desktop: 1280 },
    previewSrc: LIVE_PREVIEW_PATHS.has(path)
      ? `${path}${String(path).includes('?') ? '&' : '?'}editor-preview=1`
      : '',
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
    const slug = toPageId(path);
    return [
      { testid: `page-title-${slug}`, text: pageLabel },
      { testid: `page-description-${slug}`, text: `محتوى ${pageLabel}` },
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
    if (
      !key
      || key.startsWith('generated-')
      || looksDynamicId(key)
      || key.length > 120
      || key.endsWith('--')
      || key.includes('rrweb')
      || seen.has(key)
    ) return;
    seen.add(key);
    merged.push({ testid: key, text: item?.text || '' });
  });

  const clipped = merged.slice(0, 120);

  if (clipped.length >= 6) return clipped;
  return clipped.length ? [...clipped, ...buildFallbackBlocks(path, config)] : buildFallbackBlocks(path, config);
};

const normalizeBindingText = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s_-]/gu, ' ')
  .replace(/[\s_-]+/g, ' ')
  .trim();

const tokenizeBinding = (value = '') => normalizeBindingText(value)
  .split(' ')
  .map((word) => word.trim())
  .filter((word) => word.length >= 2);

const scoreBindingCandidate = (field, block) => {
  const labelTokens = tokenizeBinding(field?.label || '');
  const valueTokens = tokenizeBinding(field?.value || '');
  const idTokens = tokenizeBinding(field?.source_testid || '');
  const fieldTokens = Array.from(new Set([...labelTokens, ...valueTokens, ...idTokens]));
  if (!fieldTokens.length) return 0;

  const candidateText = normalizeBindingText([
    block?.id,
    block?.name,
    block?.title,
    block?.content,
    block?.category,
  ].filter(Boolean).join(' '));

  let score = 0;
  fieldTokens.forEach((token) => {
    if (candidateText.includes(` ${token} `) || candidateText.startsWith(`${token} `) || candidateText.endsWith(` ${token}`)) {
      score += 3;
    } else if (candidateText.includes(token)) {
      score += 1;
    }
  });

  const financialHints = ['مبلغ', 'رصيد', 'إجمالي', 'صافي', 'income', 'balance', 'amount', 'total'];
  const hasFinancialHint = fieldTokens.some((token) => financialHints.some((hint) => token.includes(hint)));
  if (hasFinancialHint && /amount|balance|total|income|stat|summary/.test(String(block?.id || '').toLowerCase())) {
    score += 2;
  }

  return score;
};

const suggestSmartSourceTestid = (field, blocks = []) => {
  if (!Array.isArray(blocks) || !blocks.length) return '';
  let best = { id: '', score: 0 };
  blocks.forEach((block) => {
    const score = scoreBindingCandidate(field, block);
    if (score > best.score) {
      best = { id: block.id, score };
    }
  });
  return best.score > 0 ? best.id : blocks[0]?.id || '';
};

const stableSerialize = (value) => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${key}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const makeConfigFromEditorData = (baseConfig, data, meta = {}) => {
  const nextConfig = normalizeConfig(baseConfig || {});
  const touched = new Set(Array.isArray(meta?.touchedIds) ? meta.touchedIds : []);
  let targetBlocks = touched.size
    ? (data?.blocks || []).filter((block) => touched.has(block.id))
    : (data?.blocks || []);

  if (meta?.selectedSnapshot?.id) {
    const exists = targetBlocks.some((block) => block.id === meta.selectedSnapshot.id);
    if (!exists) targetBlocks = [...targetBlocks, meta.selectedSnapshot];
  }

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

  return nextConfig;
};

const collectChangedKeys = (prevBucket = {}, nextBucket = {}) => {
  const keySet = new Set([...Object.keys(prevBucket || {}), ...Object.keys(nextBucket || {})]);
  const changed = [];
  keySet.forEach((key) => {
    if (stableSerialize(prevBucket?.[key]) !== stableSerialize(nextBucket?.[key])) changed.push(key);
  });
  return changed;
};

const buildVisualDiffSummary = (prevConfig, nextConfig) => {
  const labelsChanged = collectChangedKeys(prevConfig?.labels || {}, nextConfig?.labels || {});
  const contentsChanged = collectChangedKeys(prevConfig?.contents || {}, nextConfig?.contents || {});
  const stylesChanged = collectChangedKeys(prevConfig?.styles || {}, nextConfig?.styles || {});
  const assetsChanged = collectChangedKeys(prevConfig?.assets || {}, nextConfig?.assets || {});
  const hiddenChanged = collectChangedKeys(prevConfig?.hidden || {}, nextConfig?.hidden || {});
  const positionsChanged = collectChangedKeys(prevConfig?.positions || {}, nextConfig?.positions || {});
  const blockOrderChanged = stableSerialize(prevConfig?.block_order || []) !== stableSerialize(nextConfig?.block_order || []);
  const customCardsChanged = stableSerialize(prevConfig?.custom_cards || []) !== stableSerialize(nextConfig?.custom_cards || []);
  const pageManifestChanged = stableSerialize(prevConfig?.page_manifest || {}) !== stableSerialize(nextConfig?.page_manifest || {});

  const touchedKeys = Array.from(new Set([
    ...labelsChanged,
    ...contentsChanged,
    ...stylesChanged,
    ...assetsChanged,
    ...hiddenChanged,
    ...positionsChanged,
  ]));

  return {
    labelsChanged,
    contentsChanged,
    stylesChanged,
    assetsChanged,
    hiddenChanged,
    positionsChanged,
    blockOrderChanged,
    customCardsChanged,
    pageManifestChanged,
    touchedKeys,
    totalChanges:
      labelsChanged.length
      + contentsChanged.length
      + stylesChanged.length
      + assetsChanged.length
      + hiddenChanged.length
      + positionsChanged.length
      + (blockOrderChanged ? 1 : 0)
      + (customCardsChanged ? 1 : 0)
      + (pageManifestChanged ? 1 : 0),
  };
};

const buildPublishChecklist = (data, nextConfig) => {
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  const blockIds = blocks.map((block) => String(block?.id || '').trim()).filter(Boolean);
  const uniqueIds = new Set(blockIds);
  const duplicateIdsCount = blockIds.length - uniqueIds.size;

  const emptyTitleCount = blocks.filter((block) => !String(block?.title || '').trim()).length;
  const emptyContentCount = blocks.filter((block) => !String(block?.content || '').trim()).length;
  const brokenAssetCount = Object.values(nextConfig?.assets || {}).filter((asset) => {
    const href = String(asset?.href || '').trim();
    if (!href) return false;
    return !href.startsWith('/') && !/^https?:\/\//i.test(href) && !href.startsWith('#');
  }).length;

  const smartFields = (nextConfig?.custom_cards || []).flatMap((card) => card?.fields || []);
  const unboundSmartFieldsCount = smartFields.filter((field) => {
    const hasSource = String(field?.source_testid || '').trim().length > 0;
    const hasValue = String(field?.value || '').trim().length > 0;
    return !hasSource && !hasValue;
  }).length;

  const checks = [
    {
      id: 'has-blocks',
      label: 'وجود عناصر داخل الصفحة',
      status: blocks.length > 0 ? 'pass' : 'critical',
      hint: blocks.length > 0 ? `${blocks.length} عناصر` : 'الصفحة فارغة',
    },
    {
      id: 'duplicate-ids',
      label: 'عدم تكرار معرفات العناصر',
      status: duplicateIdsCount === 0 ? 'pass' : 'critical',
      hint: duplicateIdsCount === 0 ? 'لا يوجد تكرار' : `${duplicateIdsCount} معرف مكرر`,
    },
    {
      id: 'titles',
      label: 'عناوين العناصر مكتملة',
      status: emptyTitleCount === 0 ? 'pass' : 'warn',
      hint: emptyTitleCount === 0 ? 'كل العناوين مكتملة' : `${emptyTitleCount} عنصر بدون عنوان`,
    },
    {
      id: 'contents',
      label: 'محتوى العناصر غير فارغ',
      status: emptyContentCount <= Math.max(1, Math.floor(blocks.length * 0.3)) ? 'pass' : 'warn',
      hint: emptyContentCount ? `${emptyContentCount} عناصر بمحتوى فارغ` : 'المحتوى جاهز',
    },
    {
      id: 'smart-binding',
      label: 'حقول Smart Binding مرتبطة',
      status: unboundSmartFieldsCount === 0 ? 'pass' : 'warn',
      hint: unboundSmartFieldsCount === 0 ? 'لا توجد حقول غير مربوطة' : `${unboundSmartFieldsCount} حقل بدون ربط/قيمة`,
    },
    {
      id: 'assets-links',
      label: 'روابط الأصول صحيحة',
      status: brokenAssetCount === 0 ? 'pass' : 'warn',
      hint: brokenAssetCount === 0 ? 'لا توجد روابط مشبوهة' : `${brokenAssetCount} روابط تحتاج مراجعة`,
    },
  ];

  const criticalCount = checks.filter((check) => check.status === 'critical').length;
  const warnCount = checks.filter((check) => check.status === 'warn').length;

  return {
    checks,
    criticalCount,
    warnCount,
    passCount: checks.length - criticalCount - warnCount,
    canPublish: criticalCount === 0,
  };
};

const COMPONENT_PRESETS = [
  {
    id: 'kpi',
    title: 'Preset KPI',
    cardTitle: 'مؤشرات الأداء',
    description: 'كرت جاهز لمؤشرات الورشة السريعة',
    fields: [
      { label: 'إجمالي الإيراد', value: '0', source_testid: '' },
      { label: 'العمليات المفتوحة', value: '0', source_testid: '' },
      { label: 'صافي الدخل', value: '0', source_testid: '' },
    ],
  },
  {
    id: 'card',
    title: 'Preset Card',
    cardTitle: 'بطاقة ملخص',
    description: 'بطاقة ملخص عامة لعنصر أو قسم',
    fields: [
      { label: 'العنوان', value: 'عنوان البطاقة', source_testid: '' },
      { label: 'الوصف', value: 'وصف مختصر', source_testid: '' },
    ],
  },
  {
    id: 'table',
    title: 'Preset Table',
    cardTitle: 'جدول مختصر',
    description: 'مصفوفة جاهزة لعناوين جدول',
    fields: [
      { label: 'العمود 1', value: 'الاسم', source_testid: '' },
      { label: 'العمود 2', value: 'الحالة', source_testid: '' },
      { label: 'العمود 3', value: 'القيمة', source_testid: '' },
    ],
  },
  {
    id: 'button',
    title: 'Preset Button',
    cardTitle: 'زر إجراء',
    description: 'زر جاهز مع نص وحالة',
    fields: [
      { label: 'نص الزر', value: 'تنفيذ', source_testid: '' },
      { label: 'حالة الزر', value: 'مفعل', source_testid: '' },
    ],
  },
];

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
  const [selectedSmartCardId, setSelectedSmartCardId] = useState('');
  const [visualDiffOpen, setVisualDiffOpen] = useState(false);
  const [visualDiffSummary, setVisualDiffSummary] = useState(null);
  const [pendingPublishConfig, setPendingPublishConfig] = useState(null);
  const [publishChecklist, setPublishChecklist] = useState(null);
  const [studioPanelTab, setStudioPanelTab] = useState('history');

  const session = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('session') || '{}');
    } catch {
      return {};
    }
  }, []);

  const userId = String(session?.id || session?.userId || session?.name || 'manager').trim() || 'manager';
  const studioRootStyle = useMemo(() => ({ fontFamily: "'Parastoo', 'Noto Naskh Arabic', 'Tahoma', sans-serif" }), []);
  const panelCardClass = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';

  const customCards = useMemo(() => Array.isArray(config?.custom_cards) ? config.custom_cards : [], [config?.custom_cards]);
  const selectedSmartCard = useMemo(
    () => customCards.find((card) => card.id === selectedSmartCardId) || customCards[0] || null,
    [customCards, selectedSmartCardId],
  );

  useEffect(() => {
    if (!customCards.length) {
      setSelectedSmartCardId('');
      return;
    }
    if (!selectedSmartCardId || !customCards.some((card) => card.id === selectedSmartCardId)) {
      setSelectedSmartCardId(customCards[0].id);
    }
  }, [customCards, selectedSmartCardId]);

  const updateCustomCards = (nextCards) => {
    setConfig((prev) => normalizeConfig({ ...prev, custom_cards: nextCards }));
  };

  const addSmartCard = () => {
    const now = Date.now();
    const nextCard = {
      id: `smart-card-${now}`,
      title: `كرت ذكي ${customCards.length + 1}`,
      description: 'كرت مخصص مرتبط بعناصر الصفحة',
      fields: [
        {
          id: `smart-field-${now}`,
          label: 'حقل 1',
          value: '',
          source_testid: pageData?.blocks?.[0]?.id || '',
        },
      ],
    };
    updateCustomCards([...(customCards || []), nextCard]);
    setSelectedSmartCardId(nextCard.id);
  };

  const addPresetCard = (presetId) => {
    const preset = COMPONENT_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    const now = Date.now();
    const nextCard = {
      id: `preset-card-${preset.id}-${now}`,
      title: preset.cardTitle,
      description: preset.description,
      fields: (preset.fields || []).map((field, index) => ({
        id: `preset-field-${preset.id}-${now}-${index}`,
        label: field.label,
        value: field.value,
        source_testid: suggestSmartSourceTestid(field, pageData?.blocks || []),
      })),
    };
    updateCustomCards([...(customCards || []), nextCard]);
    setSelectedSmartCardId(nextCard.id);
    setStudioPanelTab('binding');
    toast({ title: 'تمت إضافة Preset', description: `${preset.title} تمت إضافته بنقرة واحدة.` });
  };

  const updateSmartCard = (cardId, patch) => {
    const next = customCards.map((card) => (card.id === cardId ? { ...card, ...patch } : card));
    updateCustomCards(next);
  };

  const removeSmartCard = (cardId) => {
    const next = customCards.filter((card) => card.id !== cardId);
    updateCustomCards(next);
  };

  const addSmartField = (cardId) => {
    const card = customCards.find((item) => item.id === cardId);
    if (!card) return;
    const nextField = {
      id: `smart-field-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      label: `حقل ${((card.fields || []).length || 0) + 1}`,
      value: '',
      source_testid: '',
    };
    updateSmartCard(cardId, { fields: [...(card.fields || []), nextField] });
  };

  const updateSmartField = (cardId, fieldId, patch) => {
    const card = customCards.find((item) => item.id === cardId);
    if (!card) return;
    const fields = (card.fields || []).map((field) => (field.id === fieldId ? { ...field, ...patch } : field));
    updateSmartCard(cardId, { fields });
  };

  const removeSmartField = (cardId, fieldId) => {
    const card = customCards.find((item) => item.id === cardId);
    if (!card) return;
    const fields = (card.fields || []).filter((field) => field.id !== fieldId);
    updateSmartCard(cardId, { fields });
  };

  const applySmartSuggestionToField = (cardId, field) => {
    const suggestion = suggestSmartSourceTestid(field, pageData?.blocks || []);
    if (!suggestion) return;
    updateSmartField(cardId, field.id, { source_testid: suggestion });
  };

  const applySmartSuggestionToCard = (cardId) => {
    const card = customCards.find((item) => item.id === cardId);
    if (!card) return;
    const fields = (card.fields || []).map((field) => ({
      ...field,
      source_testid: suggestSmartSourceTestid(field, pageData?.blocks || []),
    }));
    updateSmartCard(cardId, { fields });
  };

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
    const needRetry = effectiveBlocks.length < 8 && attempt < 1;
    if (needRetry) {
      window.setTimeout(() => rebuildPageDataWithRetries(pathArg, configArg, attempt + 1), 1200);
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
    const timer = window.setTimeout(() => {
      localStorage.setItem(draftStorageKey(userId, selectedPage), JSON.stringify(config));
    }, 420);
    return () => window.clearTimeout(timer);
  }, [config, selectedPage, userId]);

  const handleSave = async (data, meta = {}) => {
    const nextConfig = makeConfigFromEditorData(config, data, meta);
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

  const executePublish = async (nextConfig) => {
    try {
      setPublishing(true);
      try {
        localStorage.setItem(`moltbot-published:${userId}:${selectedPage}`, JSON.stringify(nextConfig));
      } catch (_error) {
        // ignore storage errors
      }
      window.dispatchEvent(new CustomEvent('page-customization-updated', {
        detail: {
          path: selectedPage,
          customization: nextConfig,
        },
      }));

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
      localStorage.removeItem(draftStorageKey(userId, selectedPage));
      await loadCollabMeta(selectedPage);
      toast({ title: 'تم النشر', description: 'تم نشر التعديلات على الصفحة بنجاح' });
    } catch {
      toast({ title: 'تحذير', description: 'تم حفظ التعديل محليًا، وتعذر مزامنة الخادم الآن', variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const handlePublish = async (data, meta = {}) => {
    const nextConfig = makeConfigFromEditorData(config, data, meta);
    try {
      let publishedBase = null;
      const localPublished = localStorage.getItem(`moltbot-published:${userId}:${selectedPage}`);
      if (localPublished) {
        try {
          publishedBase = normalizeConfig(JSON.parse(localPublished));
        } catch (_error) {
          publishedBase = null;
        }
      }

      const baseline = publishedBase || normalizeConfig(config);
      const summary = buildVisualDiffSummary(baseline, nextConfig);
      const checklist = buildPublishChecklist(data, nextConfig);
      if (summary.totalChanges === 0 && checklist.canPublish) {
        toast({ title: 'لا يوجد تغييرات', description: 'لم يتم اكتشاف أي فرق جديد للنشر.' });
        return;
      }
      setPendingPublishConfig(nextConfig);
      setVisualDiffSummary(summary);
      setPublishChecklist(checklist);
      setVisualDiffOpen(true);
    } catch {
      toast({ title: 'خطأ', description: 'تعذر تجهيز مقارنة النشر', variant: 'destructive' });
    }
  };

  const handleConfirmPublishFromDiff = async () => {
    if (publishChecklist && !publishChecklist.canPublish) {
      toast({
        title: 'تعذر النشر',
        description: 'يوجد عناصر حرجة في Checklist النشر. أصلحها ثم أعد المحاولة.',
        variant: 'destructive',
      });
      return;
    }
    if (!pendingPublishConfig) {
      setVisualDiffOpen(false);
      return;
    }
    setVisualDiffOpen(false);
    setPublishChecklist(null);
    await executePublish(pendingPublishConfig);
    setPendingPublishConfig(null);
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
    <div className="min-h-screen bg-[#f3f6ff] text-slate-900 overflow-x-hidden" style={studioRootStyle} data-testid="moltbot-canvas-editor-page">
      <div className="mx-3 mt-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-sm">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">MoltBot Canvas Editor</h1>
          <p className="text-xs text-slate-500" data-testid="moltbot-editor-meta-status">نسخة {draftMeta.version || 0} • الحالة: {draftMeta.status === 'published' ? 'منشور' : 'مسودة'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap md:justify-end">
          <div className="text-[11px] text-slate-500" data-testid="moltbot-editor-save-state">{savingDraft ? 'جاري حفظ المسودة...' : publishing ? 'جاري النشر...' : draftMeta.updated_at ? `آخر تحديث: ${new Date(draftMeta.updated_at).toLocaleString('ar-SA')}` : 'لم يتم الحفظ بعد'}</div>
          <select value={selectedPage} onChange={(e) => setSelectedPage(e.target.value)} className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none min-w-[180px]" data-testid="moltbot-canvas-editor-page-select">
            {LIQUID_BUILDER_PAGES.map((page) => <option key={page.path} value={page.path}>{page.label}</option>)}
          </select>
        </div>
      </div>

      <div className="mx-3 mt-2 flex flex-wrap items-center gap-2" data-testid="moltbot-editor-health-strip">
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] text-emerald-800" data-testid="moltbot-editor-health-performance-chip">تحسين أداء: فعال</span>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] text-sky-800" data-testid="moltbot-editor-health-ui-chip">واجهة مبسطة: فعال</span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-700" data-testid="moltbot-editor-health-font-chip">الخط: Parastoo</span>
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
        <div className="flex min-h-[70vh] items-center justify-center text-sm text-slate-600" data-testid="moltbot-canvas-editor-loading">جاري تجهيز المحرر...</div>
      ) : (
        <>
          <CanvasEditor
            key={`${selectedPage}-${pageData.blocks.length}`}
            pageData={pageData}
            onSave={handleSave}
            onPublish={handlePublish}
            onSelectionChange={setSelectedBlockId}
          />

          <div className="p-4 border-t border-slate-200 bg-[#eef3ff]" data-testid="moltbot-editor-collab-panel">
            <div className="mb-3 grid grid-cols-3 gap-2 xl:hidden" data-testid="moltbot-editor-collab-tabs">
              <button
                type="button"
                onClick={() => setStudioPanelTab('history')}
                className={`rounded-xl border px-2 py-2 text-xs ${studioPanelTab === 'history' ? 'border-sky-300 bg-sky-50 text-sky-900' : 'border-slate-300 bg-white text-slate-700'}`}
                data-testid="moltbot-editor-collab-tab-history"
              >
                History
              </button>
              <button
                type="button"
                onClick={() => setStudioPanelTab('comments')}
                className={`rounded-xl border px-2 py-2 text-xs ${studioPanelTab === 'comments' ? 'border-sky-300 bg-sky-50 text-sky-900' : 'border-slate-300 bg-white text-slate-700'}`}
                data-testid="moltbot-editor-collab-tab-comments"
              >
                Comments
              </button>
              <button
                type="button"
                onClick={() => setStudioPanelTab('binding')}
                className={`rounded-xl border px-2 py-2 text-xs ${studioPanelTab === 'binding' ? 'border-sky-300 bg-sky-50 text-sky-900' : 'border-slate-300 bg-white text-slate-700'}`}
                data-testid="moltbot-editor-collab-tab-binding"
              >
                Binding
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className={`${panelCardClass} ${studioPanelTab === 'history' ? 'block' : 'hidden xl:block'}`} data-testid="moltbot-editor-history-panel">
              <h3 className="text-sm font-bold mb-3 text-slate-900">History (Save)</h3>
              <div className="space-y-2 max-h-56 overflow-y-auto" data-testid="moltbot-editor-history-list">
                {historyRows.length ? historyRows.map((row, idx) => (
                  <div key={row.id || idx} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" data-testid={`moltbot-editor-history-item-${idx}`}>
                    <div className="text-xs text-slate-800">v{row.version || 0} • {row.status === 'published' ? 'منشور' : 'مسودة'}</div>
                    <div className="text-[11px] text-slate-500">{row.note || '-'} • {row.updated_at ? new Date(row.updated_at).toLocaleString('ar-SA') : '-'}</div>
                  </div>
                )) : <div className="text-xs text-slate-500" data-testid="moltbot-editor-history-empty">لا يوجد تاريخ حفظ بعد</div>}
              </div>
            </div>

            <div className={`${panelCardClass} ${studioPanelTab === 'comments' ? 'block' : 'hidden xl:block'}`} data-testid="moltbot-editor-comments-panel">
              <h3 className="text-sm font-bold mb-2 text-slate-900">Comments</h3>
              <div className="text-[11px] text-slate-500 mb-2" data-testid="moltbot-editor-comments-selected-block">العنصر المحدد: {selectedBlockId || 'غير محدد'}</div>
              <div className="flex gap-2 mb-3">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="أضف تعليقًا على العنصر/الصفحة"
                  className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none"
                  data-testid="moltbot-editor-comment-input"
                />
                <button
                  type="button"
                  onClick={handleAddComment}
                  className="rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm text-cyan-900"
                  data-testid="moltbot-editor-comment-add-button"
                >
                  إضافة
                </button>
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto" data-testid="moltbot-editor-comments-list">
                {comments.length ? comments.map((comment, idx) => (
                  <div key={comment.id || idx} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" data-testid={`moltbot-editor-comment-item-${idx}`}>
                    <div className="text-xs text-slate-800">{comment.author_name || comment.user_id || 'مستخدم'} {comment.block_id ? `• ${comment.block_id}` : ''}</div>
                    <div className="text-xs text-slate-600 mt-1">{comment.message || '-'}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">{comment.created_at ? new Date(comment.created_at).toLocaleString('ar-SA') : '-'}</span>
                      <button
                        type="button"
                        onClick={() => handleResolveComment(comment.id, Boolean(comment.resolved))}
                        className="text-[11px] px-2 py-1 rounded border border-slate-300 bg-white"
                        data-testid={`moltbot-editor-comment-resolve-button-${idx}`}
                      >
                        {comment.resolved ? 'إعادة فتح' : 'تم الحل'}
                      </button>
                    </div>
                  </div>
                )) : <div className="text-xs text-slate-500" data-testid="moltbot-editor-comments-empty">لا توجد تعليقات بعد</div>}
              </div>
            </div>

            <div className={`${panelCardClass} ${studioPanelTab === 'binding' ? 'block' : 'hidden xl:block'}`} data-testid="moltbot-editor-smart-binding-panel">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-bold text-slate-900" data-testid="moltbot-editor-smart-binding-title">Smart Binding</h3>
                <button
                  type="button"
                  onClick={addSmartCard}
                  className="rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] text-sky-900"
                  data-testid="moltbot-editor-smart-binding-add-card-button"
                >
                  + كرت جديد
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3" data-testid="moltbot-editor-presets-grid">
                {COMPONENT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => addPresetCard(preset.id)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-[11px] text-slate-700 hover:bg-slate-50"
                    data-testid={`moltbot-editor-preset-button-${preset.id}`}
                  >
                    {preset.title}
                  </button>
                ))}
              </div>

              {customCards.length ? (
                <div className="space-y-3" data-testid="moltbot-editor-smart-binding-body">
                  <select
                    value={selectedSmartCard?.id || ''}
                    onChange={(e) => setSelectedSmartCardId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                    data-testid="moltbot-editor-smart-binding-card-select"
                  >
                    {customCards.map((card) => <option key={card.id} value={card.id}>{card.title || card.id}</option>)}
                  </select>

                  {selectedSmartCard ? (
                    <>
                      <input
                        value={selectedSmartCard.title || ''}
                        onChange={(e) => updateSmartCard(selectedSmartCard.id, { title: e.target.value })}
                        placeholder="عنوان الكرت"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                        data-testid="moltbot-editor-smart-binding-card-title-input"
                      />

                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => applySmartSuggestionToCard(selectedSmartCard.id)}
                          className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-900"
                          data-testid="moltbot-editor-smart-binding-apply-all-button"
                        >
                          تطبيق ذكي لكل الحقول
                        </button>
                        <button
                          type="button"
                          onClick={() => addSmartField(selectedSmartCard.id)}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700"
                          data-testid="moltbot-editor-smart-binding-add-field-button"
                        >
                          + حقل
                        </button>
                      </div>

                      <div className="max-h-56 overflow-y-auto space-y-2" data-testid="moltbot-editor-smart-binding-fields-list">
                        {(selectedSmartCard.fields || []).length ? (selectedSmartCard.fields || []).map((field, idx) => (
                          <div key={field.id || idx} className="rounded-xl border border-slate-200 bg-slate-50 p-2" data-testid={`moltbot-editor-smart-binding-field-${idx}`}>
                            <input
                              value={field.label || ''}
                              onChange={(e) => updateSmartField(selectedSmartCard.id, field.id, { label: e.target.value })}
                              placeholder="اسم الحقل"
                              className="mb-2 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900"
                              data-testid={`moltbot-editor-smart-binding-field-label-${idx}`}
                            />
                            <input
                              value={field.value || ''}
                              onChange={(e) => updateSmartField(selectedSmartCard.id, field.id, { value: e.target.value })}
                              placeholder="قيمة افتراضية"
                              className="mb-2 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900"
                              data-testid={`moltbot-editor-smart-binding-field-value-${idx}`}
                            />
                            <select
                              value={field.source_testid || ''}
                              onChange={(e) => updateSmartField(selectedSmartCard.id, field.id, { source_testid: e.target.value })}
                              className="mb-2 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900"
                              data-testid={`moltbot-editor-smart-binding-field-source-${idx}`}
                            >
                              <option value="">بدون ربط</option>
                              {(pageData?.blocks || []).map((block) => (
                                <option key={block.id} value={block.id}>{block.title || block.name || block.id}</option>
                              ))}
                            </select>
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => applySmartSuggestionToField(selectedSmartCard.id, field)}
                                className="rounded-lg border border-cyan-300 bg-cyan-50 px-2 py-1 text-[11px] text-cyan-900"
                                data-testid={`moltbot-editor-smart-binding-field-suggest-${idx}`}
                              >
                                اقتراح ذكي
                              </button>
                              <button
                                type="button"
                                onClick={() => removeSmartField(selectedSmartCard.id, field.id)}
                                className="rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] text-rose-700"
                                data-testid={`moltbot-editor-smart-binding-field-delete-${idx}`}
                              >
                                حذف
                              </button>
                            </div>
                          </div>
                        )) : (
                          <div className="text-xs text-slate-500" data-testid="moltbot-editor-smart-binding-fields-empty">لا توجد حقول بعد</div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeSmartCard(selectedSmartCard.id)}
                        className="w-full rounded-lg border border-rose-300 bg-rose-50 px-2 py-2 text-[11px] text-rose-700"
                        data-testid="moltbot-editor-smart-binding-delete-card-button"
                      >
                        حذف الكرت المحدد
                      </button>
                    </>
                  ) : null}
                </div>
              ) : (
                <div className="text-xs text-slate-500" data-testid="moltbot-editor-smart-binding-empty">لا توجد كروت مخصصة بعد. أضف كرتًا ثم فعّل الاقتراح الذكي.</div>
              )}
            </div>
            </div>
          </div>

          {visualDiffOpen ? (
            <div className="fixed inset-0 z-[90] bg-slate-950/35 backdrop-blur-sm flex items-center justify-center p-4" data-testid="moltbot-visual-diff-modal">
              <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl" data-testid="moltbot-visual-diff-modal-card">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900" data-testid="moltbot-visual-diff-title">Visual Diff قبل النشر</h3>
                    <p className="text-xs text-slate-500" data-testid="moltbot-visual-diff-subtitle">مراجعة سريعة للتغييرات قبل اعتمادها على الصفحة.</p>
                  </div>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-900" data-testid="moltbot-visual-diff-total">{visualDiffSummary?.totalChanges || 0} تغييرات</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs mb-3" data-testid="moltbot-visual-diff-metrics">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">Labels: {visualDiffSummary?.labelsChanged?.length || 0}</div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">Contents: {visualDiffSummary?.contentsChanged?.length || 0}</div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">Styles: {visualDiffSummary?.stylesChanged?.length || 0}</div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">Assets: {visualDiffSummary?.assetsChanged?.length || 0}</div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">Hidden: {visualDiffSummary?.hiddenChanged?.length || 0}</div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">Positions: {visualDiffSummary?.positionsChanged?.length || 0}</div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 mb-3" data-testid="moltbot-visual-diff-keys-box">
                  <p className="text-xs font-semibold text-slate-700 mb-2">أهم العناصر المتأثرة</p>
                  <div className="flex flex-wrap gap-2" data-testid="moltbot-visual-diff-keys-list">
                    {(visualDiffSummary?.touchedKeys || []).slice(0, 12).map((key) => (
                      <span key={key} className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700" data-testid={`moltbot-visual-diff-key-${key}`}>
                        {key}
                      </span>
                    ))}
                    {!(visualDiffSummary?.touchedKeys || []).length ? <span className="text-[11px] text-slate-500">لا توجد فروقات على العناصر، قد يكون التغيير فقط في إعدادات عامة.</span> : null}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 mb-3" data-testid="moltbot-publish-checklist-box">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold text-slate-700" data-testid="moltbot-publish-checklist-title">Pre-Publish Checklist</p>
                    <span className="text-[11px] text-slate-600" data-testid="moltbot-publish-checklist-summary">
                      ✅ {publishChecklist?.passCount || 0} • ⚠️ {publishChecklist?.warnCount || 0} • ⛔ {publishChecklist?.criticalCount || 0}
                    </span>
                  </div>
                  <div className="space-y-2" data-testid="moltbot-publish-checklist-list">
                    {(publishChecklist?.checks || []).map((check) => {
                      const badgeClass = check.status === 'critical'
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : check.status === 'warn'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-200';
                      const label = check.status === 'critical' ? 'حرج' : check.status === 'warn' ? 'تنبيه' : 'جاهز';
                      return (
                        <div key={check.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2" data-testid={`moltbot-publish-checklist-item-${check.id}`}>
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-slate-800">{check.label}</p>
                            <p className="text-[11px] text-slate-500">{check.hint}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] ${badgeClass}`} data-testid={`moltbot-publish-checklist-badge-${check.id}`}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2" data-testid="moltbot-visual-diff-actions">
                  <button
                    type="button"
                    onClick={() => { setVisualDiffOpen(false); setPendingPublishConfig(null); setPublishChecklist(null); }}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
                    data-testid="moltbot-visual-diff-cancel-button"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPublishFromDiff}
                    disabled={Boolean(publishChecklist && !publishChecklist.canPublish)}
                    className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="moltbot-visual-diff-confirm-publish-button"
                  >
                    {publishChecklist && !publishChecklist.canPublish ? 'اصلح العناصر الحرجة أولًا' : 'نشر الآن'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}