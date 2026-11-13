const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class Admin extends Model {}

Admin.init(
  {
    adminId: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      field: "admin_id",
    },
    adminUsername: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: "admin_username",
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "password_hash",
    },
  },
  {
    sequelize,
    modelName: "Admin",
    tableName: "admins",
  },
);

module.exports = Admin;
