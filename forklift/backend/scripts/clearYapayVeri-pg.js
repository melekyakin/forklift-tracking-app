/**
 * Yapay verileri silme scripti (PostgreSQL)
 * Sadece bildirimler, hareket kayıtları ve aktiviteleri siler
 * Kullanıcılar, iş istasyonları ve kasalar korunur
 */

const db = require('../database-pg');
const { ForkliftBildirim, HareketKayit, ForkliftciAktivite } = require('../models-pg');
const { QueryTypes } = require('sequelize');

async function clearYapayVeri() {
  try {
    console.log('🔧 Veritabanı bağlantısı kuruluyor...');
    await db.init();
    
    const sequelize = db.sequelize;
    
    console.log('\n⚠️  UYARI: Yapay veriler silinecek!\n');
    console.log('Silinecek tablolar:');
    console.log('   - forklift_bildirimleri (Bildirimler)');
    console.log('   - hareket_kayitlari (Hareket Kayıtları)');
    console.log('   - forkliftci_aktiviteler (Forkliftçi Aktiviteler)');
    console.log('\nKorunacak tablolar:');
    console.log('   - kullanicilar (Kullanıcılar)');
    console.log('   - workstations (İş İstasyonları)');
    console.log('   - kasa_etiketleri (Kasalar)');
    console.log('   - forkliftci_workstations (İlişkiler)\n');
    
    // Önce kayıt sayılarını göster
    const bildirimSayisi = await ForkliftBildirim.count();
    const hareketSayisi = await HareketKayit.count();
    const aktiviteSayisi = await ForkliftciAktivite.count();
    
    console.log('📊 Mevcut Veri Sayıları:');
    console.log(`   - Bildirimler: ${bildirimSayisi}`);
    console.log(`   - Hareket Kayıtları: ${hareketSayisi}`);
    console.log(`   - Aktiviteler: ${aktiviteSayisi}\n`);
    
    if (bildirimSayisi === 0 && hareketSayisi === 0 && aktiviteSayisi === 0) {
      console.log('✅ Zaten hiç veri yok, silinecek bir şey yok.');
      await db.close();
      process.exit(0);
    }
    
    console.log('🗑️  Veriler siliniyor...\n');
    
    // Sırayla sil (foreign key'ler için)
    // 1. Aktiviteler (bildirimlere bağlı olabilir)
    const aktiviteSilindi = await ForkliftciAktivite.destroy({
      where: {},
      truncate: false
    });
    console.log(`   ✓ ${aktiviteSilindi} aktivite silindi`);
    
    // 2. Hareket kayıtları
    const hareketSilindi = await HareketKayit.destroy({
      where: {},
      truncate: false
    });
    console.log(`   ✓ ${hareketSilindi} hareket kaydı silindi`);
    
    // 3. Bildirimler
    const bildirimSilindi = await ForkliftBildirim.destroy({
      where: {},
      truncate: false
    });
    console.log(`   ✓ ${bildirimSilindi} bildirim silindi`);
    
    // Sequence'leri sıfırla (PostgreSQL için)
    try {
      await sequelize.query("SELECT setval('forklift_bildirimleri_id_seq', 1, false);", { type: QueryTypes.RAW });
      await sequelize.query("SELECT setval('hareket_kayitlari_id_seq', 1, false);", { type: QueryTypes.RAW });
      await sequelize.query("SELECT setval('forkliftci_aktiviteler_id_seq', 1, false);", { type: QueryTypes.RAW });
      console.log('   ✓ ID sequence\'leri sıfırlandı');
    } catch (err) {
      // Sequence yoksa veya hata varsa devam et
      console.log('   ⚠️  Sequence sıfırlama atlandı (normal olabilir)');
    }
    
    console.log('\n✅✅✅ Yapay veriler başarıyla silindi! ✅✅✅\n');
    console.log(`📊 Silinen Veriler:`);
    console.log(`   - ${bildirimSilindi} bildirim`);
    console.log(`   - ${hareketSilindi} hareket kaydı`);
    console.log(`   - ${aktiviteSilindi} aktivite kaydı`);
    console.log(`\nKullanıcılar, iş istasyonları ve kasalar korundu.\n`);
    
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error);
    await db.close();
    process.exit(1);
  }
}

clearYapayVeri();

