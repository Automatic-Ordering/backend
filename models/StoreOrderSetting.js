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
    analysisPeriodDays: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 120,
      field: "analysis_period_days",
    },
    movingAverageDays: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 7,
      field: "moving_average_days",
    },
    movingAverageWeight: {
      type: DataTypes.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: "0.400",
      field: "moving_average_weight",
    },
    sameWeekdayWeight: {
      type: DataTypes.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: "0.600",
      field: "same_weekday_weight",
    },
    serviceFactor: {
      type: DataTypes.DECIMAL(6, 3),
      allowNull: false,
      defaultValue: "1.650",
      field: "service_factor",
    },
    forecastPeriodDays: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 3,
      field: "forecast_period_days",
    },
  },
  {
    sequelize,
    modelName: "StoreOrderSetting",
    tableName: "store_order_settings",
  },
);

module.exports = StoreOrderSetting;
