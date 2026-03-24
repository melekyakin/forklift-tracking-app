import React, { useState, useEffect } from 'react'
import apiClient from '../utils/axiosConfig'
import { useAuth } from '../context/AuthContext'
import { WS_URL } from '../config'
import './HatOperatorEkrani.css'

function HatOperatorEkrani() {
  const { user } = useAuth()
  const [workstations, setWorkstations] = useState([])
  const [selectedWorkstation, setSelectedWorkstation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForkliftCagirModal, setShowForkliftCagirModal] = useState(false)
  const [selectedWorkstationForForklift, setSelectedWorkstationForForklift] = useState(null)
  const [mesaj, setMesaj] = useState('')
  const [tip, setTip] = useState('hammadde_talebi')

  useEffect(() => {
    if (user) {
      fetchWorkstations()
      // Hat operatörü için varsayılan iş istasyonunu ayarla
      if (user.workstation_id) {
        setSelectedWorkstation(user.workstation_id)
      }
    }
  }, [user])

  useEffect(() => {
    // Workstation'lar yüklendiğinde hat operatörü için varsayılan iş istasyonunu bul
    if (user && user.workstation_id && workstations.length > 0) {
      const defaultWs = workstations.find(ws => String(ws.id) === String(user.workstation_id))
      if (defaultWs) {
        setSelectedWorkstation(String(defaultWs.id))
      } else if (workstations.length > 0) {
        setSelectedWorkstation(String(workstations[0].id))
      }
    } else if (workstations.length > 0 && !selectedWorkstation) {
      setSelectedWorkstation(String(workstations[0].id))
    }
  }, [workstations, user])

  const fetchWorkstations = async () => {
    try {
      const response = await apiClient.get('/api/workstation')
      setWorkstations(response.data || [])
      setLoading(false)
    } catch (error) {
      console.error('Workstation yükleme hatası:', error)
      setLoading(false)
    }
  }

  const handleForkliftCagir = async () => {
    if (!selectedWorkstationForForklift) {
      alert('Lütfen bir iş istasyonu seçin')
      return
    }

    try {
      const response = await apiClient.post('/api/forklift/bildirim', {
        workstation_id: parseInt(selectedWorkstationForForklift.id),
        mesaj: mesaj || `${selectedWorkstationForForklift.workstation_adi} iş istasyonu için hammadde talebi`,
        tip: tip
      })

      if (response.data.success) {
        alert('Forklift başarıyla çağrıldı!')
        setShowForkliftCagirModal(false)
        setMesaj('')
        setTip('hammadde_talebi')
        setSelectedWorkstationForForklift(null)
      }
    } catch (error) {
      console.error('Forklift çağırma hatası:', error)
      alert('Forklift çağırılırken bir hata oluştu: ' + (error.response?.data?.error || error.message))
    }
  }

  if (loading) {
    return <div className="loading">Yükleniyor...</div>
  }

  return (
    <div className="hat-operator-container">
      <div className="hat-operator-header">
        <h2>İş İstasyonu Yönetimi</h2>
        <div className="header-actions">
          <div className="workstation-selector">
            <label>İş İstasyonu:</label>
            <select
              value={selectedWorkstation || ''}
              onChange={(e) => setSelectedWorkstation(e.target.value)}
              className="workstation-select"
            >
              {workstations.map(ws => (
                <option key={ws.id} value={String(ws.id)}>
                  {ws.workstation_adi} ({ws.workstation_no})
                </option>
              ))}
            </select>
          </div>
          <button 
            className="btn-hammadde" 
            onClick={() => {
              const ws = workstations.find(w => String(w.id) === String(selectedWorkstation))
              if (ws) {
                setSelectedWorkstationForForklift(ws)
                setTip('hammadde_talebi')
                setMesaj(`${ws.workstation_adi} iş istasyonu için hammadde talebi`)
                setShowForkliftCagirModal(true)
              }
            }}
          >
            Hammadde Talebi
          </button>
        </div>
      </div>

      <div className="workstations-grid">
        {workstations.map((workstation) => {
          return (
            <div key={workstation.id} className="workstation-card">
              <div className="workstation-header">
                <div>
                  <h3>{workstation.workstation_adi}</h3>
                  <span className="workstation-badge">{workstation.workstation_no}</span>
                </div>
                <span className={`durum-badge ${workstation.durum || 'aktif'}`}>
                  {workstation.durum || 'aktif'}
                </span>
              </div>
              
              <div className="workstation-actions">
                <button 
                  className="btn-forklift-cagir"
                  onClick={() => {
                    setSelectedWorkstationForForklift(workstation)
                    setTip('hammadde_talebi')
                    setMesaj(`${workstation.workstation_adi} iş istasyonu için hammadde talebi`)
                    setShowForkliftCagirModal(true)
                  }}
                >
                  🚜 Forklift Çağır
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Forklift Çağır Modal */}
      {showForkliftCagirModal && selectedWorkstationForForklift && (
        <div className="modal-overlay" onClick={() => setShowForkliftCagirModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Forklift Çağır</h3>
              <button className="modal-close" onClick={() => setShowForkliftCagirModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>İş İstasyonu:</label>
                <input
                  type="text"
                  value={selectedWorkstationForForklift.workstation_adi}
                  disabled
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label>Mesaj Tipi:</label>
                <select
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                  className="form-control"
                >
                  <option value="hammadde_talebi">Hammadde Talebi</option>
                </select>
              </div>
              <div className="form-group">
                <label>Mesaj:</label>
                <textarea
                  value={mesaj}
                  onChange={(e) => setMesaj(e.target.value)}
                  className="form-control"
                  rows="3"
                  placeholder="Mesaj giriniz..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowForkliftCagirModal(false)}>
                İptal
              </button>
              <button className="btn-primary" onClick={handleForkliftCagir}>
                Forklift Çağır
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HatOperatorEkrani

