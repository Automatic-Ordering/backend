const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class StoreInventory extends Model {}

StoreInventory.init(
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
    currentStock: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'current_stock',
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
    modelName: 'StoreInventory',
    tableName: 'store_inventories',
    indexes: [
      {
        unique: true,
        fields: ['store_id', 'product_id'],
      },
    ],
  },
);

module.exports = StoreInventory;
