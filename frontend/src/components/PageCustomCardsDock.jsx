import React from 'react';

export const PageCustomCardsDock = ({ cards = [] }) => {
  const visibleCards = (cards || []).filter((card) => {
    const payload = JSON.stringify(card || {});
    return !/DOM-CHECK|page-description|\[VISIT:|\[IDEMP:/i.test(payload);
  });

  if (!visibleCards.length) return null;

  const resolveFieldValue = (field) => {
    if (typeof document === 'undefined') return field.value || '—';
    if (field?.source_testid) {
      const target = document.querySelector(`[data-testid="${field.source_testid}"]`);
      const sourceText = (target?.textContent || '').trim();
      if (sourceText) return sourceText;
    }
    return field.value || '—';
  };

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3" data-testid="page-custom-cards-dock">
      {visibleCards.map((card, index) => (
        <div key={card.id || index} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.22)] backdrop-blur-2xl" data-testid={`page-custom-card-${index}`}>
          <div className="h-1.5 w-20 rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-cyan-500" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900" data-testid={`page-custom-card-title-${index}`}>{card.title || 'كرت مخصص'}</h3>
          {card.description ? <p className="mt-2 text-sm leading-6 text-slate-600" data-testid={`page-custom-card-description-${index}`}>{card.description}</p> : null}
          {(card.fields || []).length ? (
            <div className="mt-4 space-y-2" data-testid={`page-custom-card-fields-${index}`}>
              {(card.fields || []).map((field, fieldIndex) => (
                <div key={field.id || fieldIndex} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2" data-testid={`page-custom-card-field-${index}-${fieldIndex}`}>
                  <p className="text-[11px] text-slate-500">{field.label || 'حقل'}</p>
                  <p className="mt-1 text-sm text-slate-800">{resolveFieldValue(field)}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
};