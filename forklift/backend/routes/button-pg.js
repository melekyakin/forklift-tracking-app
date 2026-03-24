const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { ForkliftBildirim, ForkliftciWorkstation, Workstation, Kullanici, KasaIciSayisi } = require('../models-pg');

// Fiziksel butonlar için API endpoint (API key ile korumalı)
// Bu endpoint authentication gerektirmez, sadece API key kontrolü yapar
router.post('/press', async (req, res) => {
  try {
    const { api_key, workstation_id, button_type } = req.body;
    
    // API key kontrolü (basit güvenlik için)
    const VALID_API_KEY = process.env.BUTTON_API_KEY || 'BUTTON_API_KEY_2024';
    
    if (!api_key || api_key !== VALID_API_KEY) {
      return res.status(401).json({ error: 'Geçersiz API key' });
    }
    
    if (!workstation_id) {
      return res.status(400).json({ error: 'İş istasyonu ID gereklidir' });
    }
    
    if (!button_type || !['kasa_doldu', 'hammadde_talebi'].includes(button_type)) {
      return res.status(400).json({ error: 'Geçersiz buton tipi. "kasa_doldu" veya "hammadde_talebi" olmalıdır' });
    }
    
    const workstationId = parseInt(workstation_id);
    if (isNaN(workstationId)) {
      return res.status(400).json({ error: 'Geçersiz iş istasyonu ID' });
    }
    
    // İş istasyonunun var olduğunu kontrol et
    const workstation = await Workstation.findByPk(workstationId);
    if (!workstation) {
      return res.status(404).json({ error: 'İş istasyonu bulunamadı' });
    }
    
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
    
    console.log(`🔍 Workstation ${workstation_id} için forkliftçi-workstation kayıtları:`, forkliftciWorkstations.length);
    
    const forkliftciler = forkliftciWorkstations
      .map(fw => fw.get({ plain: true }).forkliftci)
      .filter(f => f !== null);
    
    console.log(`👷 Bulunan aktif forkliftçiler:`, forkliftciler.map(f => ({ id: f.id.toString(), ad_soyad: f.ad_soyad })));
    
    if (forkliftciler.length === 0) {
      console.log(`❌ Workstation ${workstation_id} için aktif forkliftçi bulunamadı!`);
      return res.status(404).json({ error: 'Bu iş istasyonu için forkliftçi bulunamadı' });
    }
    
    // Eğer kasa_doldu butonu ise, kasa içi sayısını artır ve direkt bildirim gönder (limit kontrolü yok)
    if (button_type === 'kasa_doldu') {
      try {
        // Kasa içi sayısı kaydını bul veya oluştur
        let kasaIciSayisi = await KasaIciSayisi.findOne({
          where: { workstation_id: workstationId }
        });

        const oncekiSayi = kasaIciSayisi ? kasaIciSayisi.kasa_ici_sayisi : 0;
        const yeniSayi = oncekiSayi + 1; // Her buton basışında 1 artır

        if (kasaIciSayisi) {
          kasaIciSayisi.kasa_ici_sayisi = yeniSayi;
          kasaIciSayisi.son_guncelleme = new Date();
          await kasaIciSayisi.save();
        } else {
          kasaIciSayisi = await KasaIciSayisi.create({
            workstation_id: workstationId,
            kasa_ici_sayisi: yeniSayi,
            limit: 100, // Limit sadece kayıt için, kontrol edilmiyor
            son_guncelleme: new Date()
          });
        }

        console.log(`📦 Kasa içi sayısı güncellendi: Workstation ${workstationId}, ${oncekiSayi} → ${yeniSayi}`);
        
        // Limit kontrolü YOK - Her buton basışında direkt bildirim gönder
        const mesaj = `${workstation.workstation_adi} iş istasyonunda kasa doldu! Forklift çağrılıyor.`;
        
        // Her forkliftçi için bildirim oluştur (duplicate kontrolü ile)
        const bildirimler = [];
        for (const forkliftci of forkliftciler) {
          // Son 5 dakika içinde aynı workstation için bekleyen bildirim var mı kontrol et
          const fiveMinutesAgo = new Date(Date.now() - 300000);
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
            
            // Aynı workstation adı içeren ve "kasa doldu" içeren
            if (bildirimMesaj.includes(workstationAdiLower) && bildirimMesaj.includes('kasa doldu')) {
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

        console.log(`✅ ${bildirimler.length} forkliftçiye kasa doldu bildirimi gönderildi`);
        
        return res.status(201).json({
          success: true,
          message: `Kasa içi sayısı ${yeniSayi} adete güncellendi. ${bildirimler.length} forkliftçiye bildirim gönderildi`,
          button_type: button_type,
          kasa_ici_sayisi: yeniSayi,
          workstation: {
            id: workstation.id.toString(),
            adi: workstation.workstation_adi,
            no: workstation.workstation_no
          },
          bildirim_sayisi: bildirimler.length
        });
      } catch (error) {
        console.error('Kasa içi sayısı güncelleme hatası:', error);
        // Hata olsa bile normal bildirim akışına devam et
      }
    }
    
    // Mesaj oluştur (hammadde_talebi veya diğer durumlar için)
    const mesaj = button_type === 'kasa_doldu' 
      ? `${workstation.workstation_adi} iş istasyonunda kasa doldu! Forklift çağrılıyor.`
      : `${workstation.workstation_adi} iş istasyonu için hammadde talebi`;
    
    // Her forkliftçi için bildirim oluştur (duplicate kontrolü ile)
    const bildirimler = [];
    for (const forkliftci of forkliftciler) {
      // Önce bu workstation ve forkliftçi için bekleyen bildirim var mı kontrol et
      // Mesaj içeriğine göre de kontrol et (hammadde talebi, kasa dolu gibi)
      const existingBildirim = await ForkliftBildirim.findOne({
        where: {
          forkliftci_id: forkliftci.id,
          durum: 'beklemede',
          [Op.or]: [
            { mesaj: mesaj },
            { 
              mesaj: { 
                [Op.like]: `%${workstation.workstation_adi}%` 
              },
              olusturma_tarihi: {
                [Op.gte]: new Date(Date.now() - 60000) // Son 1 dakika
              }
            }
          ]
        }
      });
      
      // Eğer bekleyen bildirim varsa, yeni bildirim oluşturma
      if (existingBildirim) {
        console.log(`⚠️ Forkliftçi ${forkliftci.id} için bekleyen bildirim var (ID: ${existingBildirim.id}), atlanıyor`);
        continue;
      }
      
      const savedBildirim = await ForkliftBildirim.create({
        kasa_id: null,
        forkliftci_id: forkliftci.id,
        mesaj: mesaj,
        durum: 'beklemede'
      });
      
      bildirimler.push(savedBildirim);
      
      console.log(`✅ Bildirim oluşturuldu:`, {
        bildirim_id: savedBildirim.id.toString(),
        forkliftci_id: forkliftci.id.toString(),
        forkliftci_ad: forkliftci.ad_soyad,
        mesaj: mesaj
      });
      
      // WebSocket ile bildirim gönder
      if (global.broadcast) {
        const wsMessage = {
          type: 'yeni_bildirim',
          data: {
            id: savedBildirim.id.toString(),
            workstation_id: workstation_id.toString(),
            workstation_adi: workstation.workstation_adi,
            workstation_no: workstation.workstation_no,
            mesaj: mesaj,
            durum: 'beklemede',
            forkliftci_id: forkliftci.id.toString(), // String olarak gönder
            forkliftci_id_int: forkliftci.id, // Integer olarak da gönder (karşılaştırma için)
            tip: button_type,
            olusturma_tarihi: savedBildirim.olusturma_tarihi
          }
        };
        console.log(`📡 WebSocket mesajı gönderiliyor:`, JSON.stringify(wsMessage, null, 2));
        console.log(`👤 Forkliftçi ID (string): ${forkliftci.id.toString()}, (int): ${forkliftci.id}`);
        global.broadcast(wsMessage);
      } else {
        console.log(`⚠️  global.broadcast fonksiyonu tanımlı değil!`);
      }
    }
    
    console.log(`✅ Fiziksel buton: ${button_type} - ${bildirimler.length} forkliftçiye bildirim gönderildi`);
    
    res.status(201).json({
      success: true,
      message: `${bildirimler.length} forkliftçiye bildirim gönderildi`,
      button_type: button_type,
      workstation: {
        id: workstation.id.toString(),
        adi: workstation.workstation_adi,
        no: workstation.workstation_no
      },
      bildirim_sayisi: bildirimler.length
    });
  } catch (error) {
    console.error('Fiziksel buton bildirim hatası:', error);
    res.status(500).json({ error: error.message || 'Bildirim oluşturulurken bir hata oluştu' });
  }
});

// Tüm iş istasyonlarını getir (butonlar için)
router.get('/workstations', async (req, res) => {
  try {
    const { api_key } = req.query;
    
    // API key kontrolü
    const VALID_API_KEY = process.env.BUTTON_API_KEY || 'BUTTON_API_KEY_2024';
    
    if (!api_key || api_key !== VALID_API_KEY) {
      return res.status(401).json({ error: 'Geçersiz API key' });
    }
    
    const workstations = await Workstation.findAll({
      where: { durum: 'aktif' },
      attributes: ['id', 'workstation_no', 'workstation_adi'],
      order: [['workstation_no', 'ASC']]
    });
    
    const formattedWorkstations = workstations.map(ws => {
      const plain = ws.get({ plain: true });
      return {
        id: plain.id.toString(),
        workstation_no: plain.workstation_no,
        workstation_adi: plain.workstation_adi
      };
    });
    
    res.json(formattedWorkstations);
  } catch (error) {
    console.error('İş istasyonu listesi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
