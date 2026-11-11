const Admin = require('./Admin');
const Store = require('./Store');
const StoreAccount = require('./StoreAccount');
const Product = require('./Product');
const Inventory = require('./Inventory');
const Sales = require('./Sales');
const Order = require('./Order');

Store.hasMany(Inventory, {
  foreignKey: 'storeId',
  sourceKey: 'storeId',
  as: 'inventories',
});

Store.hasOne(StoreAccount, {
  foreignKey: 'storeId',
  sourceKey: 'storeId',
  as: 'account',
});
StoreAccount.belongsTo(Store, {
  foreignKey: 'storeId',
  targetKey: 'storeId',
  as: 'store',
});
Inventory.belongsTo(Store, {
  foreignKey: 'storeId',
  targetKey: 'storeId',
  as: 'store',
});

Product.hasMany(Inventory, {
  foreignKey: 'productId',
  sourceKey: 'productId',
  as: 'inventories',
});
Inventory.belongsTo(Product, {
  foreignKey: 'productId',
  targetKey: 'productId',
  as: 'product',
});

Store.hasMany(Sales, {
  foreignKey: 'storeId',
  sourceKey: 'storeId',
  as: 'sales',
});
Sales.belongsTo(Store, {
  foreignKey: 'storeId',
  targetKey: 'storeId',
  as: 'store',
});

Product.hasMany(Sales, {
  foreignKey: 'productId',
  sourceKey: 'productId',
  as: 'sales',
});
Sales.belongsTo(Product, {
  foreignKey: 'productId',
  targetKey: 'productId',
  as: 'product',
});

Store.hasMany(Order, {
  foreignKey: 'storeId',
  sourceKey: 'storeId',
  as: 'orders',
});
Order.belongsTo(Store, {
  foreignKey: 'storeId',
  targetKey: 'storeId',
  as: 'store',
});

Product.hasMany(Order, {
  foreignKey: 'productId',
  sourceKey: 'productId',
  as: 'orders',
});
Order.belongsTo(Product, {
  foreignKey: 'productId',
  targetKey: 'productId',
  as: 'product',
});

module.exports = {
  Admin,
  Store,
  StoreAccount,
  Product,
  Inventory,
  Sales,
  Order,
};
