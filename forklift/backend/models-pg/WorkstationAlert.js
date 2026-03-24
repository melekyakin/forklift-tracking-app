const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WorkstationAlert = sequelize.define('WorkstationAlert', {
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
    doluluk_yuzdesi_limit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
        max: 100
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
    tableName: 'workstation_alerts',
    timestamps: false,
    underscored: false,
    indexes: [
      {
        unique: true,
        fields: ['forkliftci_id', 'workstation_id']
      }
    ]
  });

  return WorkstationAlert;
};

