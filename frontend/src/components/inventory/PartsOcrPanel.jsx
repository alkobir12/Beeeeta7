import React from 'react';
import { Camera, Upload } from 'lucide-react';
import { Button } from '../ui/button';

export const PartsOcrPanel = ({
  ocrPreview,
  ocrError,
  ocrResult,
  ocrLoading,
  ocrImporting,
  onFileChange,
  onRun,
  onImport,
}) => {
  return (
    <div className="apple-card p-5 mb-4" data-testid="parts-ocr-card">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900" data-testid="parts-ocr-title">OCR فاتورة قطع الغيار</h3>
          <p className="text-sm text-gray-500" data-testid="parts-ocr-subtitle">ارفع صورة الفاتورة لاستخراج البنود تلقائياً</p>
        </div>
        <div className="flex flex-wrap gap-2" data-testid="parts-ocr-actions">
          <label className="apple-button flex items-center gap-2 cursor-pointer" data-testid="parts-ocr-camera-label">
            <Camera size={16} />
            <span>التقاط بالكاميرا</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onFileChange}
              data-testid="parts-ocr-camera-input"
            />
          </label>
          <label className="apple-button flex items-center gap-2 cursor-pointer" data-testid="parts-ocr-file-label">
            <Upload size={16} />
            <span>رفع ملف</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
              data-testid="parts-ocr-file-input"
            />
          </label>
          <Button onClick={onRun} disabled={ocrLoading} data-testid="parts-ocr-run-button">
            {ocrLoading ? 'جاري القراءة...' : 'تشغيل OCR'}
          </Button>
        </div>
      </div>

      {ocrPreview && (
        <div className="mt-4" data-testid="parts-ocr-preview-wrapper">
          <img
            src={ocrPreview}
            alt="OCR Preview"
            className="max-h-56 rounded-xl border border-gray-200"
            data-testid="parts-ocr-preview"
          />
        </div>
      )}

      {ocrError && (
        <div className="mt-3 text-sm text-red-600" data-testid="parts-ocr-error">
          {ocrError}
        </div>
      )}

      {ocrResult && (
        <div className="mt-4 space-y-3" data-testid="parts-ocr-result">
          <div className="flex flex-wrap gap-4 text-sm text-gray-700" data-testid="parts-ocr-result-header">
            <span data-testid="parts-ocr-vendor">المورد: {ocrResult.vendor || 'غير محدد'}</span>
            <span data-testid="parts-ocr-invoice">الفاتورة: {ocrResult.invoice_number || '—'}</span>
            <span data-testid="parts-ocr-date">التاريخ: {ocrResult.date || '—'}</span>
            <span data-testid="parts-ocr-tax">الرقم الضريبي: {ocrResult.tax_number || '—'}</span>
          </div>
          <div className="overflow-auto" data-testid="parts-ocr-table-wrapper">
            <table className="min-w-full text-sm" data-testid="parts-ocr-table">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-2 text-right">رقم القطعة</th>
                  <th className="p-2 text-right">الوصف</th>
                  <th className="p-2 text-right">الكمية</th>
                  <th className="p-2 text-right">سعر الوحدة</th>
                  <th className="p-2 text-right">الإجمالي</th>
                  <th className="p-2 text-right">الثقة</th>
                </tr>
              </thead>
              <tbody>
                {(ocrResult.items || []).map((item, idx) => {
                  const confidence = typeof item.confidence === 'number' ? item.confidence : null;
                  const isLow = confidence !== null && confidence < 0.6;
                  return (
                    <tr
                      key={`${item.part_number}-${idx}`}
                      className={`border-b ${isLow ? 'bg-red-50' : ''}`}
                      data-testid={`parts-ocr-item-${idx}`}
                    >
                      <td className="p-2">{item.part_number || '—'}</td>
                      <td className="p-2">{item.description || '—'}</td>
                      <td className="p-2">{item.quantity || 1}</td>
                      <td className="p-2">{item.unit_price || '—'}</td>
                      <td className="p-2">{item.total || '—'}</td>
                      <td className="p-2">{confidence !== null ? `${Math.round(confidence * 100)}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-700" data-testid="parts-ocr-totals">
            <span data-testid="parts-ocr-subtotal">المجموع: {ocrResult?.totals?.subtotal || '—'}</span>
            <span data-testid="parts-ocr-tax-total">الضريبة: {ocrResult?.totals?.tax || '—'}</span>
            <span data-testid="parts-ocr-grand-total">الإجمالي النهائي: {ocrResult?.totals?.grand_total || '—'}</span>
          </div>
          {!!ocrResult?.items?.length && (
            <Button
              onClick={onImport}
              disabled={ocrImporting}
              data-testid="parts-ocr-import-button"
            >
              {ocrImporting ? 'جاري الاستيراد...' : 'استيراد البنود للمخزون'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
