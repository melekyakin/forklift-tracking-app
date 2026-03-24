import React, { useState, useEffect } from 'react'
import apiClient from '../utils/axiosConfig'
import { useAuth } from '../context/AuthContext'
import { API_URL } from '../config'
import './WorkstationIstatistikleri.css'

function WorkstationIstatistikleri({ selectedWorkstations }) {
  const { user } = useAuth()
  const [istatistikler, setIstatistikler] = useState([])
  const [alertler, setAlertler] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [selectedWorkstationForAlert, setSelectedWorkstationForAlert] = useState(null)
  const [alertLimit, setAlertLimit] = useState('')

  useEffect(() => {
    if (selectedWorkstations && selectedWorkstations.length > 0) {
      fetchIstatistikler()
      fetchAlertler()
      
      // Her 5 saniyede bir istatistikleri güncelle
      const interval = setInterval(() => {
        fetchIstatistikler()
      }, 5000)
      
      return () => clearInterval(interval)
    } else {
      setIstatistikler([])
      setLoading(false)
    }
  }, [selectedWorkstations])

  const fetchIstatistikler = async () => {
    try {
      const response = await apiClient.post('/api/workstation/istatistikler', {
        workstation_ids: selectedWorkstations
      })
      setIstatistikler(response.data)
      setLoading(false)
    } catch (error) {
      console.error('İstatistik yükleme hatası:', error)
      setLoading(false)
    }
  }

  const fetchAlertler = async () => {
    try {
      const response = await apiClient.get('/api/alert')
      setAlertler(response.data)
    } catch (error) {
      console.error('Alert yükleme hatası:', error)
    }
  }

  const handleAlertKaydet = async () => {
    if (!selectedWorkstationForAlert || !alertLimit) {
      alert('Lütfen iş istasyonu ve doluluk yüzdesi limitini girin')
      return
    }

    const dolulukLimit = parseFloat(alertLimit)
    if (isNaN(dolulukLimit) || dolulukLimit < 0 || dolulukLimit > 100) {
      alert('Doluluk yüzdesi 0-100 arasında olmalıdır')
      return
    }

    try {
      await apiClient.post('/api/alert', {
        workstation_id: selectedWorkstationForAlert,
        doluluk_yuzdesi_limit: dolulukLimit
      })
      setShowAlertModal(false)
      setSelectedWorkstationForAlert(null)
      setAlertLimit('')
      fetchAlertler()
      fetchIstatistikler()
    } catch (error) {
      console.error('Alert kaydetme hatası:', error)
      alert('Hata: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleAlertSil = async (alertId) => {
    if (!window.confirm('Bu alert\'i silmek istediğinize emin misiniz?')) {
      return
    }

    try {
      await apiClient.delete(`/api/alert/${alertId}`)
      fetchAlertler()
      fetchIstatistikler()
    } catch (error) {
      console.error('Alert silme hatası:', error)
      alert('Hata: ' + (error.response?.data?.error || error.message))
    }
  }

  const getAlertDurumu = (workstationId) => {
    // workstation_id string veya ObjectId olabilir, her iki durumu da kontrol et
    const alert = alertler.find(a => {
      const alertWsId = typeof a.workstation_id === 'string' ? a.workstation_id : a.workstation_id?.toString()
      const wsId = typeof workstationId === 'string' ? workstationId : workstationId?.toString()
      return alertWsId === wsId
    })
    if (!alert) return null
    return alert
  }

  const checkAlertTetikleme = (istatistik) => {
    const alert = getAlertDurumu(istatistik.id)
    if (!alert) return false
    // Alert kontrolü (kasa bilgisi kaldırıldı, bu fonksiyon şimdilik false döndürüyor)
    return false
  }

  if (loading) {
    return <div className="istatistik-loading">Yükleniyor...</div>
  }

  if (selectedWorkstations.length === 0) {
    return (
      <div className="istatistik-bos">
        <p>Lütfen çalıştığınız workstation'ları seçin</p>
      </div>
    )
  }

  return (
    <div className="workstation-istatistikleri">
      <div className="istatistik-header">
        <h3>Workstation İstatistikleri</h3>
        <button 
          className="btn-alert-ekle"
          onClick={() => setShowAlertModal(true)}
        >
          Alert Ekle
        </button>
      </div>

      <div className="istatistik-grid">
        {istatistikler.map((istatistik) => {
          const alert = getAlertDurumu(istatistik.id)
          const alertTetikli = checkAlertTetikleme(istatistik)
          
          return (
            <div 
              key={istatistik.id} 
              className={`istatistik-card ${alertTetikli ? 'alert-tetikli' : ''}`}
            >
              <div className="istatistik-card-header">
                <h4>{istatistik.workstation_adi}</h4>
                
              </div>
              {alert && (
                <div className="alert-bilgi">
                  <div className="alert-limit">
                    <strong>Alert Limit:</strong> %{alert.doluluk_yuzdesi_limit}
                  </div>
                  {alertTetikli && (
                    <div className="alert-uyari">
                      Alert Tetiklendi!
                    </div>
                  )}
                  <button 
                    className="btn-alert-sil"
                    onClick={() => handleAlertSil(alert.id)}
                  >
                    🗑️ Alert'i Sil
                  </button>
                </div>
              )}

              {!alert && (
                <button 
                  className="btn-alert-ekle-kart"
                  onClick={() => {
                    setSelectedWorkstationForAlert(istatistik.id)
                    setShowAlertModal(true)
                  }}
                >
                  Bu Workstation İçin Alert Ekle
                </button>
              )}
            </div>
          )
        })}
      </div>

      {showAlertModal && (
        <div className="alert-modal-overlay" onClick={() => setShowAlertModal(false)}>
          <div className="alert-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>İş İstasyonu Alert Ekle</h3>
            
            <div className="form-group">
              <label>İş İstasyonu:</label>
              <select
                value={selectedWorkstationForAlert || ''}
                onChange={(e) => setSelectedWorkstationForAlert(parseInt(e.target.value))}
                required
              >
                <option value="">Seçiniz</option>
                {istatistikler.map(ws => (
                  <option key={ws.id} value={ws.id}>
                    {ws.workstation_adi} ({ws.workstation_no})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Doluluk Yüzdesi Limiti (%):</label>
              <input
                type="number"
                value={alertLimit}
                onChange={(e) => setAlertLimit(e.target.value)}
                placeholder="Örn: 80"
                min="0"
                max="100"
                step="0.1"
                required
              />
              <small>Kasa doluluk yüzdesi bu değere ulaştığında veya geçtiğinde alert tetiklenecek</small>
            </div>

            <div className="alert-modal-actions">
              <button className="btn-kaydet" onClick={handleAlertKaydet}>
                Kaydet
              </button>
              <button 
                className="btn-iptal"
                onClick={() => {
                  setShowAlertModal(false)
                  setSelectedWorkstationForAlert(null)
                  setAlertLimit('')
                }}
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkstationIstatistikleri

