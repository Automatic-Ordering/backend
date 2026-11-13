const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class Product extends Model {}

Product.init(
  {
    productId: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      field: "product_id",
    },
    productName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "product_name",
      validate: {
        notEmpty: true,
      },
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    leadTimeDays: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
      field: "lead_time_days",
      validate: {
        min: 1,
      },
    },
    orderUnit: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
      field: "order_unit",
      validate: {
        min: 1,
      },
    },
  },
  {
    sequelize,
    modelName: "Product",
    tableName: "products",
  },
);

module.exports = Product;
