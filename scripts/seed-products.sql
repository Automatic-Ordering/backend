-- ========================================================
-- 편의점 자동 발주 시스템 테스트 상품 100개 시드 데이터
-- 카테고리:
--   - 도시락 / 김밥 (15개)
--   - 삼각김밥 / 샌드위치 (15개)
--   - 컵라면 / 봉지라면 (15개)
--   - 음료 / 생수 (20개)
--   - 과자 / 스낵 (15개)
--   - 유제품 / 디저트 (10개)
--   - 생활용품 (10개)
--   - 합계: 100개
--
-- 중복 방지 규칙:
--   이미 동일한 product_name을 가진 상품이 존재할 경우 INSERT를 건너뜁니다.
-- ========================================================

-- [PRD-BENTO-001] 도시락 / 김밥 | 판매가: 5500원 | 원가(참고): 3300원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '11가지찬 도시락', '도시락 / 김밥', 5500, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '11가지찬 도시락'
);

-- [PRD-BENTO-002] 도시락 / 김밥 | 판매가: 4800원 | 원가(참고): 2900원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '치킨마요 덮밥 도시락', '도시락 / 김밥', 4800, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '치킨마요 덮밥 도시락'
);

-- [PRD-BENTO-003] 도시락 / 김밥 | 판매가: 5200원 | 원가(참고): 3100원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '바싹불고기 정식 도시락', '도시락 / 김밥', 5200, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '바싹불고기 정식 도시락'
);

-- [PRD-BENTO-004] 도시락 / 김밥 | 판매가: 5000원 | 원가(참고): 3000원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '제육볶음 백반 도시락', '도시락 / 김밥', 5000, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '제육볶음 백반 도시락'
);

-- [PRD-BENTO-005] 도시락 / 김밥 | 판매가: 5500원 | 원가(참고): 3300원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '통등심 돈까스 도시락', '도시락 / 김밥', 5500, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '통등심 돈까스 도시락'
);

-- [PRD-BENTO-006] 도시락 / 김밥 | 판매가: 5300원 | 원가(참고): 3200원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '함박스테이크&파스타 도시락', '도시락 / 김밥', 5300, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '함박스테이크&파스타 도시락'
);

-- [PRD-BENTO-007] 도시락 / 김밥 | 판매가: 4600원 | 원가(참고): 2800원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '햄구이 부대덮밥 도시락', '도시락 / 김밥', 4600, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '햄구이 부대덮밥 도시락'
);

-- [PRD-BENTO-008] 도시락 / 김밥 | 판매가: 5000원 | 원가(참고): 3000원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '매콤닭갈비 정식 도시락', '도시락 / 김밥', 5000, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '매콤닭갈비 정식 도시락'
);

-- [PRD-BENTO-009] 도시락 / 김밥 | 판매가: 5900원 | 원가(참고): 3600원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '바베큐폭립 플래터 도시락', '도시락 / 김밥', 5900, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '바베큐폭립 플래터 도시락'
);

-- [PRD-BENTO-010] 도시락 / 김밥 | 판매가: 2800원 | 원가(참고): 1700원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '참치마요 김밥', '도시락 / 김밥', 2800, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '참치마요 김밥'
);

-- [PRD-BENTO-011] 도시락 / 김밥 | 판매가: 3000원 | 원가(참고): 1800원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '매콤제육 쌈김밥', '도시락 / 김밥', 3000, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '매콤제육 쌈김밥'
);

-- [PRD-BENTO-012] 도시락 / 김밥 | 판매가: 3200원 | 원가(참고): 1900원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '소고기불고기 김밥', '도시락 / 김밥', 3200, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '소고기불고기 김밥'
);

-- [PRD-BENTO-013] 도시락 / 김밥 | 판매가: 3000원 | 원가(참고): 1800원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '치즈스팸 김밥', '도시락 / 김밥', 3000, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '치즈스팸 김밥'
);

-- [PRD-BENTO-014] 도시락 / 김밥 | 판매가: 3000원 | 원가(참고): 1800원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '돈까스 계란김밥', '도시락 / 김밥', 3000, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '돈까스 계란김밥'
);

-- [PRD-BENTO-015] 도시락 / 김밥 | 판매가: 3200원 | 원가(참고): 1900원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '묵은지참치 통통김밥', '도시락 / 김밥', 3200, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '묵은지참치 통통김밥'
);

-- [PRD-ONIGIRI-001] 삼각김밥 / 샌드위치 | 판매가: 1200원 | 원가(참고): 700원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '참치마요 삼각김밥', '삼각김밥 / 샌드위치', 1200, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '참치마요 삼각김밥'
);

-- [PRD-ONIGIRI-002] 삼각김밥 / 샌드위치 | 판매가: 1200원 | 원가(참고): 700원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '전주비빔 삼각김밥', '삼각김밥 / 샌드위치', 1200, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '전주비빔 삼각김밥'
);

-- [PRD-ONIGIRI-003] 삼각김밥 / 샌드위치 | 판매가: 1400원 | 원가(참고): 850원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '훈제오리 삼각김밥', '삼각김밥 / 샌드위치', 1400, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '훈제오리 삼각김밥'
);

-- [PRD-ONIGIRI-004] 삼각김밥 / 샌드위치 | 판매가: 1400원 | 원가(참고): 850원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '토핑폭탄 불고기 삼각김밥', '삼각김밥 / 샌드위치', 1400, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '토핑폭탄 불고기 삼각김밥'
);

-- [PRD-ONIGIRI-005] 삼각김밥 / 샌드위치 | 판매가: 1300원 | 원가(참고): 800원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '치킨데리야끼 삼각김밥', '삼각김밥 / 샌드위치', 1300, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '치킨데리야끼 삼각김밥'
);

-- [PRD-ONIGIRI-006] 삼각김밥 / 샌드위치 | 판매가: 1300원 | 원가(참고): 800원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '매콤스팸김치 삼각김밥', '삼각김밥 / 샌드위치', 1300, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '매콤스팸김치 삼각김밥'
);

-- [PRD-ONIGIRI-007] 삼각김밥 / 샌드위치 | 판매가: 1400원 | 원가(참고): 850원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '통스팸 삼각김밥', '삼각김밥 / 샌드위치', 1400, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '통스팸 삼각김밥'
);

-- [PRD-SAND-001] 삼각김밥 / 샌드위치 | 판매가: 2600원 | 원가(참고): 1550원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '듬뿍에그 샌드위치', '삼각김밥 / 샌드위치', 2600, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '듬뿍에그 샌드위치'
);

-- [PRD-SAND-002] 삼각김밥 / 샌드위치 | 판매가: 2800원 | 원가(참고): 1700원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '베이컨감자마요 샌드위치', '삼각김밥 / 샌드위치', 2800, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '베이컨감자마요 샌드위치'
);

-- [PRD-SAND-003] 삼각김밥 / 샌드위치 | 판매가: 2800원 | 원가(참고): 1700원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '햄치즈 디럭스 샌드위치', '삼각김밥 / 샌드위치', 2800, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '햄치즈 디럭스 샌드위치'
);

-- [PRD-SAND-004] 삼각김밥 / 샌드위치 | 판매가: 2700원 | 원가(참고): 1600원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '튜나샐러드 샌드위치', '삼각김밥 / 샌드위치', 2700, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '튜나샐러드 샌드위치'
);

-- [PRD-SAND-005] 삼각김밥 / 샌드위치 | 판매가: 3200원 | 원가(참고): 1900원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '치킨텐더 클럽 샌드위치', '삼각김밥 / 샌드위치', 3200, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '치킨텐더 클럽 샌드위치'
);

-- [PRD-SAND-006] 삼각김밥 / 샌드위치 | 판매가: 2900원 | 원가(참고): 1750원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '크랩맛살 와사비마요 샌드위치', '삼각김밥 / 샌드위치', 2900, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '크랩맛살 와사비마요 샌드위치'
);

-- [PRD-SAND-007] 삼각김밥 / 샌드위치 | 판매가: 3000원 | 원가(참고): 1800원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '딸기크림 퐁당 샌드위치', '삼각김밥 / 샌드위치', 3000, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '딸기크림 퐁당 샌드위치'
);

-- [PRD-SAND-008] 삼각김밥 / 샌드위치 | 판매가: 3200원 | 원가(참고): 1900원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT 'BLT 클래식 샌드위치', '삼각김밥 / 샌드위치', 3200, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = 'BLT 클래식 샌드위치'
);

-- [PRD-RAMEN-001] 컵라면 / 봉지라면 | 판매가: 1400원 | 원가(참고): 850원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '매콤 칼칼 신라면 큰사발', '컵라면 / 봉지라면', 1400, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '매콤 칼칼 신라면 큰사발'
);

-- [PRD-RAMEN-002] 컵라면 / 봉지라면 | 판매가: 1200원 | 원가(참고): 720원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '깊고 진한 진라면 매운맛 컵', '컵라면 / 봉지라면', 1200, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '깊고 진한 진라면 매운맛 컵'
);

-- [PRD-RAMEN-003] 컵라면 / 봉지라면 | 판매가: 1000원 | 원가(참고): 600원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '얼큰 육개장 사발면', '컵라면 / 봉지라면', 1000, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '얼큰 육개장 사발면'
);

-- [PRD-RAMEN-004] 컵라면 / 봉지라면 | 판매가: 1800원 | 원가(참고): 1100원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '화끈한 불닭볶음면 큰사발', '컵라면 / 봉지라면', 1800, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '화끈한 불닭볶음면 큰사발'
);

-- [PRD-RAMEN-005] 컵라면 / 봉지라면 | 판매가: 1800원 | 원가(참고): 1100원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '부드러운 까르보 불닭볶음면 큰사발', '컵라면 / 봉지라면', 1800, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '부드러운 까르보 불닭볶음면 큰사발'
);

-- [PRD-RAMEN-006] 컵라면 / 봉지라면 | 판매가: 1500원 | 원가(참고): 900원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '고소한 참깨라면 컵', '컵라면 / 봉지라면', 1500, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '고소한 참깨라면 컵'
);

-- [PRD-RAMEN-007] 컵라면 / 봉지라면 | 판매가: 1300원 | 원가(참고): 780원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '진한 풍미 왕뚜껑 컵', '컵라면 / 봉지라면', 1300, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '진한 풍미 왕뚜껑 컵'
);

-- [PRD-RAMEN-008] 컵라면 / 봉지라면 | 판매가: 1400원 | 원가(참고): 850원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '튀김우동 큰사발', '컵라면 / 봉지라면', 1400, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '튀김우동 큰사발'
);

-- [PRD-RAMEN-009] 컵라면 / 봉지라면 | 판매가: 1100원 | 원가(참고): 660원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '매콤 새콤 김치사발면', '컵라면 / 봉지라면', 1100, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '매콤 새콤 김치사발면'
);

-- [PRD-RAMEN-010] 컵라면 / 봉지라면 | 판매가: 1500원 | 원가(참고): 900원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '오리지널 짜파게티 큰사발', '컵라면 / 봉지라면', 1500, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '오리지널 짜파게티 큰사발'
);

-- [PRD-RAMEN-011] 컵라면 / 봉지라면 | 판매가: 4500원 | 원가(참고): 2900원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '신라면 봉지 5입', '컵라면 / 봉지라면', 4500, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '신라면 봉지 5입'
);

-- [PRD-RAMEN-012] 컵라면 / 봉지라면 | 판매가: 3900원 | 원가(참고): 2500원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '진라면 매운맛 봉지 5입', '컵라면 / 봉지라면', 3900, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '진라면 매운맛 봉지 5입'
);

-- [PRD-RAMEN-013] 컵라면 / 봉지라면 | 판매가: 4200원 | 원가(참고): 2700원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '안성탕면 봉지 5입', '컵라면 / 봉지라면', 4200, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '안성탕면 봉지 5입'
);

-- [PRD-RAMEN-014] 컵라면 / 봉지라면 | 판매가: 4700원 | 원가(참고): 3000원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '너구리 얼큰한맛 봉지 5입', '컵라면 / 봉지라면', 4700, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '너구리 얼큰한맛 봉지 5입'
);

-- [PRD-RAMEN-015] 컵라면 / 봉지라면 | 판매가: 4800원 | 원가(참고): 3100원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '짜파게티 봉지 5입', '컵라면 / 봉지라면', 4800, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '짜파게티 봉지 5입'
);

-- [PRD-DRINK-001] 음료 / 생수 | 판매가: 1100원 | 원가(참고): 550원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '제주 삼다수 500ml', '음료 / 생수', 1100, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '제주 삼다수 500ml'
);

-- [PRD-DRINK-002] 음료 / 생수 | 판매가: 2000원 | 원가(참고): 1000원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '제주 삼다수 2L', '음료 / 생수', 2000, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '제주 삼다수 2L'
);

-- [PRD-DRINK-003] 음료 / 생수 | 판매가: 1000원 | 원가(참고): 500원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '백산수 500ml', '음료 / 생수', 1000, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '백산수 500ml'
);

-- [PRD-DRINK-004] 음료 / 생수 | 판매가: 1900원 | 원가(참고): 1150원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '코카콜라 350ml 캔', '음료 / 생수', 1900, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '코카콜라 350ml 캔'
);

-- [PRD-DRINK-005] 음료 / 생수 | 판매가: 1900원 | 원가(참고): 1150원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '코카콜라 제로 355ml 캔', '음료 / 생수', 1900, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '코카콜라 제로 355ml 캔'
);

-- [PRD-DRINK-006] 음료 / 생수 | 판매가: 1800원 | 원가(참고): 1080원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '칠성사이다 355ml 캔', '음료 / 생수', 1800, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '칠성사이다 355ml 캔'
);

-- [PRD-DRINK-007] 음료 / 생수 | 판매가: 1800원 | 원가(참고): 1080원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '칠성사이다 제로 355ml 캔', '음료 / 생수', 1800, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '칠성사이다 제로 355ml 캔'
);

-- [PRD-DRINK-008] 음료 / 생수 | 판매가: 2200원 | 원가(참고): 1300원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '포카리스웨트 500ml 페트', '음료 / 생수', 2200, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '포카리스웨트 500ml 페트'
);

-- [PRD-DRINK-009] 음료 / 생수 | 판매가: 2300원 | 원가(참고): 1400원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '파워에이드 마운틴블라스트 600ml', '음료 / 생수', 2300, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '파워에이드 마운틴블라스트 600ml'
);

-- [PRD-DRINK-010] 음료 / 생수 | 판매가: 1200원 | 원가(참고): 700원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '조지아 오리지널 캔커피 240ml', '음료 / 생수', 1200, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '조지아 오리지널 캔커피 240ml'
);

-- [PRD-DRINK-011] 음료 / 생수 | 판매가: 2400원 | 원가(참고): 1450원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT 'TOP 아메리카노 275ml 캔', '음료 / 생수', 2400, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = 'TOP 아메리카노 275ml 캔'
);

-- [PRD-DRINK-012] 음료 / 생수 | 판매가: 2500원 | 원가(참고): 1500원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '바리스타룰스 로에스프레소 250ml', '음료 / 생수', 2500, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '바리스타룰스 로에스프레소 250ml'
);

-- [PRD-DRINK-013] 음료 / 생수 | 판매가: 1800원 | 원가(참고): 1050원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '옥수수수염차 500ml 페트', '음료 / 생수', 1800, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '옥수수수염차 500ml 페트'
);

-- [PRD-DRINK-014] 음료 / 생수 | 판매가: 2000원 | 원가(참고): 1200원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '헛개수 500ml 페트', '음료 / 생수', 2000, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '헛개수 500ml 페트'
);

-- [PRD-DRINK-015] 음료 / 생수 | 판매가: 1700원 | 원가(참고): 1000원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '보성녹차 500ml 페트', '음료 / 생수', 1700, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '보성녹차 500ml 페트'
);

-- [PRD-DRINK-016] 음료 / 생수 | 판매가: 1300원 | 원가(참고): 780원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '델몬트 오렌지주스 180ml 팩', '음료 / 생수', 1300, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '델몬트 오렌지주스 180ml 팩'
);

-- [PRD-DRINK-017] 음료 / 생수 | 판매가: 2200원 | 원가(참고): 1300원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '따옴 사과 235ml', '음료 / 생수', 2200, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '따옴 사과 235ml'
);

-- [PRD-DRINK-018] 음료 / 생수 | 판매가: 1000원 | 원가(참고): 600원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '비타500 100ml 병', '음료 / 생수', 1000, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '비타500 100ml 병'
);

-- [PRD-DRINK-019] 음료 / 생수 | 판매가: 1500원 | 원가(참고): 900원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '핫식스 오리지널 250ml 캔', '음료 / 생수', 1500, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '핫식스 오리지널 250ml 캔'
);

-- [PRD-DRINK-020] 음료 / 생수 | 판매가: 2300원 | 원가(참고): 1400원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '몬스터에너지 355ml 캔', '음료 / 생수', 2300, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '몬스터에너지 355ml 캔'
);

-- [PRD-SNACK-001] 과자 / 스낵 | 판매가: 1500원 | 원가(참고): 900원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '농심 새우깡 90g', '과자 / 스낵', 1500, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '농심 새우깡 90g'
);

-- [PRD-SNACK-002] 과자 / 스낵 | 판매가: 1700원 | 원가(참고): 1000원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '포카칩 오리지널 66g', '과자 / 스낵', 1700, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '포카칩 오리지널 66g'
);

-- [PRD-SNACK-003] 과자 / 스낵 | 판매가: 1700원 | 원가(참고): 1000원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '꼬북칩 초코츄러스맛 80g', '과자 / 스낵', 1700, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '꼬북칩 초코츄러스맛 80g'
);

-- [PRD-SNACK-004] 과자 / 스낵 | 판매가: 1600원 | 원가(참고): 950원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '맛동산 90g', '과자 / 스낵', 1600, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '맛동산 90g'
);

-- [PRD-SNACK-005] 과자 / 스낵 | 판매가: 4800원 | 원가(참고): 3100원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '오리온 초코파이 12입', '과자 / 스낵', 4800, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '오리온 초코파이 12입'
);

-- [PRD-SNACK-006] 과자 / 스낵 | 판매가: 1700원 | 원가(참고): 1000원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '롯데 빼빼로 오리지널 54g', '과자 / 스낵', 1700, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '롯데 빼빼로 오리지널 54g'
);

-- [PRD-SNACK-007] 과자 / 스낵 | 판매가: 1700원 | 원가(참고): 1000원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '롯데 아몬드 빼빼로 37g', '과자 / 스낵', 1700, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '롯데 아몬드 빼빼로 37g'
);

-- [PRD-SNACK-008] 과자 / 스낵 | 판매가: 1700원 | 원가(참고): 1000원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '해태 홈런볼 초코 46g', '과자 / 스낵', 1700, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '해태 홈런볼 초코 46g'
);

-- [PRD-SNACK-009] 과자 / 스낵 | 판매가: 3500원 | 원가(참고): 2200원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '프링글스 오리지널 110g', '과자 / 스낵', 3500, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '프링글스 오리지널 110g'
);

-- [PRD-SNACK-010] 과자 / 스낵 | 판매가: 1700원 | 원가(참고): 1000원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '꼬깔콘 고소한맛 72g', '과자 / 스낵', 1700, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '꼬깔콘 고소한맛 72g'
);

-- [PRD-SNACK-011] 과자 / 스낵 | 판매가: 1500원 | 원가(참고): 900원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '오징어집 83g', '과자 / 스낵', 1500, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '오징어집 83g'
);

-- [PRD-SNACK-012] 과자 / 스낵 | 판매가: 1700원 | 원가(참고): 1000원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '허니버터칩 60g', '과자 / 스낵', 1700, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '허니버터칩 60g'
);

-- [PRD-SNACK-013] 과자 / 스낵 | 판매가: 4800원 | 원가(참고): 3100원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '오예스 12입', '과자 / 스낵', 4800, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '오예스 12입'
);

-- [PRD-SNACK-014] 과자 / 스낵 | 판매가: 4500원 | 원가(참고): 2900원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '마가렛트 12입', '과자 / 스낵', 4500, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '마가렛트 12입'
);

-- [PRD-SNACK-015] 과자 / 스낵 | 판매가: 2600원 | 원가(참고): 1600원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '칙촉 오리지널 6입', '과자 / 스낵', 2600, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '칙촉 오리지널 6입'
);

-- [PRD-DAIRY-001] 유제품 / 디저트 | 판매가: 1150원 | 원가(참고): 750원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '서울우유 200ml', '유제품 / 디저트', 1150, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '서울우유 200ml'
);

-- [PRD-DAIRY-002] 유제품 / 디저트 | 판매가: 3200원 | 원가(참고): 2200원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '서울우유 1L', '유제품 / 디저트', 3200, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '서울우유 1L'
);

-- [PRD-DAIRY-003] 유제품 / 디저트 | 판매가: 1700원 | 원가(참고): 1100원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '빙그레 바나나맛우유 240ml', '유제품 / 디저트', 1700, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '빙그레 바나나맛우유 240ml'
);

-- [PRD-DAIRY-004] 유제품 / 디저트 | 판매가: 1700원 | 원가(참고): 1100원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '빙그레 딸기맛우유 240ml', '유제품 / 디저트', 1700, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '빙그레 딸기맛우유 240ml'
);

-- [PRD-DAIRY-005] 유제품 / 디저트 | 판매가: 1200원 | 원가(참고): 800원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '매일 멸균우유 200ml', '유제품 / 디저트', 1200, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '매일 멸균우유 200ml'
);

-- [PRD-DAIRY-006] 유제품 / 디저트 | 판매가: 2200원 | 원가(참고): 1400원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '덴마크 드링킹요구르트 딸기 310ml', '유제품 / 디저트', 2200, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '덴마크 드링킹요구르트 딸기 310ml'
);

-- [PRD-DAIRY-007] 유제품 / 디저트 | 판매가: 3600원 | 원가(참고): 2300원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '요플레 오리지널 딸기 85g 4입', '유제품 / 디저트', 3600, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '요플레 오리지널 딸기 85g 4입'
);

-- [PRD-DAIRY-008] 유제품 / 디저트 | 판매가: 1200원 | 원가(참고): 750원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '매일 바이오 플레인요거트 85g', '유제품 / 디저트', 1200, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '매일 바이오 플레인요거트 85g'
);

-- [PRD-DAIRY-009] 유제품 / 디저트 | 판매가: 2800원 | 원가(참고): 1800원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '연세우유 생크림빵', '유제품 / 디저트', 2800, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '연세우유 생크림빵'
);

-- [PRD-DAIRY-010] 유제품 / 디저트 | 판매가: 1500원 | 원가(참고): 950원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '삼립 보름달 빵', '유제품 / 디저트', 1500, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '삼립 보름달 빵'
);

-- [PRD-LIFE-001] 생활용품 | 판매가: 2500원 | 원가(참고): 1500원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '깨끗한나라 휴대용 롤티슈 50m 2롤', '생활용품', 2500, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '깨끗한나라 휴대용 롤티슈 50m 2롤'
);

-- [PRD-LIFE-002] 생활용품 | 판매가: 3000원 | 원가(참고): 1800원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '크리넥스 포켓 티슈 6개입', '생활용품', 3000, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '크리넥스 포켓 티슈 6개입'
);

-- [PRD-LIFE-003] 생활용품 | 판매가: 2800원 | 원가(참고): 1650원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '페리오 뉴치약 120g', '생활용품', 2800, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '페리오 뉴치약 120g'
);

-- [PRD-LIFE-004] 생활용품 | 판매가: 3500원 | 원가(참고): 2100원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '미세모 여행용 칫솔세트', '생활용품', 3500, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '미세모 여행용 칫솔세트'
);

-- [PRD-LIFE-005] 생활용품 | 판매가: 1500원 | 원가(참고): 900원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '살균 손소독 물티슈 20매', '생활용품', 1500, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '살균 손소독 물티슈 20매'
);

-- [PRD-LIFE-006] 생활용품 | 판매가: 2000원 | 원가(참고): 1200원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '엠보싱 물티슈 100매', '생활용품', 2000, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '엠보싱 물티슈 100매'
);

-- [PRD-LIFE-007] 생활용품 | 판매가: 2500원 | 원가(참고): 1400원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '도루코 3중날 일회용 면도기 2개입', '생활용품', 2500, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '도루코 3중날 일회용 면도기 2개입'
);

-- [PRD-LIFE-008] 생활용품 | 판매가: 3200원 | 원가(참고): 1900원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '듀라셀 알카라인 건전지 AA 2개입', '생활용품', 3200, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '듀라셀 알카라인 건전지 AA 2개입'
);

-- [PRD-LIFE-009] 생활용품 | 판매가: 5000원 | 원가(참고): 2800원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '표준 C타입 고속충전 케이블 1m', '생활용품', 5000, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '표준 C타입 고속충전 케이블 1m'
);

-- [PRD-LIFE-010] 생활용품 | 판매가: 1500원 | 원가(참고): 800원
INSERT INTO products (product_name, category, price, created_at, updated_at)
SELECT '부드러운 종이컵 50개입', '생활용품', 1500, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE product_name = '부드러운 종이컵 50개입'
);
