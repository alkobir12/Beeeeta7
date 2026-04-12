const IGNORED_TESTID_PREFIXES = [
  'liquid-site-builder',
  'workshop-bot',
  'floating-sidebar',
  'sidebar-',
  'mobile-sidebar',
  'app-sidebar',
  'language-',
  'permission-denied',
];

const getSnapshotRoot = () => {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.content-area .animate-fade-in') || document.querySelector('main.content-area') || document.body;
};

const isIgnoredTestid = (testid) => IGNORED_TESTID_PREFIXES.some((prefix) => String(testid || '').startsWith(prefix));

export const buildUiSnapshot = (limit = 260) => {
  try {
    const root = getSnapshotRoot();
    if (!root) return [];
    return Array.from(root.querySelectorAll('[data-testid]'))
      .slice(0, limit)
      .map((node) => ({
        testid: node.getAttribute('data-testid') || '',
        text: (node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
        tag: String(node.tagName || '').toLowerCase(),
      }))
      .filter((item) => item.testid && !isIgnoredTestid(item.testid));
  } catch (_error) {
    return [];
  }
};

const BLOCK_HINTS = ['card', 'panel', 'section', 'table', 'widget', 'dock', 'layout-block', 'summary', 'page', 'stat', 'modal'];

export const buildBlockSnapshot = (limit = 120) => {
  try {
    const root = getSnapshotRoot();
    if (!root) return [];
    const matches = Array.from(root.querySelectorAll('[data-testid]'))
      .filter((node) => {
        const testid = String(node.getAttribute('data-testid') || '');
        return !isIgnoredTestid(testid) && BLOCK_HINTS.some((hint) => testid.includes(hint));
      })
      .slice(0, limit)
      .map((node) => ({
        testid: node.getAttribute('data-testid') || '',
        text: (node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
      }))
      .filter((item) => item.testid);
    if (matches.length) return matches;
    return buildUiSnapshot(limit);
  } catch (_error) {
    return [];
  }
};

export const clearPageCustomizations = (appliedEntriesRef) => {
  const entries = appliedEntriesRef?.current || [];
  entries.forEach((entry) => {
    try {
      if (!entry?.element) return;
      if (entry.type === 'hide') {
        entry.element.style.display = entry.prevDisplay ?? '';
      }
      if (entry.type === 'text') {
        entry.element.textContent = entry.prevText ?? '';
      }
      if (entry.type === 'reorder') {
        if (entry.nextSibling && entry.nextSibling.parentNode === entry.parent) {
          entry.parent.insertBefore(entry.element, entry.nextSibling);
        } else {
          entry.parent.appendChild(entry.element);
        }
      }
      if (entry.type === 'position') {
        entry.element.style.position = entry.prevPosition ?? '';
        entry.element.style.left = entry.prevLeft ?? '';
        entry.element.style.top = entry.prevTop ?? '';
      }
    } catch (_error) {
      return;
    }
  });
  if (appliedEntriesRef) {
    appliedEntriesRef.current = [];
  }
};

export const applyPageCustomizations = (customization = {}, appliedEntriesRef) => {
  clearPageCustomizations(appliedEntriesRef);
  const labels = customization?.labels || {};
  const hidden = customization?.hidden || {};
  const contents = customization?.contents || {};
  const blockOrder = customization?.block_order || [];
  const positions = customization?.positions || {};

  Object.entries(hidden).forEach(([testid, hideValue]) => {
    if (!hideValue) return;
    const element = document.querySelector(`[data-testid="${testid}"]`);
    if (!element) return;
    appliedEntriesRef.current.push({
      type: 'hide',
      element,
      prevDisplay: element.style.display,
    });
    element.style.display = 'none';
  });

  Object.entries(labels).forEach(([testid, newLabel]) => {
    const element = document.querySelector(`[data-testid="${testid}"]`);
    if (!element) return;
    appliedEntriesRef.current.push({
      type: 'text',
      element,
      prevText: element.textContent,
    });
    element.textContent = String(newLabel || '');
  });

  Object.entries(contents).forEach(([testid, newContent]) => {
    const element = document.querySelector(`[data-testid="${testid}"]`);
    if (!element) return;
    appliedEntriesRef.current.push({
      type: 'text',
      element,
      prevText: element.textContent,
    });
    element.textContent = String(newContent || '');
  });

  if (Array.isArray(blockOrder) && blockOrder.length) {
    const groups = new Map();
    blockOrder.forEach((testid) => {
      const element = document.querySelector(`[data-testid="${testid}"]`);
      if (!element?.parentNode) return;
      const parent = element.parentNode;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(element);
    });

    groups.forEach((elements, parent) => {
      elements.forEach((element) => {
        appliedEntriesRef.current.push({
          type: 'reorder',
          element,
          parent,
          nextSibling: element.nextSibling,
        });
      });
      elements.forEach((element) => parent.appendChild(element));
    });
  }

  Object.entries(positions).forEach(([testid, pos]) => {
    const element = document.querySelector(`[data-testid="${testid}"]`);
    if (!element) return;
    appliedEntriesRef.current.push({
      type: 'position',
      element,
      prevPosition: element.style.position,
      prevLeft: element.style.left,
      prevTop: element.style.top,
    });
    if (!element.style.position || element.style.position === 'static') {
      element.style.position = 'relative';
    }
    element.style.left = `${Number(pos?.left || 0)}px`;
    element.style.top = `${Number(pos?.top || 0)}px`;
  });
};