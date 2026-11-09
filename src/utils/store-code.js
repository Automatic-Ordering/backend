const crypto = require('crypto');

const generateStoreCode = () => `STORE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

module.exports = { generateStoreCode };
