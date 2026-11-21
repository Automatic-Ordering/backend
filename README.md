# AutoOrder (편의점 자동발주 시스템)

편의점 점포의 상품, 재고, 판매, 발주 및 발주 명세서를 관리하는 Express 기반 백엔드입니다.

## 기술 스택

- Node.js
- Express 5
- Sequelize 6
- MySQL
- JWT
- Swagger UI

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example`을 복사해 `.env`를 만들고 데이터베이스 및 인증 정보를 설정합니다.

```bash
cp .env.example .env
```

주요 환경 변수:

| 변수 | 설명 | 기본값 |
| --- | --- | --- |
| `PORT` | 서버 포트 | `3000` |
| `SERVER_URL` | Swagger 서버 URL | 필수 |
| `DB_HOST` | MySQL 호스트 | `localhost` |
| `DB_PORT` | MySQL 포트 | `3306` |
| `DB_NAME` | 데이터베이스 이름 | `convenience_store` |
| `DB_USER` | 데이터베이스 사용자 | `root` |
| `DB_PASSWORD` | 데이터베이스 비밀번호 | 빈 문자열 |
| `JWT_SECRET` | JWT 서명 키 | 필수 권장 |
| `BCRYPT_SALT_ROUNDS` | 비밀번호 해시 라운드 | `12` |

### 3. 데이터베이스 준비

MySQL에 `DB_NAME`에 지정한 데이터베이스를 생성한 뒤 마이그레이션을 실행합니다.

```bash
npm run migrate
```

필요한 경우 관리자와 상품 초기 데이터를 생성할 수 있습니다.

```bash
npm run seed:admin
npm run seed:products
```

`seed:admin`은 `ADMIN_USERNAME`, `ADMIN_PASSWORD` 환경 변수를 사용합니다.

### 3-1. 테스트용 더미 데이터(Seed) 주입

자동 발주 수량 계산(예상 판매량 − 현재고 − 입고 예정 수량)을 실제 데이터로 확인하려면
점포 생성 이후 더미 데이터를 주입합니다. `STORE_ID`에 대상 점포 ID를 지정해 실행합니다.

```bash
STORE_ID=<생성된_점포_ID> npm run seed
```

`npm run seed`는 두 스크립트를 순차 실행합니다.

- `seed-sales-history`: 최근 120일의 판매 이력 생성(오늘 제외, 점포에 등록된 전체 상품 대상)
- `seed-inventory-stock`: 점포 재고의 현재 재고를 랜덤(기본 10~49)으로 설정

선택 환경 변수:

| 변수 | 설명 | 기본값 |
| --- | --- | --- |
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

기본 주소는 `http://localhost:3000`입니다.

## API 문서

서버 실행 후 Swagger UI에서 API 명세를 확인할 수 있습니다.

- Swagger UI: <http://localhost:3000/api-docs>
- OpenAPI JSON: <http://localhost:3000/api-docs.json>

주요 API 그룹:

- `/api/auth` - 점포 인증
- `/api/admin/auth` - 관리자 인증
- `/api/admin/stores` - 점포 관리
- `/api/products` - 상품 관리
- `/api/store/products` - 점포 상품 및 재고
- `/api/store/sales` - 판매 등록 및 판매 내역
- `/api/store/orders` - 점포 발주
- `/api/store/orders/specs` - 점포 발주 명세서
- `/api/store/order-settings` - 자동 발주 설정
- `/api/admin/orders` - 관리자 발주 관리
- `/api/admin/orders/specs` - 관리자 발주 명세서 조회

인증이 필요한 API는 로그인 후 발급된 JWT를 다음 형식으로 전달합니다.

```http
Authorization: Bearer <access-token>
```

## 테스트

```bash
npm test
```

Jest로 실행됩니다. API 통합 테스트(supertest)는 `test/*.test.js`, 순수 로직 단위 테스트는 `test/unit/`에 정의되어 있습니다.

```bash
npm test -- --watch   # 감시 모드
```

## 프로젝트 구조

```text
backend/
├── config/       # 데이터베이스 설정
├── models/       # Sequelize 모델 및 관계
├── scripts/      # 마이그레이션 및 초기 데이터 스크립트
├── src/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   └── utils/
└── test/         # API 통합 테스트 및 단위 테스트(test/unit)
```

## 주의 사항

- `.env`와 실제 인증 정보는 커밋하지 않습니다.
- `JWT_SECRET`, 관리자 비밀번호는 운영 환경에서 충분히 긴 값을 사용합니다.
- 데이터베이스 스키마 변경 시 기존 마이그레이션 및 테스트를 함께 확인합니다.
