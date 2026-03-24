const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Kullanici = sequelize.define('Kullanici', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    kullanici_adi: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    sifre: {
      type: DataTypes.STRING,
      allowNull: false
    },
    ad_soyad: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    rol: {
      type: DataTypes.ENUM('admin', 'forkliftoperator', 'hatoperator', 'yonetici'),
      allowNull: false
    },
    workstation_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'workstations',
        key: 'id'
      }
    },
    kart_no: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
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
    tableName: 'kullanicilar',
    timestamps: false,
    underscored: false
  });

  return Kullanici;
};

