const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { ForkliftciKonum, Workstation, Kullanici } = require('../models-pg');
const { authenticateToken, authorize } = require('../middleware/auth');
const locationService = require('../services/location-pg');

/**
 * Forkliftçinin kendi konumunu kaydet (manuel veya mobil uygulamadan)
 */
router.post('/kaydet', authenticateToken, async (req, res) => {
  try {
    const forkliftciId = parseInt(req.user.id);
    const { enlem, boylam, hiz, yon, adres, batarya, wifi } = req.body;

    if (!enlem || !boylam) {
      return res.status(400).json({ error: 'Enlem ve boylam gereklidir' });
    }

    // Eğer adres verilmemişse, koordinatlardan al
    let finalAdres = adres;
    if (!finalAdres) {
      try {
        finalAdres = await locationService.getAddressFromCoordinates(enlem, boylam);
      } catch (error) {
        console.error('Adres alma hatası:', error);
      }
    }

    // Kaynak tipini belirle (otomatik veya manuel)
    const kaynak = req.body.kaynak || 'manuel';
    
    const location = await locationService.saveLocation(forkliftciId, {
      enlem: parseFloat(enlem),
      boylam: parseFloat(boylam),
      hiz: hiz ? parseFloat(hiz) : 0,
      yon: yon ? parseFloat(yon) : 0,
      adres: finalAdres,
      batarya: batarya ? parseInt(batarya) : null,
      wifi: wifi || null,
      kaynak: kaynak
    });

    res.json({ message: 'Konum başarıyla kaydedildi', location });
  } catch (error) {
    console.error('Konum kaydetme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Forkliftçinin son konumunu getir
 */
router.get('/son', authenticateToken, async (req, res) => {
  try {
    const forkliftciId = parseInt(req.user.id);
    const location = await locationService.getLastLocation(forkliftciId);
    
    if (!location) {
      return res.status(404).json({ error: 'Konum bulunamadı' });
    }

    res.json(location);
  } catch (error) {
    console.error('Konum getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Tüm forkliftçilerin son konumlarını getir (admin/yönetici)
 */
router.get('/tum', authenticateToken, authorize('admin', 'yonetici'), async (req, res) => {
  try {
    const locations = await locationService.getAllLastLocations();
    res.json(locations);
  } catch (error) {
    console.error('Konumlar getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Forkliftçinin konum geçmişini getir
 */
router.get('/gecmis', authenticateToken, async (req, res) => {
  try {
    const forkliftciId = parseInt(req.user.id);
    const { baslangic_tarihi, bitis_tarihi, limit } = req.query;

    const history = await locationService.getLocationHistory(forkliftciId, {
      baslangic_tarihi,
      bitis_tarihi,
      limit: limit ? parseInt(limit) : 1000
    });

    res.json(history);
  } catch (error) {
    console.error('Konum geçmişi getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * QR kod veya NFC ile konum kaydetme (workstation bazlı)
 */
router.post('/qr-kaydet', authenticateToken, async (req, res) => {
  try {
    const forkliftciId = parseInt(req.user.id);
    const { workstation_id, qr_data } = req.body;

    if (!workstation_id) {
      return res.status(400).json({ error: 'İş istasyonu ID gereklidir' });
    }

    const workstationId = parseInt(workstation_id);
    // Workstation'ın konumunu veritabanından al
    const workstation = await Workstation.findByPk(workstationId);

    if (!workstation) {
      return res.status(404).json({ error: 'İş istasyonu bulunamadı' });
    }

    const plainWs = workstation.get({ plain: true });
    // Workstation'ın konumu yoksa GPS konumunu kullan
    if (!plainWs.enlem || !plainWs.boylam) {
      return res.status(400).json({ error: 'İş istasyonunun konumu tanımlı değil' });
    }

    const location = await locationService.saveLocation(forkliftciId, {
      enlem: plainWs.enlem,
      boylam: plainWs.boylam,
      adres: plainWs.adres || '',
      kaynak: 'qr'
    });

    res.json({ message: 'Konum QR kod ile kaydedildi', location });
  } catch (error) {
    console.error('QR konum kaydetme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Forkliftçinin hareket durumunu getir
 */
router.get('/hareket-durumu', authenticateToken, async (req, res) => {
  try {
    const forkliftciId = parseInt(req.user.id);
    const movementStatus = await locationService.getMovementStatus(forkliftciId);
    res.json(movementStatus);
  } catch (error) {
    console.error('Hareket durumu getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Tüm forkliftçilerin hareket durumlarını getir (admin/yönetici)
 */
router.get('/hareket-durumlari', authenticateToken, authorize('admin', 'yonetici'), async (req, res) => {
  try {
    const locations = await locationService.getAllLastLocations();
    const movementStatuses = locations.map(loc => ({
      forkliftci_id: loc.forkliftci_id,
      ad_soyad: loc.ad_soyad,
      kullanici_adi: loc.kullanici_adi,
      hareket_durumu: loc.hareket_durumu || 'bilinmiyor',
      mesafe_metre: loc.mesafe_metre,
      son_guncelleme: loc.olusturma_tarihi,
      konum: {
        enlem: loc.enlem,
        boylam: loc.boylam
      }
    }));
    res.json(movementStatuses);
  } catch (error) {
    console.error('Hareket durumları getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

