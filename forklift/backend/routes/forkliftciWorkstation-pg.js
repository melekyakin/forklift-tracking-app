const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { ForkliftciWorkstation, Workstation, Kullanici } = require('../models-pg');
const { authenticateToken, authorize } = require('../middleware/auth');

// Forkliftçinin seçili iş istasyonlarını getir
router.get('/workstations', authenticateToken, async (req, res) => {
  try {
    const forkliftciId = parseInt(req.user.id);

    // Sadece forklift operatörleri kendi iş istasyonlarını görebilir
    if (req.user.rol !== 'forkliftoperator' && req.user.rol !== 'admin' && req.user.rol !== 'yonetici') {
      return res.status(403).json({ error: 'Bu işlem sadece forklift operatörleri için geçerlidir' });
    }

    // Admin/yönetici başka forkliftçinin iş istasyonlarını görebilir
    let targetForkliftciId = forkliftciId;
    if (req.query.forkliftci_id && (req.user.rol === 'admin' || req.user.rol === 'yonetici')) {
      targetForkliftciId = parseInt(req.query.forkliftci_id);
    }

    if (isNaN(targetForkliftciId)) {
      return res.status(400).json({ error: 'Geçersiz forkliftçi ID' });
    }

    const forkliftciWorkstations = await ForkliftciWorkstation.findAll({
      where: { forkliftci_id: targetForkliftciId },
      include: [{
        model: Workstation,
        as: 'workstation',
        attributes: ['id', 'workstation_adi', 'workstation_no'],
        required: true
      }],
      order: [[{ model: Workstation, as: 'workstation' }, 'workstation_no', 'ASC']]
    });

    const workstations = forkliftciWorkstations
      .map(fw => {
        const plain = fw.get({ plain: true });
        return {
          ...plain.workstation,
          id: plain.workstation.id.toString(),
          secim_tarihi: plain.olusturma_tarihi
        };
      });

    res.json(workstations);
  } catch (error) {
    console.error('İş istasyonları yükleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Forkliftçinin iş istasyonlarını güncelle
router.post('/workstations', authenticateToken, async (req, res) => {
  try {
    const forkliftciId = parseInt(req.user.id);
    const { workstation_ids } = req.body;

    // Sadece forklift operatörleri kendi iş istasyonlarını seçebilir
    if (req.user.rol !== 'forkliftoperator' && req.user.rol !== 'admin' && req.user.rol !== 'yonetici') {
      return res.status(403).json({ error: 'Bu işlem sadece forklift operatörleri için geçerlidir' });
    }

    if (!Array.isArray(workstation_ids)) {
      return res.status(400).json({ error: 'workstation_ids bir array olmalıdır' });
    }

    // Admin/yönetici başka forkliftçinin iş istasyonlarını güncelleyebilir
    let targetForkliftciId = forkliftciId;
    if (req.body.forkliftci_id && (req.user.rol === 'admin' || req.user.rol === 'yonetici')) {
      targetForkliftciId = parseInt(req.body.forkliftci_id);
    }

    if (isNaN(targetForkliftciId)) {
      return res.status(400).json({ error: 'Geçersiz forkliftçi ID' });
    }

    // Önce mevcut iş istasyonlarını sil
    await ForkliftciWorkstation.destroy({
      where: { forkliftci_id: targetForkliftciId }
    });

    // Yeni iş istasyonlarını ekle
    if (workstation_ids.length > 0) {
      const forkliftciWorkstations = workstation_ids.map(wsId => ({
        forkliftci_id: targetForkliftciId,
        workstation_id: parseInt(wsId)
      }));

      await ForkliftciWorkstation.bulkCreate(forkliftciWorkstations);
    }

    // Güncellenmiş iş istasyonlarını getir
    const forkliftciWorkstations = await ForkliftciWorkstation.findAll({
      where: { forkliftci_id: targetForkliftciId },
      include: [{
        model: Workstation,
        as: 'workstation',
        attributes: ['id', 'workstation_adi', 'workstation_no'],
        required: true
      }],
      order: [[{ model: Workstation, as: 'workstation' }, 'workstation_no', 'ASC']]
    });

    const workstations = forkliftciWorkstations
      .map(fw => {
        const plain = fw.get({ plain: true });
        return {
          ...plain.workstation,
          id: plain.workstation.id.toString(),
          secim_tarihi: plain.olusturma_tarihi
        };
      });

    // WebSocket ile güncelleme gönder
    if (global.broadcast) {
      global.broadcast({
        type: 'forkliftci_workstation_guncellendi',
        data: {
          forkliftci_id: targetForkliftciId.toString(),
          workstations: workstations
        }
      });
    }

    res.json({ message: 'İş istasyonu seçimleri güncellendi', workstations: workstations });
  } catch (error) {
    console.error('İş istasyonları güncelleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Tüm forkliftçilerin workstation seçimlerini getir (admin/yönetici için)
router.get('/all', authenticateToken, authorize('admin', 'yonetici'), async (req, res) => {
  try {
    const forkliftciler = await Kullanici.findAll({
      where: {
        rol: 'forkliftoperator',
        durum: 'aktif'
      },
      attributes: ['id', 'kullanici_adi', 'ad_soyad'],
      include: [{
        model: ForkliftciWorkstation,
        as: 'workstations',
        include: [{
          model: Workstation,
          as: 'workstation',
          attributes: ['id', 'workstation_no', 'workstation_adi'],
          required: true
        }]
      }]
    });

    const result = forkliftciler.map(kullanici => {
      const plain = kullanici.get({ plain: true });
      const workstationNos = plain.workstations.map(fw => fw.workstation.workstation_no).join(', ');
      const workstationAdis = plain.workstations.map(fw => fw.workstation.workstation_adi).join(', ');
      
      return {
        forkliftci_id: plain.id.toString(),
        kullanici_adi: plain.kullanici_adi,
        ad_soyad: plain.ad_soyad,
        workstation_nos: workstationNos,
        workstation_adis: workstationAdis,
        workstation_sayisi: plain.workstations.length
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Forkliftçi workstation listesi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

