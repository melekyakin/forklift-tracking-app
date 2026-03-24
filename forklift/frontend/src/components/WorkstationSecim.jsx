import React, { useState, useEffect } from 'react'
import apiClient from '../utils/axiosConfig'
import { useAuth } from '../context/AuthContext'
import './WorkstationSecim.css'

function WorkstationSecim({ onWorkstationChange }) {
  const { user } = useAuth()
  const [workstations, setWorkstations] = useState([])
  const [selectedWorkstations, setSelectedWorkstations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) {
      fetchWorkstations()
      loadSelectedWorkstations()
    }
  }, [user])

  const fetchWorkstations = async () => {
    try {
      const response = await apiClient.get('/api/workstation')
      setWorkstations(response.data)
      setLoading(false)
    } catch (error) {
      console.error('İş istasyonu yükleme hatası:', error)
      setLoading(false)
    }
  }

  const loadSelectedWorkstations = async () => {
    try {
      // Backend'den forkliftçinin seçili workstation'larını getir
      const response = await apiClient.get('/api/forkliftci/workstations')
      const selectedIds = response.data.map(ws => ws.id)
      setSelectedWorkstations(selectedIds)
      
      // Eğer hiç seçili workstation yoksa ve kullanıcının varsayılan workstation'ı varsa onu seç
      if (selectedIds.length === 0 && user?.workstation_id) {
        const defaultSelection = [user.workstation_id]
        setSelectedWorkstations(defaultSelection)
        await saveWorkstations(defaultSelection)
      } else if (onWorkstationChange) {
        onWorkstationChange(selectedIds)
      }
    } catch (error) {
      console.error('Seçili iş istasyonu yükleme hatası:', error)
      // Fallback: localStorage'dan yükle
      const saved = localStorage.getItem(`forklift_workstations_${user?.id}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        setSelectedWorkstations(parsed)
        if (onWorkstationChange) {
          onWorkstationChange(parsed)
        }
      }
    }
  }

  const saveWorkstations = async (workstationIds) => {
    setSaving(true)
    try {
      const response = await apiClient.post('/api/forkliftci/workstations', {
        workstation_ids: workstationIds
      })
      
      setSelectedWorkstations(workstationIds)
      
      // localStorage'a da kaydet (fallback için)
      localStorage.setItem(`forklift_workstations_${user.id}`, JSON.stringify(workstationIds))
      
      if (onWorkstationChange) {
        onWorkstationChange(workstationIds)
      }
      
      return true
    } catch (error) {
      console.error('İş istasyonu kaydetme hatası:', error)
      alert('İş istasyonu seçimleri kaydedilemedi: ' + (error.response?.data?.error || error.message))
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleWorkstationToggle = (workstationId) => {
    setSelectedWorkstations(prev => {
      const newSelection = prev.includes(workstationId)
        ? prev.filter(id => id !== workstationId)
        : [...prev, workstationId]
      
      return newSelection
    })
  }

  const handleSelectAll = () => {
    const allIds = workstations.map(ws => ws.id)
    setSelectedWorkstations(allIds)
  }

  const handleDeselectAll = () => {
    setSelectedWorkstations([])
  }

  const handleSave = async () => {
    const success = await saveWorkstations(selectedWorkstations)
    if (success) {
      setShowModal(false)
    }
  }

  if (loading) {
    return <div className="workstation-secim-loading">Yükleniyor...</div>
  }

  const selectedCount = selectedWorkstations.length
  const selectedNames = workstations
    .filter(ws => selectedWorkstations.includes(ws.id))
    .map(ws => ws.workstation_adi)
    .join(', ')

  return (
    <div className="workstation-secim-container">
      <button 
        className="workstation-secim-button"
        onClick={() => setShowModal(true)}
      >
        <span className="icon"></span>
        <span className="text">
          {selectedCount > 0 
            ? `${selectedCount} İş İstasyonu Seçili` 
            : 'İş İstasyonu Seç'}
        </span>
        {selectedCount > 0 && (
          <span className="badge">{selectedCount}</span>
        )}
      </button>

      {selectedCount > 0 && (
        <div className="selected-workstations-info">
          <strong>Seçili:</strong> {selectedNames || 'Yok'}
        </div>
      )}

      {showModal && (
        <div className="workstation-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="workstation-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="workstation-modal-header">
              <h3>Çalıştığım İş İstasyonlarını Seç</h3>
              <button 
                className="close-button"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="workstation-modal-actions">
              <button className="btn-select-all" onClick={handleSelectAll}>
                Tümünü Seç
              </button>
              <button className="btn-deselect-all" onClick={handleDeselectAll}>
                Tümünü Kaldır
              </button>
            </div>

            <div className="workstation-list">
              {workstations.map(workstation => {
                const isSelected = selectedWorkstations.includes(workstation.id)
                return (
                  <div
                    key={workstation.id}
                    className={`workstation-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleWorkstationToggle(workstation.id)}
                  >
                    <div className="workstation-checkbox">
                      {isSelected ? '✓' : ''}
                    </div>
                    <div className="workstation-info">
                      <div className="workstation-name">{workstation.workstation_adi}</div>
                      <div className="workstation-no">{workstation.workstation_no}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="workstation-modal-footer">
              <button 
                className="btn-save"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkstationSecim

