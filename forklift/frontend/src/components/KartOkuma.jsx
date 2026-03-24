import React, { useState, useEffect } from 'react'
import apiClient from '../utils/axiosConfig'
import { useAuth } from '../context/AuthContext'
import './KartOkuma.css'

function KartOkuma({ onSuccess, onCancel }) {
  const { login: contextLogin } = useAuth()
  const [isReading, setIsReading] = useState(false)
  const [error, setError] = useState('')
  const [nfcSupported, setNfcSupported] = useState(false)
  const [manualCardNo, setManualCardNo] = useState('')

  useEffect(() => {
    // NFC desteği kontrolü
    if ('NDEFReader' in window) {
      setNfcSupported(true)
    } else {
      setNfcSupported(false)
    }
  }, [])

  const handleNFCRead = async () => {
    if (!nfcSupported) {
      // Safari ve diğer tarayıcılar için uyarı
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      
      if (isSafari || isIOS) {
        setError('Safari NFC kart okumayı desteklemiyor. NFC özelliğini kullanmak için Chrome veya Edge kullanın. Alternatif olarak manuel kart numarası girebilirsiniz.')
      } else {
        setError('Tarayıcınız NFC kart okumayı desteklemiyor. Lütfen Chrome veya Edge kullanın. Alternatif olarak manuel kart numarası girebilirsiniz.')
      }
      return
    }

    setIsReading(true)
    setError('')

    try {
      const ndef = new window.NDEFReader()
      
      // NFC okuma event listener
      ndef.addEventListener('reading', async (event) => {
        try {
          let cardNumber = ''
          
          // Serial number'ı al
          if (event.serialNumber) {
            cardNumber = event.serialNumber.trim().toUpperCase()
          }
          
          // Eğer serial number yoksa, mesajı oku
          if (!cardNumber && event.message) {
            const decoder = new TextDecoder()
            for (const record of event.message.records) {
              if (record.data) {
                cardNumber = decoder.decode(record.data).trim().toUpperCase()
                break
              }
            }
          }
          
          if (cardNumber) {
            console.log('NFC\'den okunan kart numarası:', cardNumber)
            await loginWithCard(cardNumber)
          } else {
            setError('Kart okunamadı. Lütfen tekrar deneyin.')
            setIsReading(false)
          }
        } catch (err) {
          console.error('Kart okuma hatası:', err)
          setError('Kart okuma sırasında hata oluştu: ' + err.message)
          setIsReading(false)
        }
      })

      ndef.addEventListener('readingerror', (event) => {
        setError('Kart okuma hatası. Lütfen kartı tekrar yaklaştırın.')
        setIsReading(false)
      })

      // NFC okumayı başlat
      await ndef.scan()

      // 10 saniye sonra timeout
      setTimeout(() => {
        if (isReading) {
          setError('Kart okuma zaman aşımına uğradı. Lütfen tekrar deneyin.')
          setIsReading(false)
        }
      }, 10000)

    } catch (err) {
      console.error('NFC başlatma hatası:', err)
      if (err.name === 'NotAllowedError') {
        setError('NFC izni verilmedi. Lütfen tarayıcı ayarlarından NFC iznini verin.')
      } else if (err.name === 'NotSupportedError') {
        setError('Cihazınız NFC desteklemiyor.')
      } else {
        setError('NFC başlatılamadı: ' + err.message)
      }
      setIsReading(false)
    }
  }

  const handleManualCard = async () => {
    if (!manualCardNo.trim()) {
      setError('Lütfen kart numarasını girin')
      return
    }

    setIsReading(true)
    setError('')
    await loginWithCard(manualCardNo.trim())
  }

  const loginWithCard = async (cardNumber) => {
    try {
      // Kart numarasını temizle (trim ve uppercase)
      const cleanedCardNo = cardNumber.trim().toUpperCase()
      console.log('Kart numarası gönderiliyor:', cleanedCardNo)
      
      const response = await apiClient.post('/api/auth/login-kart', {
        kart_no: cleanedCardNo
      })

      const { token, user } = response.data
      
      // Token'ı kaydet ve AuthContext'i güncelle
      localStorage.setItem('token', token)
      
      // AuthContext'i manuel olarak güncelle (login fonksiyonu şifre gerektirir)
      // Bu yüzden token'ı set edip sayfayı yeniliyoruz
      if (onSuccess) {
        onSuccess({ token, user })
      } else {
        // Sayfayı yenile - AuthContext useEffect token'ı okuyacak
        window.location.reload()
      }
    } catch (error) {
      console.error('Kart ile giriş hatası:', error)
      setError(
        error.response?.data?.error || 
        'Kart ile giriş başarısız. Kart numaranızı kontrol edin veya yöneticinize başvurun.'
      )
      setIsReading(false)
    }
  }

  return (
    <div className="kart-okuma-overlay" onClick={onCancel}>
      <div className="kart-okuma-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kart-okuma-header">
          <h2>🔐 Kart ile Giriş</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>

        <div className="kart-okuma-content">
          {error && <div className="error-message">{error}</div>}

          {nfcSupported ? (
            <div className="nfc-section">
              <div className="nfc-icon">📱</div>
              <p className="nfc-info">
                NFC kartınızı cihazınıza yaklaştırın
              </p>
              <button
                className="nfc-button"
                onClick={handleNFCRead}
                disabled={isReading}
              >
                {isReading ? '⏳ Kart okunuyor...' : '📱 Kartı Oku'}
              </button>
            </div>
          ) : (
            <div className="nfc-not-supported">
              <p>Uyarı: Tarayıcınız NFC kart okumayı desteklemiyor.</p>
              <p>Lütfen Chrome veya Edge kullanın, veya kart numaranızı manuel olarak girin.</p>
            </div>
          )}

          <div className="divider">
            <span>veya</span>
          </div>

          <div className="manual-section">
            <label htmlFor="manual-card">Kart Numarası (Manuel)</label>
            <input
              type="text"
              id="manual-card"
              value={manualCardNo}
              onChange={(e) => setManualCardNo(e.target.value)}
              placeholder="Kart numaranızı girin (örn: CARD001)"
              disabled={isReading}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleManualCard()
                }
              }}
            />
            <button
              className="manual-button"
              onClick={handleManualCard}
              disabled={isReading || !manualCardNo.trim()}
            >
              {isReading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </div>

          <div className="kart-okuma-footer">
            <p className="info-text">
              💡 Not: Kart ile giriş sadece forklift operatörleri için geçerlidir.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default KartOkuma

