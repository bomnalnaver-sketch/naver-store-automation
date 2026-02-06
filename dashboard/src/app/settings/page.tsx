/**
 * @file page.tsx
 * @description 설정 페이지
 */

import { PageHeader } from '@/components/shared/PageHeader/PageHeader';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { RedundantKeywordManager } from '@/components/settings/RedundantKeywordManager';
import { fetchSettings, fetchRedundantKeywords } from '@/lib/queries/settings';
import './page.css';

export default async function SettingsPage() {
  const [settings, redundantKeywords] = await Promise.all([
    fetchSettings(),
    fetchRedundantKeywords(),
  ]);

  return (
    <div className="settings-page">
      <PageHeader
        title="설정"
        description="시스템 설정 및 불필요 키워드 사전을 관리합니다"
      />
      <SettingsForm settings={settings} />
      <RedundantKeywordManager keywords={redundantKeywords} />
    </div>
  );
}
