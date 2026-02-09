/**
 * @file ProductRegisterModal.tsx
 * @description 상품 등록 모달
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';
import { registerProduct } from '@/lib/actions/product-actions';

export function ProductRegisterModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    naverProductId: '',
    productName: '',
    representativeKeyword: '',
    categoryId: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await registerProduct({
        naverProductId: formData.naverProductId,
        productName: formData.productName,
        representativeKeyword: formData.representativeKeyword,
        categoryId: formData.categoryId || undefined,
      });

      if (result.success) {
        setOpen(false);
        setFormData({
          naverProductId: '',
          productName: '',
          representativeKeyword: '',
          categoryId: '',
        });
      } else {
        setError(result.error || '등록 실패');
      }
    } catch {
      setError('등록 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          상품 등록
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>상품 등록</DialogTitle>
          <DialogDescription>
            새로운 상품을 등록합니다. 대표 키워드로 네이버 쇼핑에서 상품을 자동으로 찾습니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="naverProductId">스마트스토어 상품 ID *</Label>
              <Input
                id="naverProductId"
                placeholder="예: 1234567890"
                value={formData.naverProductId}
                onChange={(e) =>
                  setFormData({ ...formData, naverProductId: e.target.value })
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                스마트스토어 상품 관리에서 확인 가능
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="productName">상품명 *</Label>
              <Input
                id="productName"
                placeholder="예: 프리미엄 헬스매트"
                value={formData.productName}
                onChange={(e) =>
                  setFormData({ ...formData, productName: e.target.value })
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="representativeKeyword">대표 키워드 *</Label>
              <Input
                id="representativeKeyword"
                placeholder="예: 헬스매트"
                value={formData.representativeKeyword}
                onChange={(e) =>
                  setFormData({ ...formData, representativeKeyword: e.target.value })
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                순위 추적에 사용할 메인 키워드
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="categoryId">카테고리 ID (선택)</Label>
              <Input
                id="categoryId"
                placeholder="예: 50000803"
                value={formData.categoryId}
                onChange={(e) =>
                  setFormData({ ...formData, categoryId: e.target.value })
                }
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              등록
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
