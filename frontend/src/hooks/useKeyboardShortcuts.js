import { useEffect } from 'react';

const isEditableTarget = (target) => {
  if (!target) return false;
  const tag = String(target.tagName || '').toLowerCase();
  return target.isContentEditable || ['input', 'textarea', 'select'].includes(tag);
};

export const useKeyboardShortcuts = (handlers = {}) => {
  useEffect(() => {
    const onKeyDown = (event) => {
      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      const key = String(event.key || '').toLowerCase();

      if (ctrlOrMeta && key === 's') {
        event.preventDefault();
        if (event.shiftKey) handlers.onPublish?.();
        else handlers.onSave?.();
        return;
      }

      if (ctrlOrMeta && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) handlers.onRedo?.();
        else handlers.onUndo?.();
        return;
      }

      if (ctrlOrMeta && key === 'y') {
        event.preventDefault();
        handlers.onRedo?.();
        return;
      }

      if (ctrlOrMeta && key === 'c') {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        handlers.onCopy?.();
        return;
      }

      if (ctrlOrMeta && key === 'v') {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        handlers.onPaste?.();
        return;
      }

      if (ctrlOrMeta && key === 'd') {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        handlers.onDuplicate?.();
        return;
      }

      if (key === 'delete' || key === 'backspace') {
        if (isEditableTarget(event.target)) return;
        handlers.onDelete?.();
        return;
      }

      if (key === 'escape') {
        handlers.onDeselect?.();
        return;
      }

      if (event.shiftKey && key === '?') {
        event.preventDefault();
        handlers.onToggleShortcuts?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
};
