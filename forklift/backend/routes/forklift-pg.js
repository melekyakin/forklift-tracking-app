const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { ForkliftBildirim, ForkliftciWorkstation, Workstation, Kullanici, ForkliftciAktivite } = require('../models-pg');
const { authenticateToken } = require('../middleware/auth');

// Kapatılmayı bekleyen işleri getir (onaylanmış ama kapatılmamış)
// ⚠️ Bu route'u en üste taşıdık çünkü /bildirimler/bekleyen route'u ile çakışmaması için
router.get('/bildirimler/kapatilmayi-bekleyen', authenticateToken, async (req, res) => {
  console.log('📋 Kapatılmayı bekleyen işler endpoint\'i çağrıldı');
  console.log('📋 User:', req.user);
  console.log('📋 Request URL:', req.url);
  console.log('📋 Request method:', req.method);
  try {
    const where = {
      durum: 'onaylandi',
      tamamlanma_tarihi: null // Onaylanmış ama kapatılmamış
    };
    
    // Eğer forklift operatörü ise, sadece kendi bildirimlerini göster
    if (req.user.rol === 'forkliftoperator') {
      const forkliftciId = parseInt(req.user.id);
      where.forkliftci_id = forkliftciId;
    }
    
    const bildirimler = await ForkliftBildirim.findAll({
      where,
      include: [
        {
          model: Kullanici,
          as: 'forkliftci',
          attributes: ['id', 'ad_soyad', 'kullanici_adi']
        },
      ],
      order: [['onay_tarihi', 'ASC']] // En eski onaylanmış işler önce
    });
    
    const bildirimlerWithWorkstation = await Promise.all(bildirimler.map(async (bildirim) => {
      const plain = bildirim.get({ plain: true });
      
      // Workstation bilgisini bul (mesajdan)
      let workstationAdi = null;
      let workstationNo = null;
      
      if (plain.mesaj) {
        // Eğer kasa yoksa, bildirimin mesajından workstation bilgisini çıkarmaya çalış
        // Mesaj formatı: "{workstation_adi} iş istasyonunda kasa doldu!" veya benzeri
        const mesajMatch = plain.mesaj.match(/(.+?)\s+iş\s+istasyonu/i);
        if (mesajMatch && mesajMatch[1]) {
          workstationAdi = mesajMatch[1].trim();
          // Workstation numarasını bulmak için tüm workstation'ları kontrol et
          const workstation = await Workstation.findOne({
            where: { workstation_adi: workstationAdi }
          });
          if (workstation) {
            workstationNo = workstation.workstation_no;
          }
        }
      }
      
      return {
        ...plain,
        id: plain.id.toString(),
        forkliftci_id: plain.forkliftci_id ? plain.forkliftci_id.toString() : null,
        olusturma_tarihi: plain.olusturma_tarihi,
        tamamlanma_tarihi: plain.tamamlanma_tarihi || null,
        sure_saniye: plain.sure_saniye || null,
        onay_tarihi: plain.onay_tarihi || null,
        workstation_adi: workstationAdi,
        workstation_no: workstationNo
      };
    }));
    
    console.log(`📋 Kapatılmayı bekleyen işler:`, bildirimlerWithWorkstation.length);
    
    res.json(bildirimlerWithWorkstation);
  } catch (error) {
    console.error('Kapatılmayı bekleyen işler yükleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Tüm bildirimleri getir
router.get('/bildirimler', authenticateToken, async (req, res) => {
  try {
    const { durum } = req.query;
    
    const where = {};
    if (durum) {
      where.durum = durum;
    }
    
    const bildirimler = await ForkliftBildirim.findAll({
      where,
      include: [{
        model: Kullanici,
        as: 'forkliftci',
        attributes: ['id', 'ad_soyad', 'kullanici_adi']
      }],
      order: [['olusturma_tarihi', 'DESC']]
    });
    
    const bildirimlerWithWorkstation = bildirimler.map((bildirim) => {
      const plain = bildirim.get({ plain: true });
      return {
        ...plain,
        id: plain.id.toString(),
        forkliftci_id: plain.forkliftci_id ? plain.forkliftci_id.toString() : null,
        workstation_adi: null,
        workstation_no: null
      };
    });
    
    res.json(bildirimlerWithWorkstation);
  } catch (error) {
    console.error('Bildirim yükleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Forkliftçinin onayladığı bildirimleri getir (iş geçmişi)
router.get('/bildirimler/gecmis', authenticateToken, async (req, res) => {
  try {
    const { baslangic_tarihi, bitis_tarihi, durum, limit = 100 } = req.query;
    
    const where = {};
    
    // Eğer forklift operatörü ise, sadece kendi bildirimlerini göster
    if (req.user.rol === 'forkliftoperator') {
      where.forkliftci_id = parseInt(req.user.id);
    }
    
    // Durum filtresi
    if (durum) {
      if (durum === 'tamamlanan') {
        // Tamamlanan = kapatılmış bildirimler
        where.durum = 'onaylandi';
        where.tamamlanma_tarihi = { [Op.ne]: null };
      } else if (durum === 'onaylandi') {
        // Onaylanmış ama kapatılmamış
        where.durum = 'onaylandi';
        where.tamamlanma_tarihi = null;
      } else {
        where.durum = durum;
      }
    } else {
      // Varsayılan: onaylanmış ve kapatılmış bildirimler
      where.durum = 'onaylandi';
      where.tamamlanma_tarihi = { [Op.ne]: null };
    }
    
    // Tarih filtresi
    if (baslangic_tarihi || bitis_tarihi) {
      const tarihFiltresi = {};
      if (baslangic_tarihi) {
        tarihFiltresi[Op.gte] = new Date(baslangic_tarihi);
      }
      if (bitis_tarihi) {
        const bitis = new Date(bitis_tarihi);
        bitis.setHours(23, 59, 59, 999);
        tarihFiltresi[Op.lte] = bitis;
      }
      where[Op.or] = [
        { onay_tarihi: tarihFiltresi },
        { red_tarihi: tarihFiltresi }
      ];
    }
    
    const bildirimler = await ForkliftBildirim.findAll({
      where,
      include: [{
        model: Kullanici,
        as: 'forkliftci',
        attributes: ['id', 'ad_soyad', 'kullanici_adi']
      }],
      order: [['onay_tarihi', 'DESC'], ['olusturma_tarihi', 'DESC']],
      limit: parseInt(limit)
    });
    
    const bildirimlerWithWorkstation = bildirimler.map((bildirim) => {
      const plain = bildirim.get({ plain: true });
      let workstation_adi = null;
      let workstation_no = null;
      
      if (plain.mesaj) {
        const match = plain.mesaj.match(/(.+?)\s+iş\s+istasyonu/i);
        if (match) {
          workstation_adi = match[1].trim();
        }
      }
      
      return {
        ...plain,
        id: plain.id.toString(),
        forkliftci_id: plain.forkliftci_id ? plain.forkliftci_id.toString() : null,
        forkliftci_ad_soyad: plain.forkliftci?.ad_soyad || null,
        forkliftci_kullanici_adi: plain.forkliftci?.kullanici_adi || null,
        workstation_adi: workstation_adi,
        workstation_no: workstation_no,
        olusturma_tarihi: plain.olusturma_tarihi,
        onay_tarihi: plain.onay_tarihi,
        red_tarihi: plain.red_tarihi,
        tamamlanma_tarihi: plain.tamamlanma_tarihi
      };
    });
    
    res.json(bildirimlerWithWorkstation);
  } catch (error) {
    console.error('İş geçmişi yükleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bekleyen bildirimleri getir (sadece beklemede olanlar)
// Bekleyen bildirimleri getir (duplicate kontrolü ile)
router.get('/bildirimler/bekleyen', authenticateToken, async (req, res) => {
  try {
    const { workstationIds } = req.query;
    
    // Sadece beklemede olan bildirimler
    const where = {
      durum: 'beklemede'
    };
    
    // Eğer forklift operatörü ise, sadece kendi bildirimlerini göster
    if (req.user.rol === 'forkliftoperator') {
      const forkliftciId = parseInt(req.user.id);
      console.log(`🔍 Forkliftçi bildirimleri çekiliyor:`, {
        forkliftci_id: forkliftciId,
        kullanici_adi: req.user.kullanici_adi,
        workstationIds: workstationIds
      });
      
      where.forkliftci_id = forkliftciId;
      
      if (workstationIds) {
        // Workstation filtreleme (şimdilik bildirimde workstation_id yok)
      }
    }
    
    const bildirimler = await ForkliftBildirim.findAll({
      where,
      include: [
        {
          model: Kullanici,
          as: 'forkliftci',
          attributes: ['id', 'ad_soyad', 'kullanici_adi']
        },
      ],
      order: [
        ['durum', 'ASC'], // Önce beklemede, sonra onaylandi
        ['olusturma_tarihi', 'DESC']
      ]
    });
    
    console.log(`📬 Bulunan bildirim sayısı:`, bildirimler.length);
    
    // Duplicate kontrolü - aynı ID'li bildirimleri filtrele
    const seenIds = new Set();
    const uniqueBildirimler = bildirimler.filter((bildirim) => {
      const plain = bildirim.get({ plain: true });
      if (seenIds.has(plain.id)) {
        console.log(`⚠️ Duplicate bildirim ID: ${plain.id}, atlanıyor`);
        return false;
      }
      seenIds.add(plain.id);
      return true;
    });
    
    console.log(`✅ Duplicate kontrolü sonrası bildirim sayısı:`, uniqueBildirimler.length);
    
    // Workstation ID'lerini parse et
    let selectedWorkstationIds = null;
    if (workstationIds) {
      if (Array.isArray(workstationIds)) {
        selectedWorkstationIds = workstationIds.map(id => parseInt(id)).filter(id => !isNaN(id));
      } else {
        selectedWorkstationIds = [parseInt(workstationIds)].filter(id => !isNaN(id));
      }
    }
    
    // Her bildirim için workstation bilgisini mesajdan çıkar
    const bildirimlerWithWorkstation = await Promise.all(uniqueBildirimler.map(async (bildirim) => {
      const plain = bildirim.get({ plain: true });
      
      // Workstation bilgisini mesajdan çıkar
      let workstation = null;
      let workstation_id = null;
      let workstation_adi = null;
      let workstation_no = null;
      
      // Mesajdan workstation bilgisini çıkar
      // Mesaj formatı: "{workstation_adi} iş istasyonu için hammadde talebi" veya benzeri
      if (plain.mesaj) {
        const mesajMatch = plain.mesaj.match(/(.+?)\s+iş\s+istasyonu/i);
        if (mesajMatch && mesajMatch[1]) {
          workstation_adi = mesajMatch[1].trim();
          // Workstation'ı adına göre bul
          const foundWorkstation = await Workstation.findOne({
            where: { workstation_adi: workstation_adi }
          });
          if (foundWorkstation) {
            workstation = foundWorkstation.get({ plain: true });
            workstation_id = workstation.id;
            workstation_no = workstation.workstation_no;
          }
        }
      }
      
      // Eğer mesajdan bulunamazsa, forkliftçinin workstation'ını kullan (fallback)
      if (!workstation && plain.forkliftci_id) {
        const forkliftciWorkstations = await ForkliftciWorkstation.findAll({
          where: { forkliftci_id: plain.forkliftci_id },
          include: [{
            model: Workstation,
            as: 'workstation',
            attributes: ['id', 'workstation_adi', 'workstation_no'],
            required: true
          }],
          limit: 1
        });
        
        if (forkliftciWorkstations.length > 0) {
          workstation = forkliftciWorkstations[0].get({ plain: true }).workstation;
          workstation_id = workstation.id;
          workstation_adi = workstation.workstation_adi;
          workstation_no = workstation.workstation_no;
        }
      }
      
      return {
        ...plain,
        id: plain.id.toString(),
        forkliftci_id: plain.forkliftci_id ? plain.forkliftci_id.toString() : null,
        workstation_id: workstation_id ? workstation_id.toString() : null,
        workstation_adi: workstation_adi,
        workstation_no: workstation_no,
        olusturma_tarihi: plain.olusturma_tarihi,
        tamamlanma_tarihi: plain.tamamlanma_tarihi || null,
        sure_saniye: plain.sure_saniye || null,
        onay_tarihi: plain.onay_tarihi || null
      };
    }));
    
    // Seçili workstation'lara göre filtrele
    let filteredBildirimler = bildirimlerWithWorkstation;
    if (selectedWorkstationIds && selectedWorkstationIds.length > 0) {
      console.log(`🔍 Workstation filtreleme başlıyor:`, {
        selectedWorkstationIds,
        toplamBildirim: bildirimlerWithWorkstation.length
      });
      
      filteredBildirimler = bildirimlerWithWorkstation.filter(bildirim => {
        const bildirimWorkstationId = bildirim.workstation_id ? parseInt(bildirim.workstation_id) : null;
        
        // Debug log
        console.log(`Bildirim ${bildirim.id} kontrolü:`, {
          bildirimWorkstationId,
          bildirimWorkstationAdi: bildirim.workstation_adi,
          mesaj: bildirim.mesaj,
          seçiliWorkstationIds: selectedWorkstationIds,
          eşleşiyor: bildirimWorkstationId ? selectedWorkstationIds.includes(bildirimWorkstationId) : false
        });
        
        // Workstation bilgisi yoksa, seçili workstation'lar varsa filtrele
        // Ama eğer hiç workstation seçilmemişse, tüm bildirimleri göster
        if (!bildirimWorkstationId) {
          console.log(`⚠️ Bildirim ${bildirim.id} için workstation bilgisi yok, filtreleniyor`);
          return false;
        }
        
        const eslesiyor = selectedWorkstationIds.includes(bildirimWorkstationId);
        if (!eslesiyor) {
          console.log(`❌ Bildirim ${bildirim.id} seçili workstation'lara ait değil`);
        }
        return eslesiyor;
      });
      console.log(`✅ Workstation filtreleme sonucu: ${bildirimlerWithWorkstation.length} -> ${filteredBildirimler.length} bildirim`);
    } else {
      console.log(`ℹ️ Workstation filtreleme yok, tüm bildirimler gösteriliyor: ${bildirimlerWithWorkstation.length}`);
    }
    
    res.json(filteredBildirimler);
  } catch (error) {
    console.error('Bekleyen bildirim yükleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bildirimi onayla
router.post('/bildirim/:id/onayla', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const forkliftciId = parseInt(req.user.id);
    const bildirimId = parseInt(id);
    
    if (isNaN(bildirimId)) {
      return res.status(400).json({ error: 'Geçersiz bildirim ID' });
    }
    
    const bildirim = await ForkliftBildirim.findByPk(bildirimId);
    if (!bildirim) {
      return res.status(404).json({ error: 'Bildirim bulunamadı' });
    }
    
    // Forklift operatörü ise sadece kendi bildirimlerini onaylayabilir
    if (req.user.rol === 'forkliftoperator' && 
        bildirim.forkliftci_id && 
        bildirim.forkliftci_id !== forkliftciId) {
      return res.status(403).json({ error: 'Bu bildirimi onaylama yetkiniz yok' });
    }
    
    bildirim.durum = 'onaylandi';
    bildirim.forkliftci_id = forkliftciId;
    bildirim.onay_tarihi = new Date();
    await bildirim.save();
    
    // Aktivite kaydı oluştur (iş başladı)
    const plainBildirim = bildirim.get({ plain: true });
    let workstationId = null;
    
    // Workstation'ı forkliftçiden bul
    const forkliftciWorkstations = await ForkliftciWorkstation.findAll({
      where: { forkliftci_id: forkliftciId },
      include: [{
        model: Workstation,
        as: 'workstation',
        attributes: ['id'],
        required: true
      }],
      limit: 1
    });
    
    if (forkliftciWorkstations.length > 0) {
      workstationId = forkliftciWorkstations[0].workstation_id;
    }
    
    // ForkliftciAktivite kaydı oluştur
    await ForkliftciAktivite.create({
      forkliftci_id: forkliftciId,
      aktivite_tipi: 'bildirim_onaylandi',
      workstation_id: workstationId,
      bildirim_id: bildirimId,
      baslangic_zamani: bildirim.onay_tarihi,
      aciklama: plainBildirim.mesaj || 'Bildirim onaylandı'
    });
    
    // Aynı mesaj ve workstation için diğer forkliftçilerin bekleyen bildirimlerini de "onaylandi" durumuna geçir
    // Böylece diğer forkliftçilerin ekranından kaldırılır
    if (plainBildirim.mesaj) {
      // Mesajdan workstation adını çıkar
      const mesajMatch = plainBildirim.mesaj.match(/(.+?)\s+iş\s+istasyonu/i);
      if (mesajMatch && mesajMatch[1]) {
        const workstationAdi = mesajMatch[1].trim();
        const workstation = await Workstation.findOne({
          where: { workstation_adi: workstationAdi }
        });
        
        if (workstation) {
          // Aynı mesaj ve workstation için diğer bekleyen bildirimleri bul
          const digerBekleyenBildirimler = await ForkliftBildirim.findAll({
            where: {
              durum: 'beklemede',
              mesaj: plainBildirim.mesaj,
              id: { [Op.ne]: bildirimId }, // Onaylanan bildirimi hariç tut
              forkliftci_id: { [Op.ne]: forkliftciId } // Onaylayan forkliftçiyi hariç tut
            }
          });
          
          // Diğer bekleyen bildirimleri de "onaylandi" durumuna geçir
          if (digerBekleyenBildirimler.length > 0) {
            console.log(`🔄 Aynı mesaj ve workstation için ${digerBekleyenBildirimler.length} bekleyen bildirim daha "onaylandi" durumuna geçiriliyor`);
            
            await ForkliftBildirim.update(
              {
                durum: 'onaylandi',
                onay_tarihi: new Date()
              },
              {
                where: {
                  id: { [Op.in]: digerBekleyenBildirimler.map(b => b.id) }
                }
              }
            );
            
            // WebSocket ile diğer bildirimlerin de onaylandığını bildir
            if (global.broadcast) {
              digerBekleyenBildirimler.forEach(async (digerBildirim) => {
                const plainDiger = digerBildirim.get({ plain: true });
                global.broadcast({
                  type: 'bildirim_onaylandi',
                  data: {
                    ...plainDiger,
                    id: plainDiger.id.toString(),
                    durum: 'onaylandi',
                    onay_tarihi: new Date()
                  }
                });
              });
            }
          }
        }
      }
    }
    
    // WebSocket ile bildirim gönder
    if (global.broadcast) {
      global.broadcast({
        type: 'bildirim_onaylandi',
        data: {
          ...plainBildirim,
          id: plainBildirim.id.toString()
        }
      });
    }
    
    res.json({
      ...plainBildirim,
      id: plainBildirim.id.toString()
    });
  } catch (error) {
    console.error('Bildirim onaylama hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bildirimi kapat (iş tamamlandı)
router.post('/bildirim/:id/kapat', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const forkliftciId = parseInt(req.user.id);
    const bildirimId = parseInt(id);
    
    if (isNaN(bildirimId)) {
      return res.status(400).json({ error: 'Geçersiz bildirim ID' });
    }
    
    const bildirim = await ForkliftBildirim.findByPk(bildirimId);
    if (!bildirim) {
      return res.status(404).json({ error: 'Bildirim bulunamadı' });
    }
    
    // Sadece onaylanmış bildirimler kapatılabilir
    if (bildirim.durum !== 'onaylandi') {
      return res.status(400).json({ error: 'Sadece onaylanmış bildirimler kapatılabilir' });
    }
    
    // Forklift operatörü ise sadece kendi bildirimlerini kapatabilir
    if (req.user.rol === 'forkliftoperator' && 
        bildirim.forkliftci_id && 
        bildirim.forkliftci_id !== forkliftciId) {
      return res.status(403).json({ error: 'Bu bildirimi kapatma yetkiniz yok' });
    }
    
    // Zaten kapatılmış mı kontrol et
    if (bildirim.tamamlanma_tarihi) {
      return res.status(400).json({ error: 'Bu bildirim zaten kapatılmış' });
    }
    
    const tamamlanmaTarihi = new Date();
    const onayTarihi = bildirim.onay_tarihi || bildirim.olusturma_tarihi;
    const sureSaniye = Math.floor((tamamlanmaTarihi - new Date(onayTarihi)) / 1000);
    
    bildirim.tamamlanma_tarihi = tamamlanmaTarihi;
    bildirim.sure_saniye = sureSaniye;
    await bildirim.save();
    
    // ForkliftciAktivite kaydını güncelle
    const aktivite = await ForkliftciAktivite.findOne({
      where: {
        bildirim_id: bildirimId,
        forkliftci_id: forkliftciId
      },
      order: [['baslangic_zamani', 'DESC']]
    });
    
    if (aktivite) {
      aktivite.bitis_zamani = tamamlanmaTarihi;
      aktivite.sure_saniye = sureSaniye;
      aktivite.aciklama = (aktivite.aciklama || '') + ' - İş tamamlandı';
      await aktivite.save();
    } else {
      // Aktivite kaydı yoksa oluştur
      const plainBildirim = bildirim.get({ plain: true });
      let workstationId = null;
      
      // Workstation'ı forkliftçiden bul
      const forkliftciWorkstations = await ForkliftciWorkstation.findAll({
        where: { forkliftci_id: forkliftciId },
        include: [{
          model: Workstation,
          as: 'workstation',
          attributes: ['id'],
          required: true
        }],
        limit: 1
      });
      
      if (forkliftciWorkstations.length > 0) {
        workstationId = forkliftciWorkstations[0].workstation_id;
      }
      
      await ForkliftciAktivite.create({
        forkliftci_id: forkliftciId,
        aktivite_tipi: 'is_tamamlandi',
        workstation_id: workstationId,
        bildirim_id: bildirimId,
        baslangic_zamani: onayTarihi,
        bitis_zamani: tamamlanmaTarihi,
        sure_saniye: sureSaniye,
        aciklama: plainBildirim.mesaj || 'İş tamamlandı'
      });
    }
    
    // WebSocket ile bildirim gönder
    if (global.broadcast) {
      const plain = bildirim.get({ plain: true });
      global.broadcast({
        type: 'bildirim_kapatildi',
        data: {
          ...plain,
          id: plain.id.toString(),
          sure_saniye: sureSaniye,
          tamamlanma_tarihi: tamamlanmaTarihi
        }
      });
    }
    
    const plain = bildirim.get({ plain: true });
    res.json({
      ...plain,
      id: plain.id.toString(),
      sure_saniye: sureSaniye,
      tamamlanma_tarihi: tamamlanmaTarihi
    });
  } catch (error) {
    console.error('Bildirim kapatma hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bildirimi reddet
router.post('/bildirim/:id/reddet', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { red_nedeni } = req.body;
    const forkliftciId = parseInt(req.user.id);
    const bildirimId = parseInt(id);
    
    if (isNaN(bildirimId)) {
      return res.status(400).json({ error: 'Geçersiz bildirim ID' });
    }
    
    const bildirim = await ForkliftBildirim.findByPk(bildirimId);
    if (!bildirim) {
      return res.status(404).json({ error: 'Bildirim bulunamadı' });
    }
    
    // Forklift operatörü ise sadece kendi bildirimlerini reddedebilir
    if (req.user.rol === 'forkliftoperator' && 
        bildirim.forkliftci_id && 
        bildirim.forkliftci_id !== forkliftciId) {
      return res.status(403).json({ error: 'Bu bildirimi reddetme yetkiniz yok' });
    }
    
    bildirim.durum = 'reddedildi';
    bildirim.forkliftci_id = forkliftciId;
    bildirim.red_tarihi = new Date();
    await bildirim.save();
    
    // Aktivite kaydı oluştur (bildirim reddedildi)
    const plainBildirim = bildirim.get({ plain: true });
    let workstationId = null;
    
    // Workstation'ı forkliftçiden bul
    const forkliftciWorkstations = await ForkliftciWorkstation.findAll({
      where: { forkliftci_id: forkliftciId },
      include: [{
        model: Workstation,
        as: 'workstation',
        attributes: ['id'],
        required: true
      }],
      limit: 1
    });
    
    if (forkliftciWorkstations.length > 0) {
      workstationId = forkliftciWorkstations[0].workstation_id;
    }
    
    // ForkliftciAktivite kaydı oluştur
    await ForkliftciAktivite.create({
      forkliftci_id: forkliftciId,
      aktivite_tipi: 'bildirim_reddedildi',
      workstation_id: workstationId,
      bildirim_id: bildirimId,
      baslangic_zamani: bildirim.red_tarihi,
      aciklama: plainBildirim.mesaj || 'Bildirim reddedildi' + (red_nedeni ? ` - Neden: ${red_nedeni}` : '')
    });
    
    // WebSocket ile bildirim gönder
    if (global.broadcast) {
      global.broadcast({
        type: 'bildirim_reddedildi',
        data: {
          ...plainBildirim,
          id: plainBildirim.id.toString()
        }
      });
    }
    
    res.json({
      ...plainBildirim,
      id: plainBildirim.id.toString()
    });
  } catch (error) {
    console.error('Bildirim reddetme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Yeni forklift bildirimi oluştur
router.post('/bildirim', authenticateToken, async (req, res) => {
  try {
    const { workstation_id, mesaj, tip } = req.body;
    
    if (!mesaj) {
      return res.status(400).json({ error: 'Mesaj gereklidir' });
    }

    if (!workstation_id) {
      return res.status(400).json({ error: 'İş istasyonu ID gereklidir' });
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

    const forkliftciler = forkliftciWorkstations
      .map(fw => fw.forkliftci)
      .filter(f => f !== null);

    if (forkliftciler.length === 0) {
      return res.status(404).json({ error: 'Bu iş istasyonu için forkliftçi bulunamadı' });
    }

    // Benzersiz forkliftçileri al (aynı forkliftçi birden fazla workstation'a bağlı olabilir)
    const uniqueForkliftciler = [];
    const seenForkliftciIds = new Set();
    for (const forkliftci of forkliftciler) {
      if (!seenForkliftciIds.has(forkliftci.id)) {
        seenForkliftciIds.add(forkliftci.id);
        uniqueForkliftciler.push(forkliftci);
      }
    }

    // Her forkliftçi için bildirim oluştur (duplicate kontrolü ile)
    const bildirimler = [];
    for (const forkliftci of uniqueForkliftciler) {
      // Önce bu workstation ve forkliftçi için bekleyen bildirim var mı kontrol et
      // Daha sıkı duplicate kontrolü: aynı forkliftçi, aynı workstation ve aynı mesaj tipi için
      const fiveMinutesAgo = new Date(Date.now() - 300000); // Son 5 dakika
      
      // Mesaj içeriğini normalize et (workstation adını çıkar)
      const normalizedMesaj = mesaj.toLowerCase().trim();
      const workstationAdiLower = workstation.workstation_adi.toLowerCase();
      
      // Önce tüm bekleyen bildirimleri al
      const bekleyenBildirimler = await ForkliftBildirim.findAll({
        where: {
          forkliftci_id: forkliftci.id,
          durum: 'beklemede',
          olusturma_tarihi: {
            [Op.gte]: fiveMinutesAgo // Son 5 dakika içinde
          }
        },
        order: [['olusturma_tarihi', 'DESC']]
      });
      
      // JavaScript'te duplicate kontrolü yap (daha esnek)
      const existingBildirim = bekleyenBildirimler.find(b => {
        const bildirimMesaj = (b.mesaj || '').toLowerCase().trim();
        
        // Tam mesaj eşleşmesi
        if (bildirimMesaj === normalizedMesaj) {
          return true;
        }
        
        // Aynı workstation adı içeren ve aynı mesaj tipi
        if (bildirimMesaj.includes(workstationAdiLower)) {
          // Hammadde talebi kontrolü
          if (tip === 'hammadde_talebi' && bildirimMesaj.includes('hammadde talebi')) {
            return true;
          }
          // Diğer tip kontrolleri
          if (tip && bildirimMesaj.includes(tip.toLowerCase())) {
            return true;
          }
        }
        
        return false;
      });
      
      // Eğer bekleyen bildirim varsa, yeni bildirim oluşturma
      if (existingBildirim) {
        console.log(`⚠️ Forkliftçi ${forkliftci.id} için bekleyen bildirim var (ID: ${existingBildirim.id}, Mesaj: ${existingBildirim.mesaj}), yeni bildirim oluşturulmayacak`);
        continue;
      }
      
      const savedBildirim = await ForkliftBildirim.create({
        forkliftci_id: forkliftci.id,
        mesaj: mesaj,
        durum: 'beklemede'
      });

      bildirimler.push(savedBildirim);

      // WebSocket ile bildirim gönder
      if (global.broadcast) {
        const plain = savedBildirim.get({ plain: true });
        global.broadcast({
          type: 'yeni_bildirim',
          data: {
            id: plain.id.toString(),
            workstation_id: workstation_id,
            workstation_adi: workstation.workstation_adi,
            workstation_no: workstation.workstation_no,
            mesaj: mesaj,
            durum: 'beklemede',
            forkliftci_id: forkliftci.id.toString(),
            tip: tip || 'genel',
            olusturma_tarihi: plain.olusturma_tarihi
          }
        });
      }
    }

    console.log(`✅ ${bildirimler.length} forkliftçiye bildirim gönderildi (${tip || 'genel'})`);

    res.status(201).json({
      success: true,
      message: `${bildirimler.length} forkliftçiye bildirim gönderildi`,
      bildirimler: bildirimler.map(b => {
        const plain = b.get({ plain: true });
        return {
          id: plain.id.toString(),
          ...plain
        };
      })
    });
  } catch (error) {
    console.error('Forklift bildirim oluşturma hatası:', error);
    res.status(500).json({ error: error.message || 'Bildirim oluşturulurken bir hata oluştu' });
  }
});

module.exports = router;

