const bcrypt = require('bcrypt');

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);
const verifyPassword = (password, passwordHash) => bcrypt.compare(password, passwordHash);

module.exports = { hashPassword, verifyPassword };
