import React, { useState, useEffect } from 'react'
import apiClient from '../utils/axiosConfig'
import { useAuth } from '../context/AuthContext'
import {
  PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer
} from 'recharts'
import { format, subDays } from 'date-fns'
import './AnalyticsDashboard.css'

function AnalyticsDashboard() {
  const { hasRole } = useAuth()
  const [loading, setLoading] = useState(true)
  const [selectedWorkstation, setSelectedWorkstation] = useState(null)
  const [workstations, setWorkstations] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [predictions, setPredictions] = useState([])
  const [anomalies, setAnomalies] = useState([])
  const [suggestions, setSuggestions] = useState([])

  const COLORS = ['#0066CC', '#28A745', '#FFC107', '#DC3545', '#17A2B8']

  useEffect(() => {
    fetchWorkstations()
  }, [])

  useEffect(() => {
    if (selectedWorkstation) {
      fetchAnalytics()
      fetchPredictions()
      fetchAnomalies()
      fetchSuggestions()
    }
  }, [selectedWorkstation])

  const fetchWorkstations = async () => {
    try {
      const response = await apiClient.get('/api/workstation')
      setWorkstations(response.data)
      if (response.data.length > 0) {
        setSelectedWorkstation(response.data[0].id)
      }
    } catch (error) {
      console.error('Workstation yükleme hatası:', error)
    }
  }

  const fetchAnalytics = async () => {
    try {
      const response = await apiClient.post('/api/workstation/istatistikler', {
        workstation_ids: [selectedWorkstation]
      })
      setAnalytics(response.data[0] || {})
      setLoading(false)
    } catch (error) {
      console.error('Analytics yükleme hatası:', error)
      setLoading(false)
    }
  }

  const fetchPredictions = async () => {
    try {
      // Kasa listesini al
      const kasalarResponse = await apiClient.get(`/api/kasa?workstation_id=${selectedWorkstation}`)
      const kasalar = kasalarResponse.data

      // Her kasa için tahmin al
      const tahminler = await Promise.all(
        kasalar.slice(0, 5).map(async (kasa) => {
          try {
            const tahmin = await apiClient.get(`/api/ai/tahmin/kasa/${kasa.id}?saat=2`)
            return {
              kasa_no: kasa.kasa_no,
              mevcut: kasa.mevcut_adet,
              tahmin: tahmin.data.tahmin_adet,
              doluluk: tahmin.data.tahmin_doluluk,
              guven: tahmin.data.guven_skoru
            }
          } catch (err) {
            return null
          }
        })
      )

      setPredictions(tahminler.filter(p => p !== null))
    } catch (error) {
      console.error('Tahmin yükleme hatası:', error)
    }
  }

  const fetchAnomalies = async () => {
    try {
      const response = await apiClient.get(`/api/ai/anomali/workstation/${selectedWorkstation}`)
      setAnomalies(response.data)
    } catch (error) {
      console.error('Anomali yükleme hatası:', error)
    }
  }

  const fetchSuggestions = async () => {
    try {
      const response = await apiClient.get(`/api/ai/optimizasyon/workstation/${selectedWorkstation}`)
      setSuggestions(response.data)
    } catch (error) {
      console.error('Öneri yükleme hatası:', error)
    }
  }

  if (loading) {
    return <div className="loading">Yükleniyor...</div>
  }

  const dolulukData = analytics.toplam_kapasite > 0 ? [
    { name: 'Dolu', value: analytics.toplam_adet || 0 },
    { name: 'Boş', value: (analytics.toplam_kapasite || 0) - (analytics.toplam_adet || 0) }
  ] : []

  return (
    <div className="analytics-dashboard">
      <div className="dashboard-header">
        <h2>AI Destekli Analytics Dashboard</h2>
        {hasRole(['admin', 'yonetici']) && workstations.length > 0 && (
          <select
            className="workstation-select"
            value={selectedWorkstation || ''}
            onChange={(e) => setSelectedWorkstation(parseInt(e.target.value))}
          >
            {workstations.map(ws => (
              <option key={ws.id} value={ws.id}>
                {ws.workstation_adi} 
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="dashboard-grid">
        {/* İstatistik Kartları */}
        <div className="stat-cards">
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-info">
              <div className="stat-label">Doluluk Oranı</div>
              <div className="stat-value">
                {analytics.toplam_kapasite > 0
                  ? `${((analytics.toplam_adet / analytics.toplam_kapasite) * 100).toFixed(1)}%`
                  : '0%'}
              </div>
            </div>
          </div>
        </div>

        {/* Grafikler */}
        <div className="charts-section">
          <div className="chart-card">
            <h3>Doluluk Dağılımı</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dolulukData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dolulukData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Tahminleri */}
        {predictions.length > 0 && (
          <div className="predictions-section">
            <h3>🤖 AI Tahminleri (2 Saat Sonra)</h3>
            <div className="predictions-grid">
              {predictions.map((pred, index) => (
                <div key={index} className="prediction-card">
                  <div className="prediction-header">
                    <span className="kasa-name">{pred.kasa_no}</span>
                    <span className={`guven-badge ${pred.guven > 0.7 ? 'yuksek' : pred.guven > 0.5 ? 'orta' : 'dusuk'}`}>
                      %{(pred.guven * 100).toFixed(0)} Güven
                    </span>
                  </div>
                  <div className="prediction-body">
                    <div className="prediction-item">
                      <span className="label">Mevcut:</span>
                      <span className="value">{pred.mevcut}</span>
                    </div>
                    <div className="prediction-item">
                      <span className="label">Tahmin:</span>
                      <span className="value prediction-value">{pred.tahmin}</span>
                    </div>
                    <div className="prediction-item">
                      <span className="label">Tahmin Doluluk:</span>
                      <span className="value">%{pred.doluluk.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Anomaliler */}
        {anomalies.length > 0 && (
          <div className="anomalies-section">
            <h3>⚠️ Tespit Edilen Anomaliler</h3>
            <div className="anomalies-list">
              {anomalies.map((anomali, index) => (
                <div key={index} className={`anomaly-card ${anomali.onem}`}>
                  <div className="anomaly-header">
                    <span className="anomaly-type">{anomali.tip}</span>
                    <span className={`anomaly-priority ${anomali.onem}`}>
                      {anomali.onem === 'yuksek' ? '🔴 Yüksek' : anomali.onem === 'orta' ? '🟡 Orta' : '🟢 Düşük'}
                    </span>
                  </div>
                  <div className="anomaly-message">{anomali.mesaj}</div>
                  <div className="anomaly-details">
                    <span>Kasa: {anomali.kasa_no}</span>
                    <span>Değer: {anomali.deger}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Optimizasyon Önerileri */}
        {suggestions.length > 0 && (
          <div className="suggestions-section">
            <h3>💡 AI Optimizasyon Önerileri</h3>
            <div className="suggestions-list">
              {suggestions.map((suggestion, index) => (
                <div key={index} className={`suggestion-card ${suggestion.onem}`}>
                  <div className="suggestion-header">
                    <h4>{suggestion.baslik}</h4>
                    <span className={`suggestion-priority ${suggestion.onem}`}>
                      {suggestion.onem === 'yuksek' ? '🔴 Yüksek Öncelik' : suggestion.onem === 'orta' ? '🟡 Orta Öncelik' : '🟢 Düşük Öncelik'}
                    </span>
                  </div>
                  <div className="suggestion-body">
                    <p>{suggestion.aciklama}</p>
                    {suggestion.kasalar && suggestion.kasalar.length > 0 && (
                      <div className="suggestion-kasalar">
                        <strong>Etkilenen Kasalar:</strong> {suggestion.kasalar.join(', ')}
                      </div>
                    )}
                    <div className="suggestion-action">
                      <strong>Önerilen Aksiyon:</strong> {suggestion.aksiyon}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AnalyticsDashboard

