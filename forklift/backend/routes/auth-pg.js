const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Kullanici, Workstation } = require('../models-pg');

const JWT_SECRET = process.env.JWT_SECRET || 'forklift-secret-key-change-in-production';

// Login
router.post('/login', async (req, res) => {
  try {
    const { kullanici_adi, sifre } = req.body;

    console.log('🔐 Login denemesi:', { kullanici_adi, sifre: sifre ? '***' : 'yok' });

    if (!kullanici_adi || !sifre) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir' });
    }

    const user = await Kullanici.findOne({
      where: {
        kullanici_adi: kullanici_adi,
        durum: 'aktif'
      },
      include: [{
        model: Workstation,
        as: 'workstation',
        attributes: ['id', 'workstation_no', 'workstation_adi'],
        required: false
      }]
    });

    if (!user) {
      console.log('❌ Kullanıcı bulunamadı veya aktif değil:', kullanici_adi);
      return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
    }

    console.log('✅ Kullanıcı bulundu:', user.kullanici_adi);

    // Şifre kontrolü
    const isValidPassword = await bcrypt.compare(sifre, user.sifre);
    console.log('🔑 Şifre doğrulama:', isValidPassword ? '✅' : '❌');
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
    }

    const plainUser = user.get({ plain: true });

    // JWT token oluştur
    const token = jwt.sign(
      {
        id: plainUser.id.toString(),
        kullanici_adi: plainUser.kullanici_adi,
        ad_soyad: plainUser.ad_soyad,
        rol: plainUser.rol,
        workstation_id: plainUser.workstation?.id?.toString() || null,
        workstation_no: plainUser.workstation?.workstation_no || null,
        workstation_adi: plainUser.workstation?.workstation_adi || null
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: plainUser.id.toString(),
        kullanici_adi: plainUser.kullanici_adi,
        ad_soyad: plainUser.ad_soyad,
        rol: plainUser.rol,
        workstation_id: plainUser.workstation?.id?.toString() || null,
        workstation_no: plainUser.workstation?.workstation_no || null,
        workstation_adi: plainUser.workstation?.workstation_adi || null
      }
    });
  } catch (error) {
    console.error('Login hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Kart ile login (Forklift operatörleri için)
router.post('/login-kart', async (req, res) => {
  try {
    let { kart_no } = req.body;

    if (!kart_no) {
      return res.status(400).json({ error: 'Kart numarası gereklidir' });
    }

    // Kart numarasını temizle (trim ve uppercase)
    kart_no = kart_no.trim().toUpperCase();

    const user = await Kullanici.findOne({
      where: {
        kart_no: kart_no,
        durum: 'aktif'
      },
      include: [{
        model: Workstation,
        as: 'workstation',
        attributes: ['id', 'workstation_no', 'workstation_adi'],
        required: false
      }]
    });

    if (!user) {
      console.log(`Kart bulunamadı: ${kart_no}`);
      return res.status(401).json({ error: 'Geçersiz kart veya kart kayıtlı değil' });
    }

    // Sadece forklift operatörleri kart ile giriş yapabilir
    if (user.rol !== 'forkliftoperator') {
      return res.status(403).json({ error: 'Bu kart sadece forklift operatörleri için geçerlidir' });
    }

    const plainUser = user.get({ plain: true });

    // JWT token oluştur
    const token = jwt.sign(
      {
        id: plainUser.id.toString(),
        kullanici_adi: plainUser.kullanici_adi,
        ad_soyad: plainUser.ad_soyad,
        rol: plainUser.rol,
        workstation_id: plainUser.workstation?.id?.toString() || null,
        workstation_no: plainUser.workstation?.workstation_no || null,
        workstation_adi: plainUser.workstation?.workstation_adi || null
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: plainUser.id.toString(),
        kullanici_adi: plainUser.kullanici_adi,
        ad_soyad: plainUser.ad_soyad,
        rol: plainUser.rol,
        workstation_id: plainUser.workstation?.id?.toString() || null,
        workstation_no: plainUser.workstation?.workstation_no || null,
        workstation_adi: plainUser.workstation?.workstation_adi || null
      }
    });
  } catch (error) {
    console.error('Kart ile giriş hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mevcut kullanıcı bilgilerini getir
router.get('/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token bulunamadı' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Geçersiz token' });
    }

    res.json({
      id: decoded.id,
      kullanici_adi: decoded.kullanici_adi,
      ad_soyad: decoded.ad_soyad,
      rol: decoded.rol,
      workstation_id: decoded.workstation_id,
      workstation_no: decoded.workstation_no,
      workstation_adi: decoded.workstation_adi
    });
  });
});

// Token doğrulama (test için)
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token bulunamadı' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ error: 'Geçersiz token', valid: false });
  }
});

module.exports = router;

