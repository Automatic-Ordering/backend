const express = require('express');
const { ForeignKeyConstraintError, ValidationError } = require('sequelize');
const { Product } = require('../../models');

const router = express.Router();

const serializeProduct = (product) => ({
  product_id: product.productId,
  product_name: product.productName,
  category: product.category,
  price: Number(product.price),
  created_at: product.createdAt,
  updated_at: product.updatedAt,
});

const validateProductInput = ({ product_name: productName, category, price }) => {
  if (
    typeof productName !== 'string' ||
    !productName.trim() ||
    typeof category !== 'string' ||
    !category.trim() ||
    price === undefined ||
    price === null ||
    !Number.isFinite(Number(price)) ||
    Number(price) < 0
  ) {
    return '상품명, 카테고리, 0 이상인 가격은 필수입니다.';
  }

  return null;
};

/**
 * @openapi
 * /api/products:
 *   post:
 *     tags:
 *       - Products
 *     summary: 상품 등록
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [product_name, category, price]
 *             properties:
 *               product_name:
 *                 type: string
 *               category:
 *                 type: string
 *               price:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       '201':
 *         description: 상품이 등록되었습니다.
 *       '400':
 *         description: 입력값이 올바르지 않습니다.
 */
router.post('/', async (req, res, next) => {
  const validationMessage = validateProductInput(req.body || {});
  if (validationMessage) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: validationMessage,
    });
  }

  try {
    const product = await Product.create({
      productName: req.body.product_name.trim(),
      category: req.body.category.trim(),
      price: req.body.price,
    });

    return res.status(201).json(serializeProduct(product));
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: error.errors.map(({ message }) => message).join(', '),
      });
    }

    return next(error);
  }
});

/**
 * @openapi
 * /api/products:
 *   get:
 *     tags:
 *       - Products
 *     summary: 상품 전체 조회
 *     responses:
 *       '200':
 *         description: 상품 목록
 */
router.get('/', async (req, res, next) => {
  try {
    const products = await Product.findAll({
      order: [['productId', 'DESC']],
    });

    return res.json(products.map(serializeProduct));
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /api/products/{productId}:
 *   get:
 *     tags:
 *       - Products
 *     summary: 상품 단일 조회
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: 상품 정보
 *       '404':
 *         description: 상품을 찾을 수 없습니다.
 */
router.get('/:productId', async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.productId);
    if (!product) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: '상품을 찾을 수 없습니다.',
      });
    }

    return res.json(serializeProduct(product));
  } catch (error) {
    return next(error);
  }
});

router.patch('/:productId', async (req, res, next) => {
  const validationMessage = validateProductInput(req.body || {});
  if (validationMessage) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: validationMessage,
    });
  }

  try {
    const product = await Product.findByPk(req.params.productId);
    if (!product) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: '상품을 찾을 수 없습니다.',
      });
    }

    await product.update({
      productName: req.body.product_name.trim(),
      category: req.body.category.trim(),
      price: req.body.price,
    });

    return res.json(serializeProduct(product));
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: error.errors.map(({ message }) => message).join(', '),
      });
    }

    return next(error);
  }
});

router.delete('/:productId', async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.productId);
    if (!product) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: '상품을 찾을 수 없습니다.',
      });
    }

    await product.destroy();
    return res.status(204).send();
  } catch (error) {
    if (error instanceof ForeignKeyConstraintError) {
      return res.status(409).json({
        error: 'CONFLICT',
        message: '관련 데이터가 있는 상품은 삭제할 수 없습니다.',
      });
    }

    return next(error);
  }
});

module.exports = router;
