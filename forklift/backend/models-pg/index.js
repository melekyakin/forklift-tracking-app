const { Sequelize } = require('sequelize');
const { sequelize } = require('../database-pg');

// Tüm modelleri import et (sıra önemli - foreign key'ler için)
const Kullanici = require('./Kullanici')(sequelize);
const Workstation = require('./Workstation')(sequelize);
const ForkliftBildirim = require('./ForkliftBildirim')(sequelize);
const ForkliftciWorkstation = require('./ForkliftciWorkstation')(sequelize);
const ForkliftciAktivite = require('./ForkliftciAktivite')(sequelize);
const ForkliftciKonum = require('./ForkliftciKonum')(sequelize);
const HareketKayit = require('./HareketKayit')(sequelize);
const WorkstationAlert = require('./WorkstationAlert')(sequelize);
const DarbeKayit = require('./DarbeKayit')(sequelize);
const CanbusVeri = require('./CanbusVeri')(sequelize);
const HareketliVarlik = require('./HareketliVarlik')(sequelize);
const HareketliVarlikKonum = require('./HareketliVarlikKonum')(sequelize);
const MesaiKayit = require('./MesaiKayit')(sequelize);
const OperatorKayit = require('./OperatorKayit')(sequelize);
const AlanTakip = require('./AlanTakip')(sequelize);
const ForkliftDurum = require('./ForkliftDurum')(sequelize);
const KasaIciSayisi = require('./KasaIciSayisi')(sequelize);

// İlişkileri tanımla
// Kullanici - Workstation (Many-to-One)
Kullanici.belongsTo(Workstation, { foreignKey: 'workstation_id', as: 'workstation' });
Workstation.hasMany(Kullanici, { foreignKey: 'workstation_id', as: 'kullanicilar' });

// ForkliftBildirim - Kullanici (Many-to-One)
ForkliftBildirim.belongsTo(Kullanici, { foreignKey: 'forkliftci_id', as: 'forkliftci' });
Kullanici.hasMany(ForkliftBildirim, { foreignKey: 'forkliftci_id', as: 'bildirimler' });

// ForkliftciWorkstation - Kullanici ve Workstation (Many-to-Many)
ForkliftciWorkstation.belongsTo(Kullanici, { foreignKey: 'forkliftci_id', as: 'forkliftci' });
ForkliftciWorkstation.belongsTo(Workstation, { foreignKey: 'workstation_id', as: 'workstation' });
Kullanici.hasMany(ForkliftciWorkstation, { foreignKey: 'forkliftci_id', as: 'workstations' });
Workstation.hasMany(ForkliftciWorkstation, { foreignKey: 'workstation_id', as: 'forkliftciler' });

// ForkliftciAktivite - Kullanici
ForkliftciAktivite.belongsTo(Kullanici, { foreignKey: 'forkliftci_id', as: 'forkliftci' });
Kullanici.hasMany(ForkliftciAktivite, { foreignKey: 'forkliftci_id', as: 'aktiviteler' });

// ForkliftciKonum - Kullanici
ForkliftciKonum.belongsTo(Kullanici, { foreignKey: 'forkliftci_id', as: 'forkliftci' });
Kullanici.hasMany(ForkliftciKonum, { foreignKey: 'forkliftci_id', as: 'konumlar' });

// HareketKayit - Kullanici (forkliftci_id)
HareketKayit.belongsTo(Kullanici, { foreignKey: 'forkliftci_id', as: 'forkliftci' });

// WorkstationAlert - Workstation ve Kullanici
WorkstationAlert.belongsTo(Workstation, { foreignKey: 'workstation_id', as: 'workstation' });
WorkstationAlert.belongsTo(Kullanici, { foreignKey: 'forkliftci_id', as: 'forkliftci' });

// KasaIciSayisi - Workstation (One-to-One)
KasaIciSayisi.belongsTo(Workstation, { foreignKey: 'workstation_id', as: 'workstation' });
Workstation.hasOne(KasaIciSayisi, { foreignKey: 'workstation_id', as: 'kasaIciSayisi' });

module.exports = {
  sequelize,
  Kullanici,
  Workstation,
  ForkliftBildirim,
  ForkliftciWorkstation,
  ForkliftciAktivite,
  ForkliftciKonum,
  HareketKayit,
  WorkstationAlert,
  DarbeKayit,
  CanbusVeri,
  HareketliVarlik,
  HareketliVarlikKonum,
  MesaiKayit,
  OperatorKayit,
  AlanTakip,
  ForkliftDurum,
  KasaIciSayisi
};

