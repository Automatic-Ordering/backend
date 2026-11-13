const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class Order extends Model {}

Order.init(
  {
    orderId: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      field: "order_id",
    },
    storeId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "store_id",
    },
    productId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "product_id",
    },
    orderQuantity: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: "order_quantity",
    },
    orderStatus: {
      type: DataTypes.ENUM("PENDING", "ORDERED", "COMPLETED", "CANCELLED"),
      allowNull: false,
      defaultValue: "PENDING",
      field: "order_status",
    },
  },
  {
    sequelize,
    modelName: "Order",
    tableName: "orders",
  },
);

module.exports = Order;
