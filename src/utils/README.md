# Utils

범용 유틸리티 함수 모음

## 파일 구성

- `date.ts` - 날짜 처리 유틸리티
- `format.ts` - 데이터 포맷 변환
- `validation.ts` - 유효성 검증
- `logger.ts` - 로깅 유틸리티
- `retry.ts` - 재시도 로직
- `sleep.ts` - 지연 함수

## 규칙

- 2번 이상 사용되는 로직은 여기에 추가
- 프로젝트 특화 로직은 `shared/`로
- 파일당 300줄 이하 유지
