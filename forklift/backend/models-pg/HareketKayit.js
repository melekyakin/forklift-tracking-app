const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const HareketKayit = sequelize.define('HareketKayit', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    kasa_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    forkliftci_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'kullanicilar',
        key: 'id'
      }
    },
    islem_tipi: {
      type: DataTypes.STRING,
      allowNull: false
    },
    onceki_adet: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    yeni_adet: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    aciklama: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    olusturma_tarihi: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'hareket_kayitlari',
    timestamps: false,
    underscored: false
  });

  return HareketKayit;
};

