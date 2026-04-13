import { useMemo } from 'react';

export const K_ResolveResponsive = (element, device) => {
  const responsive = element.responsive?.[device] || {};
  return {
    position: {
      x: responsive.x ?? element.x ?? 0,
      y: responsive.y ?? element.y ?? 0,
    },
    styles: {
      width: responsive.width ?? element.width ?? 180,
      height: responsive.height ?? element.height ?? 56,
      color: responsive.color ?? element.styles?.color ?? '#ffffff',
      background: responsive.background ?? element.styles?.background ?? 'rgba(255,255,255,0.05)',
      fontSize: responsive.fontSize ?? element.styles?.fontSize ?? '16px',
      fontWeight: responsive.fontWeight ?? element.styles?.fontWeight ?? '500',
      opacity: responsive.opacity ?? element.styles?.opacity ?? 1,
      borderRadius: responsive.borderRadius ?? element.styles?.borderRadius ?? '20px',
      boxShadow: responsive.boxShadow ?? element.styles?.boxShadow ?? 'none',
      textAlign: responsive.textAlign ?? element.styles?.textAlign ?? 'right',
      padding: responsive.padding ?? element.styles?.padding ?? '12px',
      margin: responsive.margin ?? element.styles?.margin ?? '0px',
      backdropFilter: responsive.backdropFilter ?? element.styles?.backdropFilter ?? 'none',
    },
  };
};

export const M_DragEngine = (state, setState, onSync) => ({
  onDrag(elementId, startX, startY) {
    const startElement = state.sections.flatMap((section) => section.elements).find((el) => el.id === elementId);
    if (!startElement) return;
    const originX = startElement.x || 0;
    const originY = startElement.y || 0;

    const onMove = (event) => {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      setState((prev) => {
        const next = {
          ...prev,
          sections: prev.sections.map((section) => ({
            ...section,
            elements: section.elements.map((el) => el.id === elementId ? { ...el, x: Math.round((originX + dx) / 10) * 10, y: Math.round((originY + dy) / 10) * 10 } : el),
          })),
        };
        onSync?.(next);
        return next;
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  },
});

export const N_ResizeEngine = (state, setState, onSync) => ({
  onResize(elementId, startWidth, startHeight, startX, startY) {
    const onMove = (event) => {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      setState((prev) => {
        const next = {
          ...prev,
          sections: prev.sections.map((section) => ({
            ...section,
            elements: section.elements.map((el) => el.id === elementId ? { ...el, width: Math.max(60, Math.round((startWidth + dx) / 10) * 10), height: Math.max(40, Math.round((startHeight + dy) / 10) * 10) } : el),
          })),
        };
        onSync?.(next);
        return next;
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  },
});

export const P_Toolbar = (element, selectedId) => (selectedId === element.id ? ['copy', 'hide', 'bind'] : null);

export const Q_Update = (state, elementId, patch) => ({
  ...state,
  sections: state.sections.map((section) => ({
    ...section,
    elements: section.elements.map((el) => el.id === elementId ? { ...el, ...patch } : el),
  })),
});

export const R_Validate = (state) => Array.isArray(state?.sections) && Array.isArray(state.sections.flatMap((section) => section.elements));

export const S_Render = (element, device) => K_ResolveResponsive(element, device);