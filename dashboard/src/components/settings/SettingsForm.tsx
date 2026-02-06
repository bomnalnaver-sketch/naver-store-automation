/**
 * @file SettingsForm.tsx
 * @description 시스템 설정 폼 (Client Component)
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { updateSetting } from '@/lib/actions/settings-actions';
import type { SettingRow } from '@/lib/supabase/types';
import './SettingsForm.css';

interface SettingsFormProps {
  settings: SettingRow[];
}

export function SettingsForm({ settings }: SettingsFormProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(settings.map((s) => [s.key, String(s.value)]))
  );
  const [saving, setSaving] = useState<string | null>(null);

  async function handleSave(key: string) {
    setSaving(key);
    await updateSetting(key, values[key] ?? '');
    setSaving(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">시스템 설정</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="settings-list">
          {settings.map((s) => (
            <div key={s.key} className="settings-item">
              <div className="settings-item-info">
                <span className="settings-item-key">{s.key}</span>
                {s.description && <span className="settings-item-desc">{s.description}</span>}
              </div>
              <div className="settings-item-action">
                <Input
                  value={values[s.key] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [s.key]: e.target.value }))}
                  className="w-40"
                />
                <Button
                  size="sm"
                  onClick={() => handleSave(s.key)}
                  disabled={saving === s.key}
                >
                  {saving === s.key ? '저장중...' : '저장'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
