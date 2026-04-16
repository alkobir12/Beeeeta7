import { useCallback, useRef, useState } from 'react';

const deepClone = (value) => JSON.parse(JSON.stringify(value));

export const useSimpleHistory = (initialData) => {
  const [history, setHistory] = useState([deepClone(initialData)]);
  const [index, setIndex] = useState(0);
  const timeoutRef = useRef(null);

  const reset = useCallback((nextData) => {
    const cloned = deepClone(nextData);
    setHistory([cloned]);
    setIndex(0);
  }, []);

  const push = useCallback((newData, delay = 300) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setHistory((prev) => {
        const sliced = prev.slice(0, index + 1);
        return [...sliced, deepClone(newData)].slice(-30);
      });
      setIndex((prev) => Math.min(prev + 1, 29));
    }, delay);
  }, [index]);

  const undo = useCallback(() => {
    if (index <= 0) return null;
    const nextIndex = index - 1;
    setIndex(nextIndex);
    return history[nextIndex];
  }, [history, index]);

  const redo = useCallback(() => {
    if (index >= history.length - 1) return null;
    const nextIndex = index + 1;
    setIndex(nextIndex);
    return history[nextIndex];
  }, [history, index]);

  return {
    current: history[index],
    push,
    undo,
    redo,
    reset,
    canUndo: index > 0,
    canRedo: index < history.length - 1,
    history,
    index,
  };
};