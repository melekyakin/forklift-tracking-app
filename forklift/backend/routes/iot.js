const express = require('express');
const router = express.Router();
const iotSimulator = require('../services/iotSimulator');
const fusionService = require('../services/fusion-pg');
const { authenticateToken } = require('../middleware/auth');

// IoT simülasyonunu başlat
router.post('/simulasyon/baslat/:forkliftId', authenticateToken, (req, res) => {
  const { forkliftId } = req.params;
  
  try {
    iotSimulator.startSimulation(forkliftId);
    res.json({ 
      message: 'IoT simülasyonu başlatıldı',
      forklift_id: forkliftId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// IoT simülasyonunu durdur
router.post('/simulasyon/durdur', authenticateToken, (req, res) => {
  try {
    iotSimulator.stopSimulation();
    res.json({ message: 'IoT simülasyonu durduruldu' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tek seferlik sensör verisi üret
router.get('/sensor/:forkliftId', authenticateToken, (req, res) => {
  const { forkliftId } = req.params;
  
  try {
    const sensorData = iotSimulator.generateSensorData(forkliftId);
    const analysis = iotSimulator.analyzeCombinedSensors(sensorData);
    
    res.json({
      sensor_data: sensorData,
      analysis: analysis
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 📱 Tablet'ten GPS Verisi Al
 * POST /api/iot/gps
 * Body: { forkliftId, lat, lng, accuracy, timestamp }
 */
router.post('/gps', async (req, res) => {
  try {
    const { forkliftId, lat, lng, accuracy, timestamp } = req.body;

    // Validasyon
    if (!forkliftId) {
      return res.status(400).json({ error: 'forkliftId gereklidir' });
    }
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'lat ve lng gereklidir' });
    }

    // Fusion servisine GPS verisini gönder
    fusionService.updateGPS(forkliftId, {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      accuracy: accuracy ? parseFloat(accuracy) : 999,
      timestamp: timestamp ? (typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime()) : Date.now()
    });

    // Veritabanına kaydet (async, hata olsa bile response dön)
    fusionService.saveToDatabase(forkliftId).catch(err => {
      console.error('GPS veritabanı kayıt hatası:', err);
    });

    // Forklift durumunu döndür
    const state = fusionService.getForkliftState(forkliftId);

    res.json({
      success: true,
      message: 'GPS verisi alındı',
      forkliftId: forkliftId,
      state: state
    });
  } catch (error) {
    console.error('GPS verisi alma hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 🚜 ESP32'den IMU Verisi Al
 * POST /api/iot/imu
 * Body: { forkliftId, moving, acc, timestamp }
 */
router.post('/imu', async (req, res) => {
  try {
    const { forkliftId, moving, acc, timestamp } = req.body;

    // Validasyon
    if (!forkliftId) {
      return res.status(400).json({ error: 'forkliftId gereklidir' });
    }
    if (moving === undefined) {
      return res.status(400).json({ error: 'moving gereklidir (true/false)' });
    }

    // Fusion servisine IMU verisini gönder
    fusionService.updateIMU(forkliftId, {
      moving: Boolean(moving),
      acc: acc ? parseFloat(acc) : null,
      timestamp: timestamp ? (typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime()) : Date.now()
    });

    // Veritabanına kaydet (async, hata olsa bile response dön)
    fusionService.saveToDatabase(forkliftId).catch(err => {
      console.error('IMU veritabanı kayıt hatası:', err);
    });

    // Forklift durumunu döndür
    const state = fusionService.getForkliftState(forkliftId);

    res.json({
      success: true,
      message: 'IMU verisi alındı',
      forkliftId: forkliftId,
      state: state
    });
  } catch (error) {
    console.error('IMU verisi alma hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 🔍 Forklift Durumunu Getir
 * GET /api/iot/forklift/:forkliftId/state
 */
router.get('/forklift/:forkliftId/state', async (req, res) => {
  try {
    const { forkliftId } = req.params;
    const state = fusionService.getForkliftState(forkliftId);

    if (!state) {
      return res.status(404).json({ error: 'Forklift durumu bulunamadı' });
    }

    res.json(state);
  } catch (error) {
    console.error('Forklift durumu getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 📊 Tüm Forklift Durumlarını Getir
 * GET /api/iot/forklifts/states
 */
router.get('/forklifts/states', async (req, res) => {
  try {
    const states = fusionService.getAllForkliftStates();
    res.json(states);
  } catch (error) {
    console.error('Forklift durumları getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

