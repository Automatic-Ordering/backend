const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class StoreOrderSetting extends Model {}

StoreOrderSetting.init(
  {
    settingId: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      field: "setting_id",
    },
    storeId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      unique: true,
      field: "store_id",
    },
    analysisDays: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 7,
      field: "analysis_days",
    },
    safetyStockDays: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 2,
      field: "safety_stock_days",
    },
    leadTimeDays: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
      field: "lead_time_days",
    },
  },
  {
    sequelize,
    modelName: "StoreOrderSetting",
    tableName: "store_order_settings",
  },
);

module.exports = StoreOrderSetting;
