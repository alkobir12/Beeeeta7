export const buildUiSnapshot = (limit = 260) => {
  try {
    return Array.from(document.querySelectorAll('[data-testid]'))
      .slice(0, limit)
      .map((node) => ({
        testid: node.getAttribute('data-testid') || '',
        text: (node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
        tag: String(node.tagName || '').toLowerCase(),
      }))
      .filter((item) => item.testid);
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
};