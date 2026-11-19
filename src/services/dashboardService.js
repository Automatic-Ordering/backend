const { Op } = require("sequelize");
const { sequelize } = require("../../config/database");
const { Sales, Product, StoreInventory } = require("../../models");

const formatDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getDashboardSummary = async (storeId) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const sevenDaysStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  // 1. 오늘 매출 금액 & 판매 건수 (Product.price * sales_quantity)
  const todaySalesRows = await Sales.findAll({
    where: {
      storeId,
      salesDate: {
        [Op.gte]: todayStart,
        [Op.lt]: tomorrowStart,
      },
    },
    include: [
      {
        model: Product,
        as: "product",
        attributes: ["price"],
        required: false,
      },
    ],
    attributes: ["salesQuantity"],
    raw: true,
    nest: true,
  });

  const todaySalesCount = todaySalesRows.length;
  const todaySalesAmount = todaySalesRows.reduce((sum, row) => {
    const qty = Number(row.salesQuantity ?? row.sales_quantity ?? 0);
    const price = Number(row.product?.price ?? 0);
    return sum + qty * price;
  }, 0);

  // 2. 최근 7일 전체 판매 내역 조회 (일별 매출 + 상품별 집계 + 7일 누적 매출 동시 계산)
  const recent7dRows = await Sales.findAll({
    where: {
      storeId,
      salesDate: {
        [Op.gte]: sevenDaysStart,
        [Op.lt]: tomorrowStart,
      },
    },
    include: [
      {
        model: Product,
        as: "product",
        attributes: ["productId", "productName", "category", "price"],
        required: false,
      },
    ],
    attributes: ["productId", "salesQuantity", "salesDate"],
    raw: true,
    nest: true,
  });

  // 최근 7일 날짜 키 초기화 (판매 없는 날도 0원으로 표시)
  const dailyMap = {};
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dailyMap[formatDateKey(d)] = 0;
  }

  let recent7dSalesAmount = 0;
  const productAggMap = {};

  recent7dRows.forEach((row) => {
    const qty = Number(row.salesQuantity ?? row.sales_quantity ?? 0);
    const price = Number(row.product?.price ?? 0);
    const amount = qty * price;
    const rawDate = row.salesDate ?? row.sales_date;
    const dateKey = rawDate ? formatDateKey(new Date(rawDate)) : null;

    recent7dSalesAmount += amount;
    if (dateKey && Object.prototype.hasOwnProperty.call(dailyMap, dateKey)) {
      dailyMap[dateKey] += amount;
    }

    const pid = row.productId ?? row.product_id;
    if (!productAggMap[pid]) {
      productAggMap[pid] = {
        product_id: pid,
        product_name: row.product?.productName ?? row.product?.product_name ?? "알 수 없음",
        category: row.product?.category ?? "미분류",
        sold_quantity: 0,
        sales_amount: 0,
      };
    }
    productAggMap[pid].sold_quantity += qty;
    productAggMap[pid].sales_amount += amount;
  });

  const dailySales7d = Object.entries(dailyMap).map(([date, amount]) => ({
    date,
    amount,
  }));

  const topProducts7d = Object.values(productAggMap)
    .sort((a, b) => b.sold_quantity - a.sold_quantity)
    .slice(0, 5);

  // 3. 재고 부족 품목 수 & 권장 발주 품목 수 (max(0, recent_7d_sales + safety_stock - current_stock) >= 1)
  const inventoryItems = await StoreInventory.findAll({
    where: { storeId },
    attributes: ["productId", "currentStock", "safetyStock"],
    raw: true,
  });

  let lowStockCount = 0;
  let recommendedOrderCount = 0;

  inventoryItems.forEach((inv) => {
    const pid = inv.productId ?? inv.product_id;
    const currentStock = Number(inv.currentStock ?? inv.current_stock ?? 0);
    const safetyStock = Number(inv.safetyStock ?? inv.safety_stock ?? 0);
    const recent7dQty = productAggMap[pid]?.sold_quantity ?? 0;

    if (currentStock < safetyStock) {
      lowStockCount += 1;
    }

    const recommendedQty = Math.max(0, recent7dQty + safetyStock - currentStock);
    if (recommendedQty >= 1) {
      recommendedOrderCount += 1;
    }
  });

  return {
    today_sales_amount: todaySalesAmount,
    today_sales_count: todaySalesCount,
    recent_7d_sales_amount: recent7dSalesAmount,
    daily_sales_7d: dailySales7d,
    top_products_7d: topProducts7d,
    low_stock_count: lowStockCount,
    recommended_order_count: recommendedOrderCount,
  };
};

module.exports = { getDashboardSummary };