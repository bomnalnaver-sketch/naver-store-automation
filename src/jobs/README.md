# Jobs

스케줄 작업 (GitHub Actions)

## 파일 구성

- `daily-automation.ts` - 일일 자동화 메인 작업
- `data-collector.ts` - 데이터 수집
- `ai-analyzer.ts` - AI 분석
- `action-executor.ts` - 액션 실행
- `report-generator.ts` - 리포트 생성

## 실행 흐름

1. 데이터 수집 (키워드 성과, 상품 데이터)
2. AI 분석 (Claude API)
3. 액션 실행 (키워드 등록/수정/OFF, 상품 수정)
4. 결과 기록 (DB 저장)
5. 리포트 발송 (Slack)
