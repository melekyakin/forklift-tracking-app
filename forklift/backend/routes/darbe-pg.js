const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { DarbeKayit, ForkliftBildirim, Kullanici } = require('../models-pg');
const { authenticateToken } = require('../middleware/auth');

/**
 * Darbe/Çarpışma kaydı oluştur
 */
router.post('/kayit', authenticateToken, async (req, res) => {
  try {
    const {
      forklift_id,
      darbe_seviyesi,
      darbe_yonu,
      konum_enlem,
      konum_boylam,
      hiz,
      ivme_x,
      ivme_y,
      ivme_z
    } = req.body;

    if (!forklift_id || darbe_seviyesi === undefined) {
      return res.status(400).json({ error: 'Forklift ID ve darbe seviyesi gereklidir' });
    }

    const operatorId = parseInt(req.user.id);

    const darbeKayit = await DarbeKayit.create({
      forklift_id: forklift_id,
      operator_id: operatorId,
      darbe_seviyesi: darbe_seviyesi,
      darbe_yonu: darbe_yonu || null,
      konum_enlem: konum_enlem || null,
      konum_boylam: konum_boylam || null,
      hiz: hiz || null,
      ivme_x: ivme_x || null,
      ivme_y: ivme_y || null,
      ivme_z: ivme_z || null,
      uyari_gonderildi: false
    });

    const plain = darbeKayit.get({ plain: true });

    // Eğer darbe seviyesi kritikse uyarı gönder
    const isCritical = darbe_seviyesi > 5.0; // Örnek eşik değeri

    // WebSocket ile bildirim gönder
    if (global.broadcast) {
      global.broadcast({
        type: isCritical ? 'kritik_darbe' : 'darbe_kayit',
        data: {
          ...plain,
          id: plain.id.toString(),
          operator_id: plain.operator_id.toString(),
          operator_ad_soyad: req.user.ad_soyad,
          uyari_seviyesi: isCritical ? 'kritik' : 'normal'
        }
      });
    }

    // Kritik darbe ise bildirim oluştur
    if (isCritical) {
      await ForkliftBildirim.create({
        kasa_id: null,
        forkliftci_id: operatorId,
        mesaj: `KRİTİK: Forklift ${forklift_id} yüksek seviyede darbe tespit edildi! (Seviye: ${darbe_seviyesi})`,
        durum: 'beklemede'
      });

      darbeKayit.uyari_gonderildi = true;
      await darbeKayit.save();
    }

    res.status(201).json({
      ...plain,
      id: plain.id.toString(),
      operator_id: plain.operator_id.toString(),
      uyari_gonderildi: isCritical
    });
  } catch (error) {
    console.error('Darbe kaydı hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Darbe kayıtlarını getir
 */
router.get('/kayitlar', authenticateToken, async (req, res) => {
  try {
    const { forklift_id, operator_id, baslangic_tarihi, bitis_tarihi, limit = 100 } = req.query;

    const where = {};

    if (forklift_id) {
      where.forklift_id = forklift_id;
    }

    if (operator_id) {
      where.operator_id = parseInt(operator_id);
    }

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

    const kayitlar = await DarbeKayit.findAll({
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

    const formatted = kayitlar.map(kayit => {
      const plain = kayit.get({ plain: true });
      return {
        ...plain,
        id: plain.id.toString(),
        operator_id: plain.operator_id ? plain.operator_id.toString() : null,
        operator_ad_soyad: plain.operator?.ad_soyad || null
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Darbe kayıtları hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Kritik darbe kayıtlarını getir
 */
router.get('/kritik', authenticateToken, async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const kayitlar = await DarbeKayit.findAll({
      where: {
        darbe_seviyesi: { [Op.gt]: 5.0 }
      },
      include: [{
        model: Kullanici,
        as: 'operator',
        attributes: ['id', 'ad_soyad'],
        required: false
      }],
      order: [['olusturma_tarihi', 'DESC']],
      limit: parseInt(limit)
    });

    const formatted = kayitlar.map(kayit => {
      const plain = kayit.get({ plain: true });
      return {
        ...plain,
        id: plain.id.toString(),
        operator_id: plain.operator_id ? plain.operator_id.toString() : null,
        operator_ad_soyad: plain.operator?.ad_soyad || null
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Kritik darbe kayıtları hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

