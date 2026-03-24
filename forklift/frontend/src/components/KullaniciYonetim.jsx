import React, { useState, useEffect } from 'react'
import apiClient from '../utils/axiosConfig'
import { useAuth } from '../context/AuthContext'
import './KullaniciYonetim.css'

function KullaniciYonetim() {
  const { hasRole } = useAuth()
  const [kullanicilar, setKullanicilar] = useState([])
  const [workstations, setWorkstations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingKullanici, setEditingKullanici] = useState(null)
  const [filterRol, setFilterRol] = useState('') // Rol filtresi
  const [formData, setFormData] = useState({
    kullanici_adi: '',
    ad_soyad: '',
    sifre: '',
    rol: 'forkliftoperator',
    workstation_ids: [],
    kart_no: '',
    durum: 'aktif'
  })
  const [errors, setErrors] = useState({})

  const rolLabels = {
    admin: 'Yönetici',
    forkliftoperator: 'Forklift Operatörü',
    hatoperator: 'Hat Operatörü',
    yonetici: 'Yönetici'
  }

  useEffect(() => {
    fetchKullanicilar()
    fetchWorkstations()
  }, [filterRol])

  const fetchKullanicilar = async () => {
    try {
      setLoading(true)
      const url = filterRol ? `/api/kullanici?rol=${filterRol}` : '/api/kullanici'
      const response = await apiClient.get(url)
      setKullanicilar(response.data)
      setLoading(false)
    } catch (error) {
      console.error('Kullanıcı yükleme hatası:', error)
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
    if (!editingKullanici && !formData.sifre.trim()) {
      newErrors.sifre = 'Şifre gereklidir'
    }
    if (formData.sifre && formData.sifre.length < 6) {
      newErrors.sifre = 'Şifre en az 6 karakter olmalıdır'
    }
    if (!formData.rol) {
      newErrors.rol = 'Rol seçilmelidir'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    try {
      if (editingKullanici) {
        // Güncelleme
        await apiClient.put(`/api/kullanici/${editingKullanici.id}`, {
          ad_soyad: formData.ad_soyad,
          sifre: formData.sifre || undefined,
          rol: formData.rol,
          workstation_ids: formData.workstation_ids || [],
          kart_no: formData.kart_no || null,
          durum: formData.durum
        })
      } else {
        // Yeni ekleme
        await apiClient.post('/api/kullanici', {
          kullanici_adi: formData.kullanici_adi,
          ad_soyad: formData.ad_soyad,
          sifre: formData.sifre,
          rol: formData.rol,
          workstation_ids: formData.workstation_ids || [],
          kart_no: formData.kart_no || null
        })
      }
      
      setShowModal(false)
      setFormData({ kullanici_adi: '', ad_soyad: '', sifre: '', rol: 'forkliftoperator', workstation_ids: [], kart_no: '', durum: 'aktif' })
      setEditingKullanici(null)
      fetchKullanicilar()
    } catch (error) {
      console.error('Kullanıcı kaydetme hatası:', error)
      alert('Hata: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleEdit = async (kullanici) => {
    setEditingKullanici(kullanici)
    
    // Kullanıcının iş istasyonlarını getir (sadece forkliftçi için)
    let workstationIds = []
    if (kullanici.rol === 'forkliftoperator') {
      try {
        const response = await apiClient.get(`/api/forkliftciWorkstation/workstations?forkliftci_id=${kullanici.id}`)
        workstationIds = response.data.map(ws => ws.id)
      } catch (error) {
        console.error('İş istasyonları yükleme hatası:', error)
        // Fallback: Eğer kullanıcıda workstation_id varsa onu kullan
        if (kullanici.workstation_id) {
          workstationIds = [kullanici.workstation_id]
        }
      }
    } else if (kullanici.workstation_id) {
      workstationIds = [kullanici.workstation_id]
    }
    
    setFormData({
      kullanici_adi: kullanici.kullanici_adi,
      ad_soyad: kullanici.ad_soyad,
      sifre: '',
      rol: kullanici.rol,
      workstation_ids: workstationIds,
      kart_no: kullanici.kart_no || '',
      durum: kullanici.durum || 'aktif'
    })
    setShowModal(true)
  }


  const handleModalClose = () => {
    setShowModal(false)
    setEditingKullanici(null)
    setFormData({ kullanici_adi: '', ad_soyad: '', sifre: '', rol: 'forkliftoperator', workstation_ids: [], kart_no: '', durum: 'aktif' })
    setErrors({})
  }

  if (loading) {
    return <div className="loading">Yükleniyor...</div>
  }

  return (
    <div className="kullanici-yonetim-container">
      <div className="kullanici-yonetim-header">
        <h2>Kullanıcı Yönetimi</h2>
        <div className="header-actions">
          <select
            className="rol-filter"
            value={filterRol}
            onChange={(e) => setFilterRol(e.target.value)}
          >
            <option value="">Tüm Roller</option>
            <option value="admin">Yönetici</option>
            <option value="forkliftoperator">Forklift Operatörü</option>
            <option value="hatoperator">Hat Operatörü</option>
            <option value="yonetici">Yönetici</option>
          </select>
          {hasRole(['admin']) && (
            <button 
              className="btn-primary" 
              onClick={() => {
              setEditingKullanici(null)
              setFormData({ kullanici_adi: '', ad_soyad: '', sifre: '', rol: 'forkliftoperator', workstation_ids: [], kart_no: '', durum: 'aktif' })
              setShowModal(true)
              }}
            >
              + Yeni Kullanıcı Ekle
            </button>
          )}
        </div>
      </div>

      <div className="kullanici-listesi">
        {kullanicilar.length === 0 ? (
          <div className="bos-liste">
            <p>Henüz kullanıcı eklenmemiş</p>
          </div>
        ) : (
          <div className="kullanici-grid">
            {kullanicilar.map((kullanici) => (
              <div key={kullanici.id} className="kullanici-card">
                <div className="kullanici-card-header">
                  <div>
                    <h3>{kullanici.ad_soyad}</h3>
                    <span className="kullanici-adi">@{kullanici.kullanici_adi}</span>
                  </div>
                  <span className={`rol-badge rol-${kullanici.rol}`}>
                    {rolLabels[kullanici.rol] || kullanici.rol}
                  </span>
                </div>

                <div className="kullanici-bilgiler">
                  {(kullanici.rol === 'forkliftoperator' || kullanici.rol === 'hatoperator') && kullanici.workstation_adi && (
                    <div className="bilgi-item">
                      <span className="label">İş İstasyonu:</span>
                      <span className="value">{kullanici.workstation_adi} ({kullanici.workstation_no})</span>
                    </div>
                  )}
                  {kullanici.kart_no && (
                    <div className="bilgi-item">
                      <span className="label">Kart No:</span>
                      <span className="value">{kullanici.kart_no}</span>
                    </div>
                  )}
                  <div className="bilgi-item">
                    <span className="label">Durum:</span>
                    <span className={`value durum-${kullanici.durum}`}>
                      {kullanici.durum === 'aktif' ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                </div>

                {hasRole(['admin']) && (
                  <div className="kullanici-actions">
                    <button 
                      className="btn-edit"
                      onClick={() => handleEdit(kullanici)}
                    >
                      Düzenle
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
            <h3>{editingKullanici ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Ekle'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Kullanıcı Adı {!editingKullanici && <span className="required">*</span>}</label>
                <input
                  type="text"
                  value={formData.kullanici_adi}
                  onChange={(e) => setFormData({ ...formData, kullanici_adi: e.target.value })}
                  disabled={!!editingKullanici}
                  required={!editingKullanici}
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
                <label>Rol <span className="required">*</span></label>
                <select
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value, workstation_ids: [] })}
                  required
                  className={errors.rol ? 'error' : ''}
                >
                  <option value="forkliftoperator">Forklift Operatörü</option>
                  <option value="hatoperator">Hat Operatörü</option>
                  <option value="yonetici">Yönetici</option>
                  <option value="admin">Admin</option>
                </select>
                {errors.rol && <span className="error-message">{errors.rol}</span>}
              </div>

              <div className="form-group">
                <label>Şifre {!editingKullanici && <span className="required">*</span>}</label>
                <input
                  type="password"
                  value={formData.sifre}
                  onChange={(e) => setFormData({ ...formData, sifre: e.target.value })}
                  required={!editingKullanici}
                  placeholder={editingKullanici ? 'Değiştirmek için yeni şifre girin' : ''}
                  className={errors.sifre ? 'error' : ''}
                />
                {errors.sifre && <span className="error-message">{errors.sifre}</span>}
                {editingKullanici && (
                  <small>Boş bırakırsanız şifre değişmez</small>
                )}
              </div>

              {(formData.rol === 'forkliftoperator' || formData.rol === 'hatoperator') && (
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
              )}

              <div className="form-group">
                <label>Kart No</label>
                <input
                  type="text"
                  value={formData.kart_no}
                  onChange={(e) => setFormData({ ...formData, kart_no: e.target.value })}
                  placeholder="Opsiyonel"
                />
              </div>

              {editingKullanici && (
                <div className="form-group">
                  <label>Durum <span className="required">*</span></label>
                  <select
                    value={formData.durum}
                    onChange={(e) => setFormData({ ...formData, durum: e.target.value })}
                    required
                    className={errors.durum ? 'error' : ''}
                  >
                    <option value="aktif">Aktif</option>
                    <option value="pasif">Pasif</option>
                  </select>
                  {errors.durum && <span className="error-message">{errors.durum}</span>}
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingKullanici ? 'Güncelle' : 'Ekle'}
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

export default KullaniciYonetim

