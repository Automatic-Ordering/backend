const express = require("express");
const { Product, Store, StoreInventory } = require("../../models");
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
 *     description: 본사 공용 상품 카탈로그에 신규 상품을 등록하고 모든 점포의 초기 재고(0개)에 자동 연동합니다.
 */
router.post("/", authenticate, requireRole("ADMIN"), async (req, res, next) => {
  const validationMessage = validateProductInput(req.body || {});
  if (validationMessage) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: validationMessage,
    });
  }

  const t = await Product.sequelize.transaction();
  try {
    // 1. 본사 공용 상품 등록
    const product = await Product.create(
      {
        productName: req.body.product_name.trim(),
        category: req.body.category.trim(),
        price: req.body.price,
      },
      { transaction: t },
    );

    // 2. 등록된 모든 점포에 초기 재고(0개) 자동 생성하여 점포 화면에 즉시 노출
    const stores = await Store.findAll({
      attributes: ["storeId"],
      transaction: t,
    });

    if (stores.length > 0) {
      await StoreInventory.bulkCreate(
        stores.map((store) => ({
          storeId: store.storeId,
          productId: product.productId,
          currentStock: 0,
          safetyStock: 0,
        })),
        {
          transaction: t,
          ignoreDuplicates: true,
        },
      );
    }

    await t.commit();
    return res.status(201).json(serializeProduct(product));
  } catch (error) {
    await t.rollback();
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
 */
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
 *     summary: 상품 정보 수정 (ADMIN 전용)
 */
router.patch(
  "/:productId",
  authenticate,
  requireRole("ADMIN"),
  async (req, res, next) => {
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
  },
);

/**
 * @openapi
 * /api/products/{productId}:
 *   delete:
 *     tags:
 *       - Products
 *     summary: 상품 삭제 (ADMIN 전용)
 */
router.delete(
  "/:productId",
  authenticate,
  requireRole("ADMIN"),
  async (req, res, next) => {
    const { productId } = req.params;
    const t = await Product.sequelize.transaction();
    try {
      const product = await Product.findByPk(productId, { transaction: t });
      if (!product) {
        await t.rollback();
        return res.status(404).json({
          error: "NOT_FOUND",
          message: "상품을 찾을 수 없습니다.",
        });
      }

      // 재고가 0개인 미사용 초기 재고 레코드는 함께 정리 후 상품 삭제
      await StoreInventory.destroy({
        where: { productId, currentStock: 0 },
        transaction: t,
      });

      await product.destroy({ transaction: t });
      await t.commit();
      return res.status(204).send();
    } catch (error) {
      await t.rollback();
      if (error instanceof ForeignKeyConstraintError) {
        return res.status(409).json({
          error: "CONFLICT",
          message: "재고 또는 발주/판매 이력이 있는 상품은 삭제할 수 없습니다.",
        });
      }

      return next(error);
    }
  },
);

/**
 * @openapi
 * /api/store/products/{productId}/safety_stock:
 *   patch:
 *     tags:
 *       - Store Products
 *     summary: 상품 안전 재고 수량 수정 (STORE 전용)
 */
router.patch(
  "/:productId/safety_stock",
  authenticate,
  requireRole("STORE"),
  async (req, res, next) => {
    const { productId } = req.params;
    const { safety_stock } = req.body;

    if (safety_stock === undefined || safety_stock === null) {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "safety_stock는 필수 입력값입니다.",
      });
    }

    if (!Number.isInteger(safety_stock) || safety_stock < 0) {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "safety_stock는 0 이상의 정수여야 합니다.",
      });
    }

    try {
      const inventory = await StoreInventory.findOne({
        where: { storeId: req.user.storeId, productId },
        include: [{ model: Product, as: "product" }],
      });

      if (!inventory) {
        return res.status(404).json({
          error: "NOT_FOUND",
          message: "해당 점포의 상품 재고가 등록되어 있지 않습니다.",
        });
      }

      await inventory.update({ safetyStock: safety_stock });
      return res.json({ safety_stock: safety_stock });
    } catch (error) {
      return next(error);
    }
  },
);

module.exports = router;