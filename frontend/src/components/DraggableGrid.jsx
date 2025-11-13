import React, { useEffect, useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableItem = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-move">
      {children}
    </div>
  );
};

const DraggableGrid = ({ items = [], storageKey = 'draggable_grid_order', columns = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' }) => {
  const [order, setOrder] = useState(items.map(i => i.id));

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Only keep known ids
        const filtered = parsed.filter(id => items.some(i => i.id === id));
        // Add any new ids not in saved
        const missing = items.map(i => i.id).filter(id => !filtered.includes(id));
        setOrder([...filtered, ...missing]);
      } catch (_) {
        setOrder(items.map(i => i.id));
      }
    } else {
      setOrder(items.map(i => i.id));
    }
  }, [items, storageKey]);

  const onDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIndex = prev.indexOf(active.id);
      const newIndex = prev.indexOf(over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const orderedItems = order.map(id => items.find(i => i.id === id)).filter(Boolean);

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div className={`grid gap-4 ${columns}`}>
          {orderedItems.map(item => (
            <SortableItem key={item.id} id={item.id}>
              {item.render()}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default DraggableGrid;
