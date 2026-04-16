import React from 'react';

const Toolbar = ({ deviceMode, onDeviceChange, onSave, onPublish, undo, redo, canUndo, canRedo }) => {
  return (
    <div className="toolbar" data-testid="canvas-editor-toolbar">
      <div className="toolbar-group history">
        <button onClick={undo} disabled={!canUndo} data-testid="canvas-editor-undo-button">↩️ تراجع</button>
        <button onClick={redo} disabled={!canRedo} data-testid="canvas-editor-redo-button">↪️ إعادة</button>
      </div>

      <div className="toolbar-group devices">
        <button className={deviceMode === 'desktop' ? 'active' : ''} onClick={() => onDeviceChange('desktop')} data-testid="canvas-editor-device-desktop">🖥️</button>
        <button className={deviceMode === 'tablet' ? 'active' : ''} onClick={() => onDeviceChange('tablet')} data-testid="canvas-editor-device-tablet">📱</button>
        <button className={deviceMode === 'mobile' ? 'active' : ''} onClick={() => onDeviceChange('mobile')} data-testid="canvas-editor-device-mobile">📲</button>
      </div>

      <div className="toolbar-group actions">
        <button onClick={onSave} className="btn-primary" data-testid="canvas-editor-save-button">حفظ</button>
        <button onClick={onPublish} className="btn-secondary" data-testid="canvas-editor-publish-button">نشر</button>
      </div>
    </div>
  );
};

export default Toolbar;