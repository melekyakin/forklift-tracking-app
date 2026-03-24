import React, { useState, useEffect, useRef } from 'react'
import apiClient from '../utils/axiosConfig'
import { useAuth } from '../context/AuthContext'
import './OtomatikKonumTakip.css'

function OtomatikKonumTakip() {
  const { user, hasRole } = useAuth()
  const [isTracking, setIsTracking] = useState(false)
  const [lastLocation, setLastLocation] = useState(null)
  const [locationHistory, setLocationHistory] = useState([])
  const [trackingStats, setTrackingStats] = useState({
    totalLocations: 0,
    startTime: null,
    lastUpdate: null
  })
  const [interval, setInterval] = useState(30) // saniye
  const [error, setError] = useState(null)
  const [permissionStatus, setPermissionStatus] = useState(null) // 'granted', 'denied', 'prompt'
  const watchIdRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    // Sayfa yüklendiğinde son konumu getir
    fetchLastLocation()
    
    // İzin durumunu kontrol et
    checkPermissionStatus()
    
    // Component unmount olduğunda takibi durdur
    return () => {
      stopTracking()
    }
  }, [])

  // İzin durumunu kontrol et
  const checkPermissionStatus = async () => {
    if (!navigator.permissions) {
      // Permissions API desteklenmiyorsa, geolocation ile test et
      return
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' })
      setPermissionStatus(result.state)
      
      // İzin durumu değiştiğinde güncelle
      result.onchange = () => {
        setPermissionStatus(result.state)
        if (result.state === 'granted' && !isTracking) {
          // İzin verildiyse ve takip başlatılmamışsa, hata mesajını temizle
          setError(null)
        }
      }
    } catch (error) {
      // Permissions API bazı tarayıcılarda çalışmayabilir
      console.log('İzin durumu kontrol edilemedi:', error)
    }
  }

  const fetchLastLocation = async () => {
    try {
      const response = await apiClient.get('/api/konum/son')
      setLastLocation(response.data)
    } catch (error) {
      // Son konum yoksa hata verme
      console.log('Son konum bulunamadı')
    }
  }

  // Geolocation hata mesajlarını Türkçe'ye çevir
  const getGeolocationErrorMessage = (error) => {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Konum izni reddedildi. Lütfen tarayıcı ayarlarından konum iznini etkinleştirin.'
      case error.POSITION_UNAVAILABLE:
        return 'Konum bilgisi alınamadı. GPS veya konum servislerinizin açık olduğundan emin olun.'
      case error.TIMEOUT:
        return 'Konum alma işlemi zaman aşımına uğradı. Lütfen tekrar deneyin.'
      default:
        return `Konum alınamadı: ${error.message || 'Bilinmeyen hata'}`
    }
  }

  // İzin verme talimatlarını al
  const getPermissionInstructions = () => {
    const userAgent = navigator.userAgent.toLowerCase()
    
    if (userAgent.includes('chrome')) {
      return {
        title: 'Chrome\'da Konum İzni Nasıl Verilir?',
        steps: [
          'Adres çubuğunun solundaki kilit 🔒 veya kamera 📷 simgesine tıklayın',
          'Açılan menüde "Konum" seçeneğini bulun',
          '"İzin ver" veya "Her zaman izin ver" seçeneğini seçin',
          'Sayfayı yenileyin (F5)'
        ]
      }
    } else if (userAgent.includes('firefox')) {
      return {
        title: 'Firefox\'ta Konum İzni Nasıl Verilir?',
        steps: [
          'Adres çubuğunun solundaki kilit 🔒 simgesine tıklayın',
          'Açılan menüde "İzinler" bölümünü bulun',
          '"Konum" için "İzin ver" seçeneğini seçin',
          'Sayfayı yenileyin (F5)'
        ]
      }
    } else if (userAgent.includes('safari')) {
      return {
        title: 'Safari\'de Konum İzni Nasıl Verilir?',
        steps: [
          'Safari menüsünden "Ayarlar" > "Web Siteleri" > "Konum Servisleri" seçin',
          'Bu web sitesini bulun ve "İzin ver" seçeneğini seçin',
          'Alternatif olarak, adres çubuğundaki kilit simgesine tıklayın',
          'Sayfayı yenileyin (Cmd+R)'
        ]
      }
    } else if (userAgent.includes('edge')) {
      return {
        title: 'Edge\'de Konum İzni Nasıl Verilir?',
        steps: [
          'Adres çubuğunun solundaki kilit 🔒 simgesine tıklayın',
          'Açılan menüde "Konum" seçeneğini bulun',
          '"İzin ver" seçeneğini seçin',
          'Sayfayı yenileyin (F5)'
        ]
      }
    } else {
      return {
        title: 'Konum İzni Nasıl Verilir?',
        steps: [
          'Tarayıcı ayarlarına gidin',
          'Gizlilik veya İzinler bölümünü bulun',
          'Konum izinlerini etkinleştirin',
          'Bu web sitesi için izin verin',
          'Sayfayı yenileyin'
        ]
      }
    }
  }

  // İzin vermeyi tekrar dene
  const requestPermissionAgain = () => {
    if (!navigator.geolocation) {
      setError('Tarayıcınız konum servisini desteklemiyor')
      return
    }

    // İzin isteğini tetiklemek için getCurrentPosition çağır
    navigator.geolocation.getCurrentPosition(
      () => {
        // İzin verildi
        setError(null)
        setPermissionStatus('granted')
        if (!isTracking) {
          startTracking()
        }
      },
      (error) => {
        // İzin hala reddedildi
        const errorMessage = getGeolocationErrorMessage(error)
        setError(errorMessage)
        setPermissionStatus('denied')
      },
      {
        enableHighAccuracy: true,
        timeout: 30000, // 30 saniye (artırıldı)
        maximumAge: 60000 // 1 dakika (cache'lenmiş konumları kullan)
      }
    )
  }

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Tarayıcınız konum servisini desteklemiyor')
      return
    }

    setError(null)
    setIsTracking(true)
    setTrackingStats(prev => ({
      ...prev,
      startTime: new Date(),
      totalLocations: 0
    }))

    // İlk konumu hemen al
    sendLocation()

    // Periyodik olarak konum gönder
    intervalRef.current = setInterval(() => {
      sendLocation()
    }, interval * 1000)

    // Geolocation watch ile sürekli takip
    const options = {
      enableHighAccuracy: true,
      timeout: 30000, // 30 saniye (artırıldı)
      maximumAge: 60000 // 1 dakika (cache'lenmiş konumları kullan)
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        // Konum güncellendiğinde state'i güncelle (görselleştirme için)
        setLastLocation({
          enlem: position.coords.latitude,
          boylam: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date()
        })
      },
      (error) => {
        console.error('Konum takip hatası:', error)
        const errorMessage = getGeolocationErrorMessage(error)
        setError(errorMessage)
        // İzin reddedildiyse takibi durdur
        if (error.code === error.PERMISSION_DENIED) {
          stopTracking()
        }
      },
      options
    )
  }

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    setIsTracking(false)
  }

  const sendLocation = async (retryCount = 0) => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // GPS hassasiyeti kontrolü - IP tabanlı tahminleri reddet
          const accuracy = position.coords.accuracy || 999
          
          // IP tabanlı tahminleri reddet (hassasiyet > 1000m veya accuracy yok)
          // Gerçek GPS genelde 5-50m hassasiyet verir
          if (accuracy > 1000 || !position.coords.accuracy) {
            console.warn(`⚠️ IP tabanlı konum tahmini algılandı (hassasiyet: ${accuracy.toFixed(2)}m)`)
            console.warn(`   Gerçek GPS konumu için tarayıcı konum izni verin ve GPS'i açın.`)
            setError('IP tabanlı konum algılandı. Gerçek GPS konumu için tarayıcı izni verin.')
            return // IP tabanlı konumları kaydetme
          }
          
          // Hassasiyet çok düşükse uyarı ver
          if (accuracy > 100) {
            console.warn(`⚠️ GPS hassasiyeti düşük: ${accuracy.toFixed(2)}m`)
          }
          
          const locationData = {
            enlem: position.coords.latitude,
            boylam: position.coords.longitude,
            hiz: position.coords.speed ? position.coords.speed * 3.6 : 0, // m/s to km/h
            batarya: null, // Mobil cihazlarda alınabilir
            kaynak: 'otomatik'
          }

          await apiClient.post('/api/konum/kaydet', locationData)

          setTrackingStats(prev => ({
            ...prev,
            totalLocations: prev.totalLocations + 1,
            lastUpdate: new Date()
          }))

          setLastLocation({
            enlem: locationData.enlem,
            boylam: locationData.boylam,
            accuracy: position.coords.accuracy,
            timestamp: new Date()
          })

          setError(null)
        } catch (error) {
          console.error('Konum gönderme hatası:', error)
          let errorMessage = ''
          
          if (error.response) {
            // Backend yanıt verdi ama hata kodu var
            errorMessage = `Konum gönderilemedi: ${error.response.data?.error || `HTTP ${error.response.status}`}`
          } else if (error.request || error.isConnectionError) {
            // İstek gönderildi ama yanıt alınamadı - Backend çalışmıyor olabilir
            errorMessage = 'Backend sunucusuna bağlanılamıyor. Lütfen sunucunun çalıştığından emin olun.'
            if (error.userMessage) {
              errorMessage = error.userMessage
            }
          } else {
            // İstek hazırlanırken hata oluştu
            errorMessage = `Konum gönderilemedi: ${error.message || 'Bilinmeyen hata'}`
          }
          
          setError(errorMessage)
        }
      },
      (error) => {
        console.error('Konum alma hatası:', error)
        
        // Timeout hatası durumunda retry yap (maksimum 2 kez)
        if (error.code === error.TIMEOUT && retryCount < 2) {
          console.log(`🔄 Konum alma retry denemesi ${retryCount + 1}/2`)
          // 2 saniye bekle ve tekrar dene
          setTimeout(() => {
            sendLocation(retryCount + 1)
          }, 2000)
          return
        }
        
        // Diğer hatalar için hata mesajı göster
        const errorMessage = getGeolocationErrorMessage(error)
        setError(errorMessage)
      },
      {
        enableHighAccuracy: true,
        timeout: 30000, // 30 saniye (artırıldı)
        maximumAge: 60000 // 1 dakika (cache'lenmiş konumları kullan)
      }
    )
  }

  const fetchLocationHistory = async () => {
    try {
      const response = await apiClient.get('/api/konum/gecmis?limit=100')
      setLocationHistory(response.data)
    } catch (error) {
      console.error('Konum geçmişi yükleme hatası:', error)
    }
  }

  const formatTime = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('tr-TR')
  }

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371 // Dünya yarıçapı (km)
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  const calculateTotalDistance = () => {
    if (locationHistory.length < 2) return 0
    
    let total = 0
    for (let i = 1; i < locationHistory.length; i++) {
      const prev = locationHistory[i]
      const curr = locationHistory[i - 1]
      total += calculateDistance(
        prev.enlem, prev.boylam,
        curr.enlem, curr.boylam
      )
    }
    return total.toFixed(2)
  }

  return (
    <div className="otomatik-konum-container">
      <div className="tracking-header">
        <div>
          <h2>Otomatik Konum Takibi</h2>
          <p className="description">
            Konumunuz otomatik olarak kaydedilir ve hareketleriniz takip edilir.
          </p>
        </div>
        <div className="tracking-status">
          <span className={`status-indicator ${isTracking ? 'active' : 'inactive'}`}></span>
          <span className="status-text">
            {isTracking ? 'Takip Aktif' : 'Takip Pasif'}
          </span>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <div className="error-header">
            <strong>⚠️ Konum Hatası:</strong>
            <span className="error-text">{error}</span>
          </div>
          {error.includes('izni reddedildi') && (
            <div className="permission-help">
              <div className="help-title">{getPermissionInstructions().title}</div>
              <ol className="help-steps">
                {getPermissionInstructions().steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
              <div className="help-actions">
                <button className="btn-retry-permission" onClick={requestPermissionAgain}>
                  🔄 İzni Tekrar İste
                </button>
                <button 
                  className="btn-dismiss-error" 
                  onClick={() => setError(null)}
                  style={{ marginLeft: '10px', background: '#6c757d' }}
                >
                  Kapat
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {permissionStatus === 'denied' && !error && (
        <div className="warning-message">
          <strong>ℹ️ Bilgi:</strong> Konum izni reddedilmiş. Takibi başlatmak için izin vermeniz gerekiyor.
          <button className="btn-request-permission" onClick={requestPermissionAgain}>
            İzin İste
          </button>
        </div>
      )}

      <div className="tracking-controls">
        <div className="control-group">
          <label>Güncelleme Aralığı (saniye)</label>
          <input
            type="number"
            min="10"
            max="300"
            value={interval}
            onChange={(e) => setInterval(parseInt(e.target.value) || 30)}
            disabled={isTracking}
            className="interval-input"
          />
        </div>

        {!isTracking ? (
          <button className="btn-start" onClick={startTracking}>
            Takibi Başlat
          </button>
        ) : (
          <button className="btn-stop" onClick={stopTracking}>
            Takibi Durdur
          </button>
        )}
      </div>

      {isTracking && (
        <div className="tracking-stats">
          <div className="stat-card">
            <div className="stat-label">Kaydedilen Konum</div>
            <div className="stat-value">{trackingStats.totalLocations}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Başlangıç Zamanı</div>
            <div className="stat-value">{formatTime(trackingStats.startTime)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Son Güncelleme</div>
            <div className="stat-value">{formatTime(trackingStats.lastUpdate)}</div>
          </div>
        </div>
      )}

      {lastLocation && (
        <div className="current-location-card">
          <h3>Son Konum</h3>
          <div className="location-info">
            <div className="info-item">
              <span className="label">Koordinatlar:</span>
              <span className="value">
                {lastLocation.enlem?.toFixed(6)}, {lastLocation.boylam?.toFixed(6)}
              </span>
            </div>
            {lastLocation.accuracy && (
              <div className="info-item">
                <span className="label">Doğruluk:</span>
                <span className="value">±{Math.round(lastLocation.accuracy)} metre</span>
              </div>
            )}
            {lastLocation.timestamp && (
              <div className="info-item">
                <span className="label">Zaman:</span>
                <span className="value">{formatTime(lastLocation.timestamp)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="history-section">
        <div className="section-header">
          <h3>Konum Geçmişi ve Hareket Analizi</h3>
          <button className="btn-refresh" onClick={fetchLocationHistory}>
            Geçmişi Yükle
          </button>
        </div>

        {locationHistory.length > 0 && (
          <div className="analysis-stats">
            <div className="analysis-card">
              <div className="analysis-label">Toplam Kayıt</div>
              <div className="analysis-value">{locationHistory.length}</div>
            </div>
            <div className="analysis-card">
              <div className="analysis-label">Toplam Mesafe</div>
              <div className="analysis-value">{calculateTotalDistance()} km</div>
            </div>
            <div className="analysis-card">
              <div className="analysis-label">İlk Kayıt</div>
              <div className="analysis-value">
                {formatTime(locationHistory[locationHistory.length - 1]?.olusturma_tarihi)}
              </div>
            </div>
            <div className="analysis-card">
              <div className="analysis-label">Son Kayıt</div>
              <div className="analysis-value">
                {formatTime(locationHistory[0]?.olusturma_tarihi)}
              </div>
            </div>
          </div>
        )}

        <div className="history-list">
          {locationHistory.length === 0 ? (
            <div className="no-history">
              <p>Henüz konum geçmişi yok</p>
              <p className="hint">Takibi başlattıktan sonra konumlar burada görünecek</p>
            </div>
          ) : (
            locationHistory.slice(0, 50).map((location, index) => (
              <div key={location.id || index} className="history-item">
                <div className="history-time">
                  {formatTime(location.olusturma_tarihi)}
                </div>
                <div className="history-coords">
                  {location.enlem?.toFixed(6)}, {location.boylam?.toFixed(6)}
                </div>
                <div className="history-details">
                  {location.hiz > 0 && <span>Hız: {location.hiz.toFixed(1)} km/h</span>}
                  {location.adres && <span>Adres: {location.adres}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default OtomatikKonumTakip

