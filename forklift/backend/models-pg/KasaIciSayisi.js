const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const KasaIciSayisi = sequelize.define('KasaIciSayisi', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    workstation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'workstations',
        key: 'id'
      },
      unique: true // Her workstation için tek bir kayıt
    },
    kasa_ici_sayisi: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    limit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
      validate: {
        min: 0,
        max: 200
      }
    },
    son_guncelleme: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    olusturma_tarihi: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'kasa_ici_sayisi',
    timestamps: false,
    underscored: false,
    indexes: [
      {
        unique: true,
        fields: ['workstation_id']
      }
    ]
  });

  return KasaIciSayisi;
};
