import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NavigationProvider } from './context/NavigationContext'
import Login from './components/Login'
import ForkliftEkrani from './components/ForkliftEkrani'
import HatOperatorEkrani from './components/HatOperatorEkrani'
import ForkliftciTakip from './components/ForkliftciTakip'
import OtomatikKonumTakip from './components/OtomatikKonumTakip'
import KullaniciYonetim from './components/KullaniciYonetim'
import ForkliftDetectionSystem from './components/ForkliftDetectionSystem'
import FusionTest from './components/FusionTest'
import apiClient from './utils/axiosConfig'
import { API_URL } from './config'
import './App.css'

function AppContent() {
  const { user, logout, hasRole, loading } = useAuth()
  // Forkliftçi için varsayılan tab 'forklift', diğerleri için 'takip'
  const [activeTab, setActiveTab] = useState(() => {
    // user henüz yüklenmediyse 'takip' döndür
    return 'takip'
  })
  const [bildirimSayisi, setBildirimSayisi] = useState(0)
  const [initialLoad, setInitialLoad] = useState(true)

  useEffect(() => {
    if (!user) return

    // Sadece ilk yüklemede forkliftçi için forklift ekranını göster
    if (initialLoad && user.rol === 'forkliftoperator') {
      setActiveTab('forklift')
      setInitialLoad(false)
    } else if (initialLoad) {
      setInitialLoad(false)
    }

    // Bildirim sayısını kontrol et (admin ve forklift operatörleri için)
    if (user.rol === 'admin' || user.rol === 'forkliftoperator') {
      const kontrolEt = async () => {
        try {
          const response = await apiClient.get('/api/forklift/bildirimler/bekleyen')
          setBildirimSayisi(response.data.length)
        } catch (error) {
          console.error('Bildirim kontrolü hatası:', error)
        }
      }

      kontrolEt()
      const interval = setInterval(kontrolEt, 5000)
      return () => clearInterval(interval)
    }
  }, [user, activeTab])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Yükleniyor...</p>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  const getRoleLabel = (rol) => {
    const labels = {
      admin: 'Admin',
      forkliftoperator: 'Forklift Operatörü',
      hatoperator: 'Hat Operatörü',
      yonetici: 'Yönetici'
    }
    return labels[rol] || rol
  }

  return (
    <NavigationProvider setActiveTab={setActiveTab}>
      <div className="app">
        <header className="app-header">
          <div className="header-top">
            <div className="header-brand">
              <div className="brand-logo"></div>
              <h1>Forklift Kasa Takip Sistemi</h1>
            </div>
            <div className="user-info">
              <span className="user-name">{user.ad_soyad}</span>
              <span className="user-role">{getRoleLabel(user.rol)}</span>
              <button className="logout-button" onClick={logout}>
                Çıkış
              </button>
            </div>
          </div>
          <nav className="nav-tabs">
            {hasRole('admin') && (
              <button
                className={`nav-tab ${activeTab === 'hat-operator' ? 'active' : ''}`}
                onClick={() => setActiveTab('hat-operator')}
              >
                İş İstasyonları
              </button>
            )}
            {(hasRole('admin') || hasRole('forkliftoperator')) && (
              <button
                className={`nav-tab ${activeTab === 'forklift' ? 'active' : ''}`}
                onClick={() => setActiveTab('forklift')}
              >
                Forklift Ekranı
                {bildirimSayisi > 0 && (
                  <span className="badge">{bildirimSayisi}</span>
                )}
              </button>
            )}
            {hasRole(['admin']) && (
              <button
                className={`nav-tab ${activeTab === 'kullanici-yonetim' ? 'active' : ''}`}
                onClick={() => setActiveTab('kullanici-yonetim')}
              >
                Kullanıcı Yönetimi
              </button>
            )}
            {(hasRole('admin') || hasRole('forkliftoperator')) && (
              <button
                className={`nav-tab ${activeTab === 'detection' ? 'active' : ''}`}
                onClick={() => setActiveTab('detection')}
              >
                Gelişmiş Tespit
              </button>
            )}
            {(hasRole(['admin', 'yonetici']) || hasRole('forkliftoperator')) && (
              <button
                className={`nav-tab ${activeTab === 'takip' ? 'active' : ''}`}
                onClick={() => setActiveTab('takip')}
              >
                Forkliftçi Takip
              </button>
            )}
            {(hasRole('admin') || hasRole('forkliftoperator')) && (
              <button
                className={`nav-tab ${activeTab === 'otomatik-konum' ? 'active' : ''}`}
                onClick={() => setActiveTab('otomatik-konum')}
              >
                Otomatik Takip
              </button>
            )}
            {(hasRole(['admin', 'yonetici'])) && (
              <button
                className={`nav-tab ${activeTab === 'fusion-test' ? 'active' : ''}`}
                onClick={() => setActiveTab('fusion-test')}
              >
                Fusion Test
              </button>
            )}
          </nav>
        </header>

        <main className="app-main">
          {activeTab === 'hat-operator' && <HatOperatorEkrani />}
          {activeTab === 'forklift' && <ForkliftEkrani />}
          {activeTab === 'kullanici-yonetim' && <KullaniciYonetim />}
          {activeTab === 'detection' && <ForkliftDetectionSystem />}
          {activeTab === 'takip' && <ForkliftciTakip />}
          {activeTab === 'otomatik-konum' && <OtomatikKonumTakip />}
          {activeTab === 'fusion-test' && <FusionTest />}
        </main>
      </div>
    </NavigationProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
