/**
 * @file RedundantKeywordManager.tsx
 * @description 불필요 키워드 사전 관리
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import {
  addRedundantKeyword,
  removeRedundantKeyword,
  toggleRedundantKeywordVerified,
} from '@/lib/actions/keyword-actions';
import type { RedundantKeywordDictRow } from '@/lib/supabase/types';
import './RedundantKeywordManager.css';

interface RedundantKeywordManagerProps {
  keywords: RedundantKeywordDictRow[];
}

export function RedundantKeywordManager({ keywords }: RedundantKeywordManagerProps) {
  const [newKeyword, setNewKeyword] = useState('');

  async function handleAdd() {
    if (!newKeyword.trim()) return;
    await addRedundantKeyword(newKeyword.trim());
    setNewKeyword('');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">불필요 키워드 사전 ({keywords.length}개)</CardTitle>
      </CardHeader>
      <CardContent>
        {/* 추가 폼 */}
        <div className="redundant-add-form">
          <Input
            placeholder="키워드 입력..."
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button onClick={handleAdd} size="sm">추가</Button>
        </div>

        {/* 키워드 목록 */}
        <div className="redundant-list">
          {keywords.map((kw) => (
            <div key={kw.id} className="redundant-item">
              <div className="redundant-item-left">
                <span className="font-medium text-sm">{kw.keyword}</span>
                {kw.note && <span className="text-xs text-muted-foreground">{kw.note}</span>}
              </div>
              <div className="redundant-item-right">
                <Badge variant={kw.verified ? 'default' : 'secondary'} className="text-xs">
                  {kw.verified ? '검증됨' : '미검증'}
                </Badge>
                <Switch
                  checked={kw.verified}
                  onCheckedChange={(checked) => toggleRedundantKeywordVerified(kw.id, checked)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => removeRedundantKeyword(kw.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
