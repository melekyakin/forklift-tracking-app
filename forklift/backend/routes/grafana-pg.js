const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { KasaEtiketi, ForkliftBildirim, Workstation, HareketKayit, ForkliftciAktivite, Kullanici } = require('../models-pg');
const { sequelize } = require('../models-pg');

// Grafana JSON API endpoint'leri
// Grafana Simple JSON Datasource için uyumlu format

/**
 * Time series veri formatı
 * Grafana'nın beklediği format: [{ "target": "series1", "datapoints": [[value, timestamp], ...] }]
 */
// Grafana Simple JSON Datasource için query endpoint
router.post('/query', async (req, res) => {
  try {
    const body = req.body;
    
    // Grafana Simple JSON formatı
    if (body.targets && body.targets.length > 0) {
      const fromDate = new Date(body.range.from);
      const toDate = new Date(body.range.to);
      const maxDataPoints = body.maxDataPoints || 100;
      
      const results = [];
      
      for (const target of body.targets) {
        const targetName = target.target || target.refId;
        let result = [];
        
        switch (targetName) {
          case 'kasa_doluluk_ortalamasi':
            result = await getKasaDolulukOrtalamasi(fromDate, toDate, maxDataPoints);
            break;
          case 'bildirim_sayisi':
            result = await getBildirimSayisi(fromDate, toDate, maxDataPoints);
            break;
          case 'bildirim_onay_orani':
            result = await getBildirimOnayOrani(fromDate, toDate, maxDataPoints);
            break;
          case 'workstation_aktivite':
            result = await getWorkstationAktivite(fromDate, toDate, maxDataPoints);
            break;
          case 'forkliftci_performans':
            result = await getForkliftciPerformans(fromDate, toDate, maxDataPoints);
            break;
          case 'kasa_hareket_sayisi':
            result = await getKasaHareketSayisi(fromDate, toDate, maxDataPoints);
            break;
          default:
            result = [];
        }
        
        results.push(...result);
      }
      
      res.json(results);
    } else {
      // Eski format desteği (GET)
      const { target, from, to, maxDataPoints } = req.query;
      
      if (!target) {
        return res.json([]);
      }
      
      const fromDate = new Date(parseInt(from));
      const toDate = new Date(parseInt(to));
      
      let result = [];
      
      switch (target) {
        case 'kasa_doluluk_ortalamasi':
          result = await getKasaDolulukOrtalamasi(fromDate, toDate, maxDataPoints);
          break;
        case 'bildirim_sayisi':
          result = await getBildirimSayisi(fromDate, toDate, maxDataPoints);
          break;
        case 'bildirim_onay_orani':
          result = await getBildirimOnayOrani(fromDate, toDate, maxDataPoints);
          break;
        case 'workstation_aktivite':
          result = await getWorkstationAktivite(fromDate, toDate, maxDataPoints);
          break;
        case 'forkliftci_performans':
          result = await getForkliftciPerformans(fromDate, toDate, maxDataPoints);
          break;
        case 'kasa_hareket_sayisi':
          result = await getKasaHareketSayisi(fromDate, toDate, maxDataPoints);
          break;
        default:
          result = [];
      }
      
      res.json(result);
    }
  } catch (error) {
    console.error('Grafana query hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Search endpoint - Grafana'da görünecek metrikleri listeler
 */
router.get('/search', (req, res) => {
  const metrics = [
    'kasa_doluluk_ortalamasi',
    'bildirim_sayisi',
    'bildirim_onay_orani',
    'workstation_aktivite',
    'forkliftci_performans',
    'kasa_hareket_sayisi'
  ];
  
  res.json(metrics);
});

/**
 * Annotations endpoint - Grafana'da annotation'lar için
 */
router.post('/annotations', async (req, res) => {
  try {
    const body = req.body;
    const fromDate = body.range ? new Date(body.range.from) : new Date(parseInt(req.query.from));
    const toDate = body.range ? new Date(body.range.to) : new Date(parseInt(req.query.to));
    
    // Önemli olayları annotation olarak döndür
    const annotations = await getAnnotations(fromDate, toDate);
    
    res.json(annotations);
  } catch (error) {
    console.error('Grafana annotations hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET desteği (geriye dönük uyumluluk)
router.get('/annotations', async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = new Date(parseInt(from));
    const toDate = new Date(parseInt(to));
    
    const annotations = await getAnnotations(fromDate, toDate);
    res.json(annotations);
  } catch (error) {
    console.error('Grafana annotations hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper fonksiyonlar

async function getKasaDolulukOrtalamasi(fromDate, toDate, maxDataPoints) {
  const interval = Math.floor((toDate - fromDate) / (maxDataPoints || 100));
  
  const datapoints = [];
  let currentDate = new Date(fromDate);
  
  // Tüm aktif kasaları bir kez al (performans için)
  const tumKasalar = await KasaEtiketi.findAll({
    where: { durum: 'aktif' }
  });
  
  if (tumKasalar.length === 0) {
    // Hiç kasa yoksa, tüm zaman aralığı için 0 döndür
    while (currentDate <= toDate) {
      datapoints.push([0, currentDate.getTime()]);
      currentDate = new Date(currentDate.getTime() + interval);
    }
    return [{
      target: 'Kasa Doluluk Ortalaması (%)',
      datapoints: datapoints
    }];
  }
  
  // Tüm zaman aralığı için hareket kayıtlarını bir kez al (performans için)
  const tumHareketKayitlari = await HareketKayit.findAll({
    where: {
      olusturma_tarihi: {
        [Op.gte]: fromDate,
        [Op.lte]: toDate
      }
    },
    order: [['olusturma_tarihi', 'ASC']]
  });
  
  // Her zaman noktası için, o zamana kadar olan hareket kayıtlarından kasa durumlarını hesapla
  while (currentDate <= toDate) {
    const nextDate = new Date(currentDate.getTime() + interval);
    
    // Her kasa için başlangıç durumu (mevcut adet)
    const kasaDurumlari = {};
    tumKasalar.forEach(k => {
      const plain = k.get({ plain: true });
      kasaDurumlari[plain.id] = {
        mevcut_adet: plain.mevcut_adet,
        kapasite: plain.kapasite
      };
    });
    
    // Bu zamana kadar olan hareket kayıtlarını işle
    const buZamanaKadarHareketler = tumHareketKayitlari.filter(hk => {
      const plain = hk.get({ plain: true });
      const tarih = new Date(plain.olusturma_tarihi);
      return tarih <= nextDate;
    });
    
    // Her kasa için en son hareket kaydını bul ve güncelle
    const kasaSonHareketleri = {};
    buZamanaKadarHareketler.forEach(hk => {
      const plain = hk.get({ plain: true });
      if (plain.kasa_id && plain.yeni_adet !== null && plain.yeni_adet !== undefined) {
        kasaSonHareketleri[plain.kasa_id] = plain.yeni_adet;
      }
    });
    
    // Son hareket kayıtlarından güncelle
    Object.keys(kasaSonHareketleri).forEach(kasaId => {
      const kasaIdInt = parseInt(kasaId);
      if (kasaDurumlari[kasaIdInt]) {
        kasaDurumlari[kasaIdInt].mevcut_adet = kasaSonHareketleri[kasaId];
      }
    });
    
    // Ortalama doluluk hesapla
    const toplamDoluluk = Object.values(kasaDurumlari).reduce((sum, k) => {
      const doluluk = k.kapasite > 0 ? (k.mevcut_adet / k.kapasite) * 100 : 0;
      return sum + doluluk;
    }, 0);
    
    const ortalama = tumKasalar.length > 0 ? toplamDoluluk / tumKasalar.length : 0;
    datapoints.push([Math.round(ortalama * 100) / 100, currentDate.getTime()]);
    
    currentDate = nextDate;
  }
  
  return [{
    target: 'Kasa Doluluk Ortalaması (%)',
    datapoints: datapoints
  }];
}

async function getBildirimSayisi(fromDate, toDate, maxDataPoints) {
  const interval = Math.floor((toDate - fromDate) / (maxDataPoints || 100));
  
  const datapoints = [];
  let currentDate = new Date(fromDate);
  
  while (currentDate <= toDate) {
    const nextDate = new Date(currentDate.getTime() + interval);
    
    const count = await ForkliftBildirim.count({
      where: {
        olusturma_tarihi: {
          [Op.gte]: currentDate,
          [Op.lt]: nextDate
        }
      }
    });
    
    datapoints.push([count, currentDate.getTime()]);
    currentDate = nextDate;
  }
  
  return [{
    target: 'Bildirim Sayısı',
    datapoints: datapoints
  }];
}

async function getBildirimOnayOrani(fromDate, toDate, maxDataPoints) {
  const interval = Math.floor((toDate - fromDate) / (maxDataPoints || 100));
  
  const datapoints = [];
  let currentDate = new Date(fromDate);
  
  // Tüm zaman aralığı için toplam ve onaylanan sayıları hesapla (performans için)
  const tumBildirimler = await ForkliftBildirim.findAll({
    where: {
      olusturma_tarihi: {
        [Op.gte]: fromDate,
        [Op.lte]: toDate
      }
    },
    attributes: ['id', 'durum', 'olusturma_tarihi']
  });
  
  while (currentDate <= toDate) {
    const nextDate = new Date(currentDate.getTime() + interval);
    
    // Bu zaman aralığındaki bildirimleri filtrele
    const zamanAraligiBildirimler = tumBildirimler.filter(b => {
      const plain = b.get({ plain: true });
      const tarih = new Date(plain.olusturma_tarihi);
      return tarih >= currentDate && tarih < nextDate;
    });
    
    const toplam = zamanAraligiBildirimler.length;
    const onaylanan = zamanAraligiBildirimler.filter(b => {
      const plain = b.get({ plain: true });
      return plain.durum === 'onaylandi';
    }).length;
    
    const oran = toplam > 0 ? (onaylanan / toplam) * 100 : null;
    
    // Eğer bu zaman aralığında bildirim yoksa, önceki değeri kullan veya null
    if (oran === null && datapoints.length > 0) {
      // Önceki değeri kullan
      const sonDeger = datapoints[datapoints.length - 1][0];
      datapoints.push([sonDeger !== null ? sonDeger : 0, currentDate.getTime()]);
    } else {
      datapoints.push([oran !== null ? oran : 0, currentDate.getTime()]);
    }
    
    currentDate = nextDate;
  }
  
  return [{
    target: 'Bildirim Onay Oranı (%)',
    datapoints: datapoints
  }];
}

async function getWorkstationAktivite(fromDate, toDate, maxDataPoints) {
  const workstations = await Workstation.findAll({
    where: { durum: 'aktif' }
  });
  const results = [];
  
  for (const ws of workstations) {
    const plainWs = ws.get({ plain: true });
    const interval = Math.floor((toDate - fromDate) / (maxDataPoints || 100));
    const datapoints = [];
    let currentDate = new Date(fromDate);
    
    // Bu workstation'a ait kasaları bul
    const kasalar = await KasaEtiketi.findAll({
      where: {
        workstation_id: plainWs.id,
        durum: 'aktif'
      }
    });
    
    const kasaIds = kasalar.map(k => k.id);
    
    while (currentDate <= toDate) {
      const nextDate = new Date(currentDate.getTime() + interval);
      
      const count = await HareketKayit.count({
        where: {
          olusturma_tarihi: {
            [Op.gte]: currentDate,
            [Op.lt]: nextDate
          },
          kasa_id: { [Op.in]: kasaIds }
        }
      });
      
      datapoints.push([count, currentDate.getTime()]);
      currentDate = nextDate;
    }
    
    results.push({
      target: `${plainWs.workstation_adi} Aktivite`,
      datapoints: datapoints
    });
  }
  
  return results;
}

async function getForkliftciPerformans(fromDate, toDate, maxDataPoints) {
  const forkliftciler = await Kullanici.findAll({
    where: {
      rol: 'forkliftoperator',
      durum: 'aktif'
    }
  });
  
  const results = [];
  
  for (const forkliftci of forkliftciler) {
    const plainForkliftci = forkliftci.get({ plain: true });
    const interval = Math.floor((toDate - fromDate) / (maxDataPoints || 100));
    const datapoints = [];
    let currentDate = new Date(fromDate);
    
    while (currentDate <= toDate) {
      const nextDate = new Date(currentDate.getTime() + interval);
      
      const toplam = await ForkliftBildirim.count({
        where: {
          forkliftci_id: plainForkliftci.id,
          olusturma_tarihi: {
            [Op.gte]: currentDate,
            [Op.lt]: nextDate
          }
        }
      });
      
      const onaylanan = await ForkliftBildirim.count({
        where: {
          forkliftci_id: plainForkliftci.id,
          olusturma_tarihi: {
            [Op.gte]: currentDate,
            [Op.lt]: nextDate
          },
          durum: 'onaylandi'
        }
      });
      
      const performans = toplam > 0 ? (onaylanan / toplam) * 100 : 0;
      datapoints.push([performans, currentDate.getTime()]);
      
      currentDate = nextDate;
    }
    
    results.push({
      target: `${plainForkliftci.ad_soyad} Performans (%)`,
      datapoints: datapoints
    });
  }
  
  return results;
}

async function getKasaHareketSayisi(fromDate, toDate, maxDataPoints) {
  const interval = Math.floor((toDate - fromDate) / (maxDataPoints || 100));
  
  const datapoints = [];
  let currentDate = new Date(fromDate);
  
  while (currentDate <= toDate) {
    const nextDate = new Date(currentDate.getTime() + interval);
    
    const count = await HareketKayit.count({
      where: {
        olusturma_tarihi: {
          [Op.gte]: currentDate,
          [Op.lt]: nextDate
        }
      }
    });
    
    datapoints.push([count, currentDate.getTime()]);
    currentDate = nextDate;
  }
  
  return [{
    target: 'Kasa Hareket Sayısı',
    datapoints: datapoints
  }];
}

async function getAnnotations(fromDate, toDate) {
  const bildirimler = await ForkliftBildirim.findAll({
    where: {
      olusturma_tarihi: {
        [Op.gte]: fromDate,
        [Op.lte]: toDate
      },
      durum: 'onaylandi'
    },
    include: [{
      model: KasaEtiketi,
      as: 'kasa',
      attributes: ['id', 'kasa_no'],
      include: [{
        model: Workstation,
        as: 'workstation',
        attributes: ['id', 'workstation_adi'],
        required: false
      }],
      required: false
    }],
    order: [['olusturma_tarihi', 'DESC']],
    limit: 50
  });
  
  return bildirimler.map(b => {
    const plain = b.get({ plain: true });
    const workstationAdi = plain.kasa?.workstation?.workstation_adi || 'Bilinmeyen';
    const onayTarihi = plain.onay_tarihi || plain.olusturma_tarihi;
    
    return {
      annotation: {
        name: 'Bildirim Onaylandı',
        enabled: true,
        datasource: 'Forklift API',
        iconColor: 'green',
        title: `${workstationAdi} - ${plain.mesaj}`,
        time: new Date(onayTarihi).getTime(),
        text: plain.mesaj,
        tags: ['bildirim', 'onaylandi']
      },
      title: `${workstationAdi} - ${plain.mesaj}`,
      time: new Date(onayTarihi).getTime(),
      text: plain.mesaj,
      tags: ['bildirim', 'onaylandi']
    };
  });
}

module.exports = router;

