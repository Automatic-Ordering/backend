require('dotenv').config();

const mysql = require('mysql2/promise');

const databaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'convenience_store',
};

const pool = mysql.createPool({
  ...databaseConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const connectDatabase = async () => {
  let connection;

  try {
    connection = await pool.getConnection();
    console.log(`Database connected: ${databaseConfig.database}`);
  } catch (error) {
    console.error('Database connection failed:', error.message);
    throw error;
  } finally {
    connection?.release();
  }
};

module.exports = {
  pool,
  connectDatabase,
};
