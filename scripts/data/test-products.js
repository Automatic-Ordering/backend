/**
 * 100 Convenience Store Test Products Data
 * Category counts:
 * - 도시락 / 김밥: 15
 * - 삼각김밥 / 샌드위치: 15
 * - 컵라면 / 봉지라면: 15
 * - 음료 / 생수: 20
 * - 과자 / 스낵: 15
 * - 유제품 / 디저트: 10
 * - 생활용품: 10
 * Total: 100
 */
const TEST_PRODUCTS = [
  // 1. 도시락 / 김밥 (15개)
  { code: 'PRD-BENTO-001', name: '11가지찬 도시락', category: '도시락 / 김밥', price: 5500, cost: 3300 },
  { code: 'PRD-BENTO-002', name: '치킨마요 덮밥 도시락', category: '도시락 / 김밥', price: 4800, cost: 2900 },
  { code: 'PRD-BENTO-003', name: '바싹불고기 정식 도시락', category: '도시락 / 김밥', price: 5200, cost: 3100 },
  { code: 'PRD-BENTO-004', name: '제육볶음 백반 도시락', category: '도시락 / 김밥', price: 5000, cost: 3000 },
  { code: 'PRD-BENTO-005', name: '통등심 돈까스 도시락', category: '도시락 / 김밥', price: 5500, cost: 3300 },
  { code: 'PRD-BENTO-006', name: '함박스테이크&파스타 도시락', category: '도시락 / 김밥', price: 5300, cost: 3200 },
  { code: 'PRD-BENTO-007', name: '햄구이 부대덮밥 도시락', category: '도시락 / 김밥', price: 4600, cost: 2800 },
  { code: 'PRD-BENTO-008', name: '매콤닭갈비 정식 도시락', category: '도시락 / 김밥', price: 5000, cost: 3000 },
  { code: 'PRD-BENTO-009', name: '바베큐폭립 플래터 도시락', category: '도시락 / 김밥', price: 5900, cost: 3600 },
  { code: 'PRD-BENTO-010', name: '참치마요 김밥', category: '도시락 / 김밥', price: 2800, cost: 1700 },
  { code: 'PRD-BENTO-011', name: '매콤제육 쌈김밥', category: '도시락 / 김밥', price: 3000, cost: 1800 },
  { code: 'PRD-BENTO-012', name: '소고기불고기 김밥', category: '도시락 / 김밥', price: 3200, cost: 1900 },
  { code: 'PRD-BENTO-013', name: '치즈스팸 김밥', category: '도시락 / 김밥', price: 3000, cost: 1800 },
  { code: 'PRD-BENTO-014', name: '돈까스 계란김밥', category: '도시락 / 김밥', price: 3000, cost: 1800 },
  { code: 'PRD-BENTO-015', name: '묵은지참치 통통김밥', category: '도시락 / 김밥', price: 3200, cost: 1900 },

  // 2. 삼각김밥 / 샌드위치 (15개)
  { code: 'PRD-ONIGIRI-001', name: '참치마요 삼각김밥', category: '삼각김밥 / 샌드위치', price: 1200, cost: 700 },
  { code: 'PRD-ONIGIRI-002', name: '전주비빔 삼각김밥', category: '삼각김밥 / 샌드위치', price: 1200, cost: 700 },
  { code: 'PRD-ONIGIRI-003', name: '훈제오리 삼각김밥', category: '삼각김밥 / 샌드위치', price: 1400, cost: 850 },
  { code: 'PRD-ONIGIRI-004', name: '토핑폭탄 불고기 삼각김밥', category: '삼각김밥 / 샌드위치', price: 1400, cost: 850 },
  { code: 'PRD-ONIGIRI-005', name: '치킨데리야끼 삼각김밥', category: '삼각김밥 / 샌드위치', price: 1300, cost: 800 },
  { code: 'PRD-ONIGIRI-006', name: '매콤스팸김치 삼각김밥', category: '삼각김밥 / 샌드위치', price: 1300, cost: 800 },
  { code: 'PRD-ONIGIRI-007', name: '통스팸 삼각김밥', category: '삼각김밥 / 샌드위치', price: 1400, cost: 850 },
  { code: 'PRD-SAND-001', name: '듬뿍에그 샌드위치', category: '삼각김밥 / 샌드위치', price: 2600, cost: 1550 },
  { code: 'PRD-SAND-002', name: '베이컨감자마요 샌드위치', category: '삼각김밥 / 샌드위치', price: 2800, cost: 1700 },
  { code: 'PRD-SAND-003', name: '햄치즈 디럭스 샌드위치', category: '삼각김밥 / 샌드위치', price: 2800, cost: 1700 },
  { code: 'PRD-SAND-004', name: '튜나샐러드 샌드위치', category: '삼각김밥 / 샌드위치', price: 2700, cost: 1600 },
  { code: 'PRD-SAND-005', name: '치킨텐더 클럽 샌드위치', category: '삼각김밥 / 샌드위치', price: 3200, cost: 1900 },
  { code: 'PRD-SAND-006', name: '크랩맛살 와사비마요 샌드위치', category: '삼각김밥 / 샌드위치', price: 2900, cost: 1750 },
  { code: 'PRD-SAND-007', name: '딸기크림 퐁당 샌드위치', category: '삼각김밥 / 샌드위치', price: 3000, cost: 1800 },
  { code: 'PRD-SAND-008', name: 'BLT 클래식 샌드위치', category: '삼각김밥 / 샌드위치', price: 3200, cost: 1900 },

  // 3. 컵라면 / 봉지라면 (15개)
  { code: 'PRD-RAMEN-001', name: '매콤 칼칼 신라면 큰사발', category: '컵라면 / 봉지라면', price: 1400, cost: 850 },
  { code: 'PRD-RAMEN-002', name: '깊고 진한 진라면 매운맛 컵', category: '컵라면 / 봉지라면', price: 1200, cost: 720 },
  { code: 'PRD-RAMEN-003', name: '얼큰 육개장 사발면', category: '컵라면 / 봉지라면', price: 1000, cost: 600 },
  { code: 'PRD-RAMEN-004', name: '화끈한 불닭볶음면 큰사발', category: '컵라면 / 봉지라면', price: 1800, cost: 1100 },
  { code: 'PRD-RAMEN-005', name: '부드러운 까르보 불닭볶음면 큰사발', category: '컵라면 / 봉지라면', price: 1800, cost: 1100 },
  { code: 'PRD-RAMEN-006', name: '고소한 참깨라면 컵', category: '컵라면 / 봉지라면', price: 1500, cost: 900 },
  { code: 'PRD-RAMEN-007', name: '진한 풍미 왕뚜껑 컵', category: '컵라면 / 봉지라면', price: 1300, cost: 780 },
  { code: 'PRD-RAMEN-008', name: '튀김우동 큰사발', category: '컵라면 / 봉지라면', price: 1400, cost: 850 },
  { code: 'PRD-RAMEN-009', name: '매콤 새콤 김치사발면', category: '컵라면 / 봉지라면', price: 1100, cost: 660 },
  { code: 'PRD-RAMEN-010', name: '오리지널 짜파게티 큰사발', category: '컵라면 / 봉지라면', price: 1500, cost: 900 },
  { code: 'PRD-RAMEN-011', name: '신라면 봉지 5입', category: '컵라면 / 봉지라면', price: 4500, cost: 2900 },
  { code: 'PRD-RAMEN-012', name: '진라면 매운맛 봉지 5입', category: '컵라면 / 봉지라면', price: 3900, cost: 2500 },
  { code: 'PRD-RAMEN-013', name: '안성탕면 봉지 5입', category: '컵라면 / 봉지라면', price: 4200, cost: 2700 },
  { code: 'PRD-RAMEN-014', name: '너구리 얼큰한맛 봉지 5입', category: '컵라면 / 봉지라면', price: 4700, cost: 3000 },
  { code: 'PRD-RAMEN-015', name: '짜파게티 봉지 5입', category: '컵라면 / 봉지라면', price: 4800, cost: 3100 },

  // 4. 음료 / 생수 (20개)
  { code: 'PRD-DRINK-001', name: '제주 삼다수 500ml', category: '음료 / 생수', price: 1100, cost: 550 },
  { code: 'PRD-DRINK-002', name: '제주 삼다수 2L', category: '음료 / 생수', price: 2000, cost: 1000 },
  { code: 'PRD-DRINK-003', name: '백산수 500ml', category: '음료 / 생수', price: 1000, cost: 500 },
  { code: 'PRD-DRINK-004', name: '코카콜라 350ml 캔', category: '음료 / 생수', price: 1900, cost: 1150 },
  { code: 'PRD-DRINK-005', name: '코카콜라 제로 355ml 캔', category: '음료 / 생수', price: 1900, cost: 1150 },
  { code: 'PRD-DRINK-006', name: '칠성사이다 355ml 캔', category: '음료 / 생수', price: 1800, cost: 1080 },
  { code: 'PRD-DRINK-007', name: '칠성사이다 제로 355ml 캔', category: '음료 / 생수', price: 1800, cost: 1080 },
  { code: 'PRD-DRINK-008', name: '포카리스웨트 500ml 페트', category: '음료 / 생수', price: 2200, cost: 1300 },
  { code: 'PRD-DRINK-009', name: '파워에이드 마운틴블라스트 600ml', category: '음료 / 생수', price: 2300, cost: 1400 },
  { code: 'PRD-DRINK-010', name: '조지아 오리지널 캔커피 240ml', category: '음료 / 생수', price: 1200, cost: 700 },
  { code: 'PRD-DRINK-011', name: 'TOP 아메리카노 275ml 캔', category: '음료 / 생수', price: 2400, cost: 1450 },
  { code: 'PRD-DRINK-012', name: '바리스타룰스 로에스프레소 250ml', category: '음료 / 생수', price: 2500, cost: 1500 },
  { code: 'PRD-DRINK-013', name: '옥수수수염차 500ml 페트', category: '음료 / 생수', price: 1800, cost: 1050 },
  { code: 'PRD-DRINK-014', name: '헛개수 500ml 페트', category: '음료 / 생수', price: 2000, cost: 1200 },
  { code: 'PRD-DRINK-015', name: '보성녹차 500ml 페트', category: '음료 / 생수', price: 1700, cost: 1000 },
  { code: 'PRD-DRINK-016', name: '델몬트 오렌지주스 180ml 팩', category: '음료 / 생수', price: 1300, cost: 780 },
  { code: 'PRD-DRINK-017', name: '따옴 사과 235ml', category: '음료 / 생수', price: 2200, cost: 1300 },
  { code: 'PRD-DRINK-018', name: '비타500 100ml 병', category: '음료 / 생수', price: 1000, cost: 600 },
  { code: 'PRD-DRINK-019', name: '핫식스 오리지널 250ml 캔', category: '음료 / 생수', price: 1500, cost: 900 },
  { code: 'PRD-DRINK-020', name: '몬스터에너지 355ml 캔', category: '음료 / 생수', price: 2300, cost: 1400 },

  // 5. 과자 / 스낵 (15개)
  { code: 'PRD-SNACK-001', name: '농심 새우깡 90g', category: '과자 / 스낵', price: 1500, cost: 900 },
  { code: 'PRD-SNACK-002', name: '포카칩 오리지널 66g', category: '과자 / 스낵', price: 1700, cost: 1000 },
  { code: 'PRD-SNACK-003', name: '꼬북칩 초코츄러스맛 80g', category: '과자 / 스낵', price: 1700, cost: 1000 },
  { code: 'PRD-SNACK-004', name: '맛동산 90g', category: '과자 / 스낵', price: 1600, cost: 950 },
  { code: 'PRD-SNACK-005', name: '오리온 초코파이 12입', category: '과자 / 스낵', price: 4800, cost: 3100 },
  { code: 'PRD-SNACK-006', name: '롯데 빼빼로 오리지널 54g', category: '과자 / 스낵', price: 1700, cost: 1000 },
  { code: 'PRD-SNACK-007', name: '롯데 아몬드 빼빼로 37g', category: '과자 / 스낵', price: 1700, cost: 1000 },
  { code: 'PRD-SNACK-008', name: '해태 홈런볼 초코 46g', category: '과자 / 스낵', price: 1700, cost: 1000 },
  { code: 'PRD-SNACK-009', name: '프링글스 오리지널 110g', category: '과자 / 스낵', price: 3500, cost: 2200 },
  { code: 'PRD-SNACK-010', name: '꼬깔콘 고소한맛 72g', category: '과자 / 스낵', price: 1700, cost: 1000 },
  { code: 'PRD-SNACK-011', name: '오징어집 83g', category: '과자 / 스낵', price: 1500, cost: 900 },
  { code: 'PRD-SNACK-012', name: '허니버터칩 60g', category: '과자 / 스낵', price: 1700, cost: 1000 },
  { code: 'PRD-SNACK-013', name: '오예스 12입', category: '과자 / 스낵', price: 4800, cost: 3100 },
  { code: 'PRD-SNACK-014', name: '마가렛트 12입', category: '과자 / 스낵', price: 4500, cost: 2900 },
  { code: 'PRD-SNACK-015', name: '칙촉 오리지널 6입', category: '과자 / 스낵', price: 2600, cost: 1600 },

  // 6. 유제품 / 디저트 (10개)
  { code: 'PRD-DAIRY-001', name: '서울우유 200ml', category: '유제품 / 디저트', price: 1150, cost: 750 },
  { code: 'PRD-DAIRY-002', name: '서울우유 1L', category: '유제품 / 디저트', price: 3200, cost: 2200 },
  { code: 'PRD-DAIRY-003', name: '빙그레 바나나맛우유 240ml', category: '유제품 / 디저트', price: 1700, cost: 1100 },
  { code: 'PRD-DAIRY-004', name: '빙그레 딸기맛우유 240ml', category: '유제품 / 디저트', price: 1700, cost: 1100 },
  { code: 'PRD-DAIRY-005', name: '매일 멸균우유 200ml', category: '유제품 / 디저트', price: 1200, cost: 800 },
  { code: 'PRD-DAIRY-006', name: '덴마크 드링킹요구르트 딸기 310ml', category: '유제품 / 디저트', price: 2200, cost: 1400 },
  { code: 'PRD-DAIRY-007', name: '요플레 오리지널 딸기 85g 4입', category: '유제품 / 디저트', price: 3600, cost: 2300 },
  { code: 'PRD-DAIRY-008', name: '매일 바이오 플레인요거트 85g', category: '유제품 / 디저트', price: 1200, cost: 750 },
  { code: 'PRD-DAIRY-009', name: '연세우유 생크림빵', category: '유제품 / 디저트', price: 2800, cost: 1800 },
  { code: 'PRD-DAIRY-010', name: '삼립 보름달 빵', category: '유제품 / 디저트', price: 1500, cost: 950 },

  // 7. 생활용품 (10개)
  { code: 'PRD-LIFE-001', name: '깨끗한나라 휴대용 롤티슈 50m 2롤', category: '생활용품', price: 2500, cost: 1500 },
  { code: 'PRD-LIFE-002', name: '크리넥스 포켓 티슈 6개입', category: '생활용품', price: 3000, cost: 1800 },
  { code: 'PRD-LIFE-003', name: '페리오 뉴치약 120g', category: '생활용품', price: 2800, cost: 1650 },
  { code: 'PRD-LIFE-004', name: '미세모 여행용 칫솔세트', category: '생활용품', price: 3500, cost: 2100 },
  { code: 'PRD-LIFE-005', name: '살균 손소독 물티슈 20매', category: '생활용품', price: 1500, cost: 900 },
  { code: 'PRD-LIFE-006', name: '엠보싱 물티슈 100매', category: '생활용품', price: 2000, cost: 1200 },
  { code: 'PRD-LIFE-007', name: '도루코 3중날 일회용 면도기 2개입', category: '생활용품', price: 2500, cost: 1400 },
  { code: 'PRD-LIFE-008', name: '듀라셀 알카라인 건전지 AA 2개입', category: '생활용품', price: 3200, cost: 1900 },
  { code: 'PRD-LIFE-009', name: '표준 C타입 고속충전 케이블 1m', category: '생활용품', price: 5000, cost: 2800 },
  { code: 'PRD-LIFE-010', name: '부드러운 종이컵 50개입', category: '생활용품', price: 1500, cost: 800 },
];

module.exports = { TEST_PRODUCTS };
