const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MesaiKayit = sequelize.define('MesaiKayit', {
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
    baslangic_zamani: {
      type: DataTypes.DATE,
      allowNull: false
    },
    bitis_zamani: {
      type: DataTypes.DATE,
      allowNull: true
    },
    toplam_sure_saniye: {
      type: DataTypes.INTEGER,
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
    forklift_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    durum: {
      type: DataTypes.ENUM('devam_ediyor', 'tamamlandi'),
      defaultValue: 'devam_ediyor'
    },
    olusturma_tarihi: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'mesai_kayitlari',
    timestamps: false,
    underscored: false
  });

  return MesaiKayit;
};

