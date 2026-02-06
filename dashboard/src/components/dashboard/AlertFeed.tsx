/**
 * @file AlertFeed.tsx
 * @description 최근 순위 변동 알림 피드
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { KeywordRankingAlertRow } from '@/lib/supabase/types';
import { RANK_ALERT_LABELS, RANK_ALERT_COLORS } from '@/lib/constants/colors';
import { formatRelativeTime, formatRank } from '@/lib/utils/formatters';
import './AlertFeed.css';

interface AlertFeedProps {
  alerts: KeywordRankingAlertRow[];
}

export function AlertFeed({ alerts }: AlertFeedProps) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">최근 순위 변동</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="alert-feed-empty">알림이 없습니다</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">최근 순위 변동</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="alert-feed-scroll">
          <div className="alert-feed-list">
            {alerts.map((alert) => (
              <div key={alert.id} className="alert-feed-item">
                <div className="alert-feed-item-header">
                  <Badge
                    variant="secondary"
                    className={RANK_ALERT_COLORS[alert.alert_type]}
                  >
                    {RANK_ALERT_LABELS[alert.alert_type]}
                  </Badge>
                  <span className="alert-feed-time">
                    {formatRelativeTime(alert.created_at)}
                  </span>
                </div>
                <p className="alert-feed-keyword">{alert.keyword}</p>
                <p className="alert-feed-rank-change">
                  {formatRank(alert.prev_rank)} → {formatRank(alert.curr_rank)}
                  {alert.change_amount !== 0 && (
                    <span className={alert.change_amount > 0 ? 'text-green-600' : 'text-red-600'}>
                      {' '}({alert.change_amount > 0 ? '+' : ''}{alert.change_amount})
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
