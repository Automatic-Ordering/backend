const bcrypt = require('bcrypt');

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);
const verifyPassword = (password, passwordHash) => bcrypt.compare(password, passwordHash);

// 점포 초기 비밀번호 규칙: Store{store_code}! (점포 생성 및 비밀번호 초기화에서 공용 사용)
const generateTemporaryPassword = (storeCode) => `Store${storeCode}!`;

module.exports = { hashPassword, verifyPassword, generateTemporaryPassword };
