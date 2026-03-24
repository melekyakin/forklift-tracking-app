const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Workstation = sequelize.define('Workstation', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    workstation_no: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    workstation_adi: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    durum: {
      type: DataTypes.ENUM('aktif', 'pasif'),
      defaultValue: 'aktif'
    },
    olusturma_tarihi: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'workstations',
    timestamps: false,
    underscored: false
  });

  return Workstation;
};

