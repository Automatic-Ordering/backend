require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');

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
  const connection = await pool.getConnection();
  try {
    for (const statement of statements) {
      await connection.query(statement);
    }
    console.log('Authentication tables are ready.');
  } finally {
    connection.release();
    await pool.end();
  }
})().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
});
