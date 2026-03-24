import React, { useState, useEffect } from 'react'
import apiClient from '../utils/axiosConfig'
import { API_URL } from '../config'
import './Raporlar.css'

function Raporlar() {
  const [istatistikler, setIstatistikler] = useState(null)
  const [hareketler, setHareketler] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtreler, setFiltreler] = useState({
    forkliftci_id: '',
    islem_tipi: '',
    tarih: ''
  })

  useEffect(() => {
    fetchIstatistikler()
    fetchHareketler()
  }, [])

  const fetchIstatistikler = async () => {
    try {
      const response = await apiClient.get('/api/rapor/istatistikler')
      setIstatistikler(response.data)
    } catch (error) {
      console.error('İstatistik yükleme hatası:', error)
    }
  }

  const fetchHareketler = async () => {
    try {
      const params = new URLSearchParams()
      Object.keys(filtreler).forEach(key => {
        if (filtreler[key]) {
          params.append(key, filtreler[key])
        }
      })
      
      const response = await apiClient.get(`/api/rapor/hareketler?${params.toString()}`)
      setHareketler(response.data)
      setLoading(false)
    } catch (error) {
      console.error('Hareket yükleme hatası:', error)
      setLoading(false)
    }
  }

  const handleFiltreDegis = (key, value) => {
    setFiltreler({ ...filtreler, [key]: value })
  }

  const handleFiltreUygula = () => {
    setLoading(true)
    fetchHareketler()
  }

  const handleFiltreTemizle = () => {
    setFiltreler({
      forkliftci_id: '',
      islem_tipi: '',
      tarih: ''
    })
    setTimeout(() => {
      setLoading(true)
      fetchHareketler()
    }, 100)
  }

  const getIslemTipiRenk = (tip) => {
    const renkler = {
      'adet_guncelleme': '#3742fa',
      'bildirim_onaylandi': '#2ed573',
      'bildirim_reddedildi': '#ff4757',
      'kasa_dolu': '#ff9800',
      'hammadde_talebi': '#9c27b0'
    }
    return renkler[tip] || '#666'
  }

  const getIslemTipiLabel = (tip) => {
    const labels = {
      'adet_guncelleme': 'Adet Güncelleme',
      'bildirim_onaylandi': 'Bildirim Onaylandı',
      'bildirim_reddedildi': 'Bildirim Reddedildi',
      'kasa_dolu': 'Kasa Dolu',
      'hammadde_talebi': 'Hammadde Talebi'
    }
    return labels[tip] || tip
  }

  if (loading && !istatistikler) {
    return <div className="loading">Yükleniyor...</div>
  }

  return (
    <div className="raporlar-container">
      <h2>Raporlar ve İstatistikler</h2>

      {istatistikler && (
        <div className="istatistikler-grid">
          <div className="istatistik-card">
            <div className="istatistik-icon">🔔</div>
            <div className="istatistik-bilgi">
              <h3>Bekleyen Bildirim</h3>
              <p className="istatistik-deger">{istatistikler.bekleyen_bildirim}</p>
            </div>
          </div>

          <div className="istatistik-card">
            <div className="istatistik-icon">📝</div>
            <div className="istatistik-bilgi">
              <h3>Toplam Hareket</h3>
              <p className="istatistik-deger">{istatistikler.toplam_hareket}</p>
            </div>
          </div>

          <div className="istatistik-card">
            <div className="istatistik-icon">📅</div>
            <div className="istatistik-bilgi">
              <h3>Günlük Hareket</h3>
              <p className="istatistik-deger">{istatistikler.gunluk_hareket}</p>
            </div>
          </div>
        </div>
      )}

      <div className="hareketler-section">
        <h3>Hareket Kayıtları</h3>

        <div className="filtreler">
          <div className="filtre-group">
            <label>Forkliftçi ID:</label>
            <input
              type="text"
              value={filtreler.forkliftci_id}
              onChange={(e) => handleFiltreDegis('forkliftci_id', e.target.value)}
              placeholder="Forkliftçi ID"
            />
          </div>

          <div className="filtre-group">
            <label>İşlem Tipi:</label>
            <select
              value={filtreler.islem_tipi}
              onChange={(e) => handleFiltreDegis('islem_tipi', e.target.value)}
            >
              <option value="">Tümü</option>
              <option value="adet_guncelleme">Adet Güncelleme</option>
              <option value="bildirim_onaylandi">Bildirim Onaylandı</option>
              <option value="bildirim_reddedildi">Bildirim Reddedildi</option>
              <option value="kasa_dolu">Kasa Dolu</option>
              <option value="hammadde_talebi">Hammadde Talebi</option>
            </select>
          </div>

          <div className="filtre-group">
            <label>Onay Tarihi:</label>
            <input
              type="date"
              value={filtreler.tarih}
              onChange={(e) => handleFiltreDegis('tarih', e.target.value)}
            />
          </div>

          <div className="filtre-actions">
            <button className="btn-primary" onClick={handleFiltreUygula}>
              🔍 Filtrele
            </button>
            <button className="btn-secondary" onClick={handleFiltreTemizle}>
              🗑️ Temizle
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading">Yükleniyor...</div>
        ) : (
          <div className="hareketler-listesi">
            {hareketler.length === 0 ? (
              <div className="no-data">Kayıt bulunamadı</div>
            ) : (
              hareketler.map((hareket) => (
                <div key={hareket.id} className="hareket-card">
                  <div className="hareket-header">
                    <div className="hareket-bilgi">
                      <h4>{hareket.kasa_no}</h4>
                      <span 
                        className="islem-tipi-badge"
                        style={{ backgroundColor: getIslemTipiRenk(hareket.islem_tipi) }}
                      >
                        {getIslemTipiLabel(hareket.islem_tipi)}
                      </span>
                    </div>
                    <div className="hareket-tarih">
                      {new Date(hareket.olusturma_tarihi).toLocaleString('tr-TR')}
                    </div>
                  </div>

                  {hareket.onceki_adet !== null && hareket.yeni_adet !== null && (
                    <div className="hareket-degisim">
                      <span className="onceki">{hareket.onceki_adet}</span>
                      <span className="ok">→</span>
                      <span className="yeni">{hareket.yeni_adet}</span>
                    </div>
                  )}

                  {hareket.aciklama && (
                    <div className="hareket-aciklama">
                      <p>{hareket.aciklama}</p>
                    </div>
                  )}

                  {hareket.forkliftci_id && (
                    <div className="hareket-forkliftci">
                      Forkliftçi: <strong>{hareket.forkliftci_id}</strong>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Raporlar

