require("dotenv").config();
const { Admin } = require("../models");
const { hashPassword } = require("../src/utils/password");

(async () => {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password || password.length < 8) {
    throw new Error(
      "ADMIN_USERNAME and ADMIN_PASSWORD (minimum 8 characters) are required.",
    );
  }
  const existing = await Admin.findOne({ where: { adminUsername: username } });
  if (existing) {
    console.log(`Administrator "${username}" already exists.`);
    await Admin.sequelize.close();
    return;
  }
  await Admin.create({
    adminUsername: username,
    passwordHash: await hashPassword(password),
  });
  console.log(`Administrator "${username}" created.`);
  await Admin.sequelize.close();
})().catch(async (error) => {
  console.error("Admin seed failed:", error.message);
  await Admin.sequelize.close();
  process.exitCode = 1;
});
