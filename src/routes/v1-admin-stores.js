const express = require('express');
const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
  ValidationError,
} = require('sequelize');
const { sequelize } = require('../../config/database');
const { Store, StoreAccount } = require('../../models');
const { hashPassword } = require('../utils/password');
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

const getStoreInputError = (body, { requireAll = false } = {}) => {
  const hasStoreCode = body.store_code !== undefined;
  const hasStoreName = body.store_name !== undefined;
  const hasPassword = body.password !== undefined;

  if (requireAll && (!hasStoreCode || !hasStoreName || !hasPassword)) {
    return '점포 코드, 점포명, 비밀번호는 필수입니다.';
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
 * /api/v1/admin/stores:
 *   post:
 *     tags:
 *       - Admin Stores
 *     summary: 점포 생성
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [store_code, store_name, password]
 *             properties:
 *               store_code:
 *                 type: string
 *                 example: STORE001
 *               store_name:
 *                 type: string
 *                 example: 강남점
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       '201':
 *         description: 점포가 생성되었습니다.
 *       '400':
 *         description: 입력값이 올바르지 않습니다.
 *       '409':
 *         description: 점포 코드가 중복됩니다.
 *   get:
 *     tags:
 *       - Admin Stores
 *     summary: 전체 점포 조회
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 점포 목록
 * /api/v1/admin/stores/{id}:
 *   get:
 *     tags:
 *       - Admin Stores
 *     summary: 특정 점포 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: 점포 정보
 *       '404':
 *         description: 점포를 찾을 수 없습니다.
 *   patch:
 *     tags:
 *       - Admin Stores
 *     summary: 점포 정보 수정
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
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
 *               store_name:
 *                 type: string
 *     responses:
 *       '200':
 *         description: 점포 정보가 수정되었습니다.
 *       '404':
 *         description: 점포를 찾을 수 없습니다.
 *   delete:
 *     tags:
 *       - Admin Stores
 *     summary: 점포 비활성화
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: 점포가 INACTIVE 상태로 변경되었습니다.
 *       '404':
 *         description: 점포를 찾을 수 없습니다.
 */
router.post('/', async (req, res, next) => {
  const inputError = getStoreInputError(req.body || {}, { requireAll: true });
  if (inputError) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: inputError,
    });
  }

  try {
    const store = await sequelize.transaction(async (transaction) => {
      const createdStore = await Store.create(
        {
          storeCode: req.body.store_code.trim(),
          storeName: req.body.store_name.trim(),
          status: 'ACTIVE',
        },
        { transaction },
      );

      await StoreAccount.create(
        {
          storeId: createdStore.storeId,
          passwordHash: await hashPassword(req.body.password),
          passwordChangeRequired: true,
        },
        { transaction },
      );

      return createdStore;
    });

    return res.status(201).json(serializeStore(store));
  } catch (error) {
    return handleSequelizeError(error, res, next);
  }
});

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

    if (store.status === 'INACTIVE') {
      return res.json(serializeStore(store));
    }

    await store.update({ status: 'INACTIVE' });
    return res.json(serializeStore(store));
  } catch (error) {
    return handleSequelizeError(error, res, next);
  }
});

module.exports = router;
