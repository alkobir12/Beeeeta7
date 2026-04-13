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

const getSnapshotRoot = (targetDocument = document) => {
  if (!targetDocument) return null;
  return targetDocument.querySelector('.content-area .animate-fade-in') || targetDocument.querySelector('main.content-area') || targetDocument.body;
};

const isIgnoredTestid = (testid) => IGNORED_TESTID_PREFIXES.some((prefix) => String(testid || '').startsWith(prefix));

export const buildUiSnapshot = (limit = 260, targetDocument = document) => {
  try {
    const root = getSnapshotRoot(targetDocument);
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

export const buildBlockSnapshot = (limit = 120, targetDocument = document) => {
  try {
    const root = getSnapshotRoot(targetDocument);
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
    return buildUiSnapshot(limit, targetDocument);
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
      if (entry.type === 'style-asset') {
        if (entry.prevStyle) {
          entry.element.setAttribute('style', entry.prevStyle);
        } else {
          entry.element.removeAttribute('style');
        }
        if (entry.prevSrc) {
          entry.element.setAttribute('src', entry.prevSrc);
        }
        if (entry.prevHref) {
          entry.element.setAttribute('href', entry.prevHref);
        }
        if (entry.prevBackgroundImage !== undefined) {
          entry.element.style.backgroundImage = entry.prevBackgroundImage;
        }
      }
    } catch (_error) {
      return;
    }
  });
  if (appliedEntriesRef) {
    appliedEntriesRef.current = [];
  }
};

export const applyPageCustomizations = (customization = {}, appliedEntriesRef, targetDocument = document) => {
  clearPageCustomizations(appliedEntriesRef);
  const labels = customization?.labels || {};
  const hidden = customization?.hidden || {};
  const contents = customization?.contents || {};
  const blockOrder = customization?.block_order || [];
  const positions = customization?.positions || {};
  const styles = customization?.styles || {};
  const assets = customization?.assets || {};
  const touched = new Set();

  const remember = (element) => {
    if (!element || touched.has(element)) return;
    touched.add(element);
    appliedEntriesRef.current.push({
      type: 'style-asset',
      element,
      prevStyle: element.getAttribute('style') || '',
      prevSrc: element.getAttribute('src') || '',
      prevHref: element.getAttribute('href') || '',
      prevBackgroundImage: element.style.backgroundImage || '',
    });
  };

  Object.entries(hidden).forEach(([testid, hideValue]) => {
    if (!hideValue) return;
    const element = targetDocument.querySelector(`[data-testid="${testid}"]`);
    if (!element) return;
    remember(element);
    appliedEntriesRef.current.push({
      type: 'hide',
      element,
      prevDisplay: element.style.display,
    });
    element.style.display = 'none';
  });

  Object.entries(labels).forEach(([testid, newLabel]) => {
    const element = targetDocument.querySelector(`[data-testid="${testid}"]`);
    if (!element) return;
    remember(element);
    appliedEntriesRef.current.push({
      type: 'text',
      element,
      prevText: element.textContent,
    });
    element.textContent = String(newLabel || '');
  });

  Object.entries(contents).forEach(([testid, newContent]) => {
    const element = targetDocument.querySelector(`[data-testid="${testid}"]`);
    if (!element) return;
    remember(element);
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
      const element = targetDocument.querySelector(`[data-testid="${testid}"]`);
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
    const element = targetDocument.querySelector(`[data-testid="${testid}"]`);
    if (!element) return;
    remember(element);
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

  Object.entries(styles).forEach(([testid, styleMap]) => {
    const element = targetDocument.querySelector(`[data-testid="${testid}"]`);
    if (!element || !styleMap || typeof styleMap !== 'object') return;
    remember(element);
    Object.entries(styleMap).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      element.style[key] = String(value);
    });
  });

  Object.entries(assets).forEach(([testid, asset]) => {
    const element = targetDocument.querySelector(`[data-testid="${testid}"]`);
    if (!element || !asset || typeof asset !== 'object') return;
    remember(element);
    const imageTarget = element.tagName === 'IMG' ? element : element.querySelector('img');
    if (asset.src && imageTarget) {
      imageTarget.setAttribute('src', asset.src);
    } else if (asset.src) {
      element.style.backgroundImage = `url(${asset.src})`;
      element.style.backgroundSize = element.style.backgroundSize || 'cover';
      element.style.backgroundPosition = element.style.backgroundPosition || 'center';
    }
    const linkTarget = element.tagName === 'A' ? element : element.querySelector('a');
    if (asset.href && linkTarget) {
      linkTarget.setAttribute('href', asset.href);
    }
  });
};