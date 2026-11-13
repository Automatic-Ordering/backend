const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class OrderSpecificationItem extends Model {}

OrderSpecificationItem.init(
  {
    orderSpecItemId: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      field: "order_spec_item_id",
    },
    orderSpecId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "order_spec_id",
    },
    productId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "product_id",
    },
    productName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "product_name",
    },
    orderQuantity: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: "order_quantity",
      validate: {
        min: 1,
      },
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: "unit_price",
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: "amount",
    },
    receivedQuantity: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: "received_quantity",
    },
  },
  {
    sequelize,
    modelName: "OrderSpecificationItem",
    tableName: "order_specification_items",
    indexes: [
      {
        unique: true,
        fields: ["order_spec_id", "product_id"],
      },
    ],
  },
);

module.exports = OrderSpecificationItem;
