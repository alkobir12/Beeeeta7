import React, { useState } from 'react';

const Toolbar = ({
  deviceMode,
  onDeviceChange,
  onSave,
  onPublish,
  undo,
  redo,
  canUndo,
  canRedo,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onToggleShortcuts,
  liveSyncEnabled,
  onToggleLiveSync,
  extraRightSlot,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

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
        <button onClick={() => setShowAdvanced((v) => !v)} data-testid="canvas-editor-advanced-toggle-button">أدوات +</button>

        {showAdvanced ? (
          <div className="toolbar-group history" data-testid="canvas-editor-advanced-tools-group">
            <button onClick={onCopy} data-testid="canvas-editor-copy-button">نسخ</button>
            <button onClick={onPaste} data-testid="canvas-editor-paste-button">لصق</button>
            <button onClick={onDuplicate} data-testid="canvas-editor-duplicate-button">تكرار</button>
            <button onClick={onDelete} data-testid="canvas-editor-delete-button">حذف</button>
            <button onClick={onToggleLiveSync} className={liveSyncEnabled ? 'active' : ''} data-testid="canvas-editor-live-sync-toggle">معاينة حية</button>
            <button onClick={onToggleShortcuts} data-testid="canvas-editor-shortcuts-help-button">⌨️</button>
            {extraRightSlot}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Toolbar;