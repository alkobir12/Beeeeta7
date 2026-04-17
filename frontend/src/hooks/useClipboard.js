import { useCallback } from 'react';

const CLIPBOARD_KEY = 'moltbot-editor-clipboard';

const generateId = (seed = 'block') => {
  const random = Math.random().toString(36).slice(2, 8);
  return `${seed}-${Date.now()}-${random}`;
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

export const useClipboard = () => {
  const writeClipboard = useCallback((block) => {
    if (!block?.id) return false;
    const payload = {
      block: deepClone(block),
      copiedAt: new Date().toISOString(),
    };
    localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(payload));
    return true;
  }, []);

  const readClipboard = useCallback(() => {
    try {
      const raw = localStorage.getItem(CLIPBOARD_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.block || null;
    } catch (_error) {
      return null;
    }
  }, []);

  const cloneWithNewId = useCallback((block) => {
    if (!block) return null;
    const clone = deepClone(block);
    clone.id = generateId(clone.id || 'block');
    clone.title = clone.title ? `${clone.title} (نسخة)` : clone.id;
    clone.name = clone.name ? `${clone.name} (نسخة)` : clone.id;
    return clone;
  }, []);

  return {
    writeClipboard,
    readClipboard,
    cloneWithNewId,
  };
};
