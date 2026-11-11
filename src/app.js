require('dotenv').config();

const express = require('express');
const path = require('node:path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { connectDatabase, pool } = require('./config/database');
const { connectDatabase: connectSequelize, syncDatabase } = require('../config/database');
require('../models');
const authRoutes = require('./routes/auth');
const adminAuthRoutes = require('./routes/admin-auth');
const adminStoreRoutes = require('./routes/admin-stores');
const v1AdminStoreRoutes = require('./routes/v1-admin-stores');
const productRoutes = require('./routes/products');

const app = express();
const port = Number(process.env.PORT) || 3000;
const serverUrl = process.env.SERVER_URL?.trim();

if (!serverUrl) {
  throw new Error('SERVER_URL environment variable is required.');
}

let parsedServerUrl;

try {
  parsedServerUrl = new URL(serverUrl);
} catch {
  throw new Error('SERVER_URL must be a valid URL.');
}

if (!['http:', 'https:'].includes(parsedServerUrl.protocol)) {
  throw new Error('SERVER_URL must use http or https.');
}

const swaggerServerUrl = serverUrl.replace(/\/+$/, '');
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || 'http://localhost:5173,https://store.moonlights.dev')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;

  if (requestOrigin && allowedOrigins.has(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] || 'Content-Type, Authorization',
    );
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(requestOrigin && allowedOrigins.has(requestOrigin) ? 204 : 403);
  }

  return next();
});
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/stores', adminStoreRoutes);
app.use('/api/v1/admin/stores', v1AdminStoreRoutes);
app.use('/api/products', productRoutes);

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: '편의점 자동 발주 시스템 API',
    version: '1.0.0',
    description:
      '편의점 자동 발주 시스템 백엔드 API 문서입니다. 관리자 인증, 점포 생성 및 점포 인증 API를 제공합니다.',
  },
  servers: [
    {
      url: swaggerServerUrl,
      description: 'SERVER_URL',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      LoginResponse: {
        type: 'object',
        required: ['token', 'token_type'],
        properties: {
          token: {
            type: 'string',
            description: '8시간 동안 유효한 JWT 액세스 토큰입니다.',
          },
          token_type: {
            type: 'string',
            enum: ['Bearer'],
            example: 'Bearer',
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['error', 'message'],
        properties: {
          error: {
            type: 'string',
            example: 'INVALID_INPUT',
          },
          message: {
            type: 'string',
            example: 'store_code and password are required.',
          },
        },
      },
    },
  },
};

const swaggerSpec = swaggerJsdoc({
  definition: swaggerDefinition,
  apis: [__filename, path.join(__dirname, 'routes/*.js')],
});

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
    },
  }),
);

/**
 * @openapi
 * /health:
 *   get:
 *     tags:
 *       - Sample
 *     summary: 서버 상태 확인
 *     description: 서버와 Swagger UI의 동작 상태를 확인합니다.
 *     parameters:
 *       - in: query
 *         name: verbose
 *         required: false
 *         description: true이면 응답에 샘플 메시지를 포함합니다.
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       '200':
 *         description: 서버가 정상적으로 실행 중입니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             examples:
 *               basic:
 *                 summary: 기본 정상 응답
 *                 value:
 *                   status: ok
 *                   timestamp: '2026-11-09T00:00:00.000Z'
 *               verbose:
 *                 summary: verbose 정상 응답
 *                 value:
 *                   status: ok
 *                   timestamp: '2026-11-09T00:00:00.000Z'
 *                   message: Swagger 샘플 API가 정상적으로 동작합니다.
 *       '400':
 *         description: verbose 파라미터 형식이 올바르지 않습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: INVALID_PARAMETER
 *               message: verbose must be true or false.
 *
 * components:
 *   schemas:
 *     HealthResponse:
 *       type: object
 *       required:
 *         - status
 *         - timestamp
 *       properties:
 *         status:
 *           type: string
 *           example: ok
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: '2026-11-09T00:00:00.000Z'
 *         message:
 *           type: string
 *           description: verbose=true일 때만 포함됩니다.
 *           example: Swagger 샘플 API가 정상적으로 동작합니다.
 *     ErrorResponse:
 *       type: object
 *       required:
 *         - error
 *         - message
 *       properties:
 *         error:
 *           type: string
 *           example: INVALID_PARAMETER
 *         message:
 *           type: string
 *           example: verbose must be true or false.
 */
app.get('/health', (req, res) => {
  const { verbose } = req.query;

  if (verbose !== undefined && verbose !== 'true' && verbose !== 'false') {
    return res.status(400).json({
      error: 'INVALID_PARAMETER',
      message: 'verbose는 true 또는 false여야 합니다.',
    });
  }

  const response = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };

  if (verbose === 'true') {
    response.message = 'Swagger 샘플 API가 정상적으로 동작합니다.';
  }

  return res.status(200).json(response);
});

/**
 * @openapi
 * /health/db:
 *   get:
 *     tags:
 *       - Health
 *     summary: 데이터베이스 연결 상태 확인
 *     responses:
 *       '200':
 *         description: 데이터베이스 연결이 정상입니다.
 *       '503':
 *         description: 데이터베이스에 연결할 수 없습니다.
 */
app.get('/health/db', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    return res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database health check failed:', error.message);

    return res.status(503).json({
      status: 'error',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/api-docs.json', (req, res) => {
  res.json(swaggerSpec);
});

app.use((error, req, res, next) => {
  console.error('Unhandled request error:', error.message);
  return res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: '예상하지 못한 서버 오류가 발생했습니다.',
  });
});

if (require.main === module) {
  connectSequelize()
    .then(syncDatabase)
    .then(() => connectDatabase())
    .then(() => {
      app.listen(port, () => {
        console.log(`Server is running at ${serverUrl}`);
        console.log(`Swagger UI is available at ${serverUrl}/api-docs`);
      });
    })
    .catch(() => {
      process.exitCode = 1;
    });
}

module.exports = { app, swaggerSpec };
