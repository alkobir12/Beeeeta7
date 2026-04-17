import React, { useEffect, useRef, useState } from 'react';
import { Liquid } from 'liquidjs';
import { applyPageCustomizations, clearPageCustomizations } from '../../utils/pageCustomization';

const PreviewFrame = ({ blocks, deviceMode, selectedId, onSelect, previewSrc, customization, liveSyncEnabled = false }) => {
  const iframeRef = useRef(null);
  const engine = useRef(new Liquid());
  const appliedCustomizationsRef = useRef([]);
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [forceFallback, setForceFallback] = useState(false);

  useEffect(() => {
    if (!previewSrc) {
      setLiveLoaded(false);
      setForceFallback(false);
      return undefined;
    }
    setLiveLoaded(false);
    setForceFallback(false);
    const timer = window.setTimeout(() => {
      setForceFallback((prev) => (liveLoaded ? prev : true));
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [previewSrc, liveLoaded]);

  useEffect(() => {
    if (!previewSrc || !iframeRef.current) return undefined;

    const iframe = iframeRef.current;
    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        setLiveLoaded(true);
        setForceFallback(false);

        applyPageCustomizations(customization || {}, appliedCustomizationsRef, doc);

        const styleId = 'moltbot-editor-selection-style';
        if (!doc.getElementById(styleId)) {
          const styleTag = doc.createElement('style');
          styleTag.id = styleId;
          styleTag.textContent = '[data-moltbot-selected="1"]{outline:2px solid #38bdf8 !important; outline-offset:2px !important; border-radius:8px !important;}';
          doc.head.appendChild(styleTag);
        }

        if (doc.__moltbotClickHandler) {
          doc.removeEventListener('click', doc.__moltbotClickHandler, true);
        }
        const clickHandler = (event) => {
          const target = event.target?.closest?.('[data-testid]');
          if (!target) return;
          event.preventDefault();
          event.stopPropagation();
          onSelect?.(target.getAttribute('data-testid') || '');
        };
        doc.__moltbotClickHandler = clickHandler;
        doc.addEventListener('click', clickHandler, true);

        window.setTimeout(() => {
          try {
            const hasVisibleText = String(doc.body?.innerText || '').trim().length > 6;
            if (!hasVisibleText) {
              setForceFallback(true);
            }
          } catch (_error) {
            setForceFallback(true);
          }
        }, 1400);
      } catch (_error) {
        return;
      }
    };

    iframe.addEventListener('load', handleLoad);
    return () => {
      iframe.removeEventListener('load', handleLoad);
      try {
        const doc = iframe.contentDocument;
        if (doc?.__moltbotClickHandler) {
          doc.removeEventListener('click', doc.__moltbotClickHandler, true);
          delete doc.__moltbotClickHandler;
        }
      } catch (_error) {
        // ignore
      }
      clearPageCustomizations(appliedCustomizationsRef);
    };
  }, [previewSrc, customization, onSelect]);

  useEffect(() => {
    if (!previewSrc || forceFallback || !liveSyncEnabled || !iframeRef.current) return;
    try {
      const doc = iframeRef.current.contentDocument;
      if (!doc) return;
      doc.querySelectorAll('[data-moltbot-selected="1"]').forEach((node) => node.removeAttribute('data-moltbot-selected'));
      if (!selectedId) return;
      const safeId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(selectedId)
        : String(selectedId).replace(/"/g, '\\"');
      const selectedNode = doc.querySelector(`[data-testid="${safeId}"]`);
      if (selectedNode) {
        selectedNode.setAttribute('data-moltbot-selected', '1');
        selectedNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (_error) {
      return;
    }
  }, [selectedId, previewSrc, forceFallback]);

  useEffect(() => {
    if (!previewSrc || forceFallback || !iframeRef.current) return;
    try {
      const doc = iframeRef.current.contentDocument;
      if (!doc) return;
      applyPageCustomizations(customization || {}, appliedCustomizationsRef, doc);
    } catch (_error) {
      return;
    }
  }, [customization, previewSrc, forceFallback, liveSyncEnabled]);

  useEffect(() => {
    if (previewSrc && !forceFallback) return undefined;
    let mounted = true;

    const writeDoc = (content) => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc || !mounted) return;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html dir="rtl">
          <head>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: system-ui; padding: 20px; background: #ffffff; }
              .preview-block { position: relative; border: 2px solid transparent; margin-bottom: 16px; border-radius: 8px; transition: border-color .2s ease, box-shadow .2s ease; }
              .preview-block.selected { border-color: #3b82f6; box-shadow: 0 0 0 4px rgba(59,130,246,0.1); }
              .preview-block:hover { border-color: #e5e7eb; }
              .preview-empty { padding: 32px 20px; border-radius: 12px; border: 1px dashed #cbd5e1; text-align: center; color: #64748b; font-size: 14px; }
              @media (max-width: 768px) { body { padding: 12px; } .preview-block { margin-bottom: 12px; } }
            </style>
          </head>
          <body>${content}</body>
        </html>
      `);
      doc.close();

      doc.body.querySelectorAll('[data-block-id]').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelect?.(el.getAttribute('data-block-id'));
        });
      });
    };

    const render = async () => {
      if (!iframeRef.current) return;
      const safeBlocks = Array.isArray(blocks) ? blocks.filter((block) => block?.id) : [];
      if (!safeBlocks.length) {
        writeDoc('<div class="preview-empty">لا توجد عناصر متاحة للمعاينة الآن.</div>');
        return;
      }

      try {
        const template = safeBlocks.map((block) => `
          <div data-block-id="${block.id}" class="preview-block ${selectedId === block.id ? 'selected' : ''}" style="${block.stylesText || ''}">
            ${block.liquidTemplate || block.renderedContent || block.content || block.title || block.id || 'عنصر قابل للتعديل'}
          </div>
        `).join('');

        const html = await engine.current.parseAndRender(template, { blocks: safeBlocks });
        writeDoc(html || '<div class="preview-empty">تعذر إنشاء المعاينة.</div>');
      } catch (_error) {
        writeDoc('<div class="preview-empty">حدث خطأ أثناء توليد المعاينة.</div>');
      }
    };

    render();

    return () => {
      mounted = false;
    };
  }, [blocks, selectedId, onSelect, previewSrc, forceFallback]);

  return (
    <iframe
      ref={iframeRef}
      className={`preview-frame ${deviceMode}`}
      src={previewSrc && !forceFallback ? previewSrc : undefined}
      style={{
        width: deviceMode === 'mobile' ? '375px' : deviceMode === 'tablet' ? '768px' : '100%',
        height: '100%',
        border: 'none',
        borderRadius: '8px',
        background: '#fff',
      }}
      title="preview"
      data-testid="canvas-editor-preview-frame"
    />
  );
};

export default PreviewFrame;