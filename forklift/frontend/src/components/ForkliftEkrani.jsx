import React, { useState, useEffect, useRef } from 'react'
import apiClient from '../utils/axiosConfig'
import { useAuth } from '../context/AuthContext'
import { WS_URL } from '../config'
import WorkstationSecim from './WorkstationSecim'
import WorkstationIstatistikleri from './WorkstationIstatistikleri'
import ForkliftciIsGecmisi from './ForkliftciIsGecmisi'
import './ForkliftEkrani.css'

function ForkliftEkrani() {
  const { user } = useAuth()
  const [aktifTab, setAktifTab] = useState('bildirimler') // 'bildirimler', 'kapatilmayi-bekleyen' veya 'is-gecmisi'
  const [bildirimler, setBildirimler] = useState([])
  const [allBildirimler, setAllBildirimler] = useState([])
  const [kapatilmayiBekleyenIsler, setKapatilmayiBekleyenIsler] = useState([])
  const [selectedWorkstations, setSelectedWorkstations] = useState([])
  const [loading, setLoading] = useState(true)
  const [kapatilmayiBekleyenLoading, setKapatilmayiBekleyenLoading] = useState(false)
  const [hareketDurumu, setHareketDurumu] = useState({
    durum: 'bilinmiyor',
    mesafe_metre: null,
    son_guncelleme: null
  })
  const [konumUyari, setKonumUyari] = useState(null) // IP tabanlı konum uyarısı için
  const [izinDurumu, setIzinDurumu] = useState(null) // 'granted', 'denied', 'prompt'
  const watchIdRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (user) {
      setupWebSocket()
      fetchHareketDurumu()
      // İzin durumunu kontrol et
      checkIzinDurumu()
      // Otomatik konum takibini başlat
      startAutomaticLocationTracking()
      // Hareket durumunu her 30 saniyede bir güncelle
      const interval = setInterval(() => {
        fetchHareketDurumu()
      }, 30000)
      return () => {
        clearInterval(interval)
        stopAutomaticLocationTracking()
      }
    }
  }, [user])

  // İzin durumunu kontrol et
  const checkIzinDurumu = async () => {
    if (!navigator.permissions) {
      // Permissions API desteklenmiyorsa, geolocation ile test et
      return
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' })
      setIzinDurumu(result.state)
      
      // İzin durumu değiştiğinde güncelle
      result.onchange = () => {
        setIzinDurumu(result.state)
      }
    } catch (error) {
      // Permissions API bazı tarayıcılarda çalışmayabilir
      console.log('İzin durumu kontrol edilemedi:', error)
    }
  }

  // İzin vermeyi tekrar dene
  const izinIste = () => {
    if (!navigator.geolocation) {
      alert('Tarayıcınız konum servisini desteklemiyor')
      return
    }

    // İzin isteğini tetiklemek için getCurrentPosition çağır
    navigator.geolocation.getCurrentPosition(
      () => {
        // İzin verildi
        setIzinDurumu('granted')
        setKonumUyari(null)
        // Konum takibini yeniden başlat
        stopAutomaticLocationTracking()
        startAutomaticLocationTracking()
      },
      (error) => {
        // İzin hala reddedildi
        if (error.code === error.PERMISSION_DENIED) {
          setIzinDurumu('denied')
          alert('Konum izni reddedildi. Lütfen tarayıcı ayarlarından konum iznini verin.')
        } else {
          console.error('Konum alma hatası:', error)
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
      }
    )
  }

  useEffect(() => {
    // Seçili workstation'lar değiştiğinde bildirimleri yeniden yükle
    if (user) {
      fetchBildirimler()
      if (aktifTab === 'kapatilmayi-bekleyen') {
        fetchKapatilmayiBekleyenIsler()
      }
    }
  }, [selectedWorkstations, user, aktifTab])

  const fetchBildirimler = async () => {
    try {
      console.log('📥 Bildirimler çekiliyor...')
      console.log('👤 Mevcut kullanıcı:', user)
      console.log('📍 Seçili workstation\'lar:', selectedWorkstations)
      
      // Seçili workstation'ları query parametresi olarak gönder
      const params = new URLSearchParams()
      if (selectedWorkstations.length > 0) {
        selectedWorkstations.forEach(wsId => {
          params.append('workstationIds', wsId)
        })
      }
      
      const url = selectedWorkstations.length > 0
        ? `/api/forklift/bildirimler/bekleyen?${params.toString()}`
        : `/api/forklift/bildirimler/bekleyen`
      
      console.log('🌐 İstek URL:', url)
      const response = await apiClient.get(url)
      console.log('📬 Backend\'den gelen bildirimler:', response.data)
      console.log('📊 Bildirim sayısı:', response.data.length)
      
      // Duplicate kontrolü - ID, mesaj ve workstation bazlı
      const seenIds = new Set()
      const seenContent = new Map() // Mesaj + workstation kombinasyonu için
      const fiveMinutesAgo = new Date(Date.now() - 300000)
      
      const uniqueBildirimler = response.data.filter((bildirim) => {
        // ID bazlı duplicate kontrolü
        const bildirimId = String(bildirim.id)
        if (seenIds.has(bildirimId)) {
          console.log(`⚠️ Duplicate bildirim ID: ${bildirimId}, atlanıyor`)
          return false
        }
        seenIds.add(bildirimId)
        
        // Mesaj ve workstation bazlı duplicate kontrolü (son 5 dakika içinde)
        const bildirimMesaj = bildirim.mesaj || ''
        const bildirimWorkstationId = bildirim.workstation_id ? String(bildirim.workstation_id) : null
        const bildirimTarihi = bildirim.olusturma_tarihi ? new Date(bildirim.olusturma_tarihi) : null
        
        if (bildirimMesaj && bildirimWorkstationId && bildirimTarihi && bildirimTarihi >= fiveMinutesAgo) {
          const contentKey = `${bildirimMesaj}_${bildirimWorkstationId}`
          const existingBildirim = seenContent.get(contentKey)
          
          if (existingBildirim) {
            // Aynı içerikli bildirim var, daha yeni olanı tut
            const existingTarih = existingBildirim.olusturma_tarihi ? new Date(existingBildirim.olusturma_tarihi) : null
            if (existingTarih && bildirimTarihi > existingTarih) {
              // Yeni bildirim daha yeni, eskiyi kaldır ve yenisini ekle
              seenContent.set(contentKey, bildirim)
              return true
            } else {
              // Eski bildirim daha yeni veya eşit, yenisini atla
              console.log(`⚠️ Duplicate içerikli bildirim: ${bildirimId}, atlanıyor (mevcut: ${existingBildirim.id})`)
              return false
            }
          } else {
            seenContent.set(contentKey, bildirim)
          }
        }
        
        return true
      })
      
      console.log('✅ Duplicate kontrolü sonrası bildirim sayısı:', uniqueBildirimler.length)
      
      // Her bildirimi kontrol et
      uniqueBildirimler.forEach(bildirim => {
        console.log(`Bildirim ${bildirim.id}:`, {
          durum: bildirim.durum,
          tamamlanma_tarihi: bildirim.tamamlanma_tarihi,
          onay_tarihi: bildirim.onay_tarihi,
          sure_saniye: bildirim.sure_saniye
        })
      })
      setAllBildirimler(uniqueBildirimler)
      setBildirimler(uniqueBildirimler) // Backend'den zaten filtrelenmiş geliyor
      setLoading(false)
    } catch (error) {
      console.error('Bildirim yükleme hatası:', error)
      setLoading(false)
    }
  }

  const handleWorkstationChange = (workstationIds) => {
    setSelectedWorkstations(workstationIds)
  }

  const fetchKapatilmayiBekleyenIsler = async () => {
    try {
      setKapatilmayiBekleyenLoading(true)
      const response = await apiClient.get('/api/forklift/bildirimler/kapatilmayi-bekleyen')
      console.log('📋 Kapatılmayı bekleyen işler:', response.data)
      setKapatilmayiBekleyenIsler(response.data)
      setKapatilmayiBekleyenLoading(false)
    } catch (error) {
      console.error('Kapatılmayı bekleyen işler yükleme hatası:', error)
      setKapatilmayiBekleyenLoading(false)
    }
  }

  const fetchHareketDurumu = async () => {
    try {
      const response = await apiClient.get('/api/konum/hareket-durumu')
      setHareketDurumu(response.data)
    } catch (error) {
      console.error('Hareket durumu yükleme hatası:', error)
    }
  }

  // Otomatik konum takibini başlat (sayfa yüklendiğinde)
  const startAutomaticLocationTracking = () => {
    if (!navigator.geolocation) {
      console.warn('Tarayıcınız konum servisini desteklemiyor')
      return
    }

    // İlk konumu hemen al
    sendLocationToServer()

    // Her 30 saniyede bir konum gönder
    intervalRef.current = setInterval(() => {
      sendLocationToServer()
    }, 30000) // 30 saniye

    // Geolocation watch ile sürekli takip (hareket algılama için)
    // Türkiye için optimize edilmiş GPS ayarları
    const options = {
      enableHighAccuracy: true, // Yüksek hassasiyet (Türkiye için önemli)
      timeout: 30000, // 30 saniye
      maximumAge: 0 // Önbellek kullanma - her zaman taze GPS verisi iste
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        // GPS hassasiyeti kontrolü
        const accuracy = position.coords.accuracy || 9999
        const gercekGPS = position.coords.accuracy && position.coords.accuracy <= 200 && position.coords.accuracy !== 9999
        
        if (!gercekGPS) {
          // IP tabanlı konum algılandı - uyarı göster ama işle
          const uyariMesaji = `IP tabanlı konum algılandı (hassasiyet: ${accuracy > 9999 ? 'bilinmiyor' : accuracy.toFixed(0) + 'm'}). Bu genelde masaüstü bilgisayarlarda olur çünkü GPS yoktur. Daha doğru konum için: 1) Mobil cihaz kullanın, 2) Cihaz ayarlarından GPS'i açın, 3) Açık alanda kullanın.`
          console.warn(`⚠️ watchPosition: ${uyariMesaji}`)
          setKonumUyari(uyariMesaji)
          // IP tabanlı konumları da işle (kullanıcı masaüstü kullanıyorsa bu tek seçenek)
        } else {
          // Gerçek GPS alındıysa uyarıyı temizle
          if (konumUyari) {
            setKonumUyari(null)
          }
        }
        
        // Konum değiştiğinde otomatik olarak gönder (hareket algılama için)
        // Ancak çok sık göndermemek için throttle uygula
        sendLocationToServer()
      },
      (error) => {
        console.error('Otomatik konum takip hatası:', error)
        // İzin reddedildiyse sessizce devam et, kullanıcıyı rahatsız etme
        // Ancak console'a detaylı log yaz
        if (error.code === error.PERMISSION_DENIED) {
          console.warn('⚠️ Konum izni reddedildi. Konum takibi çalışmayacak.')
        }
      },
      options
    )
  }

  // Otomatik konum takibini durdur
  const stopAutomaticLocationTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  // Konumu sunucuya gönder (retry mekanizması ile)
  const sendLocationToServer = async (retryCount = 0) => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // GPS hassasiyeti kontrolü - Türkiye için optimize edilmiş
          const accuracy = position.coords.accuracy || 9999
          
          // Türkiye koordinat aralığı kontrolü (yaklaşık)
          // Türkiye: Enlem 36°-42° Kuzey, Boylam 26°-45° Doğu
          const enlem = position.coords.latitude
          const boylam = position.coords.longitude
          
          // Detaylı konum bilgisi logla
          console.log('📍 Konum detayları:', {
            enlem: enlem.toFixed(6),
            boylam: boylam.toFixed(6),
            accuracy: accuracy ? `${accuracy.toFixed(2)}m` : 'yok',
            altitude: position.coords.altitude ? `${position.coords.altitude.toFixed(2)}m` : 'yok',
            altitudeAccuracy: position.coords.altitudeAccuracy ? `${position.coords.altitudeAccuracy.toFixed(2)}m` : 'yok',
            heading: position.coords.heading ? `${position.coords.heading.toFixed(2)}°` : 'yok',
            speed: position.coords.speed ? `${(position.coords.speed * 3.6).toFixed(2)} km/h` : 'yok'
          })
          
          // GPS hassasiyeti kontrolü
          // Gerçek GPS genelde 5-200m hassasiyet verir
          // IP tabanlı konumlar genelde 1000m+ hassasiyet verir
          // Masaüstü bilgisayarlarda GPS yoksa IP tabanlı konum kullanılır
          const gercekGPS = position.coords.accuracy && position.coords.accuracy <= 200 && position.coords.accuracy !== 9999
          
          if (!gercekGPS) {
            // IP tabanlı konum algılandı - uyarı göster ama kaydet
            const uyariMesaji = `IP tabanlı konum algılandı (hassasiyet: ${accuracy > 9999 ? 'bilinmiyor' : accuracy.toFixed(0) + 'm'}). Bu genelde masaüstü bilgisayarlarda olur çünkü GPS yoktur. Daha doğru konum için: 1) Mobil cihaz kullanın, 2) Cihaz ayarlarından GPS'i açın, 3) Açık alanda kullanın.`
            console.warn(`⚠️ ${uyariMesaji}`)
            setKonumUyari(uyariMesaji)
            // IP tabanlı konumları da kaydet (kullanıcı masaüstü kullanıyorsa bu tek seçenek)
          } else {
            // Gerçek GPS alındıysa uyarıyı temizle
            if (konumUyari) {
              setKonumUyari(null)
            }
          }
          
          // Hassasiyet çok düşükse uyarı ver ama kaydet (gerçek GPS olduğu için)
          if (accuracy > 100 && accuracy <= 200) {
            console.warn(`⚠️ GPS hassasiyeti düşük: ${accuracy.toFixed(2)}m - Konum yanlış olabilir`)
          }
          
          // Türkiye dışındaysa uyarı ver
          const turkiyeIcinde = enlem >= 35.8 && enlem <= 42.1 && boylam >= 25.6 && boylam <= 45.2
          
          if (!turkiyeIcinde) {
            console.warn(`⚠️ Konum Türkiye sınırları dışında görünüyor: ${enlem.toFixed(6)}, ${boylam.toFixed(6)}`)
          }

          const locationData = {
            enlem: enlem,
            boylam: boylam,
            hiz: position.coords.speed ? position.coords.speed * 3.6 : 0, // m/s to km/h
            batarya: null,
            kaynak: 'otomatik'
          }

          // Konum bilgisini logla (Türkiye için formatlanmış)
          console.log('📍 Konum alındı:', {
            enlem: locationData.enlem.toFixed(6),
            boylam: locationData.boylam.toFixed(6),
            hiz: locationData.hiz.toFixed(2) + ' km/h',
            accuracy: accuracy ? `${accuracy.toFixed(2)}m` : 'bilinmiyor',
            turkiyeIcinde: turkiyeIcinde ? '✅' : '❌',
            timestamp: new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
          })

          await apiClient.post('/api/konum/kaydet', locationData)
          
          // Konum gönderildikten sonra hareket durumunu güncelle
          setTimeout(() => {
            fetchHareketDurumu()
          }, 500) // Backend işlemi tamamlandıktan sonra
        } catch (error) {
          console.error('Konum gönderme hatası:', error)
          // Sessizce hata logla, kullanıcıyı rahatsız etme
          // Ancak backend çalışmıyorsa console'a detaylı log yaz
          if (error.request && !error.response) {
            console.warn('⚠️ Backend sunucusuna bağlanılamıyor. Konum gönderilemedi.')
          }
        }
      },
      (error) => {
        console.error('Konum alma hatası:', error)
        
        // Timeout hatası durumunda retry yap (maksimum 2 kez)
        if (error.code === error.TIMEOUT && retryCount < 2) {
          console.log(`🔄 Konum alma retry denemesi ${retryCount + 1}/2`)
          // 2 saniye bekle ve tekrar dene
          setTimeout(() => {
            sendLocationToServer(retryCount + 1)
          }, 2000)
          return
        }
        
        // Diğer hatalar için sessizce logla
        if (error.code === error.PERMISSION_DENIED) {
          console.warn('⚠️ Konum izni reddedildi')
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          console.warn('⚠️ Konum bilgisi alınamadı')
        }
      },
      {
        enableHighAccuracy: true, // Yüksek hassasiyet - GPS kullan (IP tabanlı değil)
        timeout: 30000, // 30 saniye
        maximumAge: 0 // Cache kullanma - her zaman yeni konum al (Türkiye için önemli)
      }
    )
  }

  const setupWebSocket = () => {
    console.log('🔌 WebSocket bağlantısı kuruluyor:', WS_URL)
    const ws = new WebSocket(WS_URL)
    
    ws.onopen = () => {
      console.log('✅ WebSocket bağlantısı açıldı')
    }
    
    ws.onmessage = (event) => {
      console.log('📨 WebSocket mesajı alındı:', event.data)
      const message = JSON.parse(event.data)
      console.log('📬 Parsed mesaj:', message)
      
      if (message.type === 'yeni_bildirim') {
        console.log('🆕 Yeni bildirim WebSocket mesajı:', message.data)
        console.log('👤 Mevcut kullanıcı ID:', user.id, '(type:', typeof user.id, ')')
        console.log('👤 Bildirim forkliftçi ID:', message.data.forkliftci_id, '(type:', typeof message.data.forkliftci_id, ')')
        
        // Bildirim bu forkliftçiye ait mi kontrol et (hem string hem integer karşılaştırması)
        const bildirimForkliftciId = message.data.forkliftci_id || message.data.forkliftci_id_int
        const kullaniciId = user.id
        
        // String ve integer karşılaştırması
        const isMatch = String(bildirimForkliftciId) === String(kullaniciId) || 
                       Number(bildirimForkliftciId) === Number(kullaniciId)
        
        console.log('🔍 ID karşılaştırması:', {
          bildirimForkliftciId,
          kullaniciId,
          isMatch
        })
        
        // Bildirim bu forkliftçiye aitse ve daha önce eklenmemişse ekle
        if (isMatch) {
          const bildirimId = String(message.data.id)
          const bildirimMesaj = message.data.mesaj || ''
          const bildirimWorkstationId = message.data.workstation_id ? String(message.data.workstation_id) : null
          
          setAllBildirimler(prevBildirimler => {
            // ID bazlı duplicate kontrolü
            const existsById = prevBildirimler.some(b => String(b.id) === bildirimId)
            if (existsById) {
              console.log('⚠️ Bildirim ID zaten mevcut, atlanıyor:', bildirimId)
              return prevBildirimler
            }
            
            // Mesaj ve workstation bazlı duplicate kontrolü (son 5 dakika içinde)
            const fiveMinutesAgo = new Date(Date.now() - 300000)
            const existsByContent = prevBildirimler.some(b => {
              const bildirimTarihi = b.olusturma_tarihi ? new Date(b.olusturma_tarihi) : null
              const ayniMesaj = b.mesaj === bildirimMesaj
              const ayniWorkstation = bildirimWorkstationId && b.workstation_id 
                ? String(b.workstation_id) === bildirimWorkstationId 
                : false
              
              // Son 5 dakika içinde, aynı mesaj ve aynı workstation için bildirim varsa duplicate
              if (aynıMesaj && ayniWorkstation && bildirimTarihi && bildirimTarihi >= fiveMinutesAgo) {
                return true
              }
              
              return false
            })
            
            if (existsByContent) {
              console.log('⚠️ Aynı içerikli bildirim zaten mevcut (son 5 dakika), atlanıyor:', bildirimId)
              return prevBildirimler
            }
            
            console.log('✅ Yeni bildirim WebSocket\'ten eklendi:', bildirimId)
            return [...prevBildirimler, message.data]
          })
          
          setBildirimler(prevBildirimler => {
            // Aynı duplicate kontrolünü burada da yap
            const existsById = prevBildirimler.some(b => String(b.id) === bildirimId)
            if (existsById) {
              return prevBildirimler
            }
            
            const fiveMinutesAgo = new Date(Date.now() - 300000)
            const existsByContent = prevBildirimler.some(b => {
              const bildirimTarihi = b.olusturma_tarihi ? new Date(b.olusturma_tarihi) : null
              const ayniMesaj = b.mesaj === bildirimMesaj
              const ayniWorkstation = bildirimWorkstationId && b.workstation_id 
                ? String(b.workstation_id) === bildirimWorkstationId 
                : false
              
              if (aynıMesaj && ayniWorkstation && bildirimTarihi && bildirimTarihi >= fiveMinutesAgo) {
                return true
              }
              
              return false
            })
            
            if (existsByContent) {
              return prevBildirimler
            }
            
            return [...prevBildirimler, message.data]
          })
        } else {
          // Bildirim bu forkliftçiye ait değilse, sadece yenile (başka bir forkliftçi için olabilir)
          console.log('ℹ️ Bildirim bu forkliftçiye ait değil, atlanıyor')
        }
        
        // Bildirim sesi çal (eğer tarayıcı izin verirse)
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Yeni Bildirim', {
            body: message.data.mesaj,
            icon: '/icon.png'
          })
        }
      } else if (message.type === 'bildirim_onaylandi' || message.type === 'bildirim_reddedildi' || message.type === 'bildirim_kapatildi') {
        console.log('🔄 Bildirim durumu değişti, yenileniyor...')
        
        // Bildirim onaylandığında, o bildirimi tüm forkliftçilerin ekranından kaldır
        if (message.type === 'bildirim_onaylandi' && message.data && message.data.id) {
          const bildirimId = message.data.id.toString()
          console.log('🗑️ Onaylanan bildirim kaldırılıyor:', bildirimId)
          
          setAllBildirimler(prevBildirimler => 
            prevBildirimler.filter(b => b.id.toString() !== bildirimId)
          )
          setBildirimler(prevBildirimler => 
            prevBildirimler.filter(b => b.id.toString() !== bildirimId)
          )
        }
        
        fetchBildirimler()
        // Bildirim onaylandığında veya kapatıldığında kapatılmayı bekleyen işler listesini de güncelle
        fetchKapatilmayiBekleyenIsler()
      } else if (message.type === 'forkliftci_konum_guncellendi') {
        // Konum güncellendiğinde hareket durumunu yenile
        if (message.data.forkliftci_id === user.id) {
          fetchHareketDurumu()
        }
      } else if (message.type === 'forkliftci_hareket_durumu_degisti') {
        // Hareket durumu değiştiğinde güncelle
        if (message.data.forkliftci_id === user.id) {
          setHareketDurumu({
            durum: message.data.yeni_durum,
            mesafe_metre: message.data.mesafe_metre,
            son_guncelleme: new Date()
          })
        }
      }
    }

    ws.onerror = (error) => {
      console.error('❌ WebSocket hatası:', error)
    }
    
    ws.onclose = () => {
      console.log('🔌 WebSocket bağlantısı kapatıldı')
    }

    // Bildirim izni iste
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    return () => {
      console.log('🔌 WebSocket cleanup, bağlantı kapatılıyor')
      ws.close()
    }
  }

  const handleOnayla = async (bildirimId) => {
    try {
      await apiClient.post(`/api/forklift/bildirim/${bildirimId}/onayla`, {
        forkliftci_id: user.kullanici_adi
      })
      fetchBildirimler()
      // Kapatılmayı bekleyen işler listesini de güncelle
      fetchKapatilmayiBekleyenIsler()
    } catch (error) {
      console.error('Onaylama hatası:', error)
      alert('Hata: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleReddet = async (bildirimId) => {
    const redNedeni = window.prompt('Red nedeni (opsiyonel):')
    try {
      await apiClient.post(`/api/forklift/bildirim/${bildirimId}/reddet`, {
        forkliftci_id: user.kullanici_adi,
        red_nedeni: redNedeni
      })
      fetchBildirimler()
    } catch (error) {
      console.error('Reddetme hatası:', error)
      alert('Hata: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleKapat = async (bildirimId) => {
    if (!window.confirm('İşi tamamladınız mı? İş kapatılacak ve süre hesaplanacak.')) {
      return
    }
    try {
      const response = await apiClient.post(`/api/forklift/bildirim/${bildirimId}/kapat`)
      const sureSaniye = response.data.sure_saniye
      const sureDakika = Math.floor(sureSaniye / 60)
      const sureSaniyeKalan = sureSaniye % 60
      alert(`✅ İş kapatıldı!\n\nSüre: ${sureDakika} dakika ${sureSaniyeKalan} saniye`)
      fetchBildirimler()
      if (aktifTab === 'kapatilmayi-bekleyen') {
        fetchKapatilmayiBekleyenIsler()
      }
    } catch (error) {
      console.error('Kapatma hatası:', error)
      alert('Hata: ' + (error.response?.data?.error || error.message))
    }
  }

  const formatSure = (saniye) => {
    if (!saniye) return '-'
    const dakika = Math.floor(saniye / 60)
    const saniyeKalan = saniye % 60
    if (dakika > 0) {
      return `${dakika} dk ${saniyeKalan} sn`
    }
    return `${saniyeKalan} sn`
  }

  if (loading) {
    return <div className="loading">Yükleniyor...</div>
  }

  return (
    <div className="forklift-container">
      {/* İzin Durumu Uyarısı */}
      {izinDurumu === 'denied' && (
        <div style={{
          backgroundColor: '#f8d7da',
          border: '2px solid #dc3545',
          borderRadius: '8px',
          padding: '12px 16px',
          margin: '10px 0',
          color: '#721c24',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          <div style={{ flex: 1 }}>
            <strong>⚠️ Konum İzni Reddedildi</strong>
            <div style={{ marginTop: '4px' }}>
              Konum takibi için tarayıcı izni gerekiyor. Lütfen izin verin.
            </div>
          </div>
          <button
            onClick={izinIste}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            İzin Ver
          </button>
        </div>
      )}
      
      {izinDurumu === 'prompt' && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: '8px',
          padding: '12px 16px',
          margin: '10px 0',
          color: '#856404',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          <div style={{ flex: 1 }}>
            <strong>📍 Konum İzni Gerekli</strong>
            <div style={{ marginTop: '4px' }}>
              Konum takibi için tarayıcı izni gerekiyor. Lütfen izin verin.
            </div>
          </div>
          <button
            onClick={izinIste}
            style={{
              backgroundColor: '#ffc107',
              color: '#856404',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            İzin Ver
          </button>
        </div>
      )}
      
      <div className="forklift-header">
        <h2>Forkliftçi Ekranı</h2>
        <div className="forkliftci-info">
          <span>Kullanıcı: <strong>{user.ad_soyad}</strong></span>
          <div className="hareket-durumu-gosterge">
            <span className={`hareket-durumu-badge ${hareketDurumu.durum === 'hareket_halinde' ? 'hareket-halinde' : hareketDurumu.durum === 'duruyor' ? 'duruyor' : 'bilinmiyor'}`}>
              {hareketDurumu.durum === 'hareket_halinde' ? '🚗 Hareket Halinde' : 
               hareketDurumu.durum === 'duruyor' ? '⏸️ Duruyor' : 
               '❓ Bilinmiyor'}
            </span>
            {hareketDurumu.mesafe_metre !== null && (
              <span className="mesafe-bilgisi">
                Son hareket: {hareketDurumu.mesafe_metre.toFixed(1)} m
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tab Menüsü */}
      <div className="forklift-tabs">
        <button
          className={`forklift-tab ${aktifTab === 'bildirimler' ? 'active' : ''}`}
          onClick={() => setAktifTab('bildirimler')}
        >
          Bekleyen Bildirimler
          {bildirimler.filter(b => b.durum === 'beklemede').length > 0 && (
            <span className="tab-badge">{bildirimler.filter(b => b.durum === 'beklemede').length}</span>
          )}
        </button>
        <button
          className={`forklift-tab ${aktifTab === 'kapatilmayi-bekleyen' ? 'active' : ''}`}
          onClick={() => {
            setAktifTab('kapatilmayi-bekleyen')
            fetchKapatilmayiBekleyenIsler()
          }}
        >
          Kapatılmayı Bekleyen İşler
          {kapatilmayiBekleyenIsler.length > 0 && (
            <span className="tab-badge">{kapatilmayiBekleyenIsler.length}</span>
          )}
        </button>
        <button
          className={`forklift-tab ${aktifTab === 'is-gecmisi' ? 'active' : ''}`}
          onClick={() => setAktifTab('is-gecmisi')}
        >
          İş Geçmişi
        </button>
      </div>

      {/* Tab İçerikleri */}
      {aktifTab === 'bildirimler' && (
        <>
          <div className="workstation-secim-wrapper">
            <WorkstationSecim onWorkstationChange={handleWorkstationChange} />
          </div>

          <WorkstationIstatistikleri selectedWorkstations={selectedWorkstations} />

          {bildirimler.length === 0 ? (
            <div className="no-bildirim">
              <div className="no-bildirim-icon"></div>
              <h3>Bekleyen bildirim yok</h3>
              <p>Tüm iş istasyonları normal seviyede</p>
            </div>
          ) : (
            <div className="bildirimler-listesi">
              {bildirimler.map((bildirim, index) => {
                // Debug: Bildirim durumunu console'a yazdır
                const isOnaylandi = bildirim.durum === 'onaylandi'
                const isKapatilmamis = !bildirim.tamamlanma_tarihi || bildirim.tamamlanma_tarihi === null
                const showKapatButton = isOnaylandi && isKapatilmamis
                
                if (showKapatButton) {
                  console.log(`Bildirim ${bildirim.id} için "İşi Kapat" butonu gösterilecek`, {
                    durum: bildirim.durum,
                    tamamlanma_tarihi: bildirim.tamamlanma_tarihi
                  })
                }
                
                // Unique key için hem ID hem index kullan (duplicate önleme)
                const uniqueKey = `${bildirim.id}-${index}-${bildirim.olusturma_tarihi}`
                
                return (
                <div key={uniqueKey} className="bildirim-card">
                  <div className="bildirim-header">
                    <div className="bildirim-icon"></div>
                    <div className="bildirim-bilgi">
                      {bildirim.workstation_adi ? (
                        <>
                          <h3>{bildirim.workstation_adi}</h3>
                        </>
                      ) : (
                        <h3>Bildirim</h3>
                      )}
                      <p className="bildirim-tarih">
                        {new Date(bildirim.olusturma_tarihi).toLocaleString('tr-TR')}
                      </p>
                    </div>
                  </div>

                  <div className="bildirim-mesaj">
                    <p>{bildirim.mesaj}</p>
                  </div>

                  <div className="bildirim-actions">
                    {bildirim.durum === 'beklemede' ? (
                      <>
                        <button 
                          className="btn-onayla"
                          onClick={() => handleOnayla(bildirim.id)}
                        >
                          ✅ Onayla
                        </button>
                        <button 
                          className="btn-reddet"
                          onClick={() => handleReddet(bildirim.id)}
                        >
                          ❌ Reddet
                        </button>
                      </>
                    ) : bildirim.durum === 'onaylandi' && (!bildirim.tamamlanma_tarihi || bildirim.tamamlanma_tarihi === null) ? (
                      <>
                        <button 
                          className="btn-kapat"
                          onClick={() => handleKapat(bildirim.id)}
                        >
                          ✅ İşi Kapat
                        </button>
                        {bildirim.onay_tarihi && (
                          <span className="bildirim-sure">
                            Başlangıç: {new Date(bildirim.onay_tarihi).toLocaleTimeString('tr-TR')}
                          </span>
                        )}
                      </>
                    ) : bildirim.tamamlanma_tarihi && bildirim.tamamlanma_tarihi !== null ? (
                      <div className="bildirim-tamamlandi">
                        <span className="tamamlandi-badge">✅ Tamamlandı</span>
                        {bildirim.sure_saniye && (
                          <span className="bildirim-sure">
                            Süre: {formatSure(bildirim.sure_saniye)}
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {aktifTab === 'kapatilmayi-bekleyen' && (
        <div className="kapatilmayi-bekleyen-container">
          <div className="kapatilmayi-bekleyen-header">
            <h2>Kapatılmayı Bekleyen İşler</h2>
            <p className="kapatilmayi-bekleyen-aciklama">
              Onayladığınız ancak henüz kapatmadığınız işler burada görüntülenir.
            </p>
          </div>

          {kapatilmayiBekleyenLoading ? (
            <div className="loading">Yükleniyor...</div>
          ) : kapatilmayiBekleyenIsler.length === 0 ? (
            <div className="no-bildirim">
              <div className="no-bildirim-icon"></div>
              <h3>Kapatılmayı bekleyen iş yok</h3>
              <p>Tüm onayladığınız işler kapatılmış</p>
            </div>
          ) : (
            <div className="bildirimler-listesi">
              {kapatilmayiBekleyenIsler.map((bildirim) => {
                const onayTarihi = bildirim.onay_tarihi ? new Date(bildirim.onay_tarihi) : null
                const gecenSure = onayTarihi ? Math.floor((new Date() - onayTarihi) / 1000) : 0
                
                return (
                  <div key={bildirim.id} className="bildirim-card">
                    <div className="bildirim-header">
                      <div className="bildirim-icon"></div>
                      <div className="bildirim-bilgi">
                        {bildirim.workstation_adi ? (
                          <>
                            <h3>{bildirim.workstation_adi}</h3>
                          </>
                        ) : (
                          <h3>Bildirim</h3>
                        )}
                        <p className="bildirim-tarih">
                          Onay: {onayTarihi ? onayTarihi.toLocaleString('tr-TR') : '-'}
                        </p>
                      </div>
                    </div>

                    <div className="bildirim-mesaj">
                      <p>{bildirim.mesaj}</p>
                    </div>

                    <div className="bildirim-ek-bilgi">
                      {onayTarihi && (
                        <div className="gecen-sure-bilgisi">
                          <span className="gecen-sure-label">Geçen Süre:</span>
                          <span className="gecen-sure-deger">{formatSure(gecenSure)}</span>
                        </div>
                      )}
                    </div>

                    <div className="bildirim-actions">
                      <button 
                        className="btn-kapat"
                        onClick={() => handleKapat(bildirim.id)}
                      >
                        ✅ İşi Kapat
                      </button>
                      {onayTarihi && (
                        <span className="bildirim-sure">
                          Başlangıç: {onayTarihi.toLocaleTimeString('tr-TR')}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {aktifTab === 'is-gecmisi' && (
        <ForkliftciIsGecmisi />
      )}
    </div>
  )
}

export default ForkliftEkrani

