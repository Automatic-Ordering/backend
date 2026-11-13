const Admin = require("./Admin");
const Store = require("./Store");
const StoreAccount = require("./StoreAccount");
const Product = require("./Product");
const Inventory = require("./Inventory");
const Sales = require("./Sales");
const Order = require("./Order");
const StoreInventory = require("./StoreInventory");
const OrderSpecification = require("./OrderSpecification");
const OrderSpecificationItem = require("./OrderSpecificationItem");
const OrderStatusHistory = require("./OrderStatusHistory");
const StoreOrderSetting = require("./StoreOrderSetting");

// Associations
Store.hasMany(Inventory, {
  foreignKey: "storeId",
  sourceKey: "storeId",
  as: "inventories",
});

Store.hasOne(StoreAccount, {
  foreignKey: "storeId",
  sourceKey: "storeId",
  as: "account",
});

StoreAccount.belongsTo(Store, {
  foreignKey: "storeId",
  targetKey: "storeId",
  as: "store",
});

Inventory.belongsTo(Store, {
  foreignKey: "storeId",
  targetKey: "storeId",
  as: "store",
});

Product.hasMany(Inventory, {
  foreignKey: "productId",
  sourceKey: "productId",
  as: "inventories",
});

Inventory.belongsTo(Product, {
  foreignKey: "productId",
  targetKey: "productId",
  as: "product",
});

// StoreInventory associations (optional but helpful)
Store.hasMany(StoreInventory, {
  foreignKey: "storeId",
  sourceKey: "storeId",
  as: "storeInventories",
});

Product.hasMany(StoreInventory, {
  foreignKey: "productId",
  sourceKey: "productId",
  as: "storeInventories",
});

StoreInventory.belongsTo(Store, {
  foreignKey: "storeId",
  targetKey: "storeId",
  as: "store",
});

StoreInventory.belongsTo(Product, {
  foreignKey: "productId",
  targetKey: "productId",
  as: "product",
});

Store.hasMany(Sales, {
  foreignKey: "storeId",
  sourceKey: "storeId",
  as: "sales",
});

Sales.belongsTo(Store, {
  foreignKey: "storeId",
  targetKey: "storeId",
  as: "store",
});

Product.hasMany(Sales, {
  foreignKey: "productId",
  sourceKey: "productId",
  as: "sales",
});

Sales.belongsTo(Product, {
  foreignKey: "productId",
  targetKey: "productId",
  as: "product",
});

Store.hasMany(Order, {
  foreignKey: "storeId",
  sourceKey: "storeId",
  as: "orders",
});

Order.belongsTo(Store, {
  foreignKey: "storeId",
  targetKey: "storeId",
  as: "store",
});

Product.hasMany(Order, {
  foreignKey: "productId",
  sourceKey: "productId",
  as: "orders",
});

Order.belongsTo(Product, {
  foreignKey: "productId",
  targetKey: "productId",
  as: "product",
});

// Order specification associations (발주 명세서)
Store.hasMany(OrderSpecification, {
  foreignKey: "storeId",
  sourceKey: "storeId",
  as: "orderSpecifications",
});

OrderSpecification.belongsTo(Store, {
  foreignKey: "storeId",
  targetKey: "storeId",
  as: "store",
});

OrderSpecification.hasMany(OrderSpecificationItem, {
  foreignKey: "orderSpecId",
  as: "items",
});

OrderSpecificationItem.belongsTo(OrderSpecification, {
  foreignKey: "orderSpecId",
  as: "orderSpecification",
});

OrderSpecification.hasMany(OrderStatusHistory, {
  foreignKey: "orderSpecId",
  as: "statusHistories",
});

OrderStatusHistory.belongsTo(OrderSpecification, {
  foreignKey: "orderSpecId",
  as: "orderSpecification",
});

// 점포별 자동 발주 기준 설정 (점포당 1행)
Store.hasOne(StoreOrderSetting, {
  foreignKey: "storeId",
  sourceKey: "storeId",
  as: "orderSetting",
});

StoreOrderSetting.belongsTo(Store, {
  foreignKey: "storeId",
  targetKey: "storeId",
  as: "store",
});

module.exports = {
  Admin,
  Store,
  StoreAccount,
  Product,
  Inventory,
  Sales,
  Order,
  StoreInventory,
  OrderSpecification,
  OrderSpecificationItem,
  OrderStatusHistory,
  StoreOrderSetting,
};
