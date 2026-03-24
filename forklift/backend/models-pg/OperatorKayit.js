const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OperatorKayit = sequelize.define('OperatorKayit', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    operator_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'kullanicilar',
        key: 'id'
      }
    },
    kimlik_no: {
      type: DataTypes.STRING,
      allowNull: true
    },
    ehliyet_no: {
      type: DataTypes.STRING,
      allowNull: true
    },
    ehliyet_sinifi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    telefon: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    adres: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    ise_baslama_tarihi: {
      type: DataTypes.DATE,
      allowNull: true
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
    tableName: 'operator_kayitlari',
    timestamps: false,
    underscored: false
  });

  return OperatorKayit;
};

