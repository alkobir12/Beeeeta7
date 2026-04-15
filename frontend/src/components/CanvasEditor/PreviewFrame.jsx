import React, { useEffect, useRef } from 'react';
import { Liquid } from 'liquidjs';

const PreviewFrame = ({ blocks, deviceMode, selectedId, onSelect }) => {
  const iframeRef = useRef(null);
  const engine = useRef(new Liquid());

  useEffect(() => {
    const render = async () => {
      if (!iframeRef.current) return;

      const template = blocks.map((block) => `
        <div data-block-id="${block.id}" class="preview-block ${selectedId === block.id ? 'selected' : ''}" style="${block.stylesText || ''}">
          ${block.liquidTemplate || block.renderedContent || block.content || ''}
        </div>
      `).join('');

      const html = await engine.current.parseAndRender(template, { blocks });
      const doc = iframeRef.current.contentDocument;
      if (!doc) return;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html dir="rtl">
          <head>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: system-ui; padding: 20px; background: #ffffff; }
              .preview-block { position: relative; border: 2px solid transparent; margin-bottom: 16px; border-radius: 8px; transition: all 0.2s; }
              .preview-block.selected { border-color: #3b82f6; box-shadow: 0 0 0 4px rgba(59,130,246,0.1); }
              .preview-block:hover { border-color: #e5e7eb; }
              @media (max-width: 768px) { body { padding: 12px; } .preview-block { margin-bottom: 12px; } }
            </style>
          </head>
          <body>${html}</body>
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

    render();
  }, [blocks, selectedId, onSelect]);

  return (
    <iframe
      ref={iframeRef}
      className={`preview-frame ${deviceMode}`}
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