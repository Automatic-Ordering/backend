const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class StoreAccount extends Model {}

StoreAccount.init(
  {
    accountId: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      field: 'account_id',
    },
    storeId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      unique: true,
      field: 'store_id',
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'password_hash',
    },
    passwordChangeRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'password_change_required',
    },
  },
  {
    sequelize,
    modelName: 'StoreAccount',
    tableName: 'store_accounts',
  },
);

module.exports = StoreAccount;
