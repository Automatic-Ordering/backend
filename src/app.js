require('dotenv').config();

const express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: '편의점 자동 발주 시스템 API',
    version: '1.0.0',
    description:
      '편의점 자동 발주 시스템 백엔드 API 문서입니다. 현재 프로젝트에 구현된 비즈니스 API가 없으므로, 아래 상태 확인 API는 Swagger UI 동작 검증용 샘플입니다.',
  },
  servers: [
    {
      url: process.env.SERVER_URL || `http://localhost:${port}`,
      description: '로컬 개발 서버',
    },
  ],
};

const swaggerSpec = swaggerJsdoc({
  definition: swaggerDefinition,
  apis: [__filename],
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
 *     summary: 서버 상태 확인 (샘플)
 *     description: |
 *       Swagger UI의 API 실행 기능을 확인하기 위한 샘플 엔드포인트입니다.
 *       실제 발주, 상품, 재고 API는 아직 구현되어 있지 않습니다.
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
      message: 'verbose must be true or false.',
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

app.get('/api-docs.json', (req, res) => {
  res.json(swaggerSpec);
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`Swagger UI is available at http://localhost:${port}/api-docs`);
  });
}

module.exports = { app, swaggerSpec };
