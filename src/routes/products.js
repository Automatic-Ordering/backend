const express = require("express");
const { Product } = require("../../models");
const { ForeignKeyConstraintError, ValidationError } = require("sequelize");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();

const serializeProduct = (product) => ({
  product_id: product.productId,
  product_name: product.productName,
  category: product.category,
  price: Number(product.price),
  created_at: product.createdAt,
  updated_at: product.updatedAt,
});

const validateProductInput = ({
  product_name: productName,
  category,
  price,
}) => {
  if (
    typeof productName !== "string" ||
    !productName.trim() ||
    typeof category !== "string" ||
    !category.trim() ||
    price === undefined ||
    price === null ||
    !Number.isFinite(Number(price)) ||
    Number(price) < 0
  ) {
    return "상품명, 카테고리, 0 이상인 가격은 필수입니다.";
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
 *     description: 본사 공용 상품 카탈로그에 신규 상품을 등록합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - product_name
 *               - category
 *               - price
 *             properties:
 *               product_name:
 *                 type: string
 *                 example: 삼각김밥
 *               category:
 *                 type: string
 *                 example: 식품
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 example: 1500
 *     responses:
 *       '201':
 *         description: 상품이 성공적으로 등록되었습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       '400':
 *         description: 입력값이 올바르지 않습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", authenticate, requireRole("ADMIN"), async (req, res, next) => {
  const validationMessage = validateProductInput(req.body || {});
  if (validationMessage) {
    return res.status(400).json({
      error: "INVALID_INPUT",
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
        error: "INVALID_INPUT",
        message: error.errors.map(({ message }) => message).join(", "),
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
 *     description: 전체 상품 카탈로그 목록을 최신 등록순으로 조회합니다.
 *     responses:
 *       '200':
 *         description: 상품 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 */

// PATCH: 상품 정보 수정 (ADMIN 전용)
router.patch(
  "/:productId",
  authenticate,
  requireRole("ADMIN"),
  async (req, res, next) => {
    const { productId } = req.params;
    const validationMessage = validateProductInput(req.body || {});
    if (validationMessage) {
      return res
        .status(400)
        .json({ error: "INVALID_INPUT", message: validationMessage });
    }
    try {
      const product = await Product.findByPk(productId);
      if (!product) {
        return res
          .status(404)
          .json({ error: "NOT_FOUND", message: "상품을 찾을 수 없습니다." });
      }
      await product.update({
        productName: req.body.product_name?.trim(),
        category: req.body.category?.trim(),
        price: req.body.price,
      });
      return res.json(serializeProduct(product));
    } catch (error) {
      if (error instanceof ValidationError) {
        return res
          .status(400)
          .json({
            error: "INVALID_INPUT",
            message: error.errors.map(({ message }) => message).join(", "),
          });
      }
      return next(error);
    }
  },
);

// DELETE: 상품 삭제 (ADMIN 전용)
router.delete(
  "/:productId",
  authenticate,
  requireRole("ADMIN"),
  async (req, res, next) => {
    const { productId } = req.params;
    try {
      const rows = await Product.destroy({ where: { productId } });
      if (!rows) {
        return res
          .status(404)
          .json({ error: "NOT_FOUND", message: "상품을 찾을 수 없습니다." });
      }
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  },
);

router.get("/", async (req, res, next) => {
  try {
    const products = await Product.findAll({
      order: [["productId", "DESC"]],
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
 *     description: 상품 ID로 상품 정보를 조회합니다.
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         description: 상품 ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: 상품 상세 정보
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       '404':
 *         description: 상품을 찾을 수 없습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:productId", async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.productId);
    if (!product) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "상품을 찾을 수 없습니다.",
      });
    }

    return res.json(serializeProduct(product));
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /api/products/{productId}:
 *   patch:
 *     tags:
 *       - Products
 *     summary: 상품 정보 수정
 *     description: 상품의 이름, 카테고리, 가격을 수정합니다.
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         description: 상품 ID
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - product_name
 *               - category
 *               - price
 *             properties:
 *               product_name:
 *                 type: string
 *                 example: 삼각김밥(참치마요)
 *               category:
 *                 type: string
 *                 example: 식품
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 example: 1600
 *     responses:
 *       '200':
 *         description: 상품 정보가 수정되었습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       '400':
 *         description: 입력값이 올바르지 않습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: 상품을 찾을 수 없습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/:productId", async (req, res, next) => {
  const validationMessage = validateProductInput(req.body || {});
  if (validationMessage) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: validationMessage,
    });
  }

  try {
    const product = await Product.findByPk(req.params.productId);
    if (!product) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "상품을 찾을 수 없습니다.",
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
        error: "INVALID_INPUT",
        message: error.errors.map(({ message }) => message).join(", "),
      });
    }

    return next(error);
  }
});

/**
 * @openapi
 * /api/products/{productId}:
 *   delete:
 *     tags:
 *       - Products
 *     summary: 상품 삭제
 *     description: 상품 카탈로그에서 상품을 삭제합니다. 점포 재고 등 관련 데이터가 참조하고 있는 경우 삭제할 수 없습니다.
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         description: 상품 ID
 *         schema:
 *           type: integer
 *     responses:
 *       '204':
 *         description: 상품이 성공적으로 삭제되었습니다.
 *       '404':
 *         description: 상품을 찾을 수 없습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '409':
 *         description: 관련 데이터(재고 등)가 있는 상품은 삭제할 수 없습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:productId", async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.productId);
    if (!product) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "상품을 찾을 수 없습니다.",
      });
    }

    await product.destroy();
    return res.status(204).send();
  } catch (error) {
    if (error instanceof ForeignKeyConstraintError) {
      return res.status(409).json({
        error: "CONFLICT",
        message: "관련 데이터가 있는 상품은 삭제할 수 없습니다.",
      });
    }

    return next(error);
  }
});

module.exports = router;
