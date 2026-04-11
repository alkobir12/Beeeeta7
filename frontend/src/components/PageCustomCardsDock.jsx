import React from 'react';

export const PageCustomCardsDock = ({ cards = [] }) => {
  if (!cards.length) return null;

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3" data-testid="page-custom-cards-dock">
      {cards.map((card, index) => (
        <div key={card.id || index} className="overflow-hidden rounded-[28px] border border-cyan-300/15 bg-[linear-gradient(160deg,rgba(10,15,28,0.92),rgba(15,23,42,0.88))] p-5 shadow-[0_18px_60px_-30px_rgba(34,211,238,0.35)] backdrop-blur-2xl" data-testid={`page-custom-card-${index}`}>
          <div className="h-1.5 w-20 rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-500" />
          <h3 className="mt-4 text-lg font-semibold text-white" data-testid={`page-custom-card-title-${index}`}>{card.title || 'كرت مخصص'}</h3>
          {card.description ? <p className="mt-2 text-sm leading-6 text-slate-300" data-testid={`page-custom-card-description-${index}`}>{card.description}</p> : null}
          {(card.fields || []).length ? (
            <div className="mt-4 space-y-2" data-testid={`page-custom-card-fields-${index}`}>
              {(card.fields || []).map((field, fieldIndex) => (
                <div key={field.id || fieldIndex} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2" data-testid={`page-custom-card-field-${index}-${fieldIndex}`}>
                  <p className="text-[11px] text-slate-400">{field.label || 'حقل'}</p>
                  <p className="mt-1 text-sm text-slate-100">{field.value || '—'}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
};