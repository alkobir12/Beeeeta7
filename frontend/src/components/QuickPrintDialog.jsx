import React, { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../services/api';
import { downloadPDF } from '../utils/pdfGenerator';
import { getWhatsAppLink } from '../utils/constants';

const QuickPrintDialog = ({
  open,
  title = 'إجراء الطباعة',
  description = 'معاينة المستند قبل الطباعة أو الإرسال.',
  payloadBuilder,
  initialPhone = '',
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const [phone, setPhone] = useState(initialPhone || '');
  const iframeRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPhone(initialPhone || '');
    }
  }, [open, initialPhone]);

  useEffect(() => {
    if (!open || !payloadBuilder) return;
    let isActive = true;

    const loadWorkshop = async () => {
      try {
        const [settingsRes, profileRes] = await Promise.all([
          fetch(`${API_BASE}/settings`),
          fetch(`${API_BASE}/profile`),
        ]);
        const settingsData = settingsRes.ok ? await settingsRes.json() : {};
        const profileData = profileRes.ok ? await profileRes.json() : {};
        const profile = profileData?.profile || {};
        return {
          name: settingsData?.workshopName || profile?.business_name || profile?.name || 'ورشتي',
          address: settingsData?.workshopAddress || profile?.address || '',
          phone: settingsData?.workshopPhone || profile?.phone || '',
          tax_number: settingsData?.taxNumber || profile?.tax_number || '',
          logo_url: settingsData?.logoUrl || profile?.logo_url || '',
        };
      } catch (e) {
        return {
          name: 'ورشتي',
          address: '',
          phone: '',
          tax_number: '',
          logo_url: '',
        };
      }
    };

    const generateHtml = async () => {
      setLoading(true);
      setError('');
      try {
        const basePayload = await payloadBuilder();
        if (!basePayload) {
          throw new Error('missing-payload');
        }
        const workshop = await loadWorkshop();
        const response = await fetch(`${API_BASE}/documents/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...basePayload, workshop }),
        });
        const data = await response.json();
        if (!data?.success) {
          throw new Error(data?.error || 'failed');
        }
        if (isActive) {
          setHtml(data?.data?.html || '');
        }
      } catch (e) {
        if (isActive) {
          setError('تعذر إنشاء المعاينة');
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    generateHtml();
    return () => {
      isActive = false;
    };
  }, [open, payloadBuilder]);

  useEffect(() => {
    if (!open || !html || !iframeRef.current) return;
    try {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
    } catch (e) {
      // ignore
    }
  }, [open, html]);

  const handlePrint = async () => {
    if (!html) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يبدو أن المتصفح منع فتح نافذة جديدة. الرجاء السماح بالنوافذ المنبثقة مؤقتًا.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 600);
  };

  const handleWhatsApp = async () => {
    if (!html) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    await downloadPDF(wrapper, title.replace(/\s+/g, '_'), {
      backgroundColor: '#ffffff',
      scale: 1.4,
    });
    if (!phone) {
      alert('يرجى إدخال رقم الجوال لإرسال واتس اب');
      return;
    }
    const message = `تم تجهيز المستند: ${title}. الرجاء إرفاق ملف PDF.`;
    window.open(getWhatsAppLink(phone, message), '_blank');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" data-testid="quick-print-dialog">
      <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-slate-950/90 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white" data-testid="quick-print-dialog-title">{title}</h3>
            <p className="mt-1 text-sm text-slate-300" data-testid="quick-print-dialog-description">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200"
            data-testid="quick-print-action-cancel"
          >
            إغلاق
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400"
            data-testid="quick-print-action-print"
            disabled={loading || !html}
          >
            طباعة فورية
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30"
            data-testid="quick-print-action-whatsapp"
            disabled={loading || !html}
          >
            إرسال PDF عبر واتس اب
          </button>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span>رقم الجوال</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              placeholder="05xxxxxxxx"
              data-testid="quick-print-phone-input"
            />
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-3">
          {loading && <div className="text-sm text-slate-300" data-testid="quick-print-loading">جارٍ تجهيز المعاينة...</div>}
          {error && <div className="text-sm text-rose-300" data-testid="quick-print-error">{error}</div>}
          {!loading && !error && html && (
            <iframe
              ref={iframeRef}
              title="print-preview"
              className="h-[420px] w-full rounded-xl bg-white"
              data-testid="quick-print-preview"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickPrintDialog;