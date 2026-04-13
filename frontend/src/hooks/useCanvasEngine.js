import { useEffect, useRef, useState } from 'react';

export function useCanvasEngine(initial, options = {}) {
  const { onChange, onCommit } = options;
  const [state, setState] = useState(initial);

  const dragRef = useRef({ id: null, offset: { x: 0, y: 0 } });
  const resizeRef = useRef({ id: null, direction: null, start: { x: 0, y: 0 }, startSize: { w: 0, h: 0 } });

  useEffect(() => {
    setState((prev) => ({ ...prev, elements: initial.elements || [], selectedId: initial.selectedId ?? prev.selectedId }));
  }, [initial.elements, initial.selectedId]);

  const snap = (value) => {
    const grid = 10;
    return Math.round(value / grid) * grid;
  };

  const selectElement = (id) => setState((prev) => ({ ...prev, selectedId: id }));

  const startDrag = (event, id) => {
    const el = state.elements.find((item) => item.id === id);
    if (!el) return;
    dragRef.current = { id, offset: { x: event.clientX - el.x, y: event.clientY - el.y } };
  };

  const onDrag = (event) => {
    const id = dragRef.current.id;
    if (!id) return;
    setState((prev) => {
      const next = {
        ...prev,
        elements: prev.elements.map((el) => el.id === id ? { ...el, x: snap(event.clientX - dragRef.current.offset.x), y: snap(event.clientY - dragRef.current.offset.y) } : el),
      };
      onChange?.(next);
      return next;
    });
  };

  const endDrag = () => {
    if (dragRef.current.id) {
      onCommit?.(state);
    }
    dragRef.current.id = null;
  };

  const startResize = (event, id, direction) => {
    const el = state.elements.find((item) => item.id === id);
    if (!el) return;
    resizeRef.current = {
      id,
      direction,
      start: { x: event.clientX, y: event.clientY },
      startSize: { w: el.width, h: el.height },
    };
  };

  const onResize = (event) => {
    const { id, direction, start, startSize } = resizeRef.current;
    if (!id || !direction) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    setState((prev) => {
      const next = {
        ...prev,
        elements: prev.elements.map((el) => {
          if (el.id !== id) return el;
          let width = el.width;
          let height = el.height;
          if (direction.includes('right')) width = snap(startSize.w + dx);
          if (direction.includes('bottom')) height = snap(startSize.h + dy);
          return { ...el, width: Math.max(24, width), height: Math.max(24, height) };
        }),
      };
      onChange?.(next);
      return next;
    });
  };

  const endResize = () => {
    if (resizeRef.current.id) {
      onCommit?.(state);
    }
    resizeRef.current = { id: null, direction: null, start: { x: 0, y: 0 }, startSize: { w: 0, h: 0 } };
  };

  const getGuides = (activeId) => {
    const active = state.elements.find((item) => item.id === activeId);
    if (!active) return [];
    return state.elements.filter((item) => item.id !== activeId).map((item) => ({ x: item.x, y: item.y, width: item.width, height: item.height }));
  };

  useEffect(() => {
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('mousemove', onResize);
    window.addEventListener('mouseup', endResize);
    return () => {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('mousemove', onResize);
      window.removeEventListener('mouseup', endResize);
    };
  });

  return {
    state,
    setState,
    selectElement,
    startDrag,
    startResize,
    getGuides,
  };
}