import React, { useEffect, useState } from 'react';

const sectionTitle = (title) => <h4>{title}</h4>;

const Field = ({ label, children }) => (
  <div className="property-field">
    <label>{label}</label>
    {children}
  </div>
);

const buildDraftFromBlock = (block) => {
  const styles = block?.styles || {};
  return {
    title: block?.title || '',
    content: block?.content || '',
    image: block?.image || '',
    link: block?.link || '',
    styles: {
      fontSize: styles.fontSize || '',
      fontWeight: styles.fontWeight || '',
      lineHeight: styles.lineHeight || '',
      letterSpacing: styles.letterSpacing || '',
      textAlign: styles.textAlign || '',
      backgroundColor: styles.backgroundColor || '#ffffff',
      color: styles.color || '#111827',
      opacity: styles.opacity || '',
      padding: styles.padding || '',
      margin: styles.margin || '',
      width: styles.width || '',
      minHeight: styles.minHeight || '',
      borderRadius: styles.borderRadius || '',
      border: styles.border || '',
      boxShadow: styles.boxShadow || '',
      backdropFilter: styles.backdropFilter || '',
      display: String(styles.display || '').toLowerCase() === 'none' ? 'none' : 'block',
    },
  };
};

const PropertyPanel = ({ block, onChange, onDeselect }) => {
  if (!block) {
    return (
      <div className="property-panel empty" data-testid="canvas-editor-property-empty">
        <p>اختر عنصراً للتعديل</p>
      </div>
    );
  }

  const [draft, setDraft] = useState(() => buildDraftFromBlock(block));

  useEffect(() => {
    setDraft(buildDraftFromBlock(block));
  }, [block?.id]);

  const updateDraftField = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const commitDraftField = (key) => {
    if (!block?.id) return;
    const value = draft[key];
    onChange(block.id, { [key]: value });
  };

  const updateDraftStyle = (key, value) => {
    setDraft((prev) => ({
      ...prev,
      styles: {
        ...(prev.styles || {}),
        [key]: value,
      },
    }));
  };

  const commitDraftStyle = (key) => {
    if (!block?.id) return;
    const styles = block.styles || {};
    onChange(block.id, {
      styles: {
        ...styles,
        [key]: draft.styles?.[key],
      },
    });
  };

  return (
    <div className="property-panel" data-testid="canvas-editor-property-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">{block.name || block.title || 'عنصر'}</h3>
        <button onClick={onDeselect} className="text-xs opacity-70">إلغاء</button>
      </div>

      <details className="panel-section" open>
        <summary className="panel-summary">المحتوى</summary>
        {sectionTitle('المحتوى')}
        <Field label="معرّف العنصر">
          <input type="text" value={block.id || ''} readOnly data-testid="canvas-editor-property-testid" />
        </Field>
        <Field label="العنوان">
          <input
            type="text"
            value={draft.title}
            onChange={(e) => updateDraftField('title', e.target.value)}
            onBlur={() => {
              commitDraftField('title');
              onChange(block.id, { content: draft.title });
            }}
            data-testid="canvas-editor-property-title"
          />
        </Field>
        <Field label="النص">
          <textarea
            value={draft.content}
            onChange={(e) => updateDraftField('content', e.target.value)}
            onBlur={() => commitDraftField('content')}
            data-testid="canvas-editor-property-content"
          />
        </Field>
        <Field label="الصورة">
          <input
            type="text"
            value={draft.image}
            onChange={(e) => updateDraftField('image', e.target.value)}
            onBlur={() => commitDraftField('image')}
            data-testid="canvas-editor-property-image"
          />
        </Field>
        <Field label="الرابط">
          <input
            type="text"
            value={draft.link}
            onChange={(e) => updateDraftField('link', e.target.value)}
            onBlur={() => commitDraftField('link')}
            data-testid="canvas-editor-property-link"
          />
        </Field>
      </details>

      <details className="panel-section" open>
        <summary className="panel-summary">الخطوط</summary>
        {sectionTitle('الخطوط')}
        <Field label="حجم الخط">
          <input type="text" value={draft.styles.fontSize} onChange={(e) => updateDraftStyle('fontSize', e.target.value)} onBlur={() => commitDraftStyle('fontSize')} placeholder="مثال: 20px" data-testid="canvas-editor-style-fontsize" />
        </Field>
        <Field label="سماكة الخط">
          <select value={draft.styles.fontWeight} onChange={(e) => { updateDraftStyle('fontWeight', e.target.value); commitDraftStyle('fontWeight'); }} data-testid="canvas-editor-style-fontweight">
            <option value="">افتراضي</option>
            <option value="400">عادي 400</option>
            <option value="500">متوسط 500</option>
            <option value="600">SemiBold 600</option>
            <option value="700">Bold 700</option>
            <option value="800">ExtraBold 800</option>
          </select>
        </Field>
        <Field label="ارتفاع السطر">
          <input type="text" value={draft.styles.lineHeight} onChange={(e) => updateDraftStyle('lineHeight', e.target.value)} onBlur={() => commitDraftStyle('lineHeight')} placeholder="مثال: 1.6" data-testid="canvas-editor-style-lineheight" />
        </Field>
        <Field label="تباعد الحروف">
          <input type="text" value={draft.styles.letterSpacing} onChange={(e) => updateDraftStyle('letterSpacing', e.target.value)} onBlur={() => commitDraftStyle('letterSpacing')} placeholder="مثال: 0.5px" data-testid="canvas-editor-style-letterspacing" />
        </Field>
        <Field label="محاذاة النص">
          <select value={draft.styles.textAlign} onChange={(e) => { updateDraftStyle('textAlign', e.target.value); commitDraftStyle('textAlign'); }} data-testid="canvas-editor-style-textalign">
            <option value="">افتراضي</option>
            <option value="right">يمين</option>
            <option value="center">وسط</option>
            <option value="left">يسار</option>
            <option value="justify">ضبط</option>
          </select>
        </Field>
      </details>

      <details className="panel-section">
        <summary className="panel-summary">الألوان والخلفية</summary>
        {sectionTitle('الألوان والخلفية')}
        <Field label="لون الخلفية">
          <input type="color" value={draft.styles.backgroundColor} onChange={(e) => { updateDraftStyle('backgroundColor', e.target.value); commitDraftStyle('backgroundColor'); }} data-testid="canvas-editor-style-background" />
        </Field>
        <Field label="لون النص">
          <input type="color" value={draft.styles.color} onChange={(e) => { updateDraftStyle('color', e.target.value); commitDraftStyle('color'); }} data-testid="canvas-editor-style-color" />
        </Field>
        <Field label="الشفافية (0-1)">
          <input type="text" value={draft.styles.opacity} onChange={(e) => updateDraftStyle('opacity', e.target.value)} onBlur={() => commitDraftStyle('opacity')} placeholder="1" data-testid="canvas-editor-style-opacity" />
        </Field>
      </details>

      <details className="panel-section">
        <summary className="panel-summary">المسافات والحجم</summary>
        {sectionTitle('المسافات والحجم')}
        <Field label="Padding">
          <input type="text" value={draft.styles.padding} onChange={(e) => updateDraftStyle('padding', e.target.value)} onBlur={() => commitDraftStyle('padding')} placeholder="مثال: 12px 16px" data-testid="canvas-editor-style-padding" />
        </Field>
        <Field label="Margin">
          <input type="text" value={draft.styles.margin} onChange={(e) => updateDraftStyle('margin', e.target.value)} onBlur={() => commitDraftStyle('margin')} placeholder="مثال: 8px 0" data-testid="canvas-editor-style-margin" />
        </Field>
        <Field label="العرض">
          <input type="text" value={draft.styles.width} onChange={(e) => updateDraftStyle('width', e.target.value)} onBlur={() => commitDraftStyle('width')} placeholder="مثال: 100%" data-testid="canvas-editor-style-width" />
        </Field>
        <Field label="الارتفاع الأدنى">
          <input type="text" value={draft.styles.minHeight} onChange={(e) => updateDraftStyle('minHeight', e.target.value)} onBlur={() => commitDraftStyle('minHeight')} placeholder="مثال: 80px" data-testid="canvas-editor-style-minheight" />
        </Field>
      </details>

      <details className="panel-section">
        <summary className="panel-summary">الإطار والتأثيرات</summary>
        {sectionTitle('الإطار والتأثيرات')}
        <Field label="زوايا مستديرة">
          <input type="text" value={draft.styles.borderRadius} onChange={(e) => updateDraftStyle('borderRadius', e.target.value)} onBlur={() => commitDraftStyle('borderRadius')} placeholder="مثال: 12px" data-testid="canvas-editor-style-borderradius" />
        </Field>
        <Field label="حدود العنصر">
          <input type="text" value={draft.styles.border} onChange={(e) => updateDraftStyle('border', e.target.value)} onBlur={() => commitDraftStyle('border')} placeholder="مثال: 1px solid #334155" data-testid="canvas-editor-style-border" />
        </Field>
        <Field label="ظل العنصر">
          <input type="text" value={draft.styles.boxShadow} onChange={(e) => updateDraftStyle('boxShadow', e.target.value)} onBlur={() => commitDraftStyle('boxShadow')} placeholder="مثال: 0 8px 24px rgba(0,0,0,.2)" data-testid="canvas-editor-style-shadow" />
        </Field>
        <Field label="فلتر الخلفية">
          <input type="text" value={draft.styles.backdropFilter} onChange={(e) => updateDraftStyle('backdropFilter', e.target.value)} onBlur={() => commitDraftStyle('backdropFilter')} placeholder="مثال: blur(6px)" data-testid="canvas-editor-style-backdrop" />
        </Field>
      </details>

      <details className="panel-section">
        <summary className="panel-summary">الظهور</summary>
        {sectionTitle('الظهور')}
        <Field label="إظهار/إخفاء">
          <select value={draft.styles.display} onChange={(e) => { updateDraftStyle('display', e.target.value); commitDraftStyle('display'); }} data-testid="canvas-editor-style-display">
            <option value="block">ظاهر</option>
            <option value="none">مخفي</option>
          </select>
        </Field>
      </details>
    </div>
  );
};

export default PropertyPanel;