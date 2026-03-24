const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { KasaIciSayisi, Workstation, ForkliftBildirim, ForkliftciWorkstation, Kullanici } = require('../models-pg');
const { authenticateToken } = require('../middleware/auth');

/**
 * Kasa içi sayısını güncelle
 * 80'in üzerine çıktığında otomatik bildirim oluşturur
 */
router.post('/guncelle', authenticateToken, async (req, res) => {
  try {
    const { workstation_id, kasa_ici_sayisi, limit } = req.body;

    if (!workstation_id) {
      return res.status(400).json({ error: 'İş istasyonu ID gereklidir' });
    }

    if (kasa_ici_sayisi === undefined || kasa_ici_sayisi === null) {
      return res.status(400).json({ error: 'Kasa içi sayısı gereklidir' });
    }

    const workstationId = parseInt(workstation_id);
    const yeniSayi = parseInt(kasa_ici_sayisi);
    const limitDegeri = limit ? parseInt(limit) : 100;

    if (isNaN(yeniSayi) || yeniSayi < 0) {
      return res.status(400).json({ error: 'Geçersiz kasa içi sayısı' });
    }

    // Workstation'ın var olduğunu kontrol et
    const workstation = await Workstation.findByPk(workstationId);
    if (!workstation) {
      return res.status(404).json({ error: 'İş istasyonu bulunamadı' });
    }

    // Kasa içi sayısı kaydını bul veya oluştur
    let kasaIciSayisi = await KasaIciSayisi.findOne({
      where: { workstation_id: workstationId }
    });

    const oncekiSayi = kasaIciSayisi ? kasaIciSayisi.kasa_ici_sayisi : 0;

    if (kasaIciSayisi) {
      kasaIciSayisi.kasa_ici_sayisi = yeniSayi;
      kasaIciSayisi.limit = limitDegeri;
      kasaIciSayisi.son_guncelleme = new Date();
      await kasaIciSayisi.save();
    } else {
      kasaIciSayisi = await KasaIciSayisi.create({
        workstation_id: workstationId,
        kasa_ici_sayisi: yeniSayi,
        limit: limitDegeri,
        son_guncelleme: new Date()
      });
    }

    const plain = kasaIciSayisi.get({ plain: true });

    // Eğer kasa içi sayısı limit'in üzerindeyse ve önceki sayı limit'in altındaysa bildirim oluştur
    if (yeniSayi > limitDegeri && oncekiSayi <= limitDegeri) {
      console.log(`⚠️ Kasa içi sayısı limit aşıldı: Workstation ${workstationId}, Sayı: ${yeniSayi}, Limit: ${limitDegeri}`);
      
      // Bu workstation'a bakan forkliftçileri bul
      const forkliftciWorkstations = await ForkliftciWorkstation.findAll({
        where: { workstation_id: workstationId },
        include: [{
          model: Kullanici,
          as: 'forkliftci',
          where: { 
            rol: 'forkliftoperator', 
            durum: 'aktif' 
          },
          required: true
        }]
      });

      const forkliftciler = forkliftciWorkstations
        .map(fw => fw.forkliftci)
        .filter(f => f !== null);

      // Benzersiz forkliftçileri al
      const uniqueForkliftciler = [];
      const seenForkliftciIds = new Set();
      for (const forkliftci of forkliftciler) {
        if (!seenForkliftciIds.has(forkliftci.id)) {
          seenForkliftciIds.add(forkliftci.id);
          uniqueForkliftciler.push(forkliftci);
        }
      }

      if (uniqueForkliftciler.length > 0) {
        const mesaj = `${workstation.workstation_adi} iş istasyonu için kasa içi sayısı ${yeniSayi} adete ulaştı (Limit: ${limitDegeri})`;
        
        // Her forkliftçi için bildirim oluştur (duplicate kontrolü ile)
        const bildirimler = [];
        for (const forkliftci of uniqueForkliftciler) {
          // Son 5 dakika içinde aynı workstation ve forkliftçi için bekleyen bildirim var mı kontrol et
          const fiveMinutesAgo = new Date(Date.now() - 300000);
          const normalizedMesaj = mesaj.toLowerCase().trim();
          const workstationAdiLower = workstation.workstation_adi.toLowerCase();
          
          const bekleyenBildirimler = await ForkliftBildirim.findAll({
            where: {
              forkliftci_id: forkliftci.id,
              durum: 'beklemede',
              olusturma_tarihi: {
                [Op.gte]: fiveMinutesAgo
              }
            },
            order: [['olusturma_tarihi', 'DESC']]
          });
          
          // JavaScript'te duplicate kontrolü yap
          const existingBildirim = bekleyenBildirimler.find(b => {
            const bildirimMesaj = (b.mesaj || '').toLowerCase().trim();
            
            // Tam mesaj eşleşmesi
            if (bildirimMesaj === normalizedMesaj) {
              return true;
            }
            
            // Aynı workstation adı içeren ve "kasa içi sayısı" içeren
            if (bildirimMesaj.includes(workstationAdiLower) && bildirimMesaj.includes('kasa içi sayısı')) {
              return true;
            }
            
            return false;
          });

          if (!existingBildirim) {
            const savedBildirim = await ForkliftBildirim.create({
              forkliftci_id: forkliftci.id,
              mesaj: mesaj,
              durum: 'beklemede'
            });

            bildirimler.push(savedBildirim);

            // WebSocket ile bildirim gönder
            if (global.broadcast) {
              const plainBildirim = savedBildirim.get({ plain: true });
              global.broadcast({
                type: 'yeni_bildirim',
                data: {
                  id: plainBildirim.id.toString(),
                  workstation_id: workstationId.toString(),
                  workstation_adi: workstation.workstation_adi,
                  workstation_no: workstation.workstation_no,
                  mesaj: mesaj,
                  durum: 'beklemede',
                  forkliftci_id: forkliftci.id.toString(),
                  tip: 'kasa_dolu',
                  olusturma_tarihi: plainBildirim.olusturma_tarihi
                }
              });
            }
          }
        }

        console.log(`✅ ${bildirimler.length} forkliftçiye kasa doluluk bildirimi gönderildi`);
      } else {
        console.log(`⚠️ Workstation ${workstationId} için forkliftçi bulunamadı, bildirim oluşturulamadı`);
      }
    }

    res.json({
      message: 'Kasa içi sayısı başarıyla güncellendi',
      kasaIciSayisi: {
        ...plain,
        id: plain.id.toString(),
        workstation_id: plain.workstation_id.toString()
      }
    });
  } catch (error) {
    console.error('Kasa içi sayısı güncelleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Kasa içi sayısını getir (workstation bazında)
 */
router.get('/:workstation_id', authenticateToken, async (req, res) => {
  try {
    const { workstation_id } = req.params;
    const workstationId = parseInt(workstation_id);

    if (isNaN(workstationId)) {
      return res.status(400).json({ error: 'Geçersiz iş istasyonu ID' });
    }

    const kasaIciSayisi = await KasaIciSayisi.findOne({
      where: { workstation_id: workstationId },
      include: [{
        model: Workstation,
        as: 'workstation',
        attributes: ['id', 'workstation_adi', 'workstation_no'],
        required: true
      }]
    });

    if (!kasaIciSayisi) {
      return res.status(404).json({ error: 'Kasa içi sayısı kaydı bulunamadı' });
    }

    const plain = kasaIciSayisi.get({ plain: true });
    res.json({
      ...plain,
      id: plain.id.toString(),
      workstation_id: plain.workstation_id.toString()
    });
  } catch (error) {
    console.error('Kasa içi sayısı getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Tüm workstation'ların kasa içi sayılarını getir
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const kasaIciSayilari = await KasaIciSayisi.findAll({
      include: [{
        model: Workstation,
        as: 'workstation',
        attributes: ['id', 'workstation_adi', 'workstation_no'],
        required: true
      }],
      order: [['workstation_id', 'ASC']]
    });

    const formatted = kasaIciSayilari.map(kasa => {
      const plain = kasa.get({ plain: true });
      return {
        ...plain,
        id: plain.id.toString(),
        workstation_id: plain.workstation_id.toString()
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Kasa içi sayıları getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
