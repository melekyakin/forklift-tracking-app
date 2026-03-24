const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ForkliftBildirim = sequelize.define('ForkliftBildirim', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    kasa_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'kasa_etiketleri',
        key: 'id'
      }
    },
    forkliftci_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'kullanicilar',
        key: 'id'
      }
    },
    mesaj: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    durum: {
      type: DataTypes.ENUM('beklemede', 'onaylandi', 'reddedildi', 'tamamlandi'),
      defaultValue: 'beklemede'
    },
    onay_tarihi: {
      type: DataTypes.DATE,
      allowNull: true
    },
    red_tarihi: {
      type: DataTypes.DATE,
      allowNull: true
    },
    tamamlanma_tarihi: {
      type: DataTypes.DATE,
      allowNull: true
    },
    sure_saniye: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    olusturma_tarihi: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'forklift_bildirimler',
    timestamps: false,
    underscored: false
  });

  return ForkliftBildirim;
};

