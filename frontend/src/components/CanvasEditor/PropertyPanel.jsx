import React from 'react';

const sectionTitle = (title) => <h4>{title}</h4>;

const Field = ({ label, children }) => (
  <div className="property-field">
    <label>{label}</label>
    {children}
  </div>
);

const PropertyPanel = ({ block, onChange, onDeselect }) => {
  if (!block) {
    return (
      <div className="property-panel empty" data-testid="canvas-editor-property-empty">
        <p>اختر عنصراً للتعديل</p>
      </div>
    );
  }

  const styles = block.styles || {};

  return (
    <div className="property-panel" data-testid="canvas-editor-property-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">{block.name || block.title || 'عنصر'}</h3>
        <button onClick={onDeselect} className="text-xs opacity-70">إلغاء</button>
      </div>

      <div className="panel-section">
        {sectionTitle('المحتوى')}
        <Field label="العنوان">
          <input type="text" value={block.title || ''} onChange={(e) => onChange(block.id, { title: e.target.value, content: e.target.value })} data-testid="canvas-editor-property-title" />
        </Field>
        <Field label="النص">
          <textarea value={block.content || ''} onChange={(e) => onChange(block.id, { content: e.target.value })} data-testid="canvas-editor-property-content" />
        </Field>
        <Field label="الصورة">
          <input type="text" value={block.image || ''} onChange={(e) => onChange(block.id, { image: e.target.value })} data-testid="canvas-editor-property-image" />
        </Field>
        <Field label="الرابط">
          <input type="text" value={block.link || ''} onChange={(e) => onChange(block.id, { link: e.target.value })} data-testid="canvas-editor-property-link" />
        </Field>
      </div>

      <div className="panel-section">
        {sectionTitle('التنسيق')}
        <Field label="لون الخلفية">
          <input type="color" value={styles.backgroundColor || '#ffffff'} onChange={(e) => onChange(block.id, { styles: { ...styles, backgroundColor: e.target.value } })} data-testid="canvas-editor-style-background" />
        </Field>
        <Field label="لون النص">
          <input type="color" value={styles.color || '#111827'} onChange={(e) => onChange(block.id, { styles: { ...styles, color: e.target.value } })} data-testid="canvas-editor-style-color" />
        </Field>
        <Field label="حجم الخط">
          <input type="text" value={styles.fontSize || ''} onChange={(e) => onChange(block.id, { styles: { ...styles, fontSize: e.target.value } })} data-testid="canvas-editor-style-fontsize" />
        </Field>
      </div>
    </div>
  );
};

export default PropertyPanel;