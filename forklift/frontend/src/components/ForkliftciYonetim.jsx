import React, { useState, useEffect } from 'react'
import apiClient from '../utils/axiosConfig'
import { useAuth } from '../context/AuthContext'
import './ForkliftciYonetim.css'

function ForkliftciYonetim() {
  const { hasRole } = useAuth()
  const [forkliftciler, setForkliftciler] = useState([])
  const [workstations, setWorkstations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingForkliftci, setEditingForkliftci] = useState(null)
  const [formData, setFormData] = useState({
    kullanici_adi: '',
    ad_soyad: '',
    sifre: '',
    workstation_ids: [],
    kart_no: ''
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    fetchForkliftciler()
    fetchWorkstations()
  }, [])

  const fetchForkliftciler = async () => {
    try {
      const response = await apiClient.get('/api/kullanici?rol=forkliftoperator')
      setForkliftciler(response.data)
      setLoading(false)
    } catch (error) {
      console.error('Forkliftçi yükleme hatası:', error)
      setLoading(false)
    }
  }

  const fetchWorkstations = async () => {
    try {
      const response = await apiClient.get('/api/workstation')
      setWorkstations(response.data)
    } catch (error) {
      console.error('İş istasyonu yükleme hatası:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors({})

    // Validasyon
    const newErrors = {}
    if (!formData.kullanici_adi.trim()) {
      newErrors.kullanici_adi = 'Kullanıcı adı gereklidir'
    }
    if (!formData.ad_soyad.trim()) {
      newErrors.ad_soyad = 'Ad soyad gereklidir'
    }
    if (!editingForkliftci && !formData.sifre.trim()) {
      newErrors.sifre = 'Şifre gereklidir'
    }
    if (formData.sifre && formData.sifre.length < 6) {
      newErrors.sifre = 'Şifre en az 6 karakter olmalıdır'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    try {
      if (editingForkliftci) {
        // Güncelleme
        await apiClient.put(`/api/kullanici/${editingForkliftci.id}`, {
          ad_soyad: formData.ad_soyad,
          sifre: formData.sifre || undefined,
          workstation_ids: formData.workstation_ids || [],
          kart_no: formData.kart_no || null
        })
      } else {
        // Yeni ekleme
        await apiClient.post('/api/kullanici', {
          kullanici_adi: formData.kullanici_adi,
          ad_soyad: formData.ad_soyad,
          sifre: formData.sifre,
          workstation_ids: formData.workstation_ids || [],
          kart_no: formData.kart_no || null
        })
      }
      
      setShowModal(false)
      setFormData({ kullanici_adi: '', ad_soyad: '', sifre: '', workstation_ids: [], kart_no: '' })
      setEditingForkliftci(null)
      fetchForkliftciler()
    } catch (error) {
      console.error('Forkliftçi kaydetme hatası:', error)
      alert('Hata: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleEdit = async (forkliftci) => {
    setEditingForkliftci(forkliftci)
    
    // Forkliftçinin iş istasyonlarını getir
    let workstationIds = []
    try {
      const response = await apiClient.get(`/api/forkliftciWorkstation/workstations?forkliftci_id=${forkliftci.id}`)
      workstationIds = response.data.map(ws => ws.id)
    } catch (error) {
      console.error('İş istasyonları yükleme hatası:', error)
      // Fallback: Eğer forkliftci'de workstation_id varsa onu kullan
      if (forkliftci.workstation_id) {
        workstationIds = [forkliftci.workstation_id]
      }
    }
    
    setFormData({
      kullanici_adi: forkliftci.kullanici_adi,
      ad_soyad: forkliftci.ad_soyad,
      sifre: '',
      workstation_ids: workstationIds,
      kart_no: forkliftci.kart_no || ''
    })
    setShowModal(true)
  }

  const handleCikar = async (id, adSoyad) => {
    if (!window.confirm(`${adSoyad} adlı forkliftçiyi sistemden çıkarmak istediğinize emin misiniz?`)) {
      return
    }

    try {
      await apiClient.delete(`/api/kullanici/${id}`)
      fetchForkliftciler()
      alert('Forkliftçi başarıyla çıkarıldı')
    } catch (error) {
      console.error('Forkliftçi çıkarma hatası:', error)
      alert('Hata: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleModalClose = () => {
    setShowModal(false)
    setEditingForkliftci(null)
    setFormData({ kullanici_adi: '', ad_soyad: '', sifre: '', workstation_ids: [], kart_no: '' })
    setErrors({})
  }

  if (loading) {
    return <div className="loading">Yükleniyor...</div>
  }

  return (
    <div className="forkliftci-yonetim-container">
      <div className="forkliftci-yonetim-header">
        <h2>Forkliftçi Yönetimi</h2>
        {hasRole(['admin']) && (
          <button 
            className="btn-primary" 
            onClick={() => {
              setEditingForkliftci(null)
              setFormData({ kullanici_adi: '', ad_soyad: '', sifre: '', workstation_ids: [], kart_no: '' })
              setShowModal(true)
            }}
          >
            + Yeni Forkliftçi Ekle
          </button>
        )}
      </div>

      <div className="forkliftci-listesi">
        {forkliftciler.length === 0 ? (
          <div className="bos-liste">
            <p>Henüz forkliftçi eklenmemiş</p>
          </div>
        ) : (
          <div className="forkliftci-grid">
            {forkliftciler.map((forkliftci) => (
              <div key={forkliftci.id} className="forkliftci-card">
                <div className="forkliftci-card-header">
                  <div>
                    <h3>{forkliftci.ad_soyad}</h3>
                    <span className="kullanici-adi">@{forkliftci.kullanici_adi}</span>
                  </div>
                  <span className="rol-badge">Forkliftçi</span>
                </div>

                <div className="forkliftci-bilgiler">
                  {forkliftci.workstation_adi && (
                    <div className="bilgi-item">
                      <span className="label">İş İstasyonu:</span>
                      <span className="value">{forkliftci.workstation_adi} ({forkliftci.workstation_no})</span>
                    </div>
                  )}
                  {forkliftci.kart_no && (
                    <div className="bilgi-item">
                      <span className="label">Kart No:</span>
                      <span className="value">{forkliftci.kart_no}</span>
                    </div>
                  )}
                  {!forkliftci.workstation_adi && !forkliftci.kart_no && (
                    <div className="bilgi-item">
                      <span className="value">Henüz atanmamış</span>
                    </div>
                  )}
                </div>

                {hasRole(['admin']) && (
                  <div className="forkliftci-actions">
                    <button 
                      className="btn-edit"
                      onClick={() => handleEdit(forkliftci)}
                    >
                      ✏️ Düzenle
                    </button>
                    <button 
                      className="btn-cikar"
                      onClick={() => handleCikar(forkliftci.id, forkliftci.ad_soyad)}
                    >
                      🚪 Çıkar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={handleModalClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editingForkliftci ? 'Forkliftçi Düzenle' : 'Yeni Forkliftçi Ekle'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Kullanıcı Adı {!editingForkliftci && <span className="required">*</span>}</label>
                <input
                  type="text"
                  value={formData.kullanici_adi}
                  onChange={(e) => setFormData({ ...formData, kullanici_adi: e.target.value })}
                  disabled={!!editingForkliftci}
                  required={!editingForkliftci}
                  className={errors.kullanici_adi ? 'error' : ''}
                />
                {errors.kullanici_adi && <span className="error-message">{errors.kullanici_adi}</span>}
              </div>

              <div className="form-group">
                <label>Ad Soyad <span className="required">*</span></label>
                <input
                  type="text"
                  value={formData.ad_soyad}
                  onChange={(e) => setFormData({ ...formData, ad_soyad: e.target.value })}
                  required
                  className={errors.ad_soyad ? 'error' : ''}
                />
                {errors.ad_soyad && <span className="error-message">{errors.ad_soyad}</span>}
              </div>

              <div className="form-group">
                <label>Şifre {!editingForkliftci && <span className="required">*</span>}</label>
                <input
                  type="password"
                  value={formData.sifre}
                  onChange={(e) => setFormData({ ...formData, sifre: e.target.value })}
                  required={!editingForkliftci}
                  placeholder={editingForkliftci ? 'Değiştirmek için yeni şifre girin' : ''}
                  className={errors.sifre ? 'error' : ''}
                />
                {errors.sifre && <span className="error-message">{errors.sifre}</span>}
                {editingForkliftci && (
                  <small>Boş bırakırsanız şifre değişmez</small>
                )}
              </div>

              <div className="form-group">
                <label>İş İstasyonları</label>
                <div className="workstation-checkbox-list" style={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto', 
                  border: '1px solid rgba(51, 65, 85, 0.5)', 
                  borderRadius: '8px', 
                  padding: '12px',
                  background: 'rgba(30, 41, 59, 0.5)'
                }}>
                  {workstations.length === 0 ? (
                    <p style={{ color: '#94a3b8', margin: 0 }}>İş istasyonu bulunamadı</p>
                  ) : (
                    workstations.map(ws => {
                      const isSelected = formData.workstation_ids.includes(ws.id)
                      return (
                        <label 
                          key={ws.id} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            padding: '8px 0',
                            cursor: 'pointer',
                            color: '#ffffff'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ 
                                  ...formData, 
                                  workstation_ids: [...formData.workstation_ids, ws.id] 
                                })
                              } else {
                                setFormData({ 
                                  ...formData, 
                                  workstation_ids: formData.workstation_ids.filter(id => id !== ws.id) 
                                })
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          <span>{ws.workstation_adi} ({ws.workstation_no})</span>
                        </label>
                      )
                    })
                  )}
                </div>
                {formData.workstation_ids.length > 0 && (
                  <small style={{ color: '#94a3b8', marginTop: '8px', display: 'block' }}>
                    {formData.workstation_ids.length} iş istasyonu seçildi
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Kart No</label>
                <input
                  type="text"
                  value={formData.kart_no}
                  onChange={(e) => setFormData({ ...formData, kart_no: e.target.value })}
                  placeholder="Opsiyonel"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingForkliftci ? 'Güncelle' : 'Ekle'}
                </button>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={handleModalClose}
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ForkliftciYonetim

