// src/utils/inventoryPolicy.js
/**
 * 안전재고(safety stock) 정책 정의
 * `products.category` 값과 정확히 일치하도록 키를 지정합니다.
 * 정책에 정의되지 않은 카테고리는 기본값 0을 반환합니다.
 */

const safetyStockByCategory = {
  '도시락 / 김밥': 2,
  '삼각김밥 / 샌드위치': 3,
  '컵라면 / 봉지라면': 5,
  '음료 / 생수': 5,
  '과자 / 스낵': 4,
  '유제품 / 디저트': 2,
  '생활용품': 1,
};

/**
 * 카테고리 이름을 받아 안전재고 수치를 반환합니다.
 * @param {string} category - 제품의 category 값
 * @returns {number} 안전재고 (정책에 없으면 0)
 */
function getSafetyStock(category) {
  return safetyStockByCategory[category] ?? 0;
}

module.exports = {
  safetyStockByCategory,
  getSafetyStock,
};
