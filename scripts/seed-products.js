require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');
const { Product } = require('../models');

async function seedProducts() {
  const sqlFilePath = path.join(__dirname, 'seed-products.sql');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

  // 주석 제거 및 세미콜론 기준으로 각 구문 분리
  const cleanSql = sqlContent
    .replace(/--.*$/gm, '') // 한 줄 주석 제거
    .replace(/\/\*[\s\S]*?\*\//g, ''); // 블록 주석 제거

  const statements = cleanSql
    .split(/;\s*(?:\r?\n|$)/)
    .map((stmt) => stmt.trim())
    .filter(Boolean);

  console.log(`[Seed Products] SQL 구문 ${statements.length}개를 불러왔습니다.`);

  const [beforeCountResult] = await sequelize.query('SELECT COUNT(*) AS count FROM products');
  const beforeCount = Number(beforeCountResult[0].count);
  console.log(`[Seed Products] 실행 전 기존 상품 수: ${beforeCount}개`);

  let insertedCount = 0;
  let skippedCount = 0;

  for (const statement of statements) {
    if (!statement) continue;
    const [, affectedRows] = await sequelize.query(statement);
    if (Number(affectedRows) > 0) {
      insertedCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  const [afterCountResult] = await sequelize.query('SELECT COUNT(*) AS count FROM products');
  const afterCount = Number(afterCountResult[0].count);

  const [categoryCounts] = await sequelize.query(`
    SELECT category, COUNT(*) AS count
    FROM products
    GROUP BY category
    ORDER BY count DESC, category ASC
  `);

  console.log(`\n========================================`);
  console.log(`[Seed Products] 실행 완료`);
  console.log(`- 신규 등록된 상품: ${insertedCount}개`);
  console.log(`- 건너뛴 상품 (이미 존재): ${skippedCount}개`);
  console.log(`- 실행 후 총 상품 수: ${afterCount}개`);
  console.log(`----------------------------------------`);
  console.log(`카테고리별 등록 현황:`);
  for (const row of categoryCounts) {
    console.log(`  * ${row.category}: ${row.count}개`);
  }
  console.log(`========================================\n`);

  return { beforeCount, afterCount, insertedCount, skippedCount, categoryCounts };
}

if (require.main === module) {
  seedProducts()
    .catch((error) => {
      console.error('[Seed Products] 실행 실패:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await sequelize.close();
    });
}

module.exports = { seedProducts };
