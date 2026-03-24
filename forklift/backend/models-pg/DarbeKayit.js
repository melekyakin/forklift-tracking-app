const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DarbeKayit = sequelize.define('DarbeKayit', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    forklift_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    operator_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'kullanicilar',
        key: 'id'
      }
    },
    darbe_seviyesi: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    darbe_yonu: {
      type: DataTypes.STRING,
      allowNull: true
    },
    konum_enlem: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    konum_boylam: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    hiz: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    ivme_x: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    ivme_y: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    ivme_z: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    uyari_gonderildi: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    olusturma_tarihi: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'darbe_kayitlari',
    timestamps: false,
    underscored: false
  });

  return DarbeKayit;
};

