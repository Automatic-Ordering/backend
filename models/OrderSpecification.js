const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

const SPEC_STATUSES = [
  "DRAFT",
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "ORDERED",
  "RECEIVED",
  "CANCELLED",
];

class OrderSpecification extends Model {}

OrderSpecification.init(
  {
    orderSpecId: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      field: "order_spec_id",
    },
    orderNumber: {
      type: DataTypes.STRING(32),
      allowNull: true,
      unique: true,
      field: "order_number",
    },
    storeId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "store_id",
    },
    orderStatus: {
      type: DataTypes.ENUM(...SPEC_STATUSES),
      allowNull: false,
      defaultValue: "DRAFT",
      field: "order_status",
    },
    requestDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "request_date",
    },
    totalAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: "total_amount",
    },
    adminId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "admin_id",
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "approved_at",
    },
    rejectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "rejected_at",
    },
    rejectionReason: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "rejection_reason",
    },
    issuedOrderNumber: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: "issued_order_number",
    },
    issuedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "issued_at",
    },
    receivedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "received_at",
    },
  },
  {
    sequelize,
    modelName: "OrderSpecification",
    tableName: "order_specifications",
  },
);

module.exports = OrderSpecification;
module.exports.SPEC_STATUSES = SPEC_STATUSES;
