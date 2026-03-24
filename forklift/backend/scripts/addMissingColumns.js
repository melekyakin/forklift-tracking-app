/**
 * ForkliftBildirim tablosuna eksik sütunları ekleme scripti
 * - tamamlanma_tarihi (DATE)
 * - sure_saniye (INTEGER)
 * - durum ENUM'una 'tamamlandi' değerini ekle
 */

const db = require('../database-pg');
const { QueryTypes } = require('sequelize');

async function addMissingColumns() {
  try {
    console.log('🔧 Veritabanı bağlantısı kuruluyor...');
    await db.init();
    
    const sequelize = db.sequelize;
    
    console.log('\n📊 Eksik sütunlar kontrol ediliyor...\n');
    
    // 1. durum ENUM'una 'tamamlandi' ekle
    console.log('1️⃣ durum ENUM\'una \'tamamlandi\' değeri ekleniyor...');
    try {
      await sequelize.query(`
        ALTER TYPE forklift_bildirimler_durum_enum 
        ADD VALUE IF NOT EXISTS 'tamamlandi';
      `, { type: QueryTypes.RAW });
      console.log('✅ durum ENUM güncellendi');
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log('ℹ️  durum ENUM zaten güncel');
      } else {
        console.log('⚠️  durum ENUM güncelleme hatası (devam ediliyor):', err.message);
      }
    }
    
    // 2. tamamlanma_tarihi sütununu ekle
    console.log('\n2️⃣ tamamlanma_tarihi sütunu ekleniyor...');
    try {
      await sequelize.query(`
        ALTER TABLE forklift_bildirimler 
        ADD COLUMN IF NOT EXISTS tamamlanma_tarihi DATE;
      `, { type: QueryTypes.RAW });
      console.log('✅ tamamlanma_tarihi sütunu eklendi');
    } catch (err) {
      console.log('⚠️  tamamlanma_tarihi ekleme hatası:', err.message);
    }
    
    // 3. sure_saniye sütununu ekle
    console.log('\n3️⃣ sure_saniye sütunu ekleniyor...');
    try {
      await sequelize.query(`
        ALTER TABLE forklift_bildirimler 
        ADD COLUMN IF NOT EXISTS sure_saniye INTEGER;
      `, { type: QueryTypes.RAW });
      console.log('✅ sure_saniye sütunu eklendi');
    } catch (err) {
      console.log('⚠️  sure_saniye ekleme hatası:', err.message);
    }
    
    // Kontrol: Sütunların varlığını kontrol et
    console.log('\n🔍 Sütunlar kontrol ediliyor...');
    const columns = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'forklift_bildirimler' 
      AND column_name IN ('tamamlanma_tarihi', 'sure_saniye');
    `, { type: QueryTypes.SELECT });
    
    console.log('\n📋 Mevcut sütunlar:');
    columns.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });
    
    if (columns.length === 2) {
      console.log('\n✅ Tüm sütunlar başarıyla eklendi!');
    } else {
      console.log('\n⚠️  Bazı sütunlar eksik olabilir. Lütfen kontrol edin.');
    }
    
    console.log('\n✅ İşlem tamamlandı!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Hata:', err);
    process.exit(1);
  }
}

addMissingColumns();

