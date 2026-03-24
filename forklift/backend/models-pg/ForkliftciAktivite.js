const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ForkliftciAktivite = sequelize.define('ForkliftciAktivite', {
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
    aktivite_tipi: {
      type: DataTypes.STRING,
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
    kasa_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'kasa_etiketleri',
        key: 'id'
      }
    },
    bildirim_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'forklift_bildirimler',
        key: 'id'
      }
    },
    baslangic_zamani: {
      type: DataTypes.DATE,
      allowNull: true
    },
    bitis_zamani: {
      type: DataTypes.DATE,
      allowNull: true
    },
    sure_saniye: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    aciklama: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    olusturma_tarihi: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'forkliftci_aktiviteler',
    timestamps: false,
    underscored: false
  });

  return ForkliftciAktivite;
};

