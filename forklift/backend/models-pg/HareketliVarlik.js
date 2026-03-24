const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const HareketliVarlik = sequelize.define('HareketliVarlik', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    varlik_no: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    varlik_tipi: {
      type: DataTypes.ENUM('robot', 'agv', 'konveyor', 'diger'),
      allowNull: false
    },
    varlik_adi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    durum: {
      type: DataTypes.ENUM('aktif', 'pasif'),
      defaultValue: 'aktif'
    },
    konum_enlem: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    konum_boylam: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    son_guncelleme: {
      type: DataTypes.DATE,
      allowNull: true
    },
    olusturma_tarihi: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'hareketli_varliklar',
    timestamps: false,
    underscored: false
  });

  return HareketliVarlik;
};

