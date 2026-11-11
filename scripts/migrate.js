require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');

(async () => {
  const migrationFiles = fs
    .readdirSync(path.join(__dirname, '../migrations'))
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort();
  const statements = migrationFiles.flatMap((fileName) =>
    fs
      .readFileSync(path.join(__dirname, '../migrations', fileName), 'utf8')
      .split(/;\s*(?:\r?\n|$)/)
      .map((statement) => statement.trim())
      .filter(Boolean),
  );
  try {
    for (const statement of statements) {
      await sequelize.query(statement);
    }
    console.log('Authentication tables are ready.');
  } finally {
    await sequelize.close();
  }
})().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
});
