const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ForkliftciWorkstation = sequelize.define('ForkliftciWorkstation', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    forkliftci_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'kullanicilar',
        key: 'id'
      }
    },
    workstation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'workstations',
        key: 'id'
      }
    },
    olusturma_tarihi: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'forkliftci_workstations',
    timestamps: false,
    underscored: false,
    indexes: [
      {
        unique: true,
        fields: ['forkliftci_id', 'workstation_id']
      }
    ]
  });

  return ForkliftciWorkstation;
};

