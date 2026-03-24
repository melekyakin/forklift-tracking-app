const { ForkliftciKonum, Kullanici } = require('../models-pg');
const { Op } = require('sequelize');
const { sequelize } = require('../models-pg');

/**
 * Genel Konum Takip Servisi
 * Manuel, otomatik veya API üzerinden konum kaydı yapılabilir
 * GPS tabanlı hareket algılama özelliği içerir
 */
class LocationService {
  /**
   * İki GPS koordinatı arasındaki mesafeyi hesapla (Haversine formülü)
   * @param {number} lat1 - İlk noktanın enlemi
   * @param {number} lon1 - İlk noktanın boylamı
   * @param {number} lat2 - İkinci noktanın enlemi
   * @param {number} lon2 - İkinci noktanın boylamı
   * @returns {number} Mesafe (metre cinsinden)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Dünya yarıçapı (metre)
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  /**
   * Dereceyi radyana çevir
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * GPS konum değişikliğine göre hareket durumunu belirle
   * @param {number} mesafe - İki konum arasındaki mesafe (metre)
   * @param {number} hiz - Hız (km/h)
   * @param {number} hareketEsigi - Hareket eşiği (metre, varsayılan: 5)
   * @returns {string} 'hareket_halinde' veya 'duruyor'
   */
  determineMovementStatus(mesafe, hiz = 0, hareketEsigi = 5) {
    // Hız bilgisi varsa ve 0.5 km/h'den fazlaysa kesinlikle hareket var
    if (hiz && hiz > 0.5) {
      return 'hareket_halinde';
    }
    
    // Konum değişikliği varsa (GPS gürültüsü için küçük eşik: 5 metre) hareket halinde
    // Kullanıcı isteği: "konumu değişiyorsa hareket halinde olmalı"
    return mesafe > hareketEsigi ? 'hareket_halinde' : 'duruyor';
  }

  /**
   * Forkliftçinin konumunu kaydet (manuel veya API'den)
   * GPS tabanlı hareket algılama yapar
   */
  async saveLocation(forkliftciId, locationData) {
    const {
      enlem,
      boylam,
      hiz = 0,
      yon = 0,
      adres = '',
      batarya = null,
      wifi = null,
      kaynak = 'manuel' // 'manuel', 'api', 'otomatik', 'qr', 'nfc', 'gps'
    } = locationData;

    if (!enlem || !boylam) {
      throw new Error('Enlem ve boylam gereklidir');
    }

    // Önceki konumu al (hareket algılama için)
    const lastLocation = await ForkliftciKonum.findOne({
      where: { forkliftci_id: forkliftciId },
      order: [['olusturma_tarihi', 'DESC']]
    });

    let hareketDurumu = 'bilinmiyor';
    let mesafeMetre = null;

    // Eğer önceki konum varsa, mesafe hesapla ve hareket durumunu belirle
    if (lastLocation && lastLocation.enlem && lastLocation.boylam) {
      const plain = lastLocation.get({ plain: true });
      mesafeMetre = this.calculateDistance(
        plain.enlem,
        plain.boylam,
        parseFloat(enlem),
        parseFloat(boylam)
      );

      // Hareket durumunu belirle (hız bilgisi ve 5 metre eşiği ile)
      // Hız bilgisi varsa öncelik ver, yoksa mesafe eşiğini kullan
      // Konum değişikliği varsa hareket halinde olmalı
      const hizKmh = hiz ? parseFloat(hiz) : 0;
      hareketDurumu = this.determineMovementStatus(mesafeMetre, hizKmh, 5);
    } else {
      // İlk konum kaydı - hız bilgisi varsa ona göre belirle
      if (hiz && parseFloat(hiz) > 1) {
        hareketDurumu = 'hareket_halinde';
      } else {
        hareketDurumu = 'bilinmiyor';
      }
    }

    // Yeni konum kaydı oluştur
    const newLocation = await ForkliftciKonum.create({
      forkliftci_id: forkliftciId,
      enlem: parseFloat(enlem),
      boylam: parseFloat(boylam),
      hiz: hiz ? parseFloat(hiz) : 0,
      yon: yon ? parseFloat(yon) : 0,
      adres: adres || '',
      batarya: batarya ? parseInt(batarya) : null,
      wifi: wifi || null,
      hareket_durumu: hareketDurumu,
      mesafe_metre: mesafeMetre
    });

    const locationObj = newLocation.get({ plain: true });

    // WebSocket ile güncelleme gönder
    if (global.broadcast) {
      global.broadcast({
        type: 'forkliftci_konum_guncellendi',
        data: {
          ...locationObj,
          id: locationObj.id.toString(),
          forkliftci_id: locationObj.forkliftci_id.toString(),
          hareket_durumu: hareketDurumu,
          mesafe_metre: mesafeMetre
        }
      });

      // Hareket durumu değişikliği varsa ayrı bir bildirim gönder
      if (lastLocation) {
        const plainLast = lastLocation.get({ plain: true });
        if (plainLast.hareket_durumu !== hareketDurumu) {
          global.broadcast({
            type: 'forkliftci_hareket_durumu_degisti',
            data: {
              forkliftci_id: forkliftciId.toString(),
              onceki_durum: plainLast.hareket_durumu,
              yeni_durum: hareketDurumu,
              mesafe_metre: mesafeMetre,
              konum: {
                enlem: parseFloat(enlem),
                boylam: parseFloat(boylam)
              }
            }
          });
        }
      }
    }

    return locationObj;
  }

  /**
   * GPS koordinatlarından adres bilgisi al (reverse geocoding)
   * Nominatim API rate limiting: 1 istek/saniye
   */
  async getAddressFromCoordinates(latitude, longitude, retryCount = 0) {
    try {
      // OpenStreetMap Nominatim API kullan (ücretsiz)
      const axios = require('axios');
      
      // Türkiye için optimize edilmiş Nominatim API parametreleri
      // accept-language: tr - Türkçe adres döndürmesi için
      // addressdetails: 1 - Detaylı adres bilgisi için
      // zoom: 18 - Daha detaylı adres için
      // countrycodes: tr - Sadece Türkiye için arama yap (daha hızlı ve doğru)
      // extratags: 1 - Ek etiketler için (daha detaylı bilgi)
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=18&accept-language=tr&countrycodes=tr&extratags=1`;
      
      // Rate limiting için bekleme (ilk istek hariç)
      if (retryCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle
      }
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Forklift-Tracking-System/1.0',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        timeout: 10000 // 10 saniye timeout
      });
      
      if (!response.data) {
        console.warn('Nominatim API boş yanıt döndü');
        return '';
      }
      
      // Adres formatını oluştur
      let address = '';
      
      if (response.data.address) {
        const addr = response.data.address;
        
        // Türkçe adres formatı: Mahalle, İlçe, İl, Ülke
        const parts = [];
        
        // Sokak/Cadde (varsa)
        if (addr.road || addr.street) {
          parts.push(addr.road || addr.street);
        }
        
        // Mahalle
        if (addr.suburb || addr.neighbourhood || addr.village || addr.quarter) {
          parts.push(addr.suburb || addr.neighbourhood || addr.village || addr.quarter);
        }
        
        // İlçe (öncelik sırasına göre)
        if (addr.city_district || addr.district || addr.town || addr.municipality) {
          const ilce = addr.city_district || addr.district || addr.town || addr.municipality;
          if (!parts.includes(ilce)) {
            parts.push(ilce);
          }
        }
        
        // İl
        if (addr.state || addr.region || addr.province) {
          const il = addr.state || addr.region || addr.province;
          if (!parts.includes(il)) {
            parts.push(il);
          }
        }
        
        // Bölge (opsiyonel, eğer ilçe değilse)
        if (addr.county && !parts.includes(addr.county)) {
          parts.push(addr.county);
        }
        
        // Ülke
        if (addr.country) {
          parts.push(addr.country);
        }
        
        address = parts.join(', ');
      }
      
      // Eğer formatlanmış adres yoksa, display_name kullan
      if (!address && response.data.display_name) {
        address = response.data.display_name;
      }
      
      // Eğer hala adres yoksa, koordinatları döndür
      if (!address) {
        address = `${latitude}, ${longitude}`;
      }
      
      console.log(`📍 Adres alındı: ${address} (${latitude}, ${longitude})`);
      return address;
    } catch (error) {
      console.error('Adres alma hatası:', error.message);
      
      // Rate limiting hatası (429) veya timeout durumunda retry yap
      if ((error.response && error.response.status === 429) || 
          error.code === 'ECONNABORTED' || 
          error.code === 'ETIMEDOUT') {
        
        if (retryCount < 2) { // Maksimum 2 retry
          console.log(`🔄 Adres alma retry denemesi ${retryCount + 1}/2`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 saniye bekle
          return this.getAddressFromCoordinates(latitude, longitude, retryCount + 1);
        }
      }
      
      // Timeout veya network hatası durumunda koordinatları döndür
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || !error.response) {
        console.warn('Nominatim API\'ye ulaşılamadı, koordinatlar döndürülüyor');
        return `${latitude}, ${longitude}`;
      }
      
      // API hatası durumunda koordinatları döndür (boş string yerine)
      console.warn('Adres alınamadı, koordinatlar döndürülüyor');
      return `${latitude}, ${longitude}`;
    }
  }

  /**
   * Forkliftçinin son konumunu getir
   */
  async getLastLocation(forkliftciId) {
    const location = await ForkliftciKonum.findOne({
      where: { forkliftci_id: forkliftciId },
      include: [{
        model: Kullanici,
        as: 'forkliftci',
        attributes: ['id', 'ad_soyad', 'kullanici_adi'],
        required: false
      }],
      order: [['olusturma_tarihi', 'DESC']]
    });

    if (!location) {
      return null;
    }

    const plain = location.get({ plain: true });
    return {
      ...plain,
      id: plain.id.toString(),
      forkliftci_id: plain.forkliftci_id.toString(),
      ad_soyad: plain.forkliftci?.ad_soyad || null,
      kullanici_adi: plain.forkliftci?.kullanici_adi || null
    };
  }

  /**
   * Tüm forkliftçilerin son konumlarını getir
   */
  async getAllLastLocations() {
    // Her forkliftçi için en son konumu al
    const forkliftciler = await Kullanici.findAll({
      where: {
        rol: 'forkliftoperator',
        durum: 'aktif'
      },
      attributes: ['id', 'ad_soyad', 'kullanici_adi']
    });

    const locations = await Promise.all(
      forkliftciler.map(async (kullanici) => {
        const plainKullanici = kullanici.get({ plain: true });
        const lastLocation = await ForkliftciKonum.findOne({
          where: { forkliftci_id: plainKullanici.id },
          order: [['olusturma_tarihi', 'DESC']]
        });

        if (!lastLocation) {
          return null;
        }

        const plainLocation = lastLocation.get({ plain: true });
        return {
          forkliftci_id: plainKullanici.id.toString(),
          ad_soyad: plainKullanici.ad_soyad,
          kullanici_adi: plainKullanici.kullanici_adi,
          enlem: plainLocation.enlem,
          boylam: plainLocation.boylam,
          hiz: plainLocation.hiz,
          yon: plainLocation.yon,
          adres: plainLocation.adres,
          batarya: plainLocation.batarya,
          hareket_durumu: plainLocation.hareket_durumu,
          mesafe_metre: plainLocation.mesafe_metre,
          olusturma_tarihi: plainLocation.olusturma_tarihi
        };
      })
    );

    return locations.filter(loc => loc !== null).sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad));
  }

  /**
   * Forkliftçinin konum geçmişini getir
   */
  async getLocationHistory(forkliftciId, options = {}) {
    const { baslangic_tarihi, bitis_tarihi, limit = 1000 } = options;

    const where = {
      forkliftci_id: forkliftciId
    };

    if (baslangic_tarihi || bitis_tarihi) {
      where.olusturma_tarihi = {};
      if (baslangic_tarihi) {
        where.olusturma_tarihi[Op.gte] = new Date(baslangic_tarihi);
      }
      if (bitis_tarihi) {
        const bitis = new Date(bitis_tarihi);
        bitis.setHours(23, 59, 59, 999);
        where.olusturma_tarihi[Op.lte] = bitis;
      }
    }

    const history = await ForkliftciKonum.findAll({
      where,
      order: [['olusturma_tarihi', 'DESC']],
      limit: parseInt(limit)
    });

    return history.map(loc => {
      const plain = loc.get({ plain: true });
      return {
        ...plain,
        id: plain.id.toString(),
        forkliftci_id: plain.forkliftci_id.toString()
      };
    });
  }

  /**
   * Forkliftçinin hareket durumunu getir
   */
  async getMovementStatus(forkliftciId) {
    const lastLocation = await this.getLastLocation(forkliftciId);
    
    if (!lastLocation) {
      return {
        durum: 'bilinmiyor',
        mesafe_metre: null,
        son_guncelleme: null
      };
    }

    return {
      durum: lastLocation.hareket_durumu || 'bilinmiyor',
      mesafe_metre: lastLocation.mesafe_metre || null,
      son_guncelleme: lastLocation.olusturma_tarihi,
      konum: {
        enlem: lastLocation.enlem,
        boylam: lastLocation.boylam
      }
    };
  }
}

module.exports = new LocationService();

