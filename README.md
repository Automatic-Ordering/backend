# AutoOrder (편의점 자동발주 시스템)

편의점 점포의 상품, 재고, 판매, 발주 및 발주 명세서를 관리하는 Express 기반 백엔드 시스템입니다.

## 기술 스택

- **Node.js** v22 (Docker는 Alpine 기반)
- **Express** v5 (라우터 및 미들웨어)
- **Sequelize** v6 (MySQL ORM)
- **MySQL** v8 (관계형 데이터베이스)
- **JWT** (점포/관리자 인증용 토큰)
- **Swagger UI** v5 (API 명세서 자동 생성)
- **swagger-jsdoc** v6 (JSDoc 기반 스펙 생성)
- **Jest** v30 (단위/통합 테스트)
- **Supertest** (API 통합 테스트 헬퍼)
- **Docker** (컨테이너화된 배포)

## 프로젝트 구조

```text
backend/
├── config/           # 데이터베이스 설정 (database.js)
├── Dockerfile        # Docker 기반 생산 환경 설정
├── models/           # Sequelize 모델 및 관계 정의
├── migrations/       # 데이터베이스 마이그레이션 스크립트
├── scripts/          # 시드 데이터 및 마이그레이션 스크립트
│   ├── seed-admin.js         # 관리자 초기 데이터 생성
│   ├── seed-products.sql     # 상품 100개 시드 SQL
│   ├── seed-sales-history.js # 판매 이력 시드
│   └── seed-inventory-stock.js # 점포 재고 시드
├── node_modules/     # 의존성 모듈
├── .env.example      # 환경 변수 예시
├── .gitignore
├── jest.config.js    # Jest 테스트 설정
├── package.json      # npm 스크립트 및 의존성
├── README.md         # 이 문서
└── src/
    ├── app.js        # Express 앱 및 Swagger 설정 진입점
    ├── controllers/  # 라우트 핸들러 (주문, 재고, 상품 등)
    ├── middleware/   # 인증 및 검증 미들웨어
    ├── models/       # 추가 모델 정의 (Swagger용)
    ├── routes/       # Express 라우터 그룹
    │   ├── store-orders.js          # 점포 발주 API
    │   ├── store-order-specs.js     # 점포 발주 명세서 API
    │   ├── admin-orders.js          # 관리자 발주 API
    │   └── admin-order-specs.js     # 관리자 명세서 API
    ├── services/     # 비즈니스 로직 서비스
    │   ├── orderCalculator.js       # 발주 권장 수량 계산 엔진
    │   ├── orderService.js          # 발주 생성/확정 서비스
    │   ├── orderSpecService.js      # 발주 명세서 CRUD + 입고 처리
    │   ├── inventoryService.js      # 재고 증감 서비스
    │   └── storeOrderSettingService # 점포별 자동 발주 설정 서비스
    └── utils/        # 유틸리티 함수
        ├── orderValidation.js       # 발주/입고 항목 검증
        ├── pagination.js            # 페이지네이션 헬퍼
        └── httpError.js             # HTTP 에러 핸들러
└── test/             # API 통합 테스트 (Supertest) 및 단위 테스트
    ├── unit/          # 순수 로직 단위 테스트 (orderCalculator 등)
    ├── order-specs.test.js        # 발주 명세서 API 통합 테스트
    ├── store-orders.test.js       # 발주 API 통합 테스트
    └── support/           # 테스트 지원 모듈 (test-app.js 등)
```

## 자동발주 추천 수량 계산 로직

`src/services/orderCalculator.js`에서 제공하는 `calculateRecommendation` 함수는 다음과 같은 수식과 파라미터를 사용합니다.

### 핵심 파라미터

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| `currentStock` | - | 현재 재고 수량 (0 이상 정수) |
| `configuredSafetyStock` / `safetyStock` | - | 안전재고 금액. `configuredSafetyStock`가 있으면 그것을 우선 사용, 없으면 `safetyStock` 사용 |
| `leadTimeDays` | `1` | 리드타임(공급까지 소요되는 일수). 기본 1일 |
| `analysisDays` | `7` | 판매 이력 분석 기간(일). 기본 7일 |
| `safetyStockDays` | `2` | 안전재고 적용 일수. 기본 2일 |
| `orderUnit` | `1` | **발주 배수(박스/묶음 단위, product.orderUnit)**. `1`이면 낱개 단위 |

### 계산 수식

1. **최근 N일 일평균 판매량 구하기**
   - `avgDailySales = recentSales / analysisDays`
   - `recentSales`: `dailySales` 배열에 포함된 최근 판매 데이터의 총량

2. **필요한 총 납품 수량 계산**
   - `requiredEa = max(0, ceil(avgDailySales * (leadTimeDays + safetyStockDays)) - currentStock)`

3. **배수(박스 단위) 적용**
   - `recommendedQty = requiredEa > 0 ? ceil(requiredEa / orderUnit) : 0`
   - `totalExpectedEa = recommendedQty * orderUnit` (최종 발주 총 낱개 수량)

4. **목표 재고 계산**
   - `targetStock = ceil(avgDailySales * (leadTimeDays + safetyStockDays))`

5. **반환값 주요 필드**
   - `orderQuantity`: 배수 적용 후 올림한 발주 박스 수 (`recommendedQty`)
   - `rawOrderQuantity`: 배수 미적용 원본 필요 수량 (`requiredEa`)
   - `totalExpectedEa`: `orderQuantity * orderUnit` (서버가 실제 저장하는 총 낱개 수량)
   - `multiplier`: `recommendedQty` (프론트엔드가 배수 필드로 사용할 값)
   - `targetStock`: 목표 재고 수준

### 검증 로직

- `assertNonNegativeInteger`: 0 이상 정수 확인 (현재 재고, 안전재고 등)
- `assertPositiveInteger`: 1 이상 정수 확인 (발주 배수 기본값 1)
- `assertNonNegativeSetting`: 0 이상 정수 확인 (리드타임, 분석일수, 안전재고일수)
- 최근 7일 미만 판매 데이터 경우 `INSUFFICIENT_SALES_DATA` 경고 코드 발생
- 판매 데이터가 전혀 없으면 `NO_SALES_DATA` 경고 코드 발생

### 최근 리팩토링 변경사항 (2026년)

- **`orderQuantity`는 항상 `totalExpectedEa`(total 개수)를 저장**하도록 수정
- **`orderUnit`(product.orderUnit, 즉 pack_size/입수량)과 `multiplier`(배수)를 명확히 분리**
  - 프론트엔드가 `quantity: 1`만 보내면 백엔드에서 `1 * product.orderUnit`으로 변환하여 저장
  - 프론트엔드가 `quantity: 50, multiplier: 1`처럼 보내면 `50`이 그대로 저장 (이미 총 개수인 경우)
  - `receiveOrderSpec`에서 `item.orderQuantity`를 재고 증가량으로 직접 사용하여 **중복 곱셈 방지** (이전 버그: `50 * 50 = 2500`)
- `serializeOrderRow` 및 `serializeSpecItem` 응답에 `pack_size`(orderUnit) 및 `multiplier` 필드 추가

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example`을 복사하여 `.env`를 만들고 데이터베이스 및 인증 정보를 설정합니다.

```bash
cp .env.example .env
```

주요 환경 변수:

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PORT` | 서버 포트 | `3000` |
| `NODE_ENV` | 실행 모드 | `development` |
| `SERVER_URL` | Swagger 서버 URL | `http://localhost:3000` |
| `CORS_ORIGINS` | CORS 허용 origins | `http://localhost:5173,https://store.moonlights.dev` |
| `DB_HOST` | MySQL 호스트 | `localhost` |
| `DB_PORT` | MySQL 포트 | `3306` |
| `DB_USER` | 데이터베이스 사용자 | `root` |
| `DB_PASSWORD` | 데이터베이스 비밀번호 | `(빈 문자열)` |
| `DB_NAME` | 데이터베이스 이름 | `convenience_store` |
| `JWT_SECRET` | JWT 서명 키 | 필수 권장 |
| `BCRYPT_SALT_ROUNDS` | 비밀번호 해시 라운드 | `12` |
| `ADMIN_USERNAME` | 관리자 계정 사용자명 | (seed:admin 시 사용) |
| `ADMIN_PASSWORD` | 관리자 계정 비밀번호 | (seed:admin 시 사용) |

### 3. 데이터베이스 준비

MySQL에 `DB_NAME`에 지정한 데이터베이스를 생성한 뒤 마이그레이션을 실행합니다.

```bash
npm run migrate
```

필요한 경우 관리자와 상품 초기 데이터를 생성합니다.

```bash
npm run seed:admin
npm run seed:products
```

`npm run seed`는 두 스크립트를 순차 실행합니다.

```bash
# 테스트용 더미 데이터 주입 (STORE_ID 필수)
STORE_ID=<생성된_점포_ID> npm run seed
```

`npm run seed`는 다음 스크립트를 순차 실행합니다.

- **`seed-sales-history`**: 최근 120일의 판매 이력 생성(오늘 제외, 점포에 등록된 전체 상품 대상)
- **`seed-inventory-stock`**: 점포 재고의 현재 재고를 랜덤(기본 10~49)으로 설정

선택 환경 변수:

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `STORE_ID` | 대상 점포 ID | 필수 |
| `SEED` | 판매 이력 난수 시드 | `20261113` |
| `STOCK` | 현재 재고 고정값(지정 시 랜덤 대신 적용) | 랜덤 |
| `RAND_MIN` / `RAND_MAX` | 현재 재고 랜덤 범위 | `10` / `49` |
| `SAFETY_STOCK` | 안전재고 값(미지정 시 기존 유지) | 기존 유지 |
| `DRY_RUN` | `1`로 지정 시 변경 없이 미리보기만 수행 | 미리보기 아님 |

### 4. 서버 실행

개발 모드:

```bash
npm run dev
```

일반 실행:

```bash
npm start
```

기본 주소는 `http://localhost:3000`이며, Swagger UI는 `http://localhost:3000/api-docs`에서 확인할 수 있습니다.

### 5. Docker 실행

```bash
docker build -t autoorder-backend .
docker run -p 3000:3000 \
  -e PORT=3000 \
  -e NODE_ENV=development \
  -e SERVER_URL=http://localhost:3000 \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=3306 \
  -e DB_USER=root \
  -e DB_PASSWORD=your_password \
  -e DB_NAME=convenience_store \
  -e JWT_SECRET=replace-with-a-long-random-secret \
  autoorder-backend
```

> **주의**: Docker 컨테이너 내에서는 호스트 MySQL에 연결하기 위해 `host.docker.internal`을 사용합니다. `npm run seed` 시 `STORE_ID`를 지정해야 합니다.

## 테스트 실행

```bash
npm test
```

Jest로 실행되며, 다음 디렉터리에서 테스트가 수행됩니다.

- `test/unit/orderCalculator.test.js`: 순수 로직 단위 테스트 (발주 계산 수식 검증)
- `test/*.test.js`: Supertest 기반 API 통합 테스트 (발주 생성, 명세서 생성/입고 등)

감시 모드에서 실행하려면:

```bash
npm test -- --watch
```

테스트는 `.env` 설정이 필요하며, 데이터베이스 연결이 필요합니다.

## API 문서 (Swagger)

서버 실행 후 Swagger UI에서 API 명세를 확인할 수 있습니다.

- **Swagger UI**: `http://localhost:3000/api-docs`
- **OpenAPI JSON**: `http://localhost:3000/api-docs.json`

### 주요 API 그룹

| 그룹 | 주요 엔드포인트 |
|------|----------------|
| **인증** | `/api/auth` (점포 로그인), `/api/admin/auth` (관리자 로그인) |
| **상품 관리** | `/api/products` (본사 상품 조회), `/api/store/products` (점포 상품·재고) |
| **판매 등록** | `/api/store/sales` (판매 등록 및 내역) |
| **발주** | `/api/store/orders/recommendations` (자동 추천 조회), `/api/store/orders/confirm` (PENDING → ORDERED 생성), `/api/store/orders/` (발주 이력 조회) |
| **발주 명세서** | `/api/store/orders/specs` (DRAFT 생성), `/{specId}/confirm` (확정 → PENDING_RECEIPT), `/{specId}/receipt` (입고 완료 RECEIVED) |
| **관리자 발주** | `/api/admin/orders` (전체 발주 조회/상태 변경), `/api/admin/orders/specs` (본사 명세서 조회) |
| **헬스 체크** | `/health`, `/health/db` |

인증이 필요한 API는 로그인 후 발급된 JWT를 다음 형식으로 전달합니다.

```http
Authorization: Bearer <access-token>
```

## 주의 사항

- `.env`와 실제 인증 정보는 커밋하지 않습니다.
- `JWT_SECRET`, 관리자 비밀번호는 운영 환경에서 충분히 긴 값을 사용합니다.
- 데이터베이스 스키마 변경 시 기존 마이그레이션 및 테스트를 함께 확인합니다.
- `seed:admin`은 `ADMIN_USERNAME`, `ADMIN_PASSWORD` 환경 변수를 사용합니다.
- `npm run seed` 시 `STORE_ID` 환경 변수로 대상 점포 ID를 반드시 지정해야 합니다.
- `receiveOrderSpec`에서 입고 수량은 `item.orderQuantity`(서버가 계산한 총 낱개 수량)를 기준으로 하므로, 프론트엔드에서 별도로 `pack_size`를 곱하면 **2500**(50×50)이 되어 재고가 과다 증가하는 버그가 수정되었습니다.
- `confirmOrders` 및 `resolveSpecItems`에서 `multiplier` 필드가 제시되면 `quantity * multiplier * product.orderUnit`로 변환하여 저장하며, `multiplier`가 없으면 `quantity` 그대로 저장(백워드 호환)합니다.