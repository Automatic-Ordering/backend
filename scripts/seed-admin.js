require('dotenv').config();
const { pool } = require('../src/config/database');
const { hashPassword } = require('../src/utils/password');

(async () => {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password || password.length < 8) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD (minimum 8 characters) are required.');
  }
  const [existing] = await pool.query('SELECT admin_id FROM admins WHERE admin_username = ?', [username]);
  if (existing.length) {
    console.log(`Administrator "${username}" already exists.`);
    await pool.end();
    return;
  }
  await pool.query(
    'INSERT INTO admins (admin_username, password_hash) VALUES (?, ?)',
    [username, await hashPassword(password)],
  );
  console.log(`Administrator "${username}" created.`);
  await pool.end();
})().catch(async (error) => {
  console.error('Admin seed failed:', error.message);
  await pool.end();
  process.exitCode = 1;
});
