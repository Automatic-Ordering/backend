const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class Inventory extends Model {}

Inventory.init(
  {
    inventoryId: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      field: 'inventory_id',
    },
    storeId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'store_id',
    },
    productId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'product_id',
    },
    stockQuantity: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'stock_quantity',
    },
    safetyStock: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'safety_stock',
    },
  },
  {
    sequelize,
    modelName: 'Inventory',
    tableName: 'inventories',
    indexes: [
      {
        unique: true,
        fields: ['store_id', 'product_id'],
      },
    ],
  },
);

module.exports = Inventory;
