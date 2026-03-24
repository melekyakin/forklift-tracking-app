const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const HareketliVarlikKonum = sequelize.define('HareketliVarlikKonum', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    varlik_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'hareketli_varliklar',
        key: 'id'
      }
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
    batarya: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    durum: {
      type: DataTypes.STRING,
      allowNull: true
    },
    olusturma_tarihi: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'hareketli_varlik_konumlar',
    timestamps: false,
    underscored: false
  });

  return HareketliVarlikKonum;
};

