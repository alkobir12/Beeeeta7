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
  const updateStyle = (key, value) => onChange(block.id, { styles: { ...styles, [key]: value } });
  const currentDisplay = String(styles.display || '').toLowerCase() === 'none' ? 'none' : 'block';

  return (
    <div className="property-panel" data-testid="canvas-editor-property-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">{block.name || block.title || 'عنصر'}</h3>
        <button onClick={onDeselect} className="text-xs opacity-70">إلغاء</button>
      </div>

      <div className="panel-section">
        {sectionTitle('المحتوى')}
        <Field label="معرّف العنصر">
          <input type="text" value={block.id || ''} readOnly data-testid="canvas-editor-property-testid" />
        </Field>
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
        {sectionTitle('الخطوط')}
        <Field label="حجم الخط">
          <input type="text" value={styles.fontSize || ''} onChange={(e) => updateStyle('fontSize', e.target.value)} placeholder="مثال: 20px" data-testid="canvas-editor-style-fontsize" />
        </Field>
        <Field label="سماكة الخط">
          <select value={styles.fontWeight || ''} onChange={(e) => updateStyle('fontWeight', e.target.value)} data-testid="canvas-editor-style-fontweight">
            <option value="">افتراضي</option>
            <option value="400">عادي 400</option>
            <option value="500">متوسط 500</option>
            <option value="600">SemiBold 600</option>
            <option value="700">Bold 700</option>
            <option value="800">ExtraBold 800</option>
          </select>
        </Field>
        <Field label="ارتفاع السطر">
          <input type="text" value={styles.lineHeight || ''} onChange={(e) => updateStyle('lineHeight', e.target.value)} placeholder="مثال: 1.6" data-testid="canvas-editor-style-lineheight" />
        </Field>
        <Field label="تباعد الحروف">
          <input type="text" value={styles.letterSpacing || ''} onChange={(e) => updateStyle('letterSpacing', e.target.value)} placeholder="مثال: 0.5px" data-testid="canvas-editor-style-letterspacing" />
        </Field>
        <Field label="محاذاة النص">
          <select value={styles.textAlign || ''} onChange={(e) => updateStyle('textAlign', e.target.value)} data-testid="canvas-editor-style-textalign">
            <option value="">افتراضي</option>
            <option value="right">يمين</option>
            <option value="center">وسط</option>
            <option value="left">يسار</option>
            <option value="justify">ضبط</option>
          </select>
        </Field>
      </div>

      <div className="panel-section">
        {sectionTitle('الألوان والخلفية')}
        <Field label="لون الخلفية">
          <input type="color" value={styles.backgroundColor || '#ffffff'} onChange={(e) => updateStyle('backgroundColor', e.target.value)} data-testid="canvas-editor-style-background" />
        </Field>
        <Field label="لون النص">
          <input type="color" value={styles.color || '#111827'} onChange={(e) => updateStyle('color', e.target.value)} data-testid="canvas-editor-style-color" />
        </Field>
        <Field label="الشفافية (0-1)">
          <input type="text" value={styles.opacity || ''} onChange={(e) => updateStyle('opacity', e.target.value)} placeholder="1" data-testid="canvas-editor-style-opacity" />
        </Field>
      </div>

      <div className="panel-section">
        {sectionTitle('المسافات والحجم')}
        <Field label="Padding">
          <input type="text" value={styles.padding || ''} onChange={(e) => updateStyle('padding', e.target.value)} placeholder="مثال: 12px 16px" data-testid="canvas-editor-style-padding" />
        </Field>
        <Field label="Margin">
          <input type="text" value={styles.margin || ''} onChange={(e) => updateStyle('margin', e.target.value)} placeholder="مثال: 8px 0" data-testid="canvas-editor-style-margin" />
        </Field>
        <Field label="العرض">
          <input type="text" value={styles.width || ''} onChange={(e) => updateStyle('width', e.target.value)} placeholder="مثال: 100%" data-testid="canvas-editor-style-width" />
        </Field>
        <Field label="الارتفاع الأدنى">
          <input type="text" value={styles.minHeight || ''} onChange={(e) => updateStyle('minHeight', e.target.value)} placeholder="مثال: 80px" data-testid="canvas-editor-style-minheight" />
        </Field>
      </div>

      <div className="panel-section">
        {sectionTitle('الإطار والتأثيرات')}
        <Field label="زوايا مستديرة">
          <input type="text" value={styles.borderRadius || ''} onChange={(e) => updateStyle('borderRadius', e.target.value)} placeholder="مثال: 12px" data-testid="canvas-editor-style-borderradius" />
        </Field>
        <Field label="حدود العنصر">
          <input type="text" value={styles.border || ''} onChange={(e) => updateStyle('border', e.target.value)} placeholder="مثال: 1px solid #334155" data-testid="canvas-editor-style-border" />
        </Field>
        <Field label="ظل العنصر">
          <input type="text" value={styles.boxShadow || ''} onChange={(e) => updateStyle('boxShadow', e.target.value)} placeholder="مثال: 0 8px 24px rgba(0,0,0,.2)" data-testid="canvas-editor-style-shadow" />
        </Field>
        <Field label="فلتر الخلفية">
          <input type="text" value={styles.backdropFilter || ''} onChange={(e) => updateStyle('backdropFilter', e.target.value)} placeholder="مثال: blur(6px)" data-testid="canvas-editor-style-backdrop" />
        </Field>
      </div>

      <div className="panel-section">
        {sectionTitle('الظهور')}
        <Field label="إظهار/إخفاء">
          <select value={currentDisplay} onChange={(e) => updateStyle('display', e.target.value)} data-testid="canvas-editor-style-display">
            <option value="block">ظاهر</option>
            <option value="none">مخفي</option>
          </select>
        </Field>
      </div>
    </div>
  );
};

export default PropertyPanel;