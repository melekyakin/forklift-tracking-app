const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { CanbusVeri, ForkliftBildirim, Kullanici } = require('../models-pg');
const { authenticateToken } = require('../middleware/auth');
const { sequelize } = require('../models-pg');

/**
 * CAN Bus verisi kaydet
 */
router.post('/veri', authenticateToken, async (req, res) => {
  try {
    const {
      forklift_id,
      hiz,
      motor_devir,
      yakit_seviyesi,
      aku_doluluk,
      motor_sicaklik,
      yakit_tuketim,
      toplam_calisma_saati,
      hata_kodlari
    } = req.body;

    if (!forklift_id) {
      return res.status(400).json({ error: 'Forklift ID gereklidir' });
    }

    const operatorId = parseInt(req.user.id);

    const canbusVeri = await CanbusVeri.create({
      forklift_id: forklift_id,
      operator_id: operatorId,
      hiz: hiz || null,
      motor_devir: motor_devir || null,
      yakit_seviyesi: yakit_seviyesi || null,
      aku_doluluk: aku_doluluk || null,
      motor_sicaklik: motor_sicaklik || null,
      yakit_tuketim: yakit_tuketim || null,
      toplam_calisma_saati: toplam_calisma_saati || null,
      hata_kodlari: hata_kodlari || null
    });

    const plain = canbusVeri.get({ plain: true });

    // Düşük yakıt/akü uyarısı
    const warnings = [];
    if (yakit_seviyesi !== null && yakit_seviyesi < 20) {
      warnings.push('Yakıt seviyesi düşük!');
    }
    if (aku_doluluk !== null && aku_doluluk < 20) {
      warnings.push('Akü doluluk seviyesi düşük!');
    }
    if (motor_sicaklik !== null && motor_sicaklik > 90) {
      warnings.push('Motor sıcaklığı yüksek!');
    }

    // WebSocket ile güncelleme gönder
    if (global.broadcast) {
      global.broadcast({
        type: 'canbus_veri_guncellendi',
        data: {
          ...plain,
          id: plain.id.toString(),
          operator_id: plain.operator_id.toString(),
          uyarilar: warnings
        }
      });
    }

    // Uyarılar varsa bildirim oluştur
    if (warnings.length > 0) {
      await ForkliftBildirim.create({
        kasa_id: null,
        forkliftci_id: operatorId,
        mesaj: `Forklift ${forklift_id}: ${warnings.join(' ')}`,
        durum: 'beklemede'
      });
    }

    res.status(201).json({
      ...plain,
      id: plain.id.toString(),
      operator_id: plain.operator_id.toString(),
      uyarilar: warnings
    });
  } catch (error) {
    console.error('CAN Bus veri kaydı hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Forklift'in son CAN Bus verisini getir
 */
router.get('/son-veri/:forkliftId', authenticateToken, async (req, res) => {
  try {
    const { forkliftId } = req.params;

    const veri = await CanbusVeri.findOne({
      where: { forklift_id: forkliftId },
      include: [{
        model: Kullanici,
        as: 'operator',
        attributes: ['id', 'ad_soyad'],
        required: false
      }],
      order: [['olusturma_tarihi', 'DESC']]
    });

    if (!veri) {
      return res.status(404).json({ error: 'CAN Bus verisi bulunamadı' });
    }

    const plain = veri.get({ plain: true });
    res.json({
      ...plain,
      id: plain.id.toString(),
      operator_id: plain.operator_id ? plain.operator_id.toString() : null,
      operator_ad_soyad: plain.operator?.ad_soyad || null
    });
  } catch (error) {
    console.error('CAN Bus veri getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * CAN Bus veri geçmişi
 */
router.get('/gecmis/:forkliftId', authenticateToken, async (req, res) => {
  try {
    const { forkliftId } = req.params;
    const { baslangic_tarihi, bitis_tarihi, limit = 1000 } = req.query;

    const where = { forklift_id: forkliftId };

    if (baslangic_tarihi || bitis_tarihi) {
      where.olusturma_tarihi = {};
      if (baslangic_tarihi) {
        const baslangic = new Date(baslangic_tarihi);
        baslangic.setHours(0, 0, 0, 0);
        where.olusturma_tarihi[Op.gte] = baslangic;
      }
      if (bitis_tarihi) {
        const bitis = new Date(bitis_tarihi);
        bitis.setHours(23, 59, 59, 999);
        where.olusturma_tarihi[Op.lte] = bitis;
      }
    }

    const veriler = await CanbusVeri.findAll({
      where,
      include: [{
        model: Kullanici,
        as: 'operator',
        attributes: ['id', 'ad_soyad'],
        required: false
      }],
      order: [['olusturma_tarihi', 'DESC']],
      limit: parseInt(limit)
    });

    const formatted = veriler.map(veri => {
      const plain = veri.get({ plain: true });
      return {
        ...plain,
        id: plain.id.toString(),
        operator_id: plain.operator_id ? plain.operator_id.toString() : null,
        operator_ad_soyad: plain.operator?.ad_soyad || null
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('CAN Bus geçmişi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Tüm forkliftlerin CAN Bus verilerini getir
 */
router.get('/tum-veriler', authenticateToken, async (req, res) => {
  try {
    // Her forklift için en son veriyi al
    const forkliftIds = await CanbusVeri.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('forklift_id')), 'forklift_id']],
      raw: true
    });

    const veriler = await Promise.all(
      forkliftIds.map(async ({ forklift_id }) => {
        const veri = await CanbusVeri.findOne({
          where: { forklift_id },
          include: [{
            model: Kullanici,
            as: 'operator',
            attributes: ['id', 'ad_soyad'],
            required: false
          }],
          order: [['olusturma_tarihi', 'DESC']]
        });

        if (!veri) return null;

        const plain = veri.get({ plain: true });
        return {
          ...plain,
          id: plain.id.toString(),
          operator_id: plain.operator_id ? plain.operator_id.toString() : null,
          operator_ad_soyad: plain.operator?.ad_soyad || null
        };
      })
    );

    res.json(veriler.filter(v => v !== null).sort((a, b) => a.forklift_id.localeCompare(b.forklift_id)));
  } catch (error) {
    console.error('CAN Bus verileri hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

