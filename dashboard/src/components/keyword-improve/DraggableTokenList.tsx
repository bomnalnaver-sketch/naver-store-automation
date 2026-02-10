/**
 * @file DraggableTokenList.tsx
 * @description 드래그로 순서 변경 가능한 토큰 목록
 * @responsibilities
 * - 상품명 토큰을 드래그 앤 드롭으로 재배치
 * - 토큰 클릭 제거
 * - 매핑 키워드 시각적 구분
 */

'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, GripVertical } from 'lucide-react';

interface DraggableTokenListProps {
  tokens: string[];
  mappedKeywords: string[];
  onReorder: (newTokens: string[]) => void;
  onRemove: (index: number) => void;
}

export function DraggableTokenList({
  tokens,
  mappedKeywords,
  onReorder,
  onRemove,
}: DraggableTokenListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 유니크 ID 생성 (같은 토큰이 여러 번 있을 수 있으므로 index 활용)
  const items = tokens.map((token, idx) => ({
    id: `${idx}-${token}`,
    token,
    index: idx,
  }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(tokens, oldIndex, newIndex);
      onReorder(reordered);
    }
  };

  const mappedLower = mappedKeywords.map((kw) => kw.toLowerCase());

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={horizontalListSortingStrategy}
      >
        <div className="ki-draggable-token-list">
          {items.map((item) => (
            <SortableToken
              key={item.id}
              id={item.id}
              token={item.token}
              isMapped={mappedLower.includes(item.token.toLowerCase())}
              onRemove={() => onRemove(item.index)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableToken({
  id,
  token,
  isMapped,
  onRemove,
}: {
  id: string;
  token: string;
  isMapped: boolean;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto' as const,
  };

  return (
    <span
      ref={setNodeRef}
      style={style}
      className={`ki-draggable-token ${
        isMapped ? 'ki-draggable-token-mapped' : 'ki-draggable-token-default'
      } ${isDragging ? 'ki-draggable-token-dragging' : ''}`}
    >
      <span
        className="ki-drag-handle"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3 h-3" />
      </span>
      <span className="ki-token-text">{token}</span>
      <button
        className="ki-token-remove"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="제거"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
