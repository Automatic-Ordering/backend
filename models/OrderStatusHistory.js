const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");
const { SPEC_STATUSES } = require("./OrderSpecification");

class OrderStatusHistory extends Model {}

OrderStatusHistory.init(
  {
    historyId: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      field: "history_id",
    },
    orderSpecId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "order_spec_id",
    },
    fromStatus: {
      type: DataTypes.ENUM(...SPEC_STATUSES),
      allowNull: true,
      field: "from_status",
    },
    toStatus: {
      type: DataTypes.ENUM(...SPEC_STATUSES),
      allowNull: false,
      field: "to_status",
    },
    changedByAdminId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "changed_by_admin_id",
    },
    note: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "note",
    },
  },
  {
    sequelize,
    modelName: "OrderStatusHistory",
    tableName: "order_status_histories",
  },
);

module.exports = OrderStatusHistory;
