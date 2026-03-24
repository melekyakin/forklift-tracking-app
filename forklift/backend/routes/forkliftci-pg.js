const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { ForkliftciAktivite, Workstation, KasaEtiketi, ForkliftBildirim } = require('../models-pg');
const { authenticateToken } = require('../middleware/auth');
const { sequelize } = require('../models-pg');

// Forkliftçi aktivite kaydı oluştur
router.post('/aktivite', authenticateToken, async (req, res) => {
  try {
    const { aktivite_tipi, workstation_id, kasa_id, bildirim_id, baslangic_zamani, bitis_zamani, aciklama } = req.body;
    
    if (!aktivite_tipi) {
      return res.status(400).json({ error: 'Aktivite tipi gereklidir' });
    }
    
    // Süre hesaplama
    let sure_saniye = null;
    if (baslangic_zamani && bitis_zamani) {
      const baslangic = new Date(baslangic_zamani);
      const bitis = new Date(bitis_zamani);
      sure_saniye = Math.floor((bitis - baslangic) / 1000);
    }
    
    const aktivite = await ForkliftciAktivite.create({
      forkliftci_id: parseInt(req.user.id),
      aktivite_tipi,
      workstation_id: workstation_id ? parseInt(workstation_id) : null,
      kasa_id: kasa_id ? parseInt(kasa_id) : null,
      bildirim_id: bildirim_id ? parseInt(bildirim_id) : null,
      baslangic_zamani: baslangic_zamani ? new Date(baslangic_zamani) : null,
      bitis_zamani: bitis_zamani ? new Date(bitis_zamani) : null,
      sure_saniye,
      aciklama: aciklama || null
    });
    
    const plain = aktivite.get({ plain: true });
    
    // WebSocket ile aktivite güncellemesi gönder
    if (global.broadcast) {
      global.broadcast({
        type: 'forkliftci_aktivite',
        data: plain
      });
    }
    
    res.status(201).json(plain);
  } catch (error) {
    console.error('Aktivite kaydı hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Forkliftçinin aktivitelerini getir
router.get('/aktivite', authenticateToken, async (req, res) => {
  try {
    const { forkliftci_id, baslangic_tarihi, bitis_tarihi, aktivite_tipi } = req.query;
    
    const where = {};
    
    // Kullanıcı sadece kendi aktivitelerini görebilir (admin hariç)
    if (req.user.rol !== 'admin' && req.user.rol !== 'yonetici') {
      where.forkliftci_id = parseInt(req.user.id);
    } else if (forkliftci_id) {
      where.forkliftci_id = parseInt(forkliftci_id);
    }
    
    if (aktivite_tipi) {
      where.aktivite_tipi = aktivite_tipi;
    }
    
    if (baslangic_tarihi || bitis_tarihi) {
      where.olusturma_tarihi = {};
      if (baslangic_tarihi) {
        where.olusturma_tarihi[Op.gte] = new Date(baslangic_tarihi);
      }
      if (bitis_tarihi) {
        const bitis = new Date(bitis_tarihi);
        bitis.setHours(23, 59, 59, 999);
        where.olusturma_tarihi[Op.lte] = bitis;
      }
    }
    
    const aktiviteler = await ForkliftciAktivite.findAll({
      where,
      include: [{
        model: Workstation,
        as: 'workstation',
        attributes: ['id', 'workstation_adi', 'workstation_no'],
        required: false
      }, {
        model: KasaEtiketi,
        as: 'kasa',
        attributes: ['id', 'kasa_no'],
        required: false
      }, {
        model: ForkliftBildirim,
        as: 'bildirim',
        attributes: ['id', 'mesaj'],
        required: false
      }],
      order: [['olusturma_tarihi', 'DESC']],
      limit: 500
    });
    
    const formatted = aktiviteler.map(akt => {
      const plain = akt.get({ plain: true });
      return {
        ...plain,
        id: plain.id.toString(),
        forkliftci_id: plain.forkliftci_id.toString(),
        workstation_adi: plain.workstation?.workstation_adi || null,
        workstation_no: plain.workstation?.workstation_no || null,
        kasa_no: plain.kasa?.kasa_no || null,
        bildirim_mesaj: plain.bildirim?.mesaj || null
      };
    });
    
    res.json(formatted);
  } catch (error) {
    console.error('Aktivite listesi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Forkliftçi KPI'ları getir
router.get('/kpi', authenticateToken, async (req, res) => {
  try {
    const { forkliftci_id, periyot } = req.query; // periyot: 'gunluk', 'haftalik', 'aylik'
    
    const forkliftciId = req.user.rol === 'admin' || req.user.rol === 'yonetici' 
      ? (forkliftci_id ? parseInt(forkliftci_id) : parseInt(req.user.id))
      : parseInt(req.user.id);
    
    const where = { forkliftci_id: forkliftciId };
    
    // Tarih filtresi
    const now = new Date();
    switch(periyot) {
      case 'gunluk':
        where.olusturma_tarihi = { [Op.gte]: new Date(now.setHours(0, 0, 0, 0)) };
        break;
      case 'haftalik':
        const haftaOnce = new Date();
        haftaOnce.setDate(haftaOnce.getDate() - 7);
        where.olusturma_tarihi = { [Op.gte]: haftaOnce };
        break;
      case 'aylik':
        const ayOnce = new Date();
        ayOnce.setMonth(ayOnce.getMonth() - 1);
        where.olusturma_tarihi = { [Op.gte]: ayOnce };
        break;
      default:
        const bugun = new Date();
        bugun.setHours(0, 0, 0, 0);
        where.olusturma_tarihi = { [Op.gte]: bugun };
    }
    
    const kpi = {};
    
    // Toplam aktivite sayısı
    kpi.toplam_aktivite = await ForkliftciAktivite.count({ where });
    
    // Bildirim onay sayısı
    kpi.bildirim_onay = await ForkliftciAktivite.count({
      where: { ...where, aktivite_tipi: 'bildirim_onaylandi' }
    });
    
    // Bildirim red sayısı - hem aktivite hem de bildirim tablosundan say
    const aktiviteRedSayisi = await ForkliftciAktivite.count({
      where: { ...where, aktivite_tipi: 'bildirim_reddedildi' }
    });
    
    // ForkliftBildirim tablosundan da reddedilmiş bildirimleri say
    const bildirimRedWhere = {
      forkliftci_id: forkliftciId,
      durum: 'reddedildi'
    };
    
    // Tarih filtresi için red_tarihi kullan
    switch(periyot) {
      case 'gunluk':
        const bugun = new Date();
        bugun.setHours(0, 0, 0, 0);
        bildirimRedWhere.red_tarihi = { [Op.gte]: bugun };
        break;
      case 'haftalik':
        const haftaOnce = new Date();
        haftaOnce.setDate(haftaOnce.getDate() - 7);
        bildirimRedWhere.red_tarihi = { [Op.gte]: haftaOnce };
        break;
      case 'aylik':
        const ayOnce = new Date();
        ayOnce.setMonth(ayOnce.getMonth() - 1);
        bildirimRedWhere.red_tarihi = { [Op.gte]: ayOnce };
        break;
      default:
        const bugunDefault = new Date();
        bugunDefault.setHours(0, 0, 0, 0);
        bildirimRedWhere.red_tarihi = { [Op.gte]: bugunDefault };
    }
    
    const bildirimRedSayisi = await ForkliftBildirim.count({
      where: bildirimRedWhere
    });
    
    // İki sayıyı birleştir (aktivite kaydı yoksa bile bildirim tablosundan say)
    kpi.bildirim_red = Math.max(aktiviteRedSayisi, bildirimRedSayisi);
    
    // Kasa güncelleme sayısı
    kpi.kasa_guncelleme = await ForkliftciAktivite.count({
      where: { ...where, aktivite_tipi: 'kasa_guncelleme' }
    });
    
    // Toplam çalışma süresi (saniye)
    const sureResult = await ForkliftciAktivite.sum('sure_saniye', {
      where: { ...where, sure_saniye: { [Op.ne]: null } }
    });
    kpi.toplam_sure_saniye = sureResult || 0;
    kpi.toplam_sure_dakika = Math.floor(kpi.toplam_sure_saniye / 60);
    kpi.toplam_sure_saat = Math.floor(kpi.toplam_sure_saniye / 3600);
    
    // Ortalama aktivite süresi
    const ortalamaResult = await ForkliftciAktivite.findOne({
      where: { ...where, sure_saniye: { [Op.ne]: null } },
      attributes: [[sequelize.fn('AVG', sequelize.col('sure_saniye')), 'ortalama']],
      raw: true
    });
    kpi.ortalama_sure_saniye = Math.floor(ortalamaResult?.ortalama || 0);
    
    // Çalışılan workstation sayısı - Onaylanan bildirimlerden gelen workstation sayısı
    const bildirimWhere = {
      forkliftci_id: forkliftciId,
      durum: 'onaylandi'
    };
    
    // Tarih filtresi için onay_tarihi kullan (now zaten yukarıda tanımlı)
    switch(periyot) {
      case 'gunluk':
        const bugun = new Date(now);
        bugun.setHours(0, 0, 0, 0);
        bildirimWhere.onay_tarihi = { [Op.gte]: bugun };
        break;
      case 'haftalik':
        const haftaOnce = new Date(now);
        haftaOnce.setDate(haftaOnce.getDate() - 7);
        bildirimWhere.onay_tarihi = { [Op.gte]: haftaOnce };
        break;
      case 'aylik':
        const ayOnce = new Date(now);
        ayOnce.setMonth(ayOnce.getMonth() - 1);
        bildirimWhere.onay_tarihi = { [Op.gte]: ayOnce };
        break;
      default:
        const bugunDefault = new Date(now);
        bugunDefault.setHours(0, 0, 0, 0);
        bildirimWhere.onay_tarihi = { [Op.gte]: bugunDefault };
    }
    
    // Onaylanan bildirimleri al
    const onaylananBildirimler = await ForkliftBildirim.findAll({
      where: bildirimWhere,
      attributes: ['id', 'mesaj']
    });
    
    // Mesajlardan workstation adlarını çıkar
    const workstationAdlari = new Set();
    for (const bildirim of onaylananBildirimler) {
      const plain = bildirim.get({ plain: true });
      if (plain.mesaj) {
        // Mesaj formatı: "{workstation_adi} iş istasyonu..." veya benzeri
        const mesajMatch = plain.mesaj.match(/(.+?)\s+iş\s+istasyonu/i);
        if (mesajMatch && mesajMatch[1]) {
          const workstationAdi = mesajMatch[1].trim();
          workstationAdlari.add(workstationAdi);
        }
      }
    }
    
    // Workstation adlarını Workstation tablosuyla eşleştir ve say
    let calisilanWorkstationSayisi = 0;
    if (workstationAdlari.size > 0) {
      const workstationSayisi = await Workstation.count({
        where: {
          workstation_adi: { [Op.in]: Array.from(workstationAdlari) }
        }
      });
      calisilanWorkstationSayisi = workstationSayisi;
    }
    
    kpi.calisilan_workstation = calisilanWorkstationSayisi;
    
    // Bildirim onay oranı
    const toplamBildirim = kpi.bildirim_onay + kpi.bildirim_red;
    kpi.bildirim_onay_orani = toplamBildirim > 0 
      ? ((kpi.bildirim_onay / toplamBildirim) * 100).toFixed(2)
      : 0;
    
    res.json(kpi);
  } catch (error) {
    console.error('KPI hesaplama hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Anlık aktivite durumu
router.get('/anlik-durum', authenticateToken, async (req, res) => {
  try {
    const { forkliftci_id } = req.query;
    
    const forkliftciId = req.user.rol === 'admin' || req.user.rol === 'yonetici' 
      ? (forkliftci_id ? parseInt(forkliftci_id) : parseInt(req.user.id))
      : parseInt(req.user.id);
    
    // Son 1 saatteki aktiviteler
    const birSaatOnce = new Date();
    birSaatOnce.setHours(birSaatOnce.getHours() - 1);
    
    const aktiviteler = await ForkliftciAktivite.findAll({
      where: {
        forkliftci_id: forkliftciId,
        olusturma_tarihi: { [Op.gte]: birSaatOnce }
      },
      include: [{
        model: Workstation,
        as: 'workstation',
        attributes: ['id', 'workstation_adi'],
        required: false
      }, {
        model: KasaEtiketi,
        as: 'kasa',
        attributes: ['id', 'kasa_no'],
        required: false
      }],
      order: [['olusturma_tarihi', 'DESC']],
      limit: 50
    });
    
    const formatted = aktiviteler.map(akt => {
      const plain = akt.get({ plain: true });
      return {
        ...plain,
        id: plain.id.toString(),
        forkliftci_id: plain.forkliftci_id.toString(),
        workstation_adi: plain.workstation?.workstation_adi || null,
        kasa_no: plain.kasa?.kasa_no || null
      };
    });
    
    res.json(formatted);
  } catch (error) {
    console.error('Anlık durum hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

