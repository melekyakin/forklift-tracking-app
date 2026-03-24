/**
 * IoT Simülatörü
 * Gerçek IoT sensörlerini simüle eder (CAN Bus, ağırlık sensörü, ultrasonik vb.)
 */

class IoTSimulator {
  constructor() {
    this.sensors = new Map();
    this.isRunning = false;
    this.interval = null;
  }

  /**
   * IoT sensör simülasyonunu başlat
   */
  startSimulation(forkliftId) {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    // Her 5 saniyede bir sensör verisi üret
    this.interval = setInterval(() => {
      this.generateSensorData(forkliftId);
    }, 5000);

    console.log(`IoT simülasyonu başlatıldı: ${forkliftId}`);
  }

  /**
   * Simülasyonu durdur
   */
  stopSimulation() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('IoT simülasyonu durduruldu');
  }

  /**
   * Sensör verisi üret
   */
  generateSensorData(forkliftId) {
    const sensorData = {
      forklift_id: forkliftId,
      timestamp: new Date().toISOString(),
      
      // CAN Bus verileri
      canbus: {
        hiz: this.randomFloat(0, 15), // km/h
        motor_devir: this.randomFloat(800, 2500), // RPM
        yakit_seviyesi: this.randomFloat(20, 100), // %
        aku_doluluk: this.randomFloat(60, 100), // %
        motor_sicaklik: this.randomFloat(70, 95), // °C
        yakit_tuketim: this.randomFloat(2, 8), // L/h
        toplam_calisma_saati: this.randomFloat(100, 5000), // saat
        hidrolik_basinc: this.randomFloat(150, 250), // bar
        catal_yuksekligi: this.randomFloat(0, 6), // metre
        agirlik_sensoru: this.randomFloat(0, 5000), // kg
        motor_yuku: this.randomFloat(20, 90), // %
        hareket_durumu: this.randomChoice(['durdu', 'ilerliyor', 'geri_gidiyor', 'yukari', 'asagi'])
      },

      // Ağırlık sensörü (çatal üzerinde)
      weight_sensor: {
        agirlik_kg: this.randomFloat(0, 5000),
        durum: this.randomFloat(0, 5000) > 100 ? 'dolu' : 'bos',
        guven_skoru: this.randomFloat(0.85, 0.98)
      },

      // Ultrasonik sensör (mesafe ölçümü)
      ultrasonic: {
        mesafe_cm: this.randomFloat(30, 300),
        durum: this.randomFloat(30, 300) < 100 ? 'dolu' : 'bos',
        guven_skoru: this.randomFloat(0.80, 0.95)
      },

      // IMU (Inertial Measurement Unit) - Darbe tespiti
      imu: {
        ivme_x: this.randomFloat(-2, 2), // m/s²
        ivme_y: this.randomFloat(-2, 2),
        ivme_z: this.randomFloat(9.5, 10.5),
        darbe_tespit: this.randomFloat(0, 1) > 0.95, // %5 olasılıkla darbe
        darbe_seviyesi: this.randomFloat(0, 1) > 0.95 ? this.randomFloat(5, 15) : 0 // g-force
      },

      // GPS/RTK (Yüksek hassasiyetli konum)
      gps: {
        enlem: 41.0082 + this.randomFloat(-0.01, 0.01),
        boylam: 28.9784 + this.randomFloat(-0.01, 0.01),
        hassasiyet: this.randomFloat(0.5, 2.0), // metre
        hiz: this.randomFloat(0, 15), // m/s
        yon: this.randomFloat(0, 360) // derece
      },

      // Batarya durumu
      battery: {
        seviye: this.randomFloat(60, 100), // %
        voltaj: this.randomFloat(48, 52), // V
        akim: this.randomFloat(10, 50), // A
        sicaklik: this.randomFloat(20, 35), // °C
        durum: 'normal' // normal, sarj_ediliyor, dusuk
      }
    };

    // Sensör verilerini kaydet
    this.saveSensorData(sensorData);

    return sensorData;
  }

  /**
   * Rastgele float değer üret
   */
  randomFloat(min, max) {
    return Math.random() * (max - min) + min;
  }

  /**
   * Rastgele seçim yap
   */
  randomChoice(choices) {
    return choices[Math.floor(Math.random() * choices.length)];
  }

  /**
   * Sensör verilerini veritabanına kaydet
   */
  async saveSensorData(sensorData) {
    const Database = require('../database');
    const db = Database.getDb();

    // CAN Bus verilerini kaydet
    db.run(`
      INSERT INTO canbus_veri (
        forklift_id, hiz, motor_devir, yakit_seviyesi, aku_doluluk,
        motor_sicaklik, yakit_tuketim, toplam_calisma_saati,
        hidrolik_basinc, catal_yuksekligi, agirlik_sensoru,
        motor_yuku, hareket_durumu
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      sensorData.forklift_id,
      sensorData.canbus.hiz,
      sensorData.canbus.motor_devir,
      sensorData.canbus.yakit_seviyesi,
      sensorData.canbus.aku_doluluk,
      sensorData.canbus.motor_sicaklik,
      sensorData.canbus.yakit_tuketim,
      sensorData.canbus.toplam_calisma_saati,
      sensorData.canbus.hidrolik_basinc,
      sensorData.canbus.catal_yuksekligi,
      sensorData.canbus.agirlik_sensoru,
      sensorData.canbus.motor_yuku,
      sensorData.canbus.hareket_durumu
    ], (err) => {
      if (err) {
        console.error('CAN Bus veri kaydetme hatası:', err);
      }
    });

    // Darbe tespiti varsa kaydet
    if (sensorData.imu.darbe_tespit) {
      db.run(`
        INSERT INTO darbe_kayit (
          forklift_id, darbe_seviyesi, konum_enlem, konum_boylam,
          hiz, ivme_x, ivme_y, ivme_z, uyari_gonderildi
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        sensorData.forklift_id,
        sensorData.imu.darbe_seviyesi,
        sensorData.gps.enlem,
        sensorData.gps.boylam,
        sensorData.gps.hiz * 3.6, // m/s to km/h
        sensorData.imu.ivme_x,
        sensorData.imu.ivme_y,
        sensorData.imu.ivme_z,
        0
      ], (err) => {
        if (err) {
          console.error('Darbe kayıt hatası:', err);
        }
      });
    }
  }

  /**
   * Kombine sensör analizi - Tüm sensörlerden gelen verileri birleştir
   */
  analyzeCombinedSensors(sensorData) {
    const results = [];
    let fullScore = 0;
    let emptyScore = 0;

    // Ağırlık sensörü (en güvenilir - ağırlık: 0.5)
    if (sensorData.weight_sensor) {
      const weightResult = sensorData.weight_sensor.agirlik_kg > 100 ? 'dolu' : 'bos';
      const confidence = sensorData.weight_sensor.guven_skoru;
      
      if (weightResult === 'dolu') {
        fullScore += confidence * 0.5;
      } else {
        emptyScore += confidence * 0.5;
      }
      
      results.push({
        yontem: 'agirlik_sensoru',
        durum: weightResult,
        guven: confidence,
        agirlik: 0.5
      });
    }

    // Ultrasonik sensör (ağırlık: 0.3)
    if (sensorData.ultrasonic) {
      const ultrasonicResult = sensorData.ultrasonic.mesafe_cm < 100 ? 'dolu' : 'bos';
      const confidence = sensorData.ultrasonic.guven_skoru;
      
      if (ultrasonicResult === 'dolu') {
        fullScore += confidence * 0.3;
      } else {
        emptyScore += confidence * 0.3;
      }
      
      results.push({
        yontem: 'ultrasonik',
        durum: ultrasonicResult,
        guven: confidence,
        agirlik: 0.3
      });
    }

    // CAN Bus ağırlık sensörü (ağırlık: 0.2)
    if (sensorData.canbus && sensorData.canbus.agirlik_sensoru) {
      const canbusResult = sensorData.canbus.agirlik_sensoru > 100 ? 'dolu' : 'bos';
      const confidence = 0.85; // CAN Bus genellikle güvenilir
      
      if (canbusResult === 'dolu') {
        fullScore += confidence * 0.2;
      } else {
        emptyScore += confidence * 0.2;
      }
      
      results.push({
        yontem: 'canbus_agirlik',
        durum: canbusResult,
        guven: confidence,
        agirlik: 0.2
      });
    }

    // Final karar
    const finalConfidence = Math.max(fullScore, emptyScore);
    const finalStatus = fullScore > emptyScore ? 'dolu' : 'bos';

    return {
      durum: finalStatus,
      guven_skoru: finalConfidence,
      yontem: 'kombine_sensor_analizi',
      sensor_sonuclari: results,
      detay: {
        fullScore,
        emptyScore,
        kullanilan_sensor_sayisi: results.length
      }
    };
  }
}

module.exports = new IoTSimulator();

