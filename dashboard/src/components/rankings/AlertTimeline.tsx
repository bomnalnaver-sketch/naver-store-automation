/**
 * @file AlertTimeline.tsx
 * @description 순위 알림 타임라인 (읽음 처리 포함)
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { KeywordRankingAlertRow } from '@/lib/supabase/types';
import { RANK_ALERT_LABELS, RANK_ALERT_COLORS } from '@/lib/constants/colors';
import { formatRelativeTime, formatRank } from '@/lib/utils/formatters';
import { markAlertAsRead, markAllAlertsAsRead } from '@/lib/actions/alert-actions';
import { cn } from '@/lib/utils';
import './AlertTimeline.css';

interface AlertTimelineProps {
  alerts: KeywordRankingAlertRow[];
}

export function AlertTimeline({ alerts }: AlertTimelineProps) {
  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <Card>
      <CardHeader className="alert-timeline-header">
        <CardTitle className="text-base">순위 변동 알림 ({unreadCount}개 미확인)</CardTitle>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllAlertsAsRead()}>
            모두 읽음
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="alert-timeline-scroll">
          {alerts.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">알림이 없습니다</p>
          ) : (
            <div className="alert-timeline-list">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn('alert-timeline-item', !alert.is_read && 'alert-timeline-unread')}
                >
                  <div className="alert-timeline-item-top">
                    <Badge variant="secondary" className={cn('text-xs', RANK_ALERT_COLORS[alert.alert_type])}>
                      {RANK_ALERT_LABELS[alert.alert_type]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(alert.created_at)}</span>
                  </div>
                  <p className="font-medium text-sm">{alert.keyword}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatRank(alert.prev_rank)} → {formatRank(alert.curr_rank)}
                  </p>
                  {!alert.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="alert-read-btn"
                      onClick={() => markAlertAsRead(alert.id)}
                    >
                      읽음
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
