const db = require('../database-pg');
const { Kullanici } = require('../models-pg');
const bcrypt = require('bcryptjs');

async function addUsers() {
  try {
    console.log('🔍 Bağlantı bilgileri kontrol ediliyor...');
    console.log(`   POSTGRES_USER: ${process.env.POSTGRES_USER || 'admin-1'}`);
    console.log(`   POSTGRES_PASSWORD: ${process.env.POSTGRES_PASSWORD || '123456'}`);
    console.log(`   POSTGRES_DB: ${process.env.POSTGRES_DB || 'forklift'}`);
    console.log(`   POSTGRES_HOST: ${process.env.POSTGRES_HOST || 'localhost'}`);
    console.log(`   POSTGRES_PORT: ${process.env.POSTGRES_PORT || 5432}`);

    await db.init();
    
    const defaultPassword = bcrypt.hashSync('123456', 10);
    
    const users = [
      {
        kullanici_adi: 'admin',
        sifre: defaultPassword,
        ad_soyad: 'Admin Kullanıcı',
        rol: 'admin',
        durum: 'aktif'
      },
      {
        kullanici_adi: 'forklift1',
        sifre: defaultPassword,
        ad_soyad: 'Forklift Operatör 1',
        rol: 'forkliftoperator',
        durum: 'aktif'
      },
      {
        kullanici_adi: 'hat1',
        sifre: defaultPassword,
        ad_soyad: 'Hat Operatör 1',
        rol: 'hatoperator',
        durum: 'aktif'
      },
      {
        kullanici_adi: 'yonetici1',
        sifre: defaultPassword,
        ad_soyad: 'Yönetici 1',
        rol: 'yonetici',
        durum: 'aktif'
      }
    ];
    
    for (const userData of users) {
      const existingUser = await Kullanici.findOne({ 
        where: { kullanici_adi: userData.kullanici_adi } 
      });
      
      if (!existingUser) {
        await Kullanici.create(userData);
        console.log(`✅ ${userData.kullanici_adi} kullanıcısı oluşturuldu`);
      } else {
        // Mevcut kullanıcıyı güncelle
        existingUser.sifre = defaultPassword;
        if (userData.kart_no) {
          existingUser.kart_no = userData.kart_no;
        }
        existingUser.ad_soyad = userData.ad_soyad;
        existingUser.rol = userData.rol;
        existingUser.durum = userData.durum;
        await existingUser.save();
        console.log(`✅ ${userData.kullanici_adi} kullanıcısı güncellendi`);
      }
    }
    
    console.log('\n✅ Tüm kullanıcılar başarıyla eklendi/güncellendi!');
    console.log('\n📋 Kullanıcı Listesi:');
    console.log('   - admin / 123456 (Admin)');
    console.log('   - forklift1 / 123456 (Forklift Operatör, Kart: CARD001)');
    console.log('   - hat1 / 123456 (Hat Operatör)');
    console.log('   - yonetici1 / 123456 (Yönetici)');
    
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error);
    await db.close();
    process.exit(1);
  }
}

addUsers();

