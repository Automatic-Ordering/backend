const { StoreInventory } = require("../../models");
const { createHttpError } = require("../utils/httpError");

const findInventoryForUpdate = async (
  storeId,
  productId,
  transaction,
) => {
  const inventory = await StoreInventory.findOne({
    where: { storeId, productId },
    transaction,
    lock: true,
  });
  if (!inventory) {
    throw createHttpError(404, "NOT_FOUND", "해당 점포에 등록되지 않은 상품입니다.");
  }
  return inventory;
};

const increaseStock = async ({
  storeId,
  productId,
  quantity,
  transaction,
}) => {
  const inventory = await findInventoryForUpdate(storeId, productId, transaction);
  await inventory.increment("currentStock", { by: quantity, transaction });
  return inventory;
};

const decreaseStock = async ({
  storeId,
  productId,
  quantity,
  transaction,
}) => {
  const inventory = await findInventoryForUpdate(storeId, productId, transaction);
  if (inventory.currentStock < quantity) {
    throw createHttpError(
      409,
      "INSUFFICIENT_STOCK",
      `재고가 부족합니다. 현재 재고 ${inventory.currentStock}개, 판매 요청 ${quantity}개.`,
    );
  }
  await inventory.decrement("currentStock", { by: quantity, transaction });
  return inventory;
};

module.exports = { increaseStock, decreaseStock };
