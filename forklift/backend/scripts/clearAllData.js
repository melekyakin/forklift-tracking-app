/**
 * Kullanıcılar ve iş istasyonları hariç tüm verileri silme scripti
 * 
 * KORUNACAK:
 * - kullanicilar
 * - workstations
 * - forkliftci_workstations (ilişki tablosu)
 * 
 * SİLİNECEK:
 * - forklift_bildirimler
 * - forkliftci_aktiviteler
 * - forkliftci_konumlar
 * - hareket_kayitlari
 * - kasa_etiketleri
 * - workstation_alerts
 * - forklift_durumlar
 * - hareketli_varlik_konumlar
 * - hareketli_varliklar
 * - darbe_kayitlari
 * - canbus_veriler
 * - mesai_kayitlari
 * - operator_kayitlari
 * - alan_takip
 */

const db = require('../database-pg');
const { QueryTypes } = require('sequelize');

async function clearAllData() {
  try {
    console.log('🔧 Veritabanı bağlantısı kuruluyor...');
    await db.init();
    
    const sequelize = db.sequelize;
    
    console.log('\n⚠️  UYARI: Kullanıcılar ve iş istasyonları hariç TÜM VERİLER SİLİNECEK!\n');
    
    // Silinecek tablolar (sıra önemli - foreign key'ler için)
    const tablesToClear = [
      { name: 'alan_takip', label: 'Alan Takip' },
      { name: 'operator_kayitlari', label: 'Operator Kayıtları' },
      { name: 'mesai_kayitlari', label: 'Mesai Kayıtları' },
      { name: 'hareketli_varlik_konumlar', label: 'Hareketli Varlık Konumlar' },
      { name: 'hareketli_varliklar', label: 'Hareketli Varlıklar' },
      { name: 'canbus_veriler', label: 'CANbus Veriler' },
      { name: 'darbe_kayitlari', label: 'Darbe Kayıtları' },
      { name: 'forklift_durumlar', label: 'Forklift Durumlar' },
      { name: 'workstation_alerts', label: 'Workstation Alertler' },
      { name: 'hareket_kayitlari', label: 'Hareket Kayıtları' },
      { name: 'forkliftci_konumlar', label: 'Forkliftçi Konumlar' },
      { name: 'forkliftci_aktiviteler', label: 'Forkliftçi Aktiviteler' },
      { name: 'forklift_bildirimler', label: 'Forklift Bildirimler' },
      { name: 'kasa_etiketleri', label: 'Kasa Etiketleri' }
    ];
    
    // Önce kayıt sayılarını göster
    console.log('📊 Mevcut veri sayıları:\n');
    for (const table of tablesToClear) {
      try {
        const count = await sequelize.query(
          `SELECT COUNT(*) as count FROM ${table.name};`,
          { type: QueryTypes.SELECT }
        );
        const recordCount = count[0]?.count || 0;
        console.log(`   ${table.label}: ${recordCount} kayıt`);
      } catch (err) {
        console.log(`   ${table.label}: Tablo bulunamadı veya hata (devam ediliyor)`);
      }
    }
    
    // Kullanıcı ve workstation sayılarını göster (korunacak)
    console.log('\n📋 Korunacak veriler:\n');
    try {
      const kullaniciCount = await sequelize.query(
        `SELECT COUNT(*) as count FROM kullanicilar;`,
        { type: QueryTypes.SELECT }
      );
      console.log(`   Kullanıcılar: ${kullaniciCount[0]?.count || 0} kayıt`);
    } catch (err) {
      console.log(`   Kullanıcılar: Hata`);
    }
    
    try {
      const workstationCount = await sequelize.query(
        `SELECT COUNT(*) as count FROM workstations;`,
        { type: QueryTypes.SELECT }
      );
      console.log(`   İş İstasyonları: ${workstationCount[0]?.count || 0} kayıt`);
    } catch (err) {
      console.log(`   İş İstasyonları: Hata`);
    }
    
    console.log('\n🗑️  Veriler siliniyor...\n');
    
    let totalDeleted = 0;
    
    // Tabloları temizle
    for (const table of tablesToClear) {
      try {
        const result = await sequelize.query(
          `DELETE FROM ${table.name};`,
          { type: QueryTypes.DELETE }
        );
        
        // Silinen kayıt sayısını almak için tekrar sorgu
        const countAfter = await sequelize.query(
          `SELECT COUNT(*) as count FROM ${table.name};`,
          { type: QueryTypes.SELECT }
        );
        
        const deletedCount = result[1] || 0;
        console.log(`   ✅ ${table.label}: ${deletedCount > 0 ? deletedCount : 'Tüm'} kayıt silindi`);
        totalDeleted += deletedCount || 0;
      } catch (err) {
        console.log(`   ⚠️  ${table.label}: Hata - ${err.message}`);
      }
    }
    
    // Sequence'leri sıfırla (ID'lerin 1'den başlaması için)
    console.log('\n🔄 ID sequence\'leri sıfırlanıyor...\n');
    
    const sequencesToReset = tablesToClear.map(t => t.name);
    for (const tableName of sequencesToReset) {
      try {
        await sequelize.query(
          `SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), 1, false);`,
          { type: QueryTypes.RAW }
        );
        console.log(`   ✅ ${tableName} sequence sıfırlandı`);
      } catch (err) {
        // Sequence yoksa veya hata varsa sessizce devam et
      }
    }
    
    console.log('\n📊 Son durum:\n');
    
    // Son kayıt sayılarını göster
    for (const table of tablesToClear) {
      try {
        const count = await sequelize.query(
          `SELECT COUNT(*) as count FROM ${table.name};`,
          { type: QueryTypes.SELECT }
        );
        const recordCount = count[0]?.count || 0;
        if (recordCount === 0) {
          console.log(`   ✅ ${table.label}: 0 kayıt (temizlendi)`);
        } else {
          console.log(`   ⚠️  ${table.label}: ${recordCount} kayıt kaldı`);
        }
      } catch (err) {
        // Sessizce devam et
      }
    }
    
    console.log('\n✅ İşlem tamamlandı!');
    console.log(`   Toplam silinen kayıt: ${totalDeleted}`);
    console.log('\n📋 Korunan veriler:');
    console.log('   ✅ Kullanıcılar');
    console.log('   ✅ İş İstasyonları');
    console.log('   ✅ Forkliftçi-İş İstasyonu İlişkileri\n');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Hata:', err);
    process.exit(1);
  }
}

clearAllData();

