const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class Store extends Model {}

Store.init(
  {
    storeId: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      field: "store_id",
    },
    storeCode: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
      field: "store_code",
    },
    storeName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "store_name",
    },
    status: {
      type: DataTypes.ENUM("ACTIVE", "SUSPENDED", "INACTIVE"),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
  },
  {
    sequelize,
    modelName: "Store",
    tableName: "stores",
  },
);

module.exports = Store;
