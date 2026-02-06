'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { KeywordType } from '@/lib/supabase/types';
import { KEYWORD_TYPE_LABELS, KEYWORD_TYPE_COLORS } from '@/lib/constants/colors';

export function TypeBadge({ type }: { type: KeywordType | null }) {
  if (!type) return <span className="text-muted-foreground text-xs">-</span>;
  return (
    <Badge variant="secondary" className={cn('text-xs', KEYWORD_TYPE_COLORS[type])}>
      {KEYWORD_TYPE_LABELS[type]}
    </Badge>
  );
}
