const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ForkliftDurum = sequelize.define('ForkliftDurum', {
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
    durum: {
      type: DataTypes.ENUM('dolu', 'bos'),
      allowNull: false
    },
    gorsel_yolu: {
      type: DataTypes.STRING,
      allowNull: true
    },
    analiz_sonucu: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    guven_skoru: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      validate: {
        min: 0,
        max: 1
      }
    },
    olusturma_tarihi: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'forklift_durumlar',
    timestamps: false,
    underscored: false
  });

  return ForkliftDurum;
};

