import { getWhatsAppLink } from './constants';

export const normalizeWhatsAppPhone = (phone) =>
  String(phone || '')
    .replace(/[^\d+]/g, '')
    .replace(/^\+/, '')
    .replace(/^0+/, '');

export const buildDebtWhatsAppMessage = (entity, entityType) => {
  const name = entity?.name || 'العميل';
  const debit = Number(entity?.debitBalance || 0).toFixed(2);
  const credit = Number(entity?.creditBalance || 0).toFixed(2);
  const ajel = Number(entity?.ajelBalance || entity?.overdueBalance || 0).toFixed(2);
  const settled = Number(entity?.settledAmount || 0).toFixed(2);
  const typeLabel = entityType === 'supplier' ? 'المورد' : 'العميل';

  return [
    `السلام عليكم ${name}`,
    `نرفق لكم ملخص حساب ${typeLabel}:`,
    `• مدين: ${debit} ر.س`,
    `• دائن: ${credit} ر.س`,
    `• آجل مستحق: ${ajel} ر.س`,
    `• إجمالي السداد المسجل: ${settled} ر.س`,
    '',
    'نأمل مراجعة الرصيد والتواصل معنا لإتمام التسوية.',
    'شاكرين تعاونكم.',
  ].join('\n');
};

export const buildDebtWhatsAppDraft = (entity, entityType) => {
  const phone = normalizeWhatsAppPhone(entity?.phone || entity?.whatsapp || '');
  const message = buildDebtWhatsAppMessage(entity, entityType);
  return {
    id: `${entityType}-${entity?.id || entity?.name || Math.random().toString(36).slice(2)}`,
    entityId: entity?.id,
    entityType,
    name: entity?.name || '-',
    phone,
    message,
    url: phone ? getWhatsAppLink(phone, message) : '',
  };
};
