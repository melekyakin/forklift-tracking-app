const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Kullanici, ForkliftciWorkstation, Workstation } = require('../models-pg');
const { authenticateToken, authorize } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// Kullanıcıları listele (admin ve yönetici)
router.get('/', authenticateToken, authorize('admin', 'yonetici'), async (req, res) => {
  try {
    const { rol } = req.query;
    
    const where = { durum: 'aktif' };
    if (rol) {
      where.rol = rol;
    }
    
    const kullanicilar = await Kullanici.findAll({
      where,
      include: [{
        model: Workstation,
        as: 'workstation',
        attributes: ['id', 'workstation_adi', 'workstation_no'],
        required: false
      }],
      order: [['ad_soyad', 'ASC']]
    });
    
    // Forkliftçiler için iş istasyonlarını getir
    const kullanicilarWithWorkstations = await Promise.all(
      kullanicilar.map(async (kullanici) => {
        const plain = kullanici.get({ plain: true });
        if (plain.rol === 'forkliftoperator') {
          const forkliftciWorkstations = await ForkliftciWorkstation.findAll({
            where: { forkliftci_id: plain.id },
            include: [{
              model: Workstation,
              as: 'workstation',
              attributes: ['id', 'workstation_adi', 'workstation_no'],
              required: true
            }]
          });
          
          // İlk iş istasyonunu workstation_id olarak göster (geriye dönük uyumluluk için)
          const firstWorkstation = forkliftciWorkstations[0]?.workstation;
          const plainFirstWs = firstWorkstation?.get({ plain: true });
          
          return {
            ...plain,
            id: plain.id.toString(),
            workstation_id: plainFirstWs?.id?.toString() || null,
            workstation_adi: plainFirstWs?.workstation_adi || null,
            workstation_no: plainFirstWs?.workstation_no || null
          };
        }
        
        return {
          ...plain,
          id: plain.id.toString(),
          workstation_id: plain.workstation?.id?.toString() || null,
          workstation_adi: plain.workstation?.workstation_adi || null,
          workstation_no: plain.workstation?.workstation_no || null
        };
      })
    );
    
    res.json(kullanicilarWithWorkstations);
  } catch (error) {
    console.error('Kullanıcı listeleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Kullanıcı ekle (sadece admin) - Tüm roller için
router.post('/', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { kullanici_adi, ad_soyad, sifre, rol, workstation_ids, kart_no } = req.body;
    
    if (!kullanici_adi || !ad_soyad || !sifre) {
      return res.status(400).json({ error: 'Kullanıcı adı, ad soyad ve şifre gereklidir' });
    }
    
    // Rol kontrolü
    const allowedRoles = ['admin', 'forkliftoperator', 'hatoperator', 'yonetici'];
    const userRole = rol || 'forkliftoperator';
    if (!allowedRoles.includes(userRole)) {
      return res.status(400).json({ error: 'Geçersiz rol' });
    }
    
    // Kullanıcı adı kontrolü
    const existingUser = await Kullanici.findOne({ where: { kullanici_adi } });
    if (existingUser) {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
    }
    
    // Kart no kontrolü (eğer verilmişse)
    if (kart_no) {
      const existingCard = await Kullanici.findOne({ where: { kart_no } });
      if (existingCard) {
        return res.status(400).json({ error: 'Bu kart numarası zaten kullanılıyor' });
      }
    }
    
    const hashedPassword = bcrypt.hashSync(sifre, 10);
    
    // İlk iş istasyonunu workstation_id olarak kaydet (geriye dönük uyumluluk için)
    // Sadece forkliftoperator ve hatoperator için
    const firstWorkstationId = (userRole === 'forkliftoperator' || userRole === 'hatoperator') &&
      Array.isArray(workstation_ids) && workstation_ids.length > 0 
      ? parseInt(workstation_ids[0])
      : null;
    
    const yeniKullanici = await Kullanici.create({
      kullanici_adi,
      sifre: hashedPassword,
      ad_soyad,
      rol: userRole,
      workstation_id: firstWorkstationId,
      kart_no: kart_no || null
    });
    
    // Birden fazla iş istasyonu varsa ForkliftciWorkstation'a ekle (sadece forkliftoperator için)
    if (userRole === 'forkliftoperator' && Array.isArray(workstation_ids) && workstation_ids.length > 0) {
      const forkliftciWorkstations = workstation_ids.map(wsId => ({
        forkliftci_id: yeniKullanici.id,
        workstation_id: parseInt(wsId)
      }));
      
      await ForkliftciWorkstation.bulkCreate(forkliftciWorkstations);
    }
    
    // Kullanıcıyı iş istasyonu bilgisiyle birlikte getir
    const kullaniciWithWorkstation = await Kullanici.findByPk(yeniKullanici.id, {
      include: [{
        model: Workstation,
        as: 'workstation',
        attributes: ['id', 'workstation_adi', 'workstation_no'],
        required: false
      }]
    });
    
    const plain = kullaniciWithWorkstation.get({ plain: true });
    res.status(201).json({
      ...plain,
      id: plain.id.toString(),
      workstation_id: plain.workstation?.id?.toString() || null,
      workstation_adi: plain.workstation?.workstation_adi || null,
      workstation_no: plain.workstation?.workstation_no || null
    });
  } catch (error) {
    console.error('Forkliftçi ekleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Kullanıcı güncelle (sadece admin)
router.put('/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { ad_soyad, sifre, rol, workstation_ids, kart_no, durum } = req.body;
    const userId = parseInt(id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Geçersiz kullanıcı ID' });
    }
    
    // Önce kullanıcıyı kontrol et
    const user = await Kullanici.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    // Kart no kontrolü (eğer değiştiriliyorsa)
    if (kart_no && kart_no !== user.kart_no) {
      const existingCard = await Kullanici.findOne({ 
        where: { 
          kart_no, 
          id: { [Op.ne]: userId } 
        } 
      });
      if (existingCard) {
        return res.status(400).json({ error: 'Bu kart numarası zaten kullanılıyor' });
      }
    }
    
    // Kullanıcı bilgilerini güncelle
    if (ad_soyad) user.ad_soyad = ad_soyad;
    if (sifre) user.sifre = bcrypt.hashSync(sifre, 10);
    if (kart_no !== undefined) user.kart_no = kart_no || null;
    if (durum !== undefined) {
      if (durum === 'aktif' || durum === 'pasif') {
        user.durum = durum;
      }
    }
    
    // Rol güncelleme (eğer verilmişse)
    if (rol) {
      const allowedRoles = ['admin', 'forkliftoperator', 'hatoperator', 'yonetici'];
      if (!allowedRoles.includes(rol)) {
        return res.status(400).json({ error: 'Geçersiz rol' });
      }
      user.rol = rol;
    }
    
    // İş istasyonlarını güncelle (sadece forkliftoperator ve hatoperator için)
    if (Array.isArray(workstation_ids)) {
      const userRole = rol || user.rol;
      
      if (userRole === 'forkliftoperator') {
        // Eski iş istasyonlarını sil
        await ForkliftciWorkstation.destroy({ where: { forkliftci_id: userId } });
        
        // Yeni iş istasyonlarını ekle
        if (workstation_ids.length > 0) {
          const forkliftciWorkstations = workstation_ids.map(wsId => ({
            forkliftci_id: userId,
            workstation_id: parseInt(wsId)
          }));
          
          await ForkliftciWorkstation.bulkCreate(forkliftciWorkstations);
          
          // İlk iş istasyonunu workstation_id olarak kaydet (geriye dönük uyumluluk için)
          user.workstation_id = parseInt(workstation_ids[0]);
        } else {
          user.workstation_id = null;
        }
      } else if (userRole === 'hatoperator') {
        // Hat operatörü için sadece ilk iş istasyonunu kaydet
        user.workstation_id = workstation_ids.length > 0 ? parseInt(workstation_ids[0]) : null;
      } else {
        // Diğer roller için iş istasyonu yok
        user.workstation_id = null;
        await ForkliftciWorkstation.destroy({ where: { forkliftci_id: userId } });
      }
    }
    
    await user.save();
    
    // Güncellenmiş kullanıcıyı iş istasyonu bilgisiyle birlikte getir
    const updatedUser = await Kullanici.findByPk(user.id, {
      include: [{
        model: Workstation,
        as: 'workstation',
        attributes: ['id', 'workstation_adi', 'workstation_no'],
        required: false
      }]
    });
    
    const plain = updatedUser.get({ plain: true });
    res.json({
      ...plain,
      id: plain.id.toString(),
      workstation_id: plain.workstation?.id?.toString() || null,
      workstation_adi: plain.workstation?.workstation_adi || null,
      workstation_no: plain.workstation?.workstation_no || null
    });
  } catch (error) {
    console.error('Forkliftçi güncelleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Forkliftçi çıkar (pasif yap - sadece admin)
router.delete('/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    
    // Admin kendini silemez
    if (userId === parseInt(req.user.id)) {
      return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz' });
    }
    
    const user = await Kullanici.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    user.durum = 'pasif';
    await user.save();
    
    res.json({ message: 'Forkliftçi başarıyla çıkarıldı' });
  } catch (error) {
    console.error('Forkliftçi silme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

