export const formatCurrency = (amount) =>
  new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatNumber = (num) => {
  return new Intl.NumberFormat('ar-SA').format(num || 0);
};
