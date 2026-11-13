require("dotenv").config();

const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME || "convenience_store",
  process.env.DB_USER || "root",
  process.env.DB_PASSWORD || "",
  {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    dialect: "mysql",
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    define: {
      underscored: true,
      timestamps: true,
    },
  },
);

const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log(`Sequelize database connected: ${sequelize.config.database}`);
  } catch (error) {
    console.error("Sequelize database connection failed:", error.message);
    throw error;
  }
};

const syncDatabase = async () => {
  try {
    await sequelize.sync();
    console.log("Sequelize models synchronized.");
  } catch (error) {
    console.error("Sequelize model synchronization failed:", error.message);
    throw error;
  }
};

module.exports = {
  sequelize,
  connectDatabase,
  syncDatabase,
};
