import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

const PrintPreview = ({ open, onClose, title = 'معاينة الطباعة', html }) => {
  const iframeRef = useRef(null);

  useEffect(() => {
    if (open && iframeRef.current && html) {
      try {
        const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
        // Reset iframe safely before writing
        doc.open();
        doc.write(html);
        doc.close();
      } catch (e) {
        // ignore
      }
    }
  }, [open, html]);

  const handlePrint = () => {
    try {
      const win = iframeRef.current?.contentWindow;
      win?.focus();
      win?.print();
    } catch (e) {}
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([html || ''], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {}
  };

  const handleOpenFullPage = () => {
    try {
      const blob = new Blob([html || ''], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank', 'noopener,noreferrer');
      if (!w) {
        alert('يبدو أن المتصفح منع فتح نافذة جديدة. الرجاء السماح بالنوافذ المنبثقة مؤقتًا.');
      }
      // Do not revoke immediately; let browser handle on tab close
    } catch (e) {
      alert('تعذر فتح الصفحة الكاملة');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v)=>{ if(!v) onClose?.(); }}>
      <DialogContent className="max-w-[900px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 justify-end flex-wrap">
            <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">طباعة</Button>
            <Button variant="outline" onClick={handleDownload}>تحميل HTML</Button>
            <Button variant="outline" onClick={handleOpenFullPage}>فتح صفحة كاملة</Button>
          </div>
          <div className="border rounded h-[70vh] overflow-hidden">
            <iframe ref={iframeRef} title="preview" style={{ width: '100%', height: '100%', border: '0' }} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrintPreview;
