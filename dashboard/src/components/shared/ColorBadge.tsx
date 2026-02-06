'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ColorClass } from '@/lib/supabase/types';
import { COLOR_CLASS_LABELS, COLOR_CLASS_COLORS, COLOR_CLASS_ICONS } from '@/lib/constants/colors';

export function ColorBadge({ color }: { color: ColorClass | null }) {
  if (!color) return <span className="text-muted-foreground text-xs">-</span>;
  return (
    <Badge variant="secondary" className={cn('text-xs', COLOR_CLASS_COLORS[color])}>
      {COLOR_CLASS_ICONS[color]} {COLOR_CLASS_LABELS[color]}
    </Badge>
  );
}
