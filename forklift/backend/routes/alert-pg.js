const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { WorkstationAlert, Workstation, Kullanici } = require('../models-pg');
const { authenticateToken } = require('../middleware/auth');

// Forkliftçinin alert'lerini getir
router.get('/', authenticateToken, async (req, res) => {
  try {
    const forkliftciId = parseInt(req.user.id);
    
    const alerts = await WorkstationAlert.findAll({
      where: {
        forkliftci_id: forkliftciId,
        durum: 'aktif'
      },
      include: [{
        model: Workstation,
        as: 'workstation',
        attributes: ['id', 'workstation_no', 'workstation_adi'],
        required: true
      }]
    });

    const formattedAlerts = alerts.map(alert => {
      const plain = alert.get({ plain: true });
      return {
        id: plain.id.toString(),
        workstation_id: plain.workstation_id.toString(),
        workstation_no: plain.workstation.workstation_no,
        workstation_adi: plain.workstation.workstation_adi,
        doluluk_yuzdesi_limit: plain.doluluk_yuzdesi_limit,
        durum: plain.durum,
        olusturma_tarihi: plain.olusturma_tarihi
      };
    });

    res.json(formattedAlerts);
  } catch (error) {
    console.error('Alert listesi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Yeni alert oluştur veya güncelle
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { workstation_id, doluluk_yuzdesi_limit } = req.body;

    if (!workstation_id || doluluk_yuzdesi_limit === undefined || doluluk_yuzdesi_limit === null) {
      return res.status(400).json({ error: 'İş istasyonu ID ve doluluk yüzdesi limiti gereklidir' });
    }

    if (doluluk_yuzdesi_limit < 0 || doluluk_yuzdesi_limit > 100) {
      return res.status(400).json({ error: 'Doluluk yüzdesi 0-100 arasında olmalıdır' });
    }

    const workstationId = parseInt(workstation_id);
    const forkliftciId = parseInt(req.user.id);

    // Workstation'ın varlığını kontrol et
    const workstation = await Workstation.findByPk(workstationId);
    if (!workstation) {
      return res.status(404).json({ error: 'İş istasyonu bulunamadı' });
    }

    // Mevcut alert'i kontrol et
    const existingAlert = await WorkstationAlert.findOne({
      where: {
        forkliftci_id: forkliftciId,
        workstation_id: workstationId
      }
    });

    let alert;
    if (existingAlert) {
      // Güncelle
      existingAlert.doluluk_yuzdesi_limit = doluluk_yuzdesi_limit;
      await existingAlert.save();
      alert = existingAlert;
    } else {
      // Yeni oluştur
      alert = await WorkstationAlert.create({
        forkliftci_id: forkliftciId,
        workstation_id: workstationId,
        doluluk_yuzdesi_limit: doluluk_yuzdesi_limit
      });
    }

    // Workstation bilgilerini ekle
    const alertWithWorkstation = await WorkstationAlert.findByPk(alert.id, {
      include: [{
        model: Workstation,
        as: 'workstation',
        attributes: ['id', 'workstation_no', 'workstation_adi'],
        required: true
      }]
    });

    const plain = alertWithWorkstation.get({ plain: true });
    res.json({
      id: plain.id.toString(),
      workstation_id: plain.workstation_id.toString(),
      workstation_no: plain.workstation.workstation_no,
      workstation_adi: plain.workstation.workstation_adi,
      doluluk_yuzdesi_limit: plain.doluluk_yuzdesi_limit,
      durum: plain.durum,
      olusturma_tarihi: plain.olusturma_tarihi
    });
  } catch (error) {
    console.error('Alert kaydetme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Alert sil
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const alertId = parseInt(id);
    const forkliftciId = parseInt(req.user.id);

    if (isNaN(alertId)) {
      return res.status(400).json({ error: 'Geçersiz alert ID' });
    }

    const alert = await WorkstationAlert.findOne({
      where: {
        id: alertId,
        forkliftci_id: forkliftciId
      }
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alert bulunamadı' });
    }

    await alert.destroy();

    res.json({ message: 'Alert başarıyla silindi' });
  } catch (error) {
    console.error('Alert silme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

