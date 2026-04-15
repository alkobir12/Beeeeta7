import React from 'react';

const typeLabel = {
  content: 'محتوى',
  style: 'تنسيق',
  structure: 'هيكل',
  reorder: 'ترتيب',
  initial: 'بداية',
};

export const HistoryTimeline = ({ history = [], currentStateId, onJumpTo }) => {
  return (
    <div className="history-timeline" data-testid="canvas-editor-history-timeline">
      <div className="timeline-header">
        <h4>التاريخ</h4>
        <span>{history.length} تغيير</span>
      </div>

      <div className="timeline-list">
        {history.map((state, idx) => {
          const active = state.id === currentStateId;
          return (
            <div key={state.id || idx} className={`timeline-item ${active ? 'active' : ''}`} onClick={() => onJumpTo?.(state.id)} data-testid={`canvas-editor-history-item-${idx}`}>
              <div className="timeline-line">
                <div className="timeline-dot" />
                {idx < history.length - 1 ? <div className="timeline-connector" /> : null}
              </div>
              <div className="timeline-content">
                <span className="timeline-label">{state.label}</span>
                <span className="timeline-time">{new Date(state.timestamp).toLocaleTimeString('ar-SA')}</span>
                <span className={`timeline-badge ${state.type}`}>{typeLabel[state.type] || state.type}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};