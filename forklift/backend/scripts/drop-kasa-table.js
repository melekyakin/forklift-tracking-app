const { sequelize } = require('../database-pg');

async function dropKasaTable() {
  try {
    console.log('🗑️  Kasa tablosu kaldırılıyor...');
    
    // Foreign key constraint'leri kaldır
    await sequelize.query(`
      ALTER TABLE IF EXISTS forklift_bildirimler 
      DROP CONSTRAINT IF EXISTS forklift_bildirimler_kasa_id_fkey;
    `);
    
    await sequelize.query(`
      ALTER TABLE IF EXISTS hareket_kayitlari 
      DROP CONSTRAINT IF EXISTS hareket_kayitlari_kasa_id_fkey;
    `);
    
    // Kasa tablosunu kaldır
    await sequelize.query(`
      DROP TABLE IF EXISTS kasa_etiketleri CASCADE;
    `);
    
    console.log('✅ Kasa tablosu başarıyla kaldırıldı');
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  }
}

dropKasaTable();

