import React, { useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

const defaultItems = [
  { path: '/', label: 'لوحة التحكم', enabled: true },
  { path: '/customers', label: 'العملاء', enabled: true },
  { path: '/technicians', label: 'الفنيين', enabled: true },
  { path: '/services', label: 'الخدمات', enabled: true },
  { path: '/operations', label: 'عمليات شراء/بيع', enabled: true },
  { path: '/customer-receipts', label: 'توريد العملاء', enabled: true },
  { path: '/analytics', label: 'التحليلات', enabled: true },
  { path: '/archive', label: 'أرشيف المركبات', enabled: true },
  { path: '/suppliers', label: 'الموردين', enabled: true },
  { path: '/parts', label: 'المخزون', enabled: true },
  { path: '/templates', label: 'النماذج', enabled: true },
  { path: '/ai-assistant', label: 'المساعد الذكي', enabled: true },
  { path: '/business-accounts', label: 'الفروع', enabled: true },
  { path: '/profile', label: 'ملف الورشة', enabled: true },
  { path: '/import', label: 'الاستيراد', enabled: true },
];

export default function MenuEditor({ settings, setSettings }) {
  const items = useMemo(() => {
    return Array.isArray(settings?.menuConfig?.items) && settings.menuConfig.items.length
      ? settings.menuConfig.items
      : defaultItems;
  }, [settings]);

  const updateItems = (next) => {
    setSettings({
      ...settings,
      menuConfig: {
        ...(settings.menuConfig || {}),
        items: next
      }
    });
  };

  const toggleEnabled = (idx) => {
    const next = items.map((it, i) => i === idx ? { ...it, enabled: !it.enabled } : it);
    updateItems(next);
  };

  const moveUp = (idx) => {
    if (idx === 0) return;
    const next = [...items];
    [next[idx-1], next[idx]] = [next[idx], next[idx-1]];
    updateItems(next);
  };

  const moveDown = (idx) => {
    if (idx === items.length - 1) return;
    const next = [...items];
    [next[idx+1], next[idx]] = [next[idx], next[idx+1]];
    updateItems(next);
  };

  const removeItem = (idx) => {
    const next = items.filter((_, i) => i !== idx);
    updateItems(next);
  };

  const addItem = () => {
    const next = [...items, { path: '/custom', label: 'عنصر جديد', enabled: true }];
    updateItems(next);
  };

  const updateField = (idx, field, value) => {
    const next = items.map((it, i) => i === idx ? { ...it, [field]: value } : it);
    updateItems(next);
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex justify-end">
        <Button onClick={addItem} className="bg-blue-600 hover:bg-blue-700">
          <Plus size={18} className="ml-2" />
          إضافة عنصر
        </Button>
      </div>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-12 items-center gap-3 p-3 border rounded-md">
            <div className="col-span-4">
              <Label>الاسم الظاهر</Label>
              <Input value={item.label} onChange={(e) => updateField(idx, 'label', e.target.value)} />
            </div>
            <div className="col-span-5">
              <Label>المسار</Label>
              <Input value={item.path} onChange={(e) => updateField(idx, 'path', e.target.value)} />
            </div>
            <div className="col-span-1 text-center">
              <Label>تفعيل</Label>
              <div className="flex justify-center">
                <Switch checked={item.enabled !== false} onCheckedChange={() => toggleEnabled(idx)} />
              </div>
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => moveUp(idx)} title="للأعلى"><ArrowUp size={18} /></Button>
              <Button variant="outline" onClick={() => moveDown(idx)} title="للأسفل"><ArrowDown size={18} /></Button>
              <Button variant="destructive" onClick={() => removeItem(idx)} title="حذف"><Trash2 size={18} /></Button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-500">تلميح: بعد الحفظ، ستطبّق القائمة الجديدة فورًا على الواجهة.</p>
    </div>
  );
}
