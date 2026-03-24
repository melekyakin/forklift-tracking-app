/**
 * AI/ML Servisleri
 * TensorFlow.js ve gelişmiş AI algoritmaları için servis katmanı
 */

const { HareketKayit, KasaEtiketi, ForkliftciAktivite } = require('../models-pg');
const { Op } = require('sequelize');
const { sequelize } = require('../models-pg');

class AIService {
  /**
   * Kasa doluluk tahmini - Geçmiş verilere dayalı ML tahmini
   */
  async predictKasaDoluluk(kasaId, saatIleri = 1) {
    try {
      const kasaIdInt = parseInt(kasaId);
      
      // Son 30 günün verilerini al
      const otuzGunOnce = new Date();
      otuzGunOnce.setDate(otuzGunOnce.getDate() - 30);
      
      const hareketler = await HareketKayit.findAll({
        where: {
          kasa_id: kasaIdInt,
          olusturma_tarihi: { [Op.gte]: otuzGunOnce }
        },
        include: [{
          model: KasaEtiketi,
          as: 'kasa',
          attributes: ['id', 'mevcut_adet', 'kapasite'],
          required: true
        }],
        order: [['olusturma_tarihi', 'DESC']],
        limit: 1000
      });

      if (hareketler.length < 10) {
        // Yeterli veri yok, basit ortalama döndür
        const kasa = await KasaEtiketi.findByPk(kasaIdInt);
        if (!kasa) {
          throw new Error('Kasa bulunamadı');
        }
        
        const plain = kasa.get({ plain: true });
        return {
          tahmin_adet: plain.mevcut_adet,
          tahmin_doluluk: (plain.mevcut_adet / plain.kapasite) * 100,
          guven_skoru: 0.3,
          yontem: 'basit_ortalama',
          mesaj: 'Yeterli veri yok, mevcut değer kullanıldı'
        };
      }

      // Zaman serisi analizi ile tahmin
      const simdi = new Date();
      const hedefSaat = (simdi.getHours() + saatIleri) % 24;
      const hedefGun = simdi.getDay();

      // Verileri formatla
      const formattedRows = hareketler.map(h => {
        const plain = h.get({ plain: true });
        const tarih = new Date(plain.olusturma_tarihi);
        return {
          mevcut_adet: plain.yeni_adet || plain.kasa?.mevcut_adet || 0,
          saat: tarih.getHours(),
          gun: tarih.getDay()
        };
      });

      // Aynı saat ve gün için geçmiş ortalamaları hesapla
      const ayniSaatGun = formattedRows.filter(r => 
        r.saat === hedefSaat && r.gun === hedefGun
      );

      // Trend analizi
      const son10 = formattedRows.slice(0, 10);
      const trend = this.calculateTrend(son10.map(r => r.mevcut_adet));

      // Ağırlıklı ortalama
      let tahminAdet = 0;
      let toplamAgirlik = 0;

      if (ayniSaatGun.length > 0) {
        // Aynı saat/gün ortalaması (ağırlık: 0.5)
        const ortalama = ayniSaatGun.reduce((sum, r) => sum + r.mevcut_adet, 0) / ayniSaatGun.length;
        tahminAdet += ortalama * 0.5;
        toplamAgirlik += 0.5;
      }

      // Mevcut değer (ağırlık: 0.3)
      const mevcutAdet = formattedRows[0].mevcut_adet;
      tahminAdet += mevcutAdet * 0.3;
      toplamAgirlik += 0.3;

      // Trend (ağırlık: 0.2)
      tahminAdet += (mevcutAdet + trend) * 0.2;
      toplamAgirlik += 0.2;

      tahminAdet = Math.round(tahminAdet / toplamAgirlik);

      // Kasa kapasitesini al
      const kasa = await KasaEtiketi.findByPk(kasaIdInt);
      if (!kasa) {
        throw new Error('Kasa bulunamadı');
      }

      const plainKasa = kasa.get({ plain: true });
      const tahminDoluluk = Math.min(100, (tahminAdet / plainKasa.kapasite) * 100);
      const guvenSkoru = Math.min(0.9, 0.5 + (formattedRows.length / 200) * 0.4);

      return {
        tahmin_adet: tahminAdet,
        tahmin_doluluk: tahminDoluluk,
        guven_skoru: guvenSkoru,
        yontem: 'zaman_serisi_analizi',
        trend: trend > 0 ? 'artis' : trend < 0 ? 'azalis' : 'sabit',
        trend_degeri: trend,
        veri_sayisi: formattedRows.length,
        mesaj: `${saatIleri} saat sonra tahmin edilen doluluk: %${tahminDoluluk.toFixed(1)}`
      };
    } catch (error) {
      console.error('Kasa doluluk tahmini hatası:', error);
      throw error;
    }
  }

  /**
   * Trend hesaplama (basit lineer regresyon)
   */
  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    values.forEach((y, i) => {
      const x = i;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  /**
   * Anomali tespiti - Olağandışı durumları tespit eder
   */
  async detectAnomalies(workstationId, limit = 10) {
    try {
      const workstationIdInt = parseInt(workstationId);
      
      // Son 7 günün verilerini al
      const yediGunOnce = new Date();
      yediGunOnce.setDate(yediGunOnce.getDate() - 7);
      
      const kasalar = await KasaEtiketi.findAll({
        where: {
          workstation_id: workstationIdInt,
          durum: 'aktif'
        },
        attributes: ['id', 'kasa_no', 'kapasite', 'mevcut_adet']
      });

      if (kasalar.length === 0) {
        return [];
      }

      const anomalies = [];

      for (const kasa of kasalar) {
        const plainKasa = kasa.get({ plain: true });
        const doluluk = (plainKasa.mevcut_adet / plainKasa.kapasite) * 100;

        // Son 7 gündeki hareket sayısı
        const hareketSayisi = await HareketKayit.count({
          where: {
            kasa_id: plainKasa.id,
            olusturma_tarihi: { [Op.gte]: yediGunOnce }
          }
        });

        // Anomali 1: Çok yüksek doluluk (>90%)
        if (doluluk > 90) {
          anomalies.push({
            tip: 'yuksek_doluluk',
            onem: 'yuksek',
            kasa_id: plainKasa.id.toString(),
            kasa_no: plainKasa.kasa_no,
            mesaj: `${plainKasa.kasa_no} kasası %${doluluk.toFixed(1)} dolu - Acil müdahale gerekebilir`,
            deger: doluluk,
            eşik: 90
          });
        }

        // Anomali 2: Çok düşük hareket (durgun kasa)
        if (hareketSayisi < 2 && doluluk > 50) {
          anomalies.push({
            tip: 'durgun_kasa',
            onem: 'orta',
            kasa_id: plainKasa.id.toString(),
            kasa_no: plainKasa.kasa_no,
            mesaj: `${plainKasa.kasa_no} kasası son 7 günde sadece ${hareketSayisi} hareket kaydetti - Dikkat gerekebilir`,
            deger: hareketSayisi,
            eşik: 2
          });
        }

        // Anomali 3: Ani doluluk değişimi (son 24 saatte)
        const yirmiDortSaatOnce = new Date();
        yirmiDortSaatOnce.setHours(yirmiDortSaatOnce.getHours() - 24);
        
        const hareketler = await HareketKayit.findAll({
          where: {
            kasa_id: plainKasa.id,
            olusturma_tarihi: { [Op.gte]: yirmiDortSaatOnce }
          },
          attributes: ['onceki_adet', 'yeni_adet']
        });

        if (hareketler.length > 0) {
          const maxDegisim = Math.max(...hareketler.map(h => {
            const plain = h.get({ plain: true });
            return Math.abs((plain.yeni_adet || 0) - (plain.onceki_adet || 0));
          }));

          if (maxDegisim > plainKasa.kapasite * 0.5) {
            anomalies.push({
              tip: 'ani_degisim',
              onem: 'yuksek',
              kasa_id: plainKasa.id.toString(),
              kasa_no: plainKasa.kasa_no,
              mesaj: `${plainKasa.kasa_no} kasasında son 24 saatte ${maxDegisim} adetlik ani değişim tespit edildi`,
              deger: maxDegisim,
              eşik: plainKasa.kapasite * 0.5
            });
          }
        }
      }

      // Anomalileri önem sırasına göre sırala
      const onemSirasi = { 'yuksek': 3, 'orta': 2, 'dusuk': 1 };
      anomalies.sort((a, b) => onemSirasi[b.onem] - onemSirasi[a.onem]);
      
      return anomalies.slice(0, limit);
    } catch (error) {
      console.error('Anomali tespiti hatası:', error);
      throw error;
    }
  }

  /**
   * Optimizasyon önerileri - AI destekli öneriler
   */
  async getOptimizationSuggestions(workstationId) {
    try {
      const workstationIdInt = parseInt(workstationId);
      
      // Son 30 günün verilerini al
      const otuzGunOnce = new Date();
      otuzGunOnce.setDate(otuzGunOnce.getDate() - 30);
      
      const kasalar = await KasaEtiketi.findAll({
        where: {
          workstation_id: workstationIdInt,
          durum: 'aktif'
        },
        attributes: ['id', 'kasa_no', 'kapasite', 'mevcut_adet']
      });

      const suggestions = [];
      const toplamKapasite = kasalar.reduce((sum, k) => {
        const plain = k.get({ plain: true });
        return sum + plain.kapasite;
      }, 0);
      const toplamAdet = kasalar.reduce((sum, k) => {
        const plain = k.get({ plain: true });
        return sum + plain.mevcut_adet;
      }, 0);
      const ortalamaDoluluk = toplamKapasite > 0 ? (toplamAdet / toplamKapasite) * 100 : 0;

      // Her kasa için aktif gün sayısını hesapla
      const kasalarWithAktifGun = await Promise.all(
        kasalar.map(async (kasa) => {
          const plain = kasa.get({ plain: true });
          const hareketler = await HareketKayit.findAll({
            where: {
              kasa_id: plain.id,
              olusturma_tarihi: { [Op.gte]: otuzGunOnce }
            },
            attributes: ['olusturma_tarihi'],
            raw: true
          });
          
          // Unique tarihleri say (JavaScript'te)
          const uniqueTarihler = new Set();
          hareketler.forEach(h => {
            const tarih = new Date(h.olusturma_tarihi);
            const tarihStr = `${tarih.getFullYear()}-${String(tarih.getMonth() + 1).padStart(2, '0')}-${String(tarih.getDate()).padStart(2, '0')}`;
            uniqueTarihler.add(tarihStr);
          });
          
          const doluluk = (plain.mevcut_adet / plain.kapasite) * 100;
          return {
            ...plain,
            doluluk_orani: doluluk,
            aktif_gun_sayisi: uniqueTarihler.size
          };
        })
      );

      // Öneri 1: Yüksek doluluklu kasalar için boşaltma önerisi
      const yuksekDoluluk = kasalarWithAktifGun.filter(k => k.doluluk_orani > 80);
      if (yuksekDoluluk.length > 0) {
        suggestions.push({
          tip: 'bosaltma_onerisi',
          onem: 'yuksek',
          baslik: 'Yüksek Doluluk Uyarısı',
          aciklama: `${yuksekDoluluk.length} kasa %80'in üzerinde dolu. Acil boşaltma önerilir.`,
          kasalar: yuksekDoluluk.map(k => k.kasa_no),
          aksiyon: 'bosaltma_planla'
        });
      }

      // Öneri 2: Düşük kullanımlı kasalar için optimizasyon
      const dusukKullanim = kasalarWithAktifGun.filter(k => k.aktif_gun_sayisi < 10 && k.doluluk_orani < 30);
      if (dusukKullanim.length > 0) {
        suggestions.push({
          tip: 'kapasite_optimizasyonu',
          onem: 'orta',
          baslik: 'Kapasite Optimizasyonu',
          aciklama: `${dusukKullanim.length} kasa düşük kullanımda. Kapasite yeniden dağıtımı düşünülebilir.`,
          kasalar: dusukKullanim.map(k => k.kasa_no),
          aksiyon: 'kapasite_yeniden_dagıt'
        });
      }

      // Öneri 3: Genel doluluk analizi
      if (ortalamaDoluluk > 75) {
        suggestions.push({
          tip: 'genel_doluluk_uyarisi',
          onem: 'yuksek',
          baslik: 'Yüksek Genel Doluluk',
          aciklama: `Workstation genel doluluk oranı %${ortalamaDoluluk.toFixed(1)}. Yeni kasa eklenmesi önerilir.`,
          aksiyon: 'yeni_kasa_ekle'
        });
      } else if (ortalamaDoluluk < 30) {
        suggestions.push({
          tip: 'dusuk_kullanim',
          onem: 'dusuk',
          baslik: 'Düşük Kullanım',
          aciklama: `Workstation genel doluluk oranı %${ortalamaDoluluk.toFixed(1)}. Mevcut kapasite yeterli görünüyor.`,
          aksiyon: 'monitor_et'
        });
      }

      return suggestions;
    } catch (error) {
      console.error('Optimizasyon önerileri hatası:', error);
      throw error;
    }
  }

  /**
   * Forkliftçi performans analizi - AI destekli
   */
  async analyzeForkliftciPerformance(forkliftciId, periyot = 30) {
    try {
      const forkliftciIdInt = parseInt(forkliftciId);
      
      // Son N günün verilerini al
      const periyotOnce = new Date();
      periyotOnce.setDate(periyotOnce.getDate() - periyot);
      
      const aktiviteler = await ForkliftciAktivite.findAll({
        where: {
          forkliftci_id: forkliftciIdInt,
          olusturma_tarihi: { [Op.gte]: periyotOnce }
        },
        attributes: [
          'aktivite_tipi',
          [sequelize.fn('COUNT', sequelize.col('id')), 'sayi'],
          [sequelize.fn('AVG', sequelize.col('sure_saniye')), 'ortalama_sure'],
          [sequelize.fn('SUM', sequelize.col('sure_saniye')), 'toplam_sure']
        ],
        group: ['aktivite_tipi'],
        raw: true
      });

      const analiz = {
        toplam_aktivite: 0,
        performans_skoru: 0,
        güçlü_yönler: [],
        iyilestirme_alanlari: [],
        oneriler: []
      };

      aktiviteler.forEach(akt => {
        analiz.toplam_aktivite += parseInt(akt.sayi || 0);
      });

      // Performans skoru hesaplama
      const onaySayisi = parseInt(aktiviteler.find(a => a.aktivite_tipi === 'bildirim_onaylandi')?.sayi || 0);
      const redSayisi = parseInt(aktiviteler.find(a => a.aktivite_tipi === 'bildirim_reddedildi')?.sayi || 0);
      const toplamBildirim = onaySayisi + redSayisi;
      
      if (toplamBildirim > 0) {
        analiz.performans_skoru = (onaySayisi / toplamBildirim) * 100;
      }

      // Güçlü yönler
      if (onaySayisi > redSayisi * 2) {
        analiz.güçlü_yönler.push('Yüksek bildirim onay oranı');
      }

      // İyileştirme alanları
      if (redSayisi > onaySayisi) {
        analiz.iyilestirme_alanlari.push('Bildirim onay oranı düşük');
      }

      // Öneriler
      if (analiz.performans_skoru < 70) {
        analiz.oneriler.push('Bildirim onay oranını artırmak için eğitim önerilir');
      }

      return analiz;
    } catch (error) {
      console.error('Forkliftçi performans analizi hatası:', error);
      throw error;
    }
  }
}

module.exports = new AIService();

