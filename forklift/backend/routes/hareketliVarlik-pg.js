const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { HareketliVarlik, HareketliVarlikKonum } = require('../models-pg');
const { authenticateToken, authorize } = require('../middleware/auth');

/**
 * Hareketli varlık oluştur/güncelle
 */
router.post('/varlik', authenticateToken, authorize('admin', 'yonetici'), async (req, res) => {
  try {
    const {
      varlik_no,
      varlik_tipi,
      varlik_adi,
      durum
    } = req.body;

    if (!varlik_no || !varlik_tipi) {
      return res.status(400).json({ error: 'Varlık no ve tipi gereklidir' });
    }

    // Mevcut varlığı kontrol et
    let existing = await HareketliVarlik.findOne({
      where: { varlik_no: varlik_no }
    });

    if (existing) {
      // Güncelle
      existing.varlik_tipi = varlik_tipi;
      existing.varlik_adi = varlik_adi || null;
      existing.durum = durum || 'aktif';
      await existing.save();
      
      const plain = existing.get({ plain: true });
      res.json(plain);
    } else {
      // Yeni varlık
      const newVarlik = await HareketliVarlik.create({
        varlik_no: varlik_no,
        varlik_tipi: varlik_tipi,
        varlik_adi: varlik_adi || null,
        durum: durum || 'aktif'
      });
      
      const plain = newVarlik.get({ plain: true });
      res.status(201).json(plain);
    }
  } catch (error) {
    console.error('Varlık kaydı hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Varlık konum güncelle
 */
router.post('/konum', authenticateToken, async (req, res) => {
  try {
    const {
      varlik_no,
      enlem,
      boylam,
      hiz,
      yon,
      batarya,
      durum
    } = req.body;

    if (!varlik_no || enlem === undefined || boylam === undefined) {
      return res.status(400).json({ error: 'Varlık no, enlem ve boylam gereklidir' });
    }

    // Varlığı bul
    const varlik = await HareketliVarlik.findOne({
      where: { varlik_no: varlik_no }
    });

    if (!varlik) {
      return res.status(404).json({ error: 'Varlık bulunamadı' });
    }

    const plainVarlik = varlik.get({ plain: true });

    // Varlık konumunu güncelle (eğer model'de bu alanlar varsa)
    // Not: HareketliVarlik modelinde konum alanları olmayabilir, sadece konum geçmişi tutulabilir

    // Konum geçmişine ekle
    await HareketliVarlikKonum.create({
      varlik_id: plainVarlik.id,
      enlem: enlem,
      boylam: boylam,
      hiz: hiz || null,
      yon: yon || null,
      batarya: batarya || null,
      durum: durum || null
    });

    // WebSocket ile güncelleme gönder
    if (global.broadcast) {
      global.broadcast({
        type: 'hareketli_varlik_konum_guncellendi',
        data: {
          varlik_no: varlik_no,
          varlik_adi: plainVarlik.varlik_adi,
          varlik_tipi: plainVarlik.varlik_tipi,
          enlem,
          boylam,
          hiz,
          batarya,
          durum
        }
      });
    }

    // Güncellenmiş varlığı getir
    const updatedVarlik = await HareketliVarlik.findByPk(plainVarlik.id);
    const plain = updatedVarlik.get({ plain: true });
    res.json(plain);
  } catch (error) {
    console.error('Varlık konum güncelleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Tüm hareketli varlıkları getir
 */
router.get('/varliklar', authenticateToken, async (req, res) => {
  try {
    const { varlik_tipi, durum } = req.query;

    const where = {};

    if (varlik_tipi) {
      where.varlik_tipi = varlik_tipi;
    }

    if (durum) {
      where.durum = durum;
    }

    const varliklar = await HareketliVarlik.findAll({
      where,
      order: [['varlik_no', 'ASC']]
    });

    const formatted = varliklar.map(varlik => {
      const plain = varlik.get({ plain: true });
      return {
        ...plain,
        id: plain.id.toString()
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Varlık listesi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Varlık detayı ve konum geçmişi
 */
router.get('/varlik/:varlikNo', authenticateToken, async (req, res) => {
  try {
    const { varlikNo } = req.params;
    const { limit = 100 } = req.query;

    // Varlık bilgisi
    const varlik = await HareketliVarlik.findOne({
      where: { varlik_no: varlikNo }
    });

    if (!varlik) {
      return res.status(404).json({ error: 'Varlık bulunamadı' });
    }

    const plainVarlik = varlik.get({ plain: true });

    // Konum geçmişi
    const konumGecmisi = await HareketliVarlikKonum.findAll({
      where: { varlik_id: plainVarlik.id },
      order: [['olusturma_tarihi', 'DESC']],
      limit: parseInt(limit)
    });

    const formattedGecmis = konumGecmisi.map(konum => {
      const plain = konum.get({ plain: true });
      return {
        ...plain,
        id: plain.id.toString(),
        varlik_id: plain.varlik_id.toString()
      };
    });

    res.json({
      ...plainVarlik,
      id: plainVarlik.id.toString(),
      konum_gecmisi: formattedGecmis
    });
  } catch (error) {
    console.error('Varlık detayı hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Varlık konum geçmişi
 */
router.get('/konum-gecmis/:varlikNo', authenticateToken, async (req, res) => {
  try {
    const { varlikNo } = req.params;
    const { baslangic_tarihi, bitis_tarihi, limit = 1000 } = req.query;

    // Varlığı bul
    const varlik = await HareketliVarlik.findOne({
      where: { varlik_no: varlikNo }
    });

    if (!varlik) {
      return res.status(404).json({ error: 'Varlık bulunamadı' });
    }

    const plainVarlik = varlik.get({ plain: true });
    const where = { varlik_id: plainVarlik.id };

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

    const konumlar = await HareketliVarlikKonum.findAll({
      where,
      order: [['olusturma_tarihi', 'DESC']],
      limit: parseInt(limit)
    });

    const formatted = konumlar.map(konum => {
      const plain = konum.get({ plain: true });
      return {
        ...plain,
        id: plain.id.toString(),
        varlik_id: plain.varlik_id.toString()
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Konum geçmişi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

