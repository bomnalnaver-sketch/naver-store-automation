/**
 * @file page.tsx
 * @description 설정 페이지
 */

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
      <h1 className="settings-title">설정</h1>
      <SettingsForm settings={settings} />
      <RedundantKeywordManager keywords={redundantKeywords} />
    </div>
  );
}
