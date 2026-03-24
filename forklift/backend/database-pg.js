const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');

// PostgreSQL bağlantı bilgileri
const POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
const POSTGRES_PORT = process.env.POSTGRES_PORT || 5432;
const POSTGRES_DB = process.env.POSTGRES_DB || 'forklift';
const POSTGRES_USER = process.env.POSTGRES_USER || 'admin-1';
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || '123456';

// Sequelize instance oluştur
console.log('🔧 Sequelize bağlantı bilgileri:');
console.log('   Database:', POSTGRES_DB);
console.log('   User:', POSTGRES_USER);
console.log('   Password:', POSTGRES_PASSWORD ? '***' : '(boş)');
console.log('   Host:', POSTGRES_HOST);
console.log('   Port:', POSTGRES_PORT);

const sequelize = new Sequelize(POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, {
  host: POSTGRES_HOST,
  port: POSTGRES_PORT,
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

let isConnected = false;

async function init() {
  try {
    if (isConnected) {
      console.log('PostgreSQL zaten bağlı');
      return sequelize;
    }

    // Bağlantıyı test et
    await sequelize.authenticate();
    console.log('✅ PostgreSQL veritabanına bağlandı:', `${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`);
    
    isConnected = true;

    // Tabloları senkronize et (migration yerine - development için)
    await sequelize.sync({ alter: false }); // alter: true production'da kullanmayın!
    
    // Örnek verileri ekle
    await seedDatabase();

    return sequelize;
  } catch (err) {
    console.error('❌ PostgreSQL bağlantı hatası:', err);
    throw err;
  }
}

async function seedDatabase() {
  try {
    const { Workstation, Kullanici, KasaEtiketi, KasaIciSayisi } = require('./models-pg');

    // Workstation kontrolü
    const workstationCount = await Workstation.count();
    if (workstationCount === 0) {
      await Workstation.bulkCreate([
        { workstation_no: 'WS-001', workstation_adi: 'İş İstasyonu 1', durum: 'aktif' },
        { workstation_no: 'WS-002', workstation_adi: 'İş İstasyonu 2', durum: 'aktif' },
        { workstation_no: 'WS-003', workstation_adi: 'İş İstasyonu 3', durum: 'aktif' }
      ]);
      console.log('✓ Örnek workstation\'lar eklendi');
    }

    // Kullanıcı kontrolü
    const kullaniciCount = await Kullanici.count();
    if (kullaniciCount === 0) {
      const defaultPassword = bcrypt.hashSync('123456', 10);
      const workstations = await Workstation.findAll();
      
      await Kullanici.bulkCreate([
        {
          kullanici_adi: 'admin-1',
          sifre: defaultPassword,
          ad_soyad: 'Admin Kullanıcı',
          rol: 'admin',
          durum: 'aktif'
        },
        {
          kullanici_adi: 'admin',
          sifre: defaultPassword,
          ad_soyad: 'Admin Kullanıcı (Eski)',
          rol: 'admin',
          durum: 'aktif'
        },
        {
          kullanici_adi: 'forklift1',
          sifre: defaultPassword,
          ad_soyad: 'Forklift Operatör 1',
          rol: 'forkliftoperator',
          workstation_id: workstations[0]?.id || null,
          durum: 'aktif'
        },
        {
          kullanici_adi: 'hat1',
          sifre: defaultPassword,
          ad_soyad: 'Hat Operatör 1',
          rol: 'hatoperator',
          workstation_id: workstations[0]?.id || null,
          durum: 'aktif'
        },
        {
          kullanici_adi: 'yonetici1',
          sifre: defaultPassword,
          ad_soyad: 'Yönetici 1',
          rol: 'yonetici',
          durum: 'aktif'
        }
      ]);
      console.log('✓ Örnek kullanıcılar eklendi');
    }

    // Kasa kontrolü
    const kasaCount = await KasaEtiketi.count();
    if (kasaCount === 0) {
      const workstations = await Workstation.findAll();
      
      await KasaEtiketi.bulkCreate([
        { kasa_no: 'KASA-001', kapasite: 100, mevcut_adet: 0, workstation_id: workstations[0]?.id || null, durum: 'aktif' },
        { kasa_no: 'KASA-002', kapasite: 150, mevcut_adet: 0, workstation_id: workstations[0]?.id || null, durum: 'aktif' },
        { kasa_no: 'KASA-003', kapasite: 200, mevcut_adet: 0, workstation_id: workstations[1]?.id || null, durum: 'aktif' },
        { kasa_no: 'KASA-004', kapasite: 120, mevcut_adet: 0, workstation_id: workstations[1]?.id || null, durum: 'aktif' },
        { kasa_no: 'KASA-005', kapasite: 180, mevcut_adet: 0, workstation_id: workstations[2]?.id || null, durum: 'aktif' }
      ]);
      console.log('✓ Örnek kasalar eklendi');
    }

    // Kasa içi sayısı kontrolü - her workstation için varsayılan kayıt oluştur
    const kasaIciSayisiCount = await KasaIciSayisi.count();
    if (kasaIciSayisiCount === 0) {
      const workstations = await Workstation.findAll();
      const kasaIciSayisiKayitlari = workstations.map(ws => ({
        workstation_id: ws.id,
        kasa_ici_sayisi: 0,
        limit: 100
      }));
      
      await KasaIciSayisi.bulkCreate(kasaIciSayisiKayitlari);
      console.log('✓ Kasa içi sayısı kayıtları eklendi');
    }

  } catch (err) {
    console.error('Örnek veri ekleme hatası:', err);
  }
}

function getDb() {
  return sequelize;
}

async function close() {
  try {
    if (isConnected) {
      await sequelize.close();
      isConnected = false;
      console.log('PostgreSQL bağlantısı kapatıldı');
    }
  } catch (err) {
    console.error('PostgreSQL kapatma hatası:', err);
    throw err;
  }
}

module.exports = {
  init,
  getDb,
  close,
  sequelize
};

