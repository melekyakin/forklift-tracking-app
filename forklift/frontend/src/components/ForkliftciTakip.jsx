import React, { useState, useEffect } from 'react'
import apiClient from '../utils/axiosConfig'
import { useAuth } from '../context/AuthContext'
import { API_URL, WS_URL } from '../config'
import './ForkliftciTakip.css'
import './Raporlar.css'
import './ForkliftciIsGecmisi.css'

function ForkliftciTakip() {
  const { user, hasRole } = useAuth()
  const [selectedPeriyot, setSelectedPeriyot] = useState('gunluk')
  const [kpi, setKpi] = useState(null)
  const [anlikAktiviteler, setAnlikAktiviteler] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedForkliftci, setSelectedForkliftci] = useState(null)
  const [forkliftciler, setForkliftciler] = useState([])
  // Raporlar için state'ler
  const [istatistikler, setIstatistikler] = useState(null)
  // İş geçmişi için state'ler
  const [isler, setIsler] = useState([])
  const [isGecmisiLoading, setIsGecmisiLoading] = useState(true)
  const [isGecmisiFiltreler, setIsGecmisiFiltreler] = useState({
    baslangic_tarihi: '',
    bitis_tarihi: '',
    durum: 'tamamlanan'
  })

  useEffect(() => {
    if (user) {
      // Forkliftoperator için otomatik olarak kendi ID'sini seç
      if (hasRole('forkliftoperator') && !selectedForkliftci) {
        setSelectedForkliftci(user.id.toString())
      }
      
      if (hasRole(['admin', 'yonetici'])) {
        fetchForkliftciler()
      }
      setupWebSocket()
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchKPI()
      fetchAnlikAktiviteler()
      fetchIstatistikler()
      fetchIsGecmisi()
      
      // Her 10 saniyede bir güncelle
      const interval = setInterval(() => {
        fetchKPI()
        fetchAnlikAktiviteler()
      }, 10000)
      
      return () => clearInterval(interval)
    }
  }, [user, selectedPeriyot, selectedForkliftci])

  useEffect(() => {
    if (user) {
      fetchIsGecmisi()
    }
  }, [user, isGecmisiFiltreler])

  const fetchForkliftciler = async () => {
    try {
      // Tüm forkliftçileri getir (admin/yönetici için)
      const response = await apiClient.get('/api/kullanici?rol=forkliftoperator')
      setForkliftciler(response.data || [])
    } catch (error) {
      console.error('Forkliftçi yükleme hatası:', error)
      // Eğer endpoint yoksa boş array kullan
      setForkliftciler([])
    }
  }

  const fetchKPI = async () => {
    try {
      const params = new URLSearchParams({
        periyot: selectedPeriyot
      })
      // Admin/yönetici için forkliftçi seçimi varsa ekle
      // Forkliftoperator için backend otomatik olarak kendi ID'sini kullanır
      if (selectedForkliftci && (hasRole(['admin', 'yonetici']))) {
        params.append('forkliftci_id', selectedForkliftci)
      }
      
      const response = await apiClient.get(`/api/forkliftci/kpi?${params.toString()}`)
      setKpi(response.data)
      setLoading(false)
    } catch (error) {
      console.error('KPI yükleme hatası:', error)
      setLoading(false)
    }
  }

  const fetchAnlikAktiviteler = async () => {
    try {
      const params = new URLSearchParams()
      // Admin/yönetici için forkliftçi seçimi varsa ekle
      // Forkliftoperator için backend otomatik olarak kendi ID'sini kullanır
      if (selectedForkliftci && (hasRole(['admin', 'yonetici']))) {
        params.append('forkliftci_id', selectedForkliftci)
      }
      
      const response = await apiClient.get(`/api/forkliftci/anlik-durum?${params.toString()}`)
      setAnlikAktiviteler(response.data)
    } catch (error) {
      console.error('Anlık aktivite yükleme hatası:', error)
    }
  }

  const setupWebSocket = () => {
    const ws = new WebSocket(WS_URL)
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'forkliftci_aktivite') {
        fetchKPI()
        fetchAnlikAktiviteler()
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket hatası:', error)
    }

    return () => ws.close()
  }

  const formatSure = (saniye) => {
    if (!saniye) return '0 dk'
    const saat = Math.floor(saniye / 3600)
    const dakika = Math.floor((saniye % 3600) / 60)
    if (saat > 0) {
      return `${saat}s ${dakika}dk`
    }
    return `${dakika}dk`
  }

  const getAktiviteIcon = (tip) => {
    const icons = {
      'bildirim_onaylandi': '✓',
      'bildirim_reddedildi': '✕',
      'workstation_degisim': '📍'
    }
    return icons[tip] || '•'
  }

  const getAktiviteLabel = (tip) => {
    const labels = {
      'bildirim_onaylandi': 'Bildirim Onaylandı',
      'bildirim_reddedildi': 'Bildirim Reddedildi',
      'workstation_degisim': 'Workstation Değişti'
    }
    return labels[tip] || tip
  }

  // Raporlar fonksiyonları
  const fetchIstatistikler = async () => {
    try {
      const response = await apiClient.get('/api/rapor/istatistikler')
      setIstatistikler(response.data)
    } catch (error) {
      console.error('İstatistik yükleme hatası:', error)
    }
  }

  // İş geçmişi fonksiyonları
  const fetchIsGecmisi = async () => {
    try {
      setIsGecmisiLoading(true)
      const params = new URLSearchParams()
      
      if (isGecmisiFiltreler.baslangic_tarihi) {
        params.append('baslangic_tarihi', isGecmisiFiltreler.baslangic_tarihi)
      }
      if (isGecmisiFiltreler.bitis_tarihi) {
        params.append('bitis_tarihi', isGecmisiFiltreler.bitis_tarihi)
      }
      if (isGecmisiFiltreler.durum) {
        params.append('durum', isGecmisiFiltreler.durum)
      }
      
      // Admin/yönetici için forkliftçi seçimi varsa ekle
      // Forkliftoperator için backend otomatik olarak kendi ID'sini kullanır
      if (selectedForkliftci && (hasRole(['admin', 'yonetici']))) {
        params.append('forkliftci_id', selectedForkliftci)
      }
      
      const url = `/api/forklift/bildirimler/gecmis?${params.toString()}`
      const response = await apiClient.get(url)
      setIsler(response.data)
      setIsGecmisiLoading(false)
    } catch (error) {
      console.error('İş geçmişi yükleme hatası:', error)
      setIsGecmisiLoading(false)
    }
  }

  const handleIsGecmisiFiltreDegis = (key, value) => {
    setIsGecmisiFiltreler(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const formatTarih = (tarih) => {
    if (!tarih) return '-'
    return new Date(tarih).toLocaleString('tr-TR')
  }

  const formatSureIsGecmisi = (saniye) => {
    if (!saniye) return '-'
    const saat = Math.floor(saniye / 3600)
    const dakika = Math.floor((saniye % 3600) / 60)
    const saniyeKalan = saniye % 60
    if (saat > 0) {
      return `${saat} sa ${dakika} dk ${saniyeKalan} sn`
    } else if (dakika > 0) {
      return `${dakika} dk ${saniyeKalan} sn`
    }
    return `${saniyeKalan} sn`
  }

  const getDurumBadge = (durum) => {
    if (durum === 'onaylandi') {
      return <span className="durum-badge durum-onaylandi">✅ Onaylandı</span>
    } else if (durum === 'reddedildi') {
      return <span className="durum-badge durum-reddedildi">❌ Reddedildi</span>
    }
    return <span className="durum-badge durum-beklemede">⏳ Beklemede</span>
  }

  if (loading) {
    return <div className="loading">Yükleniyor...</div>
  }

  return (
    <div className="forkliftci-takip-container">
      <div className="takip-header">
        <h2>
          {hasRole('forkliftoperator') ? 'Kendi Performansım' : 'Forkliftçi Takip ve KPI'}
        </h2>
        <div className="header-controls">
          {hasRole(['admin', 'yonetici']) && forkliftciler.length > 0 && (
            <select
              className="forkliftci-select"
              value={selectedForkliftci || ''}
              onChange={(e) => {
                const value = e.target.value
                setSelectedForkliftci(value === '' ? null : value)
              }}
            >
              <option value="">Tüm Forkliftçiler</option>
              {forkliftciler.map(f => (
                <option key={f.id} value={f.id}>{f.ad_soyad}</option>
              ))}
            </select>
          )}
          <div className="periyot-selector">
            <button
              className={`periyot-btn ${selectedPeriyot === 'gunluk' ? 'active' : ''}`}
              onClick={() => setSelectedPeriyot('gunluk')}
            >
              Günlük
            </button>
            <button
              className={`periyot-btn ${selectedPeriyot === 'haftalik' ? 'active' : ''}`}
              onClick={() => setSelectedPeriyot('haftalik')}
            >
              Haftalık
            </button>
            <button
              className={`periyot-btn ${selectedPeriyot === 'aylik' ? 'active' : ''}`}
              onClick={() => setSelectedPeriyot('aylik')}
            >
              Aylık
            </button>
          </div>
        </div>
      </div>

      {kpi && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon icon-chart"></div>
            <div className="kpi-content">
              <h3>Toplam Aktivite</h3>
              <p className="kpi-value">{kpi.toplam_aktivite}</p>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon icon-check"></div>
            <div className="kpi-content">
              <h3>Bildirim Onay</h3>
              <p className="kpi-value">{kpi.bildirim_onay}</p>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon icon-cross"></div>
            <div className="kpi-content">
              <h3>Bildirim Red</h3>
              <p className="kpi-value">{kpi.bildirim_red}</p>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon icon-time"></div>
            <div className="kpi-content">
              <h3>Toplam Süre</h3>
              <p className="kpi-value">{formatSure(kpi.toplam_sure_saniye)}</p>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon icon-chart"></div>
            <div className="kpi-content">
              <h3>Ortalama Süre</h3>
              <p className="kpi-value">{formatSure(kpi.ortalama_sure_saniye)}</p>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon icon-location"></div>
            <div className="kpi-content">
              <h3>Çalışılan WS</h3>
              <p className="kpi-value">{kpi.calisilan_workstation}</p>
            </div>
          </div>

          <div className="kpi-card highlight">
            <div className="kpi-icon">🎯</div>
            <div className="kpi-content">
              <h3>Onay Oranı</h3>
              <p className="kpi-value">{kpi.bildirim_onay_orani}%</p>
            </div>
          </div>
        </div>
      )}


      {/* Raporlar Bölümü */}
      <div className="raporlar-section">
        {/* İş Geçmişi Bölümü */}
        <div className="is-gecmisi-section">
          <div className="is-gecmisi-header">
            <h3>İş Geçmişi</h3>
          </div>

          <div className="is-gecmisi-filtreler">
            <div className="filtre-grup">
              <label>Başlangıç Tarihi:</label>
              <input
                type="date"
                value={isGecmisiFiltreler.baslangic_tarihi}
                onChange={(e) => handleIsGecmisiFiltreDegis('baslangic_tarihi', e.target.value)}
              />
            </div>
            <div className="filtre-grup">
              <label>Bitiş Tarihi:</label>
              <input
                type="date"
                value={isGecmisiFiltreler.bitis_tarihi}
                onChange={(e) => handleIsGecmisiFiltreDegis('bitis_tarihi', e.target.value)}
              />
            </div>
            <div className="filtre-grup">
              <label>Durum:</label>
              <select
                value={isGecmisiFiltreler.durum}
                onChange={(e) => handleIsGecmisiFiltreDegis('durum', e.target.value)}
              >
                <option value="tamamlanan">Tümü (Onaylanan + Reddedilen)</option>
                <option value="onaylandi">Onaylanan</option>
                <option value="reddedildi">Reddedilen</option>
              </select>
            </div>
            <button className="btn-filtre-temizle" onClick={() => setIsGecmisiFiltreler({
              baslangic_tarihi: '',
              bitis_tarihi: '',
              durum: 'tamamlanan'
            })}>
              Filtreleri Temizle
            </button>
          </div>

          {isGecmisiLoading ? (
            <div className="loading">Yükleniyor...</div>
          ) : (
            <>
              {isler.length === 0 ? (
                <div className="no-is-gecmisi">
                  <p>Henüz iş geçmişi bulunmuyor.</p>
                </div>
              ) : (
                <div className="is-gecmisi-tablo-wrapper">
                  <table className="is-gecmisi-tablo">
                    <thead>
                      <tr>
                        <th>Forkliftçi</th>
                        <th>İş İstasyonu</th>
                        <th>Mesaj</th>
                        <th>Durum</th>
                        <th>Oluşturulma</th>
                        <th>Onay/Red</th>
                        <th>Kapatılma</th>
                        <th>Süre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isler.map((is) => {
                        return (
                          <tr key={is.id}>
                            <td>
                              <div className="forkliftci-bilgi">
                                <strong>{is.forkliftci_ad_soyad || is.forkliftci_kullanici_adi || 'Bilinmiyor'}</strong>
                                {is.forkliftci_kullanici_adi && is.forkliftci_ad_soyad && (
                                  <span className="kullanici-adi">({is.forkliftci_kullanici_adi})</span>
                                )}
                              </div>
                            </td>
                            <td>{is.workstation_adi || 'Bilinmiyor'}</td>
                            <td className="mesaj-cell">{is.mesaj || '-'}</td>
                            <td>{getDurumBadge(is.durum)}</td>
                            <td>{formatTarih(is.olusturma_tarihi)}</td>
                            <td>
                              {is.onay_tarihi ? (
                                <span className="tarih-badge onay">✅ {formatTarih(is.onay_tarihi)}</span>
                              ) : is.red_tarihi ? (
                                <span className="tarih-badge red">❌ {formatTarih(is.red_tarihi)}</span>
                              ) : (
                                <span className="tarih-badge">-</span>
                              )}
                            </td>
                            <td>
                              {is.tamamlanma_tarihi ? (
                                <span className="tarih-badge tamamlandi">✅ {formatTarih(is.tamamlanma_tarihi)}</span>
                              ) : (
                                <span className="tarih-badge">-</span>
                              )}
                            </td>
                            <td>{formatSureIsGecmisi(is.sure_saniye)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="is-gecmisi-istatistik">
                <div className="istatistik-item">
                  <span className="istatistik-label">Toplam İş:</span>
                  <span className="istatistik-deger">{isler.length}</span>
                </div>
                <div className="istatistik-item">
                  <span className="istatistik-label">Onaylanan:</span>
                  <span className="istatistik-deger onaylandi">
                    {isler.filter(i => i.durum === 'onaylandi').length}
                  </span>
                </div>
                <div className="istatistik-item">
                  <span className="istatistik-label">Reddedilen:</span>
                  <span className="istatistik-deger reddedildi">
                    {isler.filter(i => i.durum === 'reddedildi').length}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ForkliftciTakip

