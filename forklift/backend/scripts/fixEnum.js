/**
 * ForkliftBildirim durum ENUM'una 'tamamlandi' değerini ekle
 */

const db = require('../database-pg');
const { QueryTypes } = require('sequelize');

async function fixEnum() {
  try {
    console.log('🔧 Veritabanı bağlantısı kuruluyor...');
    await db.init();
    
    const sequelize = db.sequelize;
    
    // ENUM tipini bul
    console.log('\n🔍 ENUM tipi aranıyor...');
    const enumTypes = await sequelize.query(`
      SELECT DISTINCT t.typname as enum_name 
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      WHERE t.typname LIKE '%durum%' OR t.typname LIKE '%forklift%'
      GROUP BY t.typname;
    `, { type: QueryTypes.SELECT });
    
    console.log('Bulunan ENUM tipleri:', enumTypes.map(e => e.enum_name));
    
    // forklift_bildirimler tablosunun durum sütununun tipini bul
    const columnInfo = await sequelize.query(`
      SELECT 
        udt_name as type_name,
        column_name
      FROM information_schema.columns 
      WHERE table_name = 'forklift_bildirimler' 
      AND column_name = 'durum';
    `, { type: QueryTypes.SELECT });
    
    if (columnInfo.length === 0) {
      console.log('❌ durum sütunu bulunamadı!');
      process.exit(1);
    }
    
    const enumTypeName = columnInfo[0].type_name;
    console.log(`\n📋 durum sütunu tipi: ${enumTypeName}`);
    
    // Mevcut ENUM değerlerini kontrol et
    const currentValues = await sequelize.query(`
      SELECT e.enumlabel as value
      FROM pg_enum e 
      JOIN pg_type t ON e.enumtypid = t.oid 
      WHERE t.typname = '${enumTypeName}'
      ORDER BY e.enumsortorder;
    `, { type: QueryTypes.SELECT });
    
    console.log('\n📋 Mevcut ENUM değerleri:', currentValues.map(v => v.value));
    
    // 'tamamlandi' değeri var mı kontrol et
    const hasTamamlandi = currentValues.some(v => v.value === 'tamamlandi');
    
    if (hasTamamlandi) {
      console.log('\n✅ tamamlandi değeri zaten mevcut!');
    } else {
      console.log('\n➕ tamamlandi değeri ekleniyor...');
      try {
        await sequelize.query(`
          ALTER TYPE ${enumTypeName} ADD VALUE 'tamamlandi';
        `, { type: QueryTypes.RAW });
        console.log('✅ tamamlandi değeri başarıyla eklendi!');
      } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
          console.log('ℹ️  tamamlandi zaten mevcut (farklı bir hata mesajı)');
        } else {
          console.error('❌ ENUM güncelleme hatası:', err.message);
          throw err;
        }
      }
    }
    
    // Tekrar kontrol et
    const updatedValues = await sequelize.query(`
      SELECT e.enumlabel as value
      FROM pg_enum e 
      JOIN pg_type t ON e.enumtypid = t.oid 
      WHERE t.typname = '${enumTypeName}'
      ORDER BY e.enumsortorder;
    `, { type: QueryTypes.SELECT });
    
    console.log('\n📋 Güncel ENUM değerleri:', updatedValues.map(v => v.value));
    
    console.log('\n✅ İşlem tamamlandı!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Hata:', err);
    process.exit(1);
  }
}

fixEnum();

