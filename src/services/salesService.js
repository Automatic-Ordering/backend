const { Op } = require("sequelize");
const { sequelize } = require("../../config/database");
const { Sales, Product } = require("../../models");
const { decreaseStock } = require("./inventoryService");

const registerSale = async ({
  storeId,
  productId,
  salesQuantity,
  salesDate,
}) => {
  const result = await sequelize.transaction(async (transaction) => {
    const inventory = await decreaseStock({
      storeId,
      productId,
      quantity: salesQuantity,
      transaction,
    });
    const remainingStock = inventory.currentStock - salesQuantity;

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
