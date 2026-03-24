import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import apiClient from '../utils/axiosConfig'
import { API_URL } from '../config'
import './Login.css'

function Login() {
  const [kullanici_adi, setKullanici_adi] = useState('')
  const [sifre, setSifre] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [backendStatus, setBackendStatus] = useState('checking')
  const { login } = useAuth()

  useEffect(() => {
    // Backend bağlantısını kontrol et
    const checkBackend = async () => {
      try {
        const response = await apiClient.get('/api/health', { timeout: 5000 })
        setBackendStatus('connected')
        setError('') // Bağlantı başarılıysa hatayı temizle
      } catch (error) {
        console.error('Backend bağlantı hatası:', error)
        setBackendStatus('disconnected')
        // İlk yüklemede veya bağlantı hatası varsa bilgilendir
        if (!kullanici_adi && !sifre) {
          // İlk yüklemede sessizce durumu göster, hata mesajı gösterme
        }
      }
    }
    checkBackend()
    
    // Her 5 saniyede bir backend bağlantısını kontrol et
    const interval = setInterval(checkBackend, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Backend kontrolü
    if (backendStatus === 'disconnected') {
      setError(`Backend sunucusuna bağlanılamıyor.\n\nSunucu Adresi: ${API_URL}\n\nLütfen backend sunucusunun çalıştığından emin olun.`)
      setLoading(false)
      return
    }

    try {
      const result = await login(kullanici_adi, sifre)
      
      if (!result.success) {
        setError(result.error)
        setLoading(false)
      } else {
        // Login başarılı - AuthContext zaten user'ı set edecek, bu yüzden App.jsx otomatik olarak ana sayfayı gösterecek
        setLoading(false)
        // Form'u temizle
        setKullanici_adi('')
        setSifre('')
      }
    } catch (error) {
      console.error('Login hatası:', error)
      setError('Giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.')
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>Forklift Takip Uygulaması</h1>

          {/* Backend Durumu */}
          <div className="backend-status-container">
            {backendStatus === 'checking' && (
              <div className="backend-status checking">
                <span className="status-dot"></span>
                <span className="status-text">Backend kontrol ediliyor...</span>
              </div>
            )}

            {backendStatus === 'disconnected' && (
              <div className="backend-status disconnected">
                <span className="status-dot"></span>
                <span className="status-text">Backend bağlantısı yok</span>
              </div>
            )}
          </div>

          {/* Backend Bağlantı Hatası Detayları */}
          {backendStatus === 'disconnected' && (
            <div className="backend-error-details">
              <div className="error-title">Backend Sunucusuna Bağlanılamıyor</div>
              <div className="error-info">
                <p><strong>Sunucu Adresi:</strong> {API_URL}</p>
                <p><strong>Çözüm Önerileri:</strong></p>
                <ol>
                  <li>Backend sunucusunun çalıştığından emin olun</li>
                  <li>Sunucu adresinin doğru olduğunu kontrol edin</li>
                  <li>Firewall veya güvenlik duvarı ayarlarını kontrol edin</li>
                  <li>Backend'i başlatmak için: <code>npm run server</code> komutunu çalıştırın</li>
                </ol>
                <button 
                  className="btn-retry-connection" 
                  onClick={() => window.location.reload()}
                >
                  Yeniden Dene
                </button>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="kullanici_adi">Kullanıcı Adı</label>
            <input
              type="text"
              id="kullanici_adi"
              value={kullanici_adi}
              onChange={(e) => setKullanici_adi(e.target.value)}
              required
              autoFocus
              placeholder="Kullanıcı adınızı girin"
            />
          </div>

          <div className="form-group">
            <label htmlFor="sifre">Şifre</label>
            <input
              type="password"
              id="sifre"
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              required
              placeholder="Şifrenizi girin"
            />
          </div>

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <div className="login-info">
          <p><strong>Test Kullanıcıları:</strong></p>
          <ul>
            <li>admin / 123456</li>
            <li>forklift1 / 123456</li>
            <li>hat1 / 123456</li>
            <li>yonetici1 / 123456</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Login

