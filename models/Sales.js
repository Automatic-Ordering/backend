const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class Sales extends Model {}

Sales.init(
  {
    salesId: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      field: 'sales_id',
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
    salesQuantity: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'sales_quantity',
    },
    salesDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'sales_date',
    },
  },
  {
    sequelize,
    modelName: 'Sales',
    tableName: 'sales',
  },
);

module.exports = Sales;
