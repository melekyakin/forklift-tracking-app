const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ForkliftciKonum = sequelize.define('ForkliftciKonum', {
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
    life360_member_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    enlem: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    boylam: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    hiz: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    yon: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    adres: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    batarya: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    wifi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    hareket_durumu: {
      type: DataTypes.ENUM('hareket_halinde', 'duruyor', 'bilinmiyor'),
      defaultValue: 'bilinmiyor'
    },
    mesafe_metre: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    olusturma_tarihi: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'forkliftci_konumlar',
    timestamps: false,
    underscored: false
  });

  return ForkliftciKonum;
};

