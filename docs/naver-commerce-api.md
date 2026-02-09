# 네이버 커머스 API 엔드포인트 문서

## 인증 방식
- OAuth2 Client Credentials Grant
- **bcrypt 서명 방식** 사용
- 서명 생성: `Base64(bcrypt.hashSync(clientId + "_" + timestamp, clientSecret))`

## API Base URL
```
https://api.commerce.naver.com/external
```

---

## 1. 문의 (QnA)

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/v1/contents/qnas` | 상품 문의 목록 조회 |
| GET | `/v1/contents/qnas/templates` | 문의 답변 템플릿 목록 조회 |
| PUT | `/v1/contents/qnas/{questionId}` | 문의 답변 등록/수정 |

---

## 2. 주문 판매자

### 주문 조회
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/v1/pay-order/seller/product-orders/last-changed-statuses` | 최근 변경된 상태 조회 |
| GET | `/v1/pay-order/seller/orders/{orderId}/product-order-ids` | 주문별 상품주문 ID 조회 |
| GET | `/v1/pay-order/seller/product-orders` | 상품주문 목록 조회 |
| POST | `/v1/pay-order/seller/product-orders/query` | 상품주문 상세 조회 |

### 발주/발송 처리
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/v1/pay-order/seller/product-orders/confirm` | 발주 확인 |
| POST | `/v1/pay-order/seller/product-orders/{productOrderId}/delay` | 발송 지연 처리 |
| POST | `/v1/pay-order/seller/product-orders/dispatch` | 발송 처리 |
| POST | `/v1/pay-order/seller/product-orders/{productOrderId}/hope-delivery/change` | 희망배송일 변경 |

### 취소 처리
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/v1/pay-order/seller/product-orders/{productOrderId}/claim/cancel/request` | 취소 요청 |
| POST | `/v1/pay-order/seller/product-orders/{productOrderId}/claim/cancel/approve` | 취소 승인 |

### 반품 처리
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/v1/pay-order/seller/product-orders/{productOrderId}/claim/return/request` | 반품 요청 |
| POST | `/v1/pay-order/seller/product-orders/{productOrderId}/claim/return/approve` | 반품 승인 |
| POST | `/v1/pay-order/seller/product-orders/{productOrderId}/claim/return/reject` | 반품 거부 |
| POST | `/v1/pay-order/seller/product-orders/{productOrderId}/claim/return/holdback` | 반품 보류 |
| POST | `/v1/pay-order/seller/product-orders/{productOrderId}/claim/return/holdback/release` | 반품 보류 해제 |

### 교환 처리
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/v1/pay-order/seller/product-orders/{productOrderId}/claim/exchange/dispatch` | 교환 발송 |
| POST | `/v1/pay-order/seller/product-orders/{productOrderId}/claim/exchange/collect/approve` | 교환 수거 승인 |
| POST | `/v1/pay-order/seller/product-orders/{productOrderId}/claim/exchange/reject` | 교환 거부 |
| POST | `/v1/pay-order/seller/product-orders/{productOrderId}/claim/exchange/holdback` | 교환 보류 |
| POST | `/v1/pay-order/seller/product-orders/{productOrderId}/claim/exchange/holdback/release` | 교환 보류 해제 |

### 문의
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/v1/pay-user/inquiries` | 사용자 문의 조회 |
| POST | `/v1/pay-merchant/inquiries/{inquiryNo}/answer` | 문의 답변 등록 |
| PUT | `/v1/pay-merchant/inquiries/{inquiryNo}/answer/{answerContentId}` | 문의 답변 수정 |

---

## 3. 상품

### 상품 조회/검색
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| **POST** | **`/v1/products/search`** | **상품 목록 검색 (메인 조회 API)** |
| GET | `/v2/products/channel-products/{channelProductNo}` | 채널상품 상세 조회 |
| GET | `/v2/products/origin-products/{originProductNo}` | 원상품 상세 조회 |
| GET | `/v1/product-inspections/channel-products` | 검수 대상 상품 조회 |

### 상품 등록/수정
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/v2/products` | 상품 등록 |
| PUT | `/v2/products/channel-products/{channelProductNo}` | 채널상품 수정 |
| PUT | `/v2/products/origin-products/{originProductNo}` | 원상품 수정 |
| PUT | `/v1/products/origin-products/{originProductNo}/change-status` | 상품 상태 변경 |
| PUT | `/v1/products/origin-products/bulk-update` | 상품 일괄 수정 |
| PATCH | `/v1/products/origin-products/multi-update` | 상품 다중 업데이트 |
| PUT | `/v1/products/origin-products/{originProductNo}/option-stock` | 옵션 재고 수정 |

### 상품 삭제
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| DEL | `/v2/products/channel-products/{channelProductNo}` | 채널상품 삭제 |
| DEL | `/v2/products/origin-products/{originProductNo}` | 원상품 삭제 |

### 상품 검수
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| PUT | `/v1/product-inspections/channel-product/{channelProductNo}/restore` | 검수 상품 복원 |

### 카테고리
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/v1/categories` | 전체 카테고리 조회 |
| GET | `/v1/categories/{categoryId}` | 카테고리 상세 조회 |
| GET | `/v1/categories/{categoryId}/sub-categories` | 하위 카테고리 조회 |

### 상품 속성
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/v1/product-attributes/attributes` | 상품 속성 조회 |
| GET | `/v1/product-attributes/attribute-values` | 속성값 조회 |
| GET | `/v1/product-attributes/attribute-value-units` | 속성값 단위 조회 |

### 브랜드/제조사/모델
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/v1/product-brands` | 브랜드 조회 |
| GET | `/v1/product-manufacturers` | 제조사 조회 |
| GET | `/v1/product-models` | 모델 목록 조회 |
| GET | `/v1/product-models/{id}` | 모델 상세 조회 |

### 옵션
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/v1/options/standard-options` | 표준 옵션 조회 |

### 이미지
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/v1/product-images/upload` | 상품 이미지 업로드 |

### 배송 정보
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/v1/product-delivery-info/bundle-groups` | 묶음배송 그룹 목록 |
| GET | `/v1/product-delivery-info/bundle-groups/{deliveryBundleGroupId}` | 묶음배송 그룹 상세 |
| POST | `/v1/product-delivery-info/bundle-groups` | 묶음배송 그룹 등록 |
| PUT | `/v1/product-delivery-info/bundle-groups/{deliveryBundleGroupId}` | 묶음배송 그룹 수정 |
| GET | `/v1/product-delivery-info/hope-delivery-groups` | 희망배송 그룹 목록 |
| GET | `/v1/product-delivery-info/hope-delivery-groups/{hopeDeliveryGroupId}` | 희망배송 그룹 상세 |
| POST | `/v1/product-delivery-info/hope-delivery-groups` | 희망배송 그룹 등록 |
| PUT | `/v1/product-delivery-info/hope-delivery-groups/{hopeDeliveryGroupId}` | 희망배송 그룹 수정 |
| GET | `/v2/product-delivery-info/return-delivery-companies` | 반품 배송업체 조회 |

### 원산지
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/v1/product-origin-areas` | 원산지 목록 |
| GET | `/v1/product-origin-areas/query` | 원산지 검색 |
| GET | `/v1/product-origin-areas/sub-origin-areas` | 하위 원산지 조회 |

### 태그
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/v2/tags/recommend-tags` | 추천 태그 조회 |
| GET | `/v2/tags/restricted-tags` | 제한 태그 조회 |

### 사이즈
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/v1/product-sizes` | 사이즈 목록 |
| GET | `/v1/product-sizes/{sizeTypeId}` | 사이즈 상세 |

### 패션 모델
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/v1/product-fashion-models` | 패션 모델 목록 |
| POST | `/v1/product-fashion-models` | 패션 모델 등록 |
| PUT | `/v1/product-fashion-models/{fashionModelId}` | 패션 모델 수정 |
| DEL | `/v1/product-fashion-models/{fashionModelId}` | 패션 모델 삭제 |

### 판매자 공지
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/v1/contents/seller-notices` | 공지 목록 |
| GET | `/v1/contents/seller-notices/{sellerNoticeId}` | 공지 상세 |
| POST | `/v1/contents/seller-notices` | 공지 등록 |
| PUT | `/v1/contents/seller-notices/{sellerNoticeId}` | 공지 수정 |
| DEL | `/v1/contents/seller-notices/{sellerNoticeId}` | 공지 삭제 |
| PUT | `/v1/products/channel-products/notice/apply` | 공지 적용 |

### 상품정보제공고시
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/v1/products-for-provided-notice` | 상품정보제공고시 목록 |
| GET | `/v1/products-for-provided-notice/{productInfoProvidedNoticeType}` | 상품정보제공고시 상세 |

### 표준그룹상품
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/v2/standard-purchase-option-guides` | 표준 구매옵션 가이드 |
| GET | `/v2/standard-group-products/status` | 표준그룹상품 상태 |
| GET | `/v2/standard-group-products/{groupProductNo}` | 표준그룹상품 조회 |
| POST | `/v2/standard-group-products` | 표준그룹상품 등록 |
| PUT | `/v2/standard-group-products/{groupProductNo}` | 표준그룹상품 수정 |
| DEL | `/v2/standard-group-products/{groupProductNo}` | 표준그룹상품 삭제 |
| POST | `/v2/standard-group-products/temp-detail-content` | 임시 상세 콘텐츠 |

---

## 4. 판매자정보

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/v1/seller/account` | 판매자 계정 정보 |
| GET | `/v1/seller/channels` | 판매자 채널 목록 |
| GET | `/v1/seller/this-day-dispatch` | 오늘출발 설정 조회 |
| POST | `/v1/seller/this-day-dispatch` | 오늘출발 설정 등록 |
| GET | `/v1/seller/addressbooks/{addressBookNo}` | 주소록 상세 |
| GET | `/v1/seller/addressbooks-for-page` | 주소록 목록 (페이징) |

### 물류
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/v1/logistics/logistics-companies` | 택배사 목록 |
| GET | `/v1/logistics/outbound-locations` | 출고지 목록 |

---

## 5. 정산

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/v1/pay-settle/settle/case` | 정산 건별 내역 |
| GET | `/v1/pay-settle/settle/daily` | 정산 일별 내역 |
| GET | `/v1/pay-settle/vat/case` | 부가세 건별 내역 |
| GET | `/v1/pay-settle/vat/daily` | 부가세 일별 내역 |
| GET | `/v1/pay-settle/settle/commission-details` | 수수료 상세 내역 |

---

## 자주 사용하는 API

### 상품 목록 조회 (가장 중요)
```typescript
// POST /v1/products/search
const response = await axios.post(
  'https://api.commerce.naver.com/external/v1/products/search',
  {}, // 검색 조건 (빈 객체면 전체 조회)
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    params: {
      page: 1,
      size: 100
    },
  }
);
```

### 응답 구조
```json
{
  "contents": [
    {
      "originProductNo": 13010802709,
      "channelProducts": [
        {
          "originProductNo": 13010802709,
          "channelProductNo": 13068778443,
          "name": "상품명",
          "statusType": "SALE",
          "salePrice": 12500,
          "discountedPrice": 6500,
          "stockQuantity": 20,
          "sellerTags": [
            { "code": 575329, "text": "태그명" }
          ]
        }
      ]
    }
  ],
  "page": 1,
  "size": 50,
  "totalElements": 1,
  "totalPages": 1
}
```

---

## 참고
- 모든 API는 Bearer 토큰 인증 필요
- Rate Limit: 초당 최대 2회 호출
- 토큰 유효시간: 발급 후 일정 시간 (재발급 필요)
