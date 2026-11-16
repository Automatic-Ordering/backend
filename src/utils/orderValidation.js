const MAX_ORDER_ITEMS = 500;
const { createHttpError } = require("./httpError");

const validateItemList = (
  items,
  {
    emptyMessage,
    quantityField = "quantity",
    minQuantity = 1,
    maxItems = MAX_ORDER_ITEMS,
  },
) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw createHttpError(400, "INVALID_INPUT", emptyMessage);
  }
  if (maxItems !== undefined && items.length > maxItems) {
    throw createHttpError(
      400,
      "INVALID_INPUT",
      `items는 한 번에 최대 ${maxItems}개까지 발주할 수 있습니다.`,
    );
  }

  const seenProductIds = new Set();
  return items.map((item, index) => {
    const productId = Number(item?.product_id);
    const quantity = Number(item?.[quantityField]);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw createHttpError(
        400,
        "INVALID_INPUT",
        `items[${index}].product_id는 1 이상의 정수여야 합니다.`,
      );
    }
    if (!Number.isInteger(quantity) || quantity < minQuantity) {
      const quantityDescription =
        minQuantity === 0 ? "0 이상의 정수" : "1 이상의 정수";
      throw createHttpError(
        400,
        "INVALID_INPUT",
        `items[${index}].${quantityField}는 ${quantityDescription}여야 합니다.`,
      );
    }
    if (seenProductIds.has(productId)) {
      throw createHttpError(
        400,
        "INVALID_INPUT",
        `중복된 상품이 포함되어 있습니다. (product_id=${productId})`,
      );
    }
    seenProductIds.add(productId);
    return { productId, [quantityField]: quantity };
  });
};

const validateOrderItems = (items, options = {}) =>
  validateItemList(items, {
    emptyMessage: "발주 항목(items)은 1개 이상의 배열이어야 합니다.",
    ...options,
  });

const validateConfirmItems = (items) =>
  validateItemList(items, {
    emptyMessage: "발주할 상품 목록(items)이 비어 있거나 올바르지 않습니다.",
  }).map(({ productId, quantity }) => ({ productId, quantity }));

const validateReceivedItems = (items) =>
  validateItemList(items, {
    emptyMessage: "입고 수량 목록(items)은 1개 이상의 배열이어야 합니다.",
    quantityField: "received_quantity",
    minQuantity: 0,
    maxItems: undefined,
  }).map(({ productId, received_quantity: receivedQuantity }) => ({
    productId,
    receivedQuantity,
  }));

module.exports = {
  MAX_ORDER_ITEMS,
  validateOrderItems,
  validateConfirmItems,
  validateReceivedItems,
};
