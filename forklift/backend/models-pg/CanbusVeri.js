const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CanbusVeri = sequelize.define('CanbusVeri', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    forklift_id: {
      type: DataTypes.STRING,
      allowNull: false
    },
    operator_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'kullanicilar',
        key: 'id'
      }
    },
    hiz: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    motor_devir: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    yakit_seviyesi: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    aku_doluluk: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    motor_sicaklik: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    yakit_tuketim: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    toplam_calisma_saati: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    hata_kodlari: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    hidrolik_basinc: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    catal_yuksekligi: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    agirlik_sensoru: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    motor_yuku: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    hareket_durumu: {
      type: DataTypes.STRING,
      allowNull: true
    },
    olusturma_tarihi: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'canbus_veriler',
    timestamps: false,
    underscored: false
  });

  return CanbusVeri;
};

