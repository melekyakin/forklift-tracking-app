const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AlanTakip = sequelize.define('AlanTakip', {
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
    forklift_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    alan_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'workstations',
        key: 'id'
      }
    },
    giris_zamani: {
      type: DataTypes.DATE,
      allowNull: true
    },
    cikis_zamani: {
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
    tableName: 'alan_takip',
    timestamps: false,
    underscored: false
  });

  return AlanTakip;
};

