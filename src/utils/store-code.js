const crypto = require("crypto");

const generateStoreCode = () => String(crypto.randomInt(10000, 100000));

module.exports = { generateStoreCode };
