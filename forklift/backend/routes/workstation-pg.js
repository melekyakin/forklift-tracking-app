const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Workstation } = require('../models-pg');
const { authenticateToken, authorize } = require('../middleware/auth');

// Tüm iş istasyonlarını getir (admin, yönetici, forkliftoperator ve hatoperator)
router.get('/', authenticateToken, authorize('admin', 'yonetici', 'forkliftoperator', 'hatoperator'), async (req, res) => {
  try {
    const workstations = await Workstation.findAll({
      where: { durum: 'aktif' },
      attributes: ['id', 'workstation_no', 'workstation_adi', 'durum'],
      order: [['workstation_no', 'ASC']]
    });
    
    // ID'yi string'e çevir
    const formattedWorkstations = workstations.map(ws => {
      const plain = ws.get({ plain: true });
      return {
        id: plain.id.toString(),
        workstation_no: plain.workstation_no,
        workstation_adi: plain.workstation_adi,
        durum: plain.durum
      };
    });
    
    res.json(formattedWorkstations);
  } catch (error) {
    console.error('İş istasyonu listesi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Kullanıcının iş istasyonunu getir
router.get('/me', authenticateToken, async (req, res) => {
  try {
    if (!req.user.workstation_id) {
      return res.json(null);
    }

    const workstationId = parseInt(req.user.workstation_id);
    const workstation = await Workstation.findByPk(workstationId);
    
    if (!workstation) {
      return res.json(null);
    }

    const plain = workstation.get({ plain: true });
    res.json({ ...plain, id: plain.id.toString() });
  } catch (error) {
    console.error('İş istasyonu getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// İş istasyonu istatistikleri
router.get('/:id/istatistikler', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const workstationId = parseInt(id);
    
    if (isNaN(workstationId)) {
      return res.status(400).json({ error: 'Geçersiz iş istasyonu ID' });
    }

    const workstation = await Workstation.findByPk(workstationId);
    
    if (!workstation) {
      return res.status(404).json({ error: 'İş istasyonu bulunamadı' });
    }

    const plainWs = workstation.get({ plain: true });

    res.json({
      id: plainWs.id.toString(),
      workstation_no: plainWs.workstation_no,
      workstation_adi: plainWs.workstation_adi
    });
  } catch (error) {
    console.error('İş istasyonu istatistik hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Seçili iş istasyonlarının istatistikleri
router.post('/istatistikler', authenticateToken, async (req, res) => {
  try {
    const { workstation_ids } = req.body;
    
    if (!workstation_ids || !Array.isArray(workstation_ids) || workstation_ids.length === 0) {
      return res.status(400).json({ error: 'İş istasyonu ID\'leri gereklidir' });
    }

    // ID'leri integer'a çevir
    const workstationIds = workstation_ids
      .map(id => parseInt(id))
      .filter(id => !isNaN(id));

    if (workstationIds.length === 0) {
      return res.status(400).json({ error: 'Geçerli iş istasyonu ID\'leri gereklidir' });
    }

    const workstations = await Workstation.findAll({
      where: {
        id: { [Op.in]: workstationIds }
      }
    });

    const stats = workstations.map((ws) => {
      const plainWs = ws.get({ plain: true });
      return {
        id: plainWs.id.toString(),
        workstation_no: plainWs.workstation_no,
        workstation_adi: plainWs.workstation_adi
      };
    });

    // İş istasyonu numarasına göre sırala
    stats.sort((a, b) => a.workstation_no.localeCompare(b.workstation_no));

    res.json(stats);
  } catch (error) {
    console.error('İş istasyonu istatistik hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Yeni iş istasyonu oluştur (sadece admin)
router.post('/', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { workstation_no, workstation_adi } = req.body;
    
    if (!workstation_no || !workstation_adi) {
      return res.status(400).json({ error: 'İş istasyonu no ve adı gereklidir' });
    }

    const workstation = await Workstation.create({
      workstation_no,
      workstation_adi,
      durum: 'aktif'
    });
    
    const plain = workstation.get({ plain: true });
    res.status(201).json({ ...plain, id: plain.id.toString() });
  } catch (error) {
    console.error('İş istasyonu oluşturma hatası:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Bu iş istasyonu numarası zaten kullanılıyor' });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

