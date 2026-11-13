const express = require('express');
const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
  ValidationError,
} = require('sequelize');
const { sequelize } = require('../../config/database');
const {
  Store,
  StoreAccount,
  Inventory,
  Sales,
  Order,
} = require('../../models');
const { hashPassword, generateTemporaryPassword } = require('../utils/password');
const { generateStoreCode } = require('../utils/store-code');
const { Product } = require('../../models');
const { StoreInventory } = require('../../models');
const { getSafetyStock } = require('../utils/inventoryPolicy');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole('ADMIN'));

const serializeStore = (store) => ({
  store_id: store.storeId,
  store_code: store.storeCode,
  store_name: store.storeName,
  status: store.status,
  created_at: store.createdAt,
  updated_at: store.updatedAt,
});

const isValidStoreId = (storeId) => /^\d+$/.test(storeId) && Number(storeId) > 0;

const getStoreInputError = (body, { isCreate = false } = {}) => {
  const hasStoreCode = body.store_code !== undefined;
  const hasStoreName = body.store_name !== undefined;
  const hasPassword = body.password !== undefined;

  if (isCreate) {
    if (!hasStoreName || typeof body.store_name !== 'string' || !body.store_name.trim()) {
      return '점포명은 비어 있지 않은 문자열이어야 합니다.';
    }
  }

  if (hasStoreCode && (typeof body.store_code !== 'string' || !body.store_code.trim())) {
    return '점포 코드는 비어 있지 않은 문자열이어야 합니다.';
  }

  if (hasStoreName && (typeof body.store_name !== 'string' || !body.store_name.trim())) {
    return '점포명은 비어 있지 않은 문자열이어야 합니다.';
  }

  if (hasPassword && (typeof body.password !== 'string' || body.password.length < 8)) {
    return '비밀번호는 8자 이상이어야 합니다.';
  }

  if (hasStoreCode && body.store_code.trim().length > 32) {
    return '점포 코드는 32자 이하여야 합니다.';
  }

  return null;
};

const findUniqueStoreCode = async (transaction) => {
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateStoreCode();
    const existing = await Store.findOne({
      where: { storeCode: candidate },
      ...(transaction ? { transaction } : {}),
    });
    if (!existing) {
      return candidate;
    }
  }
  throw new Error('점포 코드 자동 생성에 실패했습니다. 다시 시도해주세요.');
};

const handleSequelizeError = (error, res, next) => {
  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({
      error: 'DUPLICATE_STORE_CODE',
      message: '점포 코드가 이미 사용 중입니다.',
    });
  }

  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: error.errors.map(({ message }) => message).join(', '),
    });
  }

  if (error instanceof ForeignKeyConstraintError) {
    return res.status(409).json({
      error: 'CONFLICT',
      message: '해당 점포가 다른 데이터에서 참조되고 있습니다.',
    });
  }

  return next(error);
};

/**
 * @openapi
 * /api/admin/stores:
 *   post:
 *     tags:
 *       - Admin Stores
 *     summary: 점포 생성
 *     description: 점포를 생성하고 점포 계정을 함께 초기화합니다. store_code가 생략되면 5자리 숫자로 자동 생성되며, password가 생략되면 Store{store_code}! 형식의 초기 비밀번호가 발급됩니다.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - store_name
 *             properties:
 *               store_name:
 *                 type: string
 *                 description: 점포명 (필수)
 *                 example: 강남점
 *               store_code:
 *                 type: string
 *                 description: 점포 코드 (미입력 시 5자리 자동 생성, 최대 32자)
 *                 example: 12345
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: 점포 초기 비밀번호 (미입력 시 Store{store_code}! 자동 생성)
 *                 example: StorePass123!
 *     responses:
 *       '201':
 *         description: 점포가 생성되었습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StoreCreateResponse'
 *       '400':
 *         description: 입력값이 올바르지 않습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: 인증 실패 (토큰 없음 또는 유효하지 않음)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 권한 부족 (관리자 권한 필요)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '409':
 *         description: 점포 코드가 중복됩니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', async (req, res, next) => {
  const inputError = getStoreInputError(req.body || {}, { isCreate: true });
  if (inputError) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: inputError,
    });
  }

  const rawStoreCode = typeof req.body?.store_code === 'string' && req.body.store_code.trim()
    ? req.body.store_code.trim()
    : null;
  const storeName = req.body.store_name.trim();

  const maxAttempts = rawStoreCode ? 1 : 5;
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const storeCode = rawStoreCode || (await findUniqueStoreCode());
      const password = typeof req.body?.password === 'string' && req.body.password
        ? req.body.password
        : generateTemporaryPassword(storeCode);

      const store = await sequelize.transaction(async (transaction) => {
        // ① 점포 레코드 생성
        const createdStore = await Store.create(
          {
            storeCode,
            storeName,
            status: 'ACTIVE',
          },
          { transaction },
        );

        // ② 점포 계정 생성
        await StoreAccount.create(
          {
            storeId: createdStore.storeId,
            passwordHash: await hashPassword(password),
            passwordChangeRequired: true,
          },
          { transaction },
        );

        // ③ 전체 상품 조회 (productId + category)
        const products = await Product.findAll({
          attributes: ['productId', 'category'],
          transaction,
        });

        // ④ 재고 행 준비 (current_stock=0, safety_stock=policy)
        const inventoryRows = products.map(p => ({
          storeId: createdStore.storeId,
          productId: p.productId,
          currentStock: 0,
          safetyStock: getSafetyStock(p.category),
        }));

        // ⑤ bulkCreate – 중복 방지를 위해 예외 처리
        await StoreInventory.bulkCreate(inventoryRows, { transaction })
          .catch(err => {
            if (err.name !== 'SequelizeUniqueConstraintError') throw err;
            // 중복이면 무시 (이미 존재)
          });

        // ⑥ 최종적으로 생성된 Store 레코드 반환
        return createdStore;
      });

      const responsePayload = serializeStore(store);
      if (!req.body?.password) {
        responsePayload.initial_password = password;
      }

      return res.status(201).json(responsePayload);
    } catch (error) {
      lastError = error;
      if (error instanceof UniqueConstraintError && !rawStoreCode && attempt < maxAttempts - 1) {
        continue;
      }
      return handleSequelizeError(error, res, next);
    }
  }

  return handleSequelizeError(lastError, res, next);
});

/**
 * @openapi
 * /api/admin/stores:
 *   get:
 *     tags:
 *       - Admin Stores
 *     summary: 전체 점포 목록 조회
 *     description: 전체 점포 목록을 최신 등록순으로 조회합니다.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 점포 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Store'
 *       '401':
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 관리자 권한 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', async (req, res, next) => {
  try {
    const stores = await Store.findAll({
      order: [['storeId', 'DESC']],
    });

    return res.json(stores.map(serializeStore));
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /api/admin/stores/{id}:
 *   get:
 *     tags:
 *       - Admin Stores
 *     summary: 특정 점포 단일 조회
 *     description: 점포 ID로 점포 상세 정보를 조회합니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 점포 ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: 점포 상세 정보
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Store'
 *       '401':
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 관리자 권한 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: 점포를 찾을 수 없습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', async (req, res, next) => {
  if (!isValidStoreId(req.params.id)) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: '점포를 찾을 수 없습니다.',
    });
  }

  try {
    const store = await Store.findByPk(req.params.id);
    if (!store) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: '점포를 찾을 수 없습니다.',
      });
    }

    return res.json(serializeStore(store));
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /api/admin/stores/{id}:
 *   patch:
 *     tags:
 *       - Admin Stores
 *     summary: 점포 정보 수정
 *     description: 점포 코드 또는 점포명을 수정합니다. 비밀번호는 이 API를 통해 변경할 수 없습니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 점포 ID
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               store_code:
 *                 type: string
 *                 description: 변경할 점포 코드 (최대 32자)
 *                 example: 54321
 *               store_name:
 *                 type: string
 *                 description: 변경할 점포명
 *                 example: 강남역삼호점
 *     responses:
 *       '200':
 *         description: 점포 정보 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Store'
 *       '400':
 *         description: 입력값이 올바르지 않거나 변경할 필드가 없습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 관리자 권한 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: 점포를 찾을 수 없습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '409':
 *         description: 점포 코드가 이미 사용 중입니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch('/:id', async (req, res, next) => {
  if (!isValidStoreId(req.params.id)) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: '점포를 찾을 수 없습니다.',
    });
  }

  if (req.body?.password !== undefined) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: '비밀번호는 비밀번호 변경 API를 통해 변경해야 합니다.',
    });
  }

  const inputError = getStoreInputError(req.body || {});
  if (inputError) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: inputError,
    });
  }

  const updates = {};
  if (req.body.store_code !== undefined) updates.storeCode = req.body.store_code.trim();
  if (req.body.store_name !== undefined) updates.storeName = req.body.store_name.trim();

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: '점포 코드 또는 점포명은 필수입니다.',
    });
  }

  try {
    const store = await Store.findByPk(req.params.id);
    if (!store) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: '점포를 찾을 수 없습니다.',
      });
    }

    await store.update(updates);
    return res.json(serializeStore(store));
  } catch (error) {
    return handleSequelizeError(error, res, next);
  }
});

/**
 * @openapi
 * /api/admin/stores/{id}/status:
 *   patch:
 *     tags:
 *       - Admin Stores
 *     summary: 점포 상태 변경 (활성화 / 이용 정지)
 *     description: 점포 상태를 ACTIVE 또는 SUSPENDED로 변경합니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 점포 ID
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, SUSPENDED]
 *                 example: SUSPENDED
 *     responses:
 *       '200':
 *         description: 상태 변경 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Store'
 *       '400':
 *         description: 상태 값이 올바르지 않습니다 (ACTIVE 또는 SUSPENDED만 가능).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 관리자 권한 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: 점포를 찾을 수 없습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch('/:id/status', async (req, res, next) => {
  if (!isValidStoreId(req.params.id)) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: '점포를 찾을 수 없습니다.',
    });
  }

  const { status } = req.body || {};
  if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: '점포 상태는 ACTIVE 또는 SUSPENDED여야 합니다.',
    });
  }

  try {
    const store = await Store.findByPk(req.params.id);
    if (!store) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: '점포를 찾을 수 없습니다.',
      });
    }

    await store.update({ status });
    return res.json(serializeStore(store));
  } catch (error) {
    return handleSequelizeError(error, res, next);
  }
});

/**
 * @openapi
 * /api/admin/stores/{id}:
 *   delete:
 *     tags:
 *       - Admin Stores
 *     summary: 점포 폐점 처리
 *     description: 점포와 관련된 재고, 매출, 발주, 계정 데이터를 영구 삭제합니다. 이용 정지(SUSPENDED) 상태인 점포만 폐점 처리할 수 있습니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 점포 ID
 *         schema:
 *           type: integer
 *     responses:
 *       '204':
 *         description: 점포와 관련 데이터가 성공적으로 영구 삭제되었습니다.
 *       '400':
 *         description: 이용 정지(SUSPENDED) 상태인 점포만 폐점 처리할 수 있습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 관리자 권한 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: 점포를 찾을 수 없습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '409':
 *         description: 참조 무결성 충돌 등으로 삭제 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:id', async (req, res, next) => {
  if (!isValidStoreId(req.params.id)) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: '점포를 찾을 수 없습니다.',
    });
  }

  try {
    const store = await Store.findByPk(req.params.id);
    if (!store) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: '점포를 찾을 수 없습니다.',
      });
    }

    if (store.status !== 'SUSPENDED') {
      return res.status(400).json({
        error: 'INVALID_STATUS',
        message: '이용 정지된 점포만 폐점 처리할 수 있습니다.',
      });
    }

    await sequelize.transaction(async (transaction) => {
      await Inventory.destroy({ where: { storeId: store.storeId }, transaction });
      await Sales.destroy({ where: { storeId: store.storeId }, transaction });
      await Order.destroy({ where: { storeId: store.storeId }, transaction });
      await StoreAccount.destroy({ where: { storeId: store.storeId }, transaction });
      await store.destroy({ transaction });
    });

    return res.status(204).send();
  } catch (error) {
    return handleSequelizeError(error, res, next);
  }
});

/**
 * @openapi
 * /api/admin/stores/{id}/password/reset:
 *   patch:
 *     tags:
 *       - Admin Stores
 *     summary: 점포 비밀번호 초기화
 *     description: 점포의 비밀번호를 초기화하고 새 임시 비밀번호를 발급합니다. 점포 생성 시와 동일한 규칙(Store{store_code}!)으로 임시 비밀번호를 생성합니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 점포 ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: 비밀번호 초기화 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     temporaryPassword:
 *                       type: string
 *       '404':
 *         description: 점포 또는 점포 계정을 찾을 수 없습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: 인증 실패
 *       '403':
 *         description: 관리자 권한 필요
 */
router.patch('/:id/password/reset', async (req, res, next) => {
  if (!isValidStoreId(req.params.id)) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: '점포를 찾을 수 없습니다.',
    });
  }

  try {
    const store = await Store.findByPk(req.params.id);
    if (!store) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: '점포를 찾을 수 없습니다.',
      });
    }

    const account = await StoreAccount.findOne({ where: { storeId: store.storeId } });
    if (!account) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: '점포 계정을 찾을 수 없습니다.',
      });
    }

    // 기존 점포 생성과 동일한 임시 비밀번호 규칙 재사용
    const temporaryPassword = generateTemporaryPassword(store.storeCode);
    const passwordHash = await hashPassword(temporaryPassword);

    await account.update({ passwordHash, passwordChangeRequired: true });

    return res.json({
      success: true,
      message: '점포 비밀번호가 초기화되었습니다.',
      data: { temporaryPassword },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
