const { ForkliftciKonum } = require('../models-pg');

/**
 * GPS + IMU Veri Birleştirme Servisi (Fusion Algorithm)
 * 
 * Sliding Window Yaklaşımı:
 * - IMU verisi: son 2 saniye
 * - GPS verisi: son 5 saniye
 * 
 * Karar Algoritması:
 * - IMU hareket algıladıysa → forklift hareket ediyor
 * - GPS konumu sadece IMU hareketliyken güncellenir
 * - GPS doğruluğu kötü ise (accuracy > 10m) konum sabitlenir
 * - IMU yok ama GPS değiştiyse → düşük güvenli hareket
 */
class FusionService {
  constructor() {
    // Her forklift için veri buffer'ı
    // forklifts[forkliftId] = { imu: {...}, gps: {...}, state: 'MOVING'|'IDLE', location: {...} }
    this.forklifts = {};
    
    // Zaman pencereleri (milisaniye)
    this.IMU_WINDOW = 2000; // 2 saniye
    this.GPS_WINDOW = 5000; // 5 saniye
    
    // GPS doğruluk eşiği (metre)
    this.GPS_ACCURACY_THRESHOLD = 10;
    
    // Periyodik fusion kontrolü (her 1 saniyede bir)
    this.fusionInterval = setInterval(() => {
      this.processAllForklifts();
      this.cleanup(); // Eski verileri temizle
    }, 1000);
  }

  /**
   * IMU verisi güncelle
   * @param {string} forkliftId - Forklift ID (örn: "FL-01")
   * @param {object} imuData - IMU verisi
   * @param {boolean} imuData.moving - Hareket var mı?
   * @param {number} imuData.acc - İvme değeri (opsiyonel)
   * @param {number} imuData.timestamp - Zaman damgası (Unix timestamp veya Date.now())
   */
  updateIMU(forkliftId, imuData) {
    if (!this.forklifts[forkliftId]) {
      this.forklifts[forkliftId] = {
        imu: null,
        gps: null,
        state: 'IDLE',
        location: null,
        lastKnownLocation: null
      };
    }

    const timestamp = imuData.timestamp || Date.now();
    
    this.forklifts[forkliftId].imu = {
      moving: imuData.moving,
      acc: imuData.acc || null,
      timestamp: timestamp
    };

    // Son güncelleme zamanını kaydet
    this.forklifts[forkliftId].lastUpdate = Date.now();

    // Fusion algoritmasını çalıştır
    this.fusion(forkliftId);
  }

  /**
   * GPS verisi güncelle
   * @param {string} forkliftId - Forklift ID
   * @param {object} gpsData - GPS verisi
   * @param {number} gpsData.lat - Enlem
   * @param {number} gpsData.lng - Boylam
   * @param {number} gpsData.accuracy - GPS doğruluğu (metre)
   * @param {number} gpsData.timestamp - Zaman damgası
   */
  updateGPS(forkliftId, gpsData) {
    if (!this.forklifts[forkliftId]) {
      this.forklifts[forkliftId] = {
        imu: null,
        gps: null,
        state: 'IDLE',
        location: null,
        lastKnownLocation: null
      };
    }

    const timestamp = gpsData.timestamp || Date.now();
    
    this.forklifts[forkliftId].gps = {
      lat: parseFloat(gpsData.lat),
      lng: parseFloat(gpsData.lng),
      accuracy: parseFloat(gpsData.accuracy) || 999,
      timestamp: timestamp
    };

    // Son güncelleme zamanını kaydet
    this.forklifts[forkliftId].lastUpdate = Date.now();

    // Fusion algoritmasını çalıştır
    this.fusion(forkliftId);
  }

  /**
   * Veri birleştirme (Fusion) algoritması
   * @param {string} forkliftId - Forklift ID
   */
  fusion(forkliftId) {
    const f = this.forklifts[forkliftId];
    if (!f || !f.imu) {
      return; // IMU verisi yoksa işlem yapma
    }

    const now = Date.now();
    
    // IMU verisi zaman penceresi içinde mi?
    const imuAge = now - f.imu.timestamp;
    const imuRecent = imuAge < this.IMU_WINDOW;

    // GPS verisi zaman penceresi içinde mi?
    let gpsRecent = false;
    let gpsValid = false;
    if (f.gps) {
      const gpsAge = now - f.gps.timestamp;
      gpsRecent = gpsAge < this.GPS_WINDOW;
      gpsValid = f.gps.accuracy < this.GPS_ACCURACY_THRESHOLD;
    }

    // Karar algoritması
    if (imuRecent && f.imu.moving) {
      // IMU hareket algıladı → forklift hareket ediyor
      f.state = 'MOVING';
      
      if (gpsRecent && gpsValid) {
        // GPS doğru ve güncel → konumu güncelle
        f.location = {
          lat: f.gps.lat,
          lng: f.gps.lng,
          accuracy: f.gps.accuracy,
          source: 'gps'
        };
        f.lastKnownLocation = f.location;
      } else if (f.lastKnownLocation) {
        // GPS kötü veya yok → son bilinen konumu kullan
        f.location = {
          ...f.lastKnownLocation,
          source: 'last_known'
        };
      } else if (gpsRecent && !gpsValid) {
        // GPS var ama doğruluğu kötü → yine de kaydet ama düşük güvenli
        f.location = {
          lat: f.gps.lat,
          lng: f.gps.lng,
          accuracy: f.gps.accuracy,
          source: 'gps_low_confidence'
        };
        f.lastKnownLocation = f.location;
      }
    } else {
      // IMU hareket yok veya eski → forklift duruyor
      f.state = 'IDLE';
      
      // Konumu son bilinen konum olarak sabitle
      if (f.lastKnownLocation) {
        f.location = {
          ...f.lastKnownLocation,
          source: 'last_known'
        };
      } else if (gpsRecent) {
        // Son bilinen konum yok ama GPS var → GPS'i kaydet
        f.location = {
          lat: f.gps.lat,
          lng: f.gps.lng,
          accuracy: f.gps.accuracy,
          source: 'gps_idle'
        };
        f.lastKnownLocation = f.location;
      }
    }

    // Hareket türünü belirle
    f.movementType = this.determineMovementType(f);

    return f;
  }

  /**
   * Hareket türünü belirle
   * @param {object} f - Forklift verisi
   * @returns {string} Hareket türü
   */
  determineMovementType(f) {
    const hasIMU = f.imu && (Date.now() - f.imu.timestamp) < this.IMU_WINDOW;
    const hasGPS = f.gps && (Date.now() - f.gps.timestamp) < this.GPS_WINDOW;
    const imuMoving = hasIMU && f.imu.moving;

    if (imuMoving && hasGPS) {
      return 'normal_surme'; // Normal sürüş
    } else if (imuMoving && !hasGPS) {
      return 'titresim'; // Yerinde çalışıyor (depo içi)
    } else if (!imuMoving && hasGPS) {
      return 'operator_yuruyusu'; // Forklift sabit, operatör yürüyor
    } else {
      return 'bilinmiyor';
    }
  }

  /**
   * Tüm forkliftler için fusion işlemini çalıştır
   */
  processAllForklifts() {
    Object.keys(this.forklifts).forEach(forkliftId => {
      this.fusion(forkliftId);
    });
  }

  /**
   * Forklift durumunu getir
   * @param {string} forkliftId - Forklift ID
   * @returns {object} Forklift durumu
   */
  getForkliftState(forkliftId) {
    const f = this.forklifts[forkliftId];
    if (!f) {
      return null;
    }

    return {
      forkliftId: forkliftId,
      state: f.state,
      location: f.location,
      movementType: f.movementType,
      imu: f.imu ? {
        moving: f.imu.moving,
        acc: f.imu.acc,
        age: Date.now() - f.imu.timestamp
      } : null,
      gps: f.gps ? {
        lat: f.gps.lat,
        lng: f.gps.lng,
        accuracy: f.gps.accuracy,
        age: Date.now() - f.gps.timestamp
      } : null
    };
  }

  /**
   * Forklift durumunu veritabanına kaydet
   * @param {string} forkliftId - Forklift ID (forkliftci_id olarak kullanılacak)
   * @returns {Promise<object>} Kaydedilen konum
   */
  async saveToDatabase(forkliftId) {
    const f = this.forklifts[forkliftId];
    if (!f || !f.location) {
      return null;
    }

    // ForkliftId'yi forkliftci_id'ye çevir
    // Eğer forkliftId "FL-01" gibi bir format ise, sadece sayısal kısmı al
    // Veya direkt forkliftci_id olarak kullanılabilir
    let forkliftciId = forkliftId;
    if (typeof forkliftId === 'string') {
      // "FL-01" -> 1 veya "1" -> 1
      const numericId = parseInt(forkliftId.replace(/[^0-9]/g, ''));
      if (!isNaN(numericId) && numericId > 0) {
        forkliftciId = numericId;
      } else {
        // Sayısal ID yoksa, string olarak kullan (hata verebilir ama deneyelim)
        console.warn(`ForkliftId sayısal değil: ${forkliftId}, direkt kullanılıyor`);
      }
    }

    // Hareket durumunu belirle
    let hareketDurumu = 'bilinmiyor';
    if (f.state === 'MOVING') {
      hareketDurumu = 'hareket_halinde';
    } else if (f.state === 'IDLE') {
      hareketDurumu = 'duruyor';
    }

    // Konum kaydı oluştur
    const location = await ForkliftciKonum.create({
      forkliftci_id: forkliftciId,
      enlem: f.location.lat,
      boylam: f.location.lng,
      hareket_durumu: hareketDurumu,
      olusturma_tarihi: new Date()
    });

    // WebSocket bildirimi gönder
    if (global.broadcast) {
      const plain = location.get({ plain: true });
      global.broadcast({
        type: 'forklift_fusion_guncellendi',
        data: {
          forkliftId: forkliftId,
          forkliftci_id: forkliftciId,
          state: f.state,
          movementType: f.movementType,
          location: {
            lat: f.location.lat,
            lng: f.location.lng,
            accuracy: f.location.accuracy,
            source: f.location.source
          },
          hareket_durumu: hareketDurumu,
          timestamp: plain.olusturma_tarihi
        }
      });
    }

    return location.get({ plain: true });
  }

  /**
   * Tüm forkliftlerin durumunu getir
   * @returns {Array} Forklift durumları
   */
  getAllForkliftStates() {
    return Object.keys(this.forklifts).map(forkliftId => 
      this.getForkliftState(forkliftId)
    ).filter(state => state !== null);
  }

  /**
   * Eski verileri temizle (memory leak önleme)
   */
  cleanup() {
    const now = Date.now();
    Object.keys(this.forklifts).forEach(forkliftId => {
      const f = this.forklifts[forkliftId];
      
      // IMU verisi çok eskiyse temizle
      if (f.imu && (now - f.imu.timestamp) > this.IMU_WINDOW * 2) {
        f.imu = null;
      }
      
      // GPS verisi çok eskiyse temizle
      if (f.gps && (now - f.gps.timestamp) > this.GPS_WINDOW * 2) {
        f.gps = null;
      }
      
      // Hem IMU hem GPS yoksa forklift verisini sil
      if (!f.imu && !f.gps && (now - (f.lastUpdate || 0)) > 60000) {
        delete this.forklifts[forkliftId];
      }
    });
  }
}

module.exports = new FusionService();

