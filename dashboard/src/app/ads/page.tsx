/**
 * @file page.tsx
 * @description 광고 성과 페이지
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader/PageHeader';
import { AdsTableClient } from '@/components/ads/AdsTableClient';
import { fetchAdKeywordsWithStats, fetchAbTests } from '@/lib/queries/ads';
import './page.css';

export default async function AdsPage() {
  const [adKeywords, abTests] = await Promise.all([
    fetchAdKeywordsWithStats(),
    fetchAbTests(),
  ]);

  return (
    <div className="ads-page">
      <PageHeader
        title="광고 성과"
        description="광고 키워드 성과 및 A/B 테스트 현황을 관리합니다"
      />

      {/* 광고 키워드 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">광고 키워드 (최근 7일 집계)</CardTitle>
        </CardHeader>
        <CardContent>
          <AdsTableClient data={adKeywords} />
        </CardContent>
      </Card>

      {/* A/B 테스트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">A/B 테스트 현황</CardTitle>
        </CardHeader>
        <CardContent>
          {abTests.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">진행 중인 A/B 테스트가 없습니다</p>
          ) : (
            <div className="ab-test-grid">
              {abTests.map((test) => (
                <Card key={test.id}>
                  <CardContent className="p-4">
                    <div className="ab-test-header">
                      <span className="font-medium text-sm">{test.test_type}</span>
                      <Badge variant={test.status === 'running' ? 'default' : 'secondary'} className="text-xs">
                        {test.status === 'running' ? '진행중' : test.status === 'completed' ? '완료' : '중단'}
                      </Badge>
                    </div>
                    {test.winner && (
                      <p className="text-sm mt-2">
                        승자: <span className="font-bold">{test.winner.toUpperCase()}안</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
