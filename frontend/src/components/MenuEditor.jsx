import React, { useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

// Sortable Item Component
function SortableItem({ item, idx, updateField, toggleEnabled, removeItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `item-${idx}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-12 items-center gap-3 p-3 border rounded-md bg-white"
    >
      {/* Drag Handle */}
      <div className="col-span-1 flex justify-center cursor-move" {...attributes} {...listeners}>
        <GripVertical size={20} className="text-slate-400" />
      </div>
      
      {/* Label Input */}
      <div className="col-span-4">
        <Label className="text-xs">الاسم الظاهر</Label>
        <Input value={item.label} onChange={(e) => updateField(idx, 'label', e.target.value)} />
      </div>
      
      {/* Path Input */}
      <div className="col-span-4">
        <Label className="text-xs">المسار</Label>
        <Input value={item.path} onChange={(e) => updateField(idx, 'path', e.target.value)} />
      </div>
      
      {/* Enable Switch */}
      <div className="col-span-1 text-center">
        <Label className="text-xs">تفعيل</Label>
        <div className="flex justify-center mt-1">
          <Switch checked={item.enabled !== false} onCheckedChange={() => toggleEnabled(idx)} />
        </div>
      </div>
      
      {/* Delete Button */}
      <div className="col-span-2 flex justify-end">
        <Button variant="destructive" size="sm" onClick={() => removeItem(idx)} title="حذف">
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
  );
}

export default function MenuEditor({ settings, setSettings }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = parseInt(active.id.split('-')[1]);
      const newIndex = parseInt(over.id.split('-')[1]);
      const next = arrayMove(items, oldIndex, newIndex);
      updateItems(next);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-blue-800">
          💡 <strong>نصيحة:</strong> اسحب العنصر من الأيقونة ⋮⋮ لإعادة ترتيب القائمة
        </p>
      </div>
      
      <div className="flex justify-end">
        <Button onClick={addItem} className="bg-blue-600 hover:bg-blue-700">
          <Plus size={18} className="ml-2" />
          إضافة عنصر
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((_, idx) => `item-${idx}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {items.map((item, idx) => (
              <SortableItem
                key={`item-${idx}`}
                item={item}
                idx={idx}
                updateField={updateField}
                toggleEnabled={toggleEnabled}
                removeItem={removeItem}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <p className="text-sm text-slate-500 mt-4">
        تلميح: بعد الحفظ، ستطبّق القائمة الجديدة فورًا على الواجهة.
      </p>
    </div>
  );
}
