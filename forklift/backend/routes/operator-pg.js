const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { OperatorKayit, MesaiKayit, AlanTakip, Kullanici, Workstation } = require('../models-pg');
const { authenticateToken, authorize } = require('../middleware/auth');

/**
 * Operatör kaydı oluştur/güncelle
 */
router.post('/kayit', authenticateToken, authorize('admin', 'yonetici'), async (req, res) => {
  try {
    const {
      operator_id,
      kimlik_no,
      ehliyet_no,
      ehliyet_sinifi,
      telefon,
      email,
      adres,
      ise_baslama_tarihi
    } = req.body;

    if (!operator_id) {
      return res.status(400).json({ error: 'Operatör ID gereklidir' });
    }

    const operatorId = parseInt(operator_id);

    // Mevcut kaydı kontrol et
    let existing = await OperatorKayit.findOne({
      where: { operator_id: operatorId }
    });

    if (existing) {
      // Güncelle
      existing.kimlik_no = kimlik_no || null;
      existing.ehliyet_no = ehliyet_no || null;
      existing.ehliyet_sinifi = ehliyet_sinifi || null;
      existing.telefon = telefon || null;
      existing.email = email || null;
      existing.adres = adres || null;
      existing.ise_baslama_tarihi = ise_baslama_tarihi ? new Date(ise_baslama_tarihi) : null;
      await existing.save();
      
      const plain = existing.get({ plain: true });
      res.json(plain);
    } else {
      // Yeni kayıt
      const newRecord = await OperatorKayit.create({
        operator_id: operatorId,
        kimlik_no: kimlik_no || null,
        ehliyet_no: ehliyet_no || null,
        ehliyet_sinifi: ehliyet_sinifi || null,
        telefon: telefon || null,
        email: email || null,
        adres: adres || null,
        ise_baslama_tarihi: ise_baslama_tarihi ? new Date(ise_baslama_tarihi) : null
      });
      
      const plain = newRecord.get({ plain: true });
      res.status(201).json(plain);
    }
  } catch (error) {
    console.error('Operatör kaydı hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Operatör kaydını getir
 */
router.get('/kayit/:operatorId', authenticateToken, async (req, res) => {
  try {
    const { operatorId } = req.params;
    const operatorIdInt = parseInt(operatorId);

    const kayit = await OperatorKayit.findOne({
      where: { operator_id: operatorIdInt },
      include: [{
        model: Kullanici,
        as: 'operator',
        attributes: ['id', 'ad_soyad', 'kullanici_adi', 'rol'],
        required: true
      }]
    });

    if (!kayit) {
      return res.status(404).json({ error: 'Operatör kaydı bulunamadı' });
    }

    const plain = kayit.get({ plain: true });
    res.json({
      ...plain,
      id: plain.id.toString(),
      operator_id: plain.operator_id.toString(),
      ad_soyad: plain.operator?.ad_soyad || null,
      kullanici_adi: plain.operator?.kullanici_adi || null,
      rol: plain.operator?.rol || null
    });
  } catch (error) {
    console.error('Operatör kaydı getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Mesai başlat
 */
router.post('/mesai/baslat', authenticateToken, async (req, res) => {
  try {
    const operatorId = parseInt(req.user.id);
    const { alan_id, forklift_id } = req.body;

    // Aktif mesai var mı kontrol et
    const activeMesai = await MesaiKayit.findOne({
      where: {
        operator_id: operatorId,
        durum: 'devam_ediyor'
      },
      order: [['baslangic_zamani', 'DESC']]
    });

    if (activeMesai) {
      return res.status(400).json({ error: 'Zaten aktif bir mesai kaydı var' });
    }

    // Yeni mesai başlat
    const newMesai = await MesaiKayit.create({
      operator_id: operatorId,
      baslangic_zamani: new Date(),
      alan_id: alan_id ? parseInt(alan_id) : null,
      forklift_id: forklift_id || null,
      durum: 'devam_ediyor'
    });

    const plain = newMesai.get({ plain: true });
    
    if (global.broadcast) {
      global.broadcast({
        type: 'mesai_basladi',
        data: plain
      });
    }
    
    res.status(201).json(plain);
  } catch (error) {
    console.error('Mesai başlatma hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Mesai bitir
 */
router.post('/mesai/bitir', authenticateToken, async (req, res) => {
  try {
    const operatorId = parseInt(req.user.id);

    // Aktif mesaiyi bul
    const activeMesai = await MesaiKayit.findOne({
      where: {
        operator_id: operatorId,
        durum: 'devam_ediyor'
      },
      order: [['baslangic_zamani', 'DESC']]
    });

    if (!activeMesai) {
      return res.status(400).json({ error: 'Aktif mesai kaydı bulunamadı' });
    }

    // Süre hesapla
    const baslangic = new Date(activeMesai.baslangic_zamani);
    const bitis = new Date();
    const sure_saniye = Math.floor((bitis - baslangic) / 1000);

    // Mesaiyi bitir
    activeMesai.bitis_zamani = bitis;
    activeMesai.toplam_sure_saniye = sure_saniye;
    activeMesai.durum = 'tamamlandi';
    await activeMesai.save();

    const plain = activeMesai.get({ plain: true });
    
    if (global.broadcast) {
      global.broadcast({
        type: 'mesai_bitti',
        data: plain
      });
    }
    
    res.json(plain);
  } catch (error) {
    console.error('Mesai bitirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Mesai geçmişi
 */
router.get('/mesai/gecmis', authenticateToken, async (req, res) => {
  try {
    const operatorId = parseInt(req.user.id);
    const { baslangic_tarihi, bitis_tarihi, limit = 50 } = req.query;

    const where = { operator_id: operatorId };

    if (baslangic_tarihi || bitis_tarihi) {
      where.baslangic_zamani = {};
      if (baslangic_tarihi) {
        const baslangic = new Date(baslangic_tarihi);
        baslangic.setHours(0, 0, 0, 0);
        where.baslangic_zamani[Op.gte] = baslangic;
      }
      if (bitis_tarihi) {
        const bitis = new Date(bitis_tarihi);
        bitis.setHours(23, 59, 59, 999);
        where.baslangic_zamani[Op.lte] = bitis;
      }
    }

    const mesailer = await MesaiKayit.findAll({
      where,
      include: [{
        model: Kullanici,
        as: 'operator',
        attributes: ['id', 'ad_soyad'],
        required: true
      }, {
        model: Workstation,
        as: 'alan',
        attributes: ['id', 'workstation_adi'],
        required: false
      }],
      order: [['baslangic_zamani', 'DESC']],
      limit: parseInt(limit)
    });

    const formatted = mesailer.map(mesai => {
      const plain = mesai.get({ plain: true });
      return {
        ...plain,
        id: plain.id.toString(),
        operator_id: plain.operator_id.toString(),
        ad_soyad: plain.operator?.ad_soyad || null,
        workstation_adi: plain.alan?.workstation_adi || null
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Mesai geçmişi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Alan giriş kaydı
 */
router.post('/alan/giris', authenticateToken, async (req, res) => {
  try {
    const operatorId = parseInt(req.user.id);
    const { alan_id, forklift_id } = req.body;

    if (!alan_id) {
      return res.status(400).json({ error: 'Alan ID gereklidir' });
    }

    const alanId = parseInt(alan_id);

    // Son çıkış kaydını kontrol et
    const activeEntry = await AlanTakip.findOne({
      where: {
        operator_id: operatorId,
        alan_id: alanId,
        cikis_zamani: null
      },
      order: [['giris_zamani', 'DESC']]
    });

    if (activeEntry) {
      return res.status(400).json({ error: 'Bu alanda zaten aktif bir giriş kaydı var' });
    }

    // Yeni giriş kaydı
    const newEntry = await AlanTakip.create({
      operator_id: operatorId,
      alan_id: alanId,
      forklift_id: forklift_id || null,
      giris_zamani: new Date()
    });

    const plain = newEntry.get({ plain: true });
    
    if (global.broadcast) {
      global.broadcast({
        type: 'alan_giris',
        data: plain
      });
    }
    
    res.status(201).json(plain);
  } catch (error) {
    console.error('Alan giriş hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Alan çıkış kaydı
 */
router.post('/alan/cikis', authenticateToken, async (req, res) => {
  try {
    const operatorId = parseInt(req.user.id);
    const { alan_id } = req.body;

    if (!alan_id) {
      return res.status(400).json({ error: 'Alan ID gereklidir' });
    }

    const alanId = parseInt(alan_id);

    // Aktif giriş kaydını bul
    const activeEntry = await AlanTakip.findOne({
      where: {
        operator_id: operatorId,
        alan_id: alanId,
        cikis_zamani: null
      },
      order: [['giris_zamani', 'DESC']]
    });

    if (!activeEntry) {
      return res.status(400).json({ error: 'Bu alanda aktif giriş kaydı bulunamadı' });
    }

    // Süre hesapla
    const giris = new Date(activeEntry.giris_zamani);
    const cikis = new Date();
    const sure_saniye = Math.floor((cikis - giris) / 1000);

    // Çıkış kaydı
    activeEntry.cikis_zamani = cikis;
    activeEntry.sure_saniye = sure_saniye;
    await activeEntry.save();

    const plain = activeEntry.get({ plain: true });
    
    if (global.broadcast) {
      global.broadcast({
        type: 'alan_cikis',
        data: plain
      });
    }
    
    res.json(plain);
  } catch (error) {
    console.error('Alan çıkış hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Operatörün alan geçmişi
 */
router.get('/alan/gecmis', authenticateToken, async (req, res) => {
  try {
    const operatorId = parseInt(req.user.id);
    const { limit = 50 } = req.query;

    const entries = await AlanTakip.findAll({
      where: { operator_id: operatorId },
      include: [{
        model: Workstation,
        as: 'alan',
        attributes: ['id', 'workstation_adi'],
        required: false
      }],
      order: [['giris_zamani', 'DESC']],
      limit: parseInt(limit)
    });

    const formatted = entries.map(entry => {
      const plain = entry.get({ plain: true });
      return {
        ...plain,
        id: plain.id.toString(),
        operator_id: plain.operator_id.toString(),
        workstation_adi: plain.alan?.workstation_adi || null
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Alan geçmişi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

