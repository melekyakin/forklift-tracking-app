const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { HareketKayit, ForkliftBildirim, ForkliftciAktivite } = require('../models-pg');
const { authenticateToken, authorize } = require('../middleware/auth');
const { sequelize } = require('../models-pg');

// Tüm hareket kayıtlarını getir
router.get('/hareketler', authenticateToken, async (req, res) => {
  try {
    const { forkliftci_id, islem_tipi, tarih } = req.query;
    
    const where = {};
    
    if (forkliftci_id) {
      where.forkliftci_id = parseInt(forkliftci_id);
    }
    
    if (islem_tipi) {
      where.islem_tipi = islem_tipi;
    }
    
    // Tarih filtresi - forkliftçinin onayladığı tarihe göre
    let tarihFiltresi = null;
    if (tarih) {
      const secilenTarih = new Date(tarih);
      const baslangic = new Date(secilenTarih);
      baslangic.setHours(0, 0, 0, 0);
      const bitis = new Date(secilenTarih);
      bitis.setHours(23, 59, 59, 999);
      
      tarihFiltresi = {
        [Op.gte]: baslangic,
        [Op.lte]: bitis
      };
    }
    
    // Bildirim onaylandı/reddedildi işlemleri için ForkliftBildirim tablosundan onay_tarihi'ne göre filtrele
    if (tarihFiltresi && (islem_tipi === 'bildirim_onaylandi' || islem_tipi === 'bildirim_reddedildi')) {
      // ForkliftBildirim'den onay/red tarihine göre filtrele
      const bildirimWhere = {};
      if (islem_tipi === 'bildirim_onaylandi') {
        bildirimWhere.durum = 'onaylandi';
        bildirimWhere.onay_tarihi = tarihFiltresi;
      } else if (islem_tipi === 'bildirim_reddedildi') {
        bildirimWhere.durum = 'reddedildi';
        bildirimWhere.red_tarihi = tarihFiltresi;
      }
      
      if (forkliftci_id) {
        bildirimWhere.forkliftci_id = parseInt(forkliftci_id);
      }
      
      const bildirimler = await ForkliftBildirim.findAll({
        where: bildirimWhere,
        attributes: ['id', 'forkliftci_id']
      });
      
      const bildirimForkliftciIds = [...new Set(bildirimler.map(b => b.forkliftci_id).filter(id => id !== null))];
      
      if (bildirimForkliftciIds.length > 0) {
        // Hareket kayıtlarında forkliftci_id ve işlem_tipi ile eşleşenleri bul
        where.forkliftci_id = { [Op.in]: bildirimForkliftciIds };
        where.islem_tipi = islem_tipi;
        // Tarih filtresini olusturma_tarihi'ne de uygula (bildirim onay tarihi ile yaklaşık eşleşme)
        where.olusturma_tarihi = tarihFiltresi;
      } else {
        // Eşleşen bildirim yoksa boş sonuç döndür
        return res.json([]);
      }
    } else if (tarihFiltresi) {
      // Diğer işlem tipleri için olusturma_tarihi'ne göre filtrele
      where.olusturma_tarihi = tarihFiltresi;
    }
    
    // Admin ve yönetici için limit yok, tüm veriler görünmeli
    const isAdminOrYonetici = req.user.rol === 'admin' || req.user.rol === 'yonetici';
    const findOptions = {
      where,
      order: [['olusturma_tarihi', 'DESC']]
    };
    
    // Sadece forkliftçi için limit uygula
    if (!isAdminOrYonetici) {
      findOptions.limit = 1000;
    }
    
    const hareketler = await HareketKayit.findAll(findOptions);
    
    const formatted = hareketler.map(hareket => {
      const plain = hareket.get({ plain: true });
      return {
        ...plain,
        id: plain.id.toString()
      };
    });
    
    res.json(formatted);
  } catch (error) {
    console.error('Hareket kayıtları hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// İstatistikler
router.get('/istatistikler', authenticateToken, async (req, res) => {
  try {
    const istatistikler = {};
    
    
    // Bekleyen bildirimler
    istatistikler.bekleyen_bildirim = await ForkliftBildirim.count({
      where: { durum: 'beklemede' }
    });
    
    // Toplam hareket sayısı
    istatistikler.toplam_hareket = await HareketKayit.count();
    
    // Günlük hareket sayısı
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);
    istatistikler.gunluk_hareket = await HareketKayit.count({
      where: {
        olusturma_tarihi: { [Op.gte]: bugun }
      }
    });
    
    res.json(istatistikler);
  } catch (error) {
    console.error('İstatistik hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Kasa bazlı rapor
module.exports = router;

