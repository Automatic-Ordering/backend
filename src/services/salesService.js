const { Op } = require("sequelize");
const { sequelize } = require("../../config/database");
const { Sales, StoreInventory, Product } = require("../../models");

const registerSale = async ({
  storeId,
  productId,
  salesQuantity,
  salesDate,
}) => {
  const result = await sequelize.transaction(async (transaction) => {
    const inventory = await StoreInventory.findOne({
      where: { storeId, productId },
      transaction,
      lock: true,
    });

    if (!inventory) {
      const error = new Error("해당 점포에 등록되지 않은 상품입니다.");
      error.statusCode = 404;
      error.code = "NOT_FOUND";
      throw error;
    }

    if (inventory.currentStock < salesQuantity) {
      const error = new Error(
        `재고가 부족합니다. 현재 재고 ${inventory.currentStock}개, 판매 요청 ${salesQuantity}개.`,
      );
      error.statusCode = 409;
      error.code = "INSUFFICIENT_STOCK";
      throw error;
    }

    const remainingStock = inventory.currentStock - salesQuantity;

    await inventory.decrement("currentStock", {
      by: salesQuantity,
      transaction,
    });

    const sale = await Sales.create(
      {
        storeId,
        productId,
        salesQuantity,
        salesDate,
      },
      { transaction },
    );

    return { sale, remainingStock };
  });

  return result;
};

const getSalesHistory = async ({ storeId, from, to, page = 1, limit = 20 }) => {
  const where = { storeId };

  if (from) {
    where.salesDate = {
      ...where.salesDate,
      [Op.gte]: new Date(`${from}T00:00:00`),
    };
  }

  if (to) {
    where.salesDate = {
      ...where.salesDate,
      [Op.lte]: new Date(`${to}T23:59:59.999`),
    };
  }

  const total = await Sales.count({ where });

  const sales = await Sales.findAll({
    where,
    include: [
      {
        model: Product,
        as: "product",
        attributes: ["productId", "productName", "category"],
      },
    ],
    order: [
      ["salesDate", "DESC"],
      ["salesId", "DESC"],
    ],
    limit,
    offset: (page - 1) * limit,
  });

  return { sales, total };
};

module.exports = { registerSale, getSalesHistory };
