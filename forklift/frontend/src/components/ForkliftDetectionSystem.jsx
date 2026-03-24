import React, { useState, useRef } from 'react'
import { Camera, Upload, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import apiClient from '../utils/axiosConfig'
import './ForkliftDetectionSystem.css'

const ForkliftDetectionSystem = () => {
  const [uploadedImage, setUploadedImage] = useState(null)
  const [detectionResult, setDetectionResult] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  // Backend API kullanarak gelişmiş tespit
  const detectForkStatus = async (imageFile) => {
    try {
      const formData = new FormData()
      formData.append('gorsel', imageFile)

      const response = await apiClient.post('/api/forklift/gorsel/yukle-ve-analiz-et', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      const result = response.data
      const analizSonucu = result.analiz_sonucu || {}

      // Görseli yükle ve bounding box'ları çiz
      const img = new window.Image()
      return new Promise((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)

          // Forklift bounding box (tüm görsel)
          ctx.strokeStyle = '#3b82f6'
          ctx.lineWidth = 3
          ctx.strokeRect(0, 0, canvas.width, canvas.height)
          ctx.fillStyle = '#3b82f6'
          ctx.font = 'bold 20px Arial'
          ctx.fillText(`Forklift (${Math.round((analizSonucu.forkliftScore || 0) * 100)}%)`, 10, 30)

          // Çatal bölgesi (fork region)
          if (result.cata_tespit?.forkRegion) {
            const forkRegion = result.cata_tespit.forkRegion
            // Scale coordinates if image was resized
            const scaleX = canvas.width / 600 // Backend resizes to 600x600
            const scaleY = canvas.height / 600
            
            const forkX = forkRegion.x * scaleX
            const forkY = forkRegion.y * scaleY
            const forkW = forkRegion.width * scaleX
            const forkH = forkRegion.height * scaleY

            ctx.strokeStyle = '#f59e0b'
            ctx.lineWidth = 3
            ctx.strokeRect(forkX, forkY, forkW, forkH)
            ctx.fillStyle = '#f59e0b'
            ctx.font = 'bold 18px Arial'
            ctx.fillText(
              `Çatal (${Math.round((analizSonucu.forkDetectionScore || 0) * 100)}%)`,
              forkX,
              forkY - 5
            )
          }

          // Yük bölgesi (load region)
          if (result.yuk_tespit?.loadRegion && result.yuk_tespit?.hasLoad) {
            const loadRegion = result.yuk_tespit.loadRegion
            const scaleX = canvas.width / 600
            const scaleY = canvas.height / 600
            
            const loadX = loadRegion.x * scaleX
            const loadY = loadRegion.y * scaleY
            const loadW = loadRegion.width * scaleX
            const loadH = loadRegion.height * scaleY

            ctx.strokeStyle = result.durum === 'dolu' ? '#10b981' : '#ef4444'
            ctx.lineWidth = 4
            ctx.strokeRect(loadX, loadY, loadW, loadH)
            ctx.fillStyle = result.durum === 'dolu' ? '#10b981' : '#ef4444'
            ctx.font = 'bold 22px Arial'
            const status = result.durum === 'dolu' ? 'DOLU' : 'BOŞ'
            ctx.fillText(
              `${status} (${Math.round((result.guven_skoru || 0) * 100)}%)`,
              loadX,
              loadY - 10
            )
          }

          resolve({
            status: result.durum === 'dolu' ? 'DOLU' : 'BOŞ',
            isLoaded: result.durum === 'dolu',
            confidence: result.guven_skoru || 0,
            forkliftDetection: result.forklift_tespit,
            forkDetection: result.cata_tespit,
            loadDetection: result.yuk_tespit,
            metrics: {
              forkliftScore: analizSonucu.forkliftScore || 0,
              forkDetectionScore: analizSonucu.forkDetectionScore || 0,
              loadDetectionScore: analizSonucu.loadDetectionScore || 0,
              forkliftDetails: analizSonucu.forkliftDetails || {},
              forkDetails: analizSonucu.forkDetails || {},
              loadDetails: analizSonucu.loadDetails || {}
            },
            processedImage: canvas.toDataURL(),
            boundingBoxes: {
              forklift: { x: 0, y: 0, width: canvas.width, height: canvas.height },
              fork: result.cata_tespit?.forkRegion,
              load: result.yuk_tespit?.loadRegion
            }
          })
        }
        img.onerror = () => reject(new Error('Görsel yüklenemedi'))
        img.src = URL.createObjectURL(imageFile)
      })
    } catch (error) {
      console.error('Tespit hatası:', error)
      throw error
    }
  }

  // Görsel yükleme
  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (event) => {
        setUploadedImage(event.target.result)
        setIsProcessing(true)
        setError(null)
        
        try {
          const result = await detectForkStatus(file)
          setDetectionResult(result)
        } catch (error) {
          console.error('Tespit hatası:', error)
          if (error.response?.status === 404) {
            setError('Backend endpoint bulunamadı. Lütfen backend sunucusunun çalıştığından ve route\'un doğru yapılandırıldığından emin olun.')
          } else if (error.response?.status === 401) {
            setError('Giriş yapmanız gerekiyor. Lütfen önce giriş yapın.')
          } else if (error.response?.status === 403) {
            setError('Bu işlem için yetkiniz yok.')
          } else {
            setError(error.response?.data?.error || error.message || 'Görsel analiz edilemedi')
          }
        } finally {
          setIsProcessing(false)
        }
      }
      reader.readAsDataURL(file)
    }
  }


  return (
    <div className="forklift-detection-system">
      <div className="detection-container">
        {/* Header */}
        <div className="detection-header">
          <h1 className="detection-title">
            🚜 Forklift Tespit Sistemi
          </h1>
          <p className="detection-subtitle">
            Klasik Görüntü İşleme ile Dolu / Boş Forklift Tespiti
          </p>
        </div>

        {/* Tespit */}
        <div className="detection-content">
            <div className="detection-card">
              <h2 className="detection-card-title">
                <Camera className="icon-blue" />
                Gerçek Zamanlı Tespit
              </h2>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden-input"
              />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-upload"
              >
                <Upload size={24} />
                Forklift Görseli Yükle
              </button>
              
              {isProcessing && (
                <div className="processing-indicator">
                  <Loader className="spinner-icon" size={32} />
                  <p>Görsel analiz ediliyor...</p>
                  <p className="processing-steps">
                    <span>1. Forklift tespiti</span> → 
                    <span>2. Çatal tespiti</span> → 
                    <span>3. Yük analizi</span>
                  </p>
                </div>
              )}

              {error && !isProcessing && (
                <div className="error-message">
                  <AlertCircle size={24} />
                  <p>{error}</p>
                </div>
              )}
              
              {detectionResult && !isProcessing && (
                <div className="detection-results">
                  <div className="result-section">
                    <h3>İşlenmiş Görsel</h3>
                    <img
                      src={detectionResult.processedImage}
                      alt="Processed"
                      className="processed-image"
                    />
                  </div>
                  
                  <div className="result-section">
                    <h3>Tespit Sonucu</h3>
                    
                    <div className={`result-card ${detectionResult.isLoaded ? 'loaded' : 'empty'}`}>
                      <div className="result-header">
                        {detectionResult.isLoaded ? (
                          <CheckCircle className="icon-success" size={32} />
                        ) : (
                          <AlertCircle className="icon-error" size={32} />
                        )}
                        <div>
                          <div className="result-status">{detectionResult.status}</div>
                          <div className="result-confidence">
                            Güven: {(detectionResult.confidence * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="metrics-card">
                      <h4>Detaylı Analiz Sonuçları</h4>
                      
                      <div className="detection-steps">
                        <div className="step-item">
                          <div className="step-header">
                            <span className="step-number">1</span>
                            <span className="step-title">Forklift Tespiti</span>
                            <span className={`step-status ${detectionResult.forkliftDetection?.isForklift ? 'success' : 'error'}`}>
                              {detectionResult.forkliftDetection?.isForklift ? '✓ Tespit Edildi' : '✗ Tespit Edilemedi'}
                            </span>
                          </div>
                          <div className="step-details">
                            <span>Güven Skoru: %{Math.round((detectionResult.metrics.forkliftScore || 0) * 100)}</span>
                          </div>
                        </div>

                        <div className="step-item">
                          <div className="step-header">
                            <span className="step-number">2</span>
                            <span className="step-title">Çatal Tespiti</span>
                            <span className={`step-status ${detectionResult.forkDetection?.forksDetected ? 'success' : 'error'}`}>
                              {detectionResult.forkDetection?.forksDetected ? '✓ Tespit Edildi' : '✗ Tespit Edilemedi'}
                            </span>
                          </div>
                          <div className="step-details">
                            <span>Güven Skoru: %{Math.round((detectionResult.metrics.forkDetectionScore || 0) * 100)}</span>
                            {detectionResult.boundingBoxes?.fork && (
                              <span>Bölge: {Math.round(detectionResult.boundingBoxes.fork.x)}, {Math.round(detectionResult.boundingBoxes.fork.y)}</span>
                            )}
                          </div>
                        </div>

                        <div className="step-item">
                          <div className="step-header">
                            <span className="step-number">3</span>
                            <span className="step-title">Yük Analizi</span>
                            <span className={`step-status ${detectionResult.loadDetection?.hasLoad ? 'success' : 'info'}`}>
                              {detectionResult.loadDetection?.hasLoad ? '✓ Yük Tespit Edildi' : '○ Yük Yok'}
                            </span>
                          </div>
                          <div className="step-details">
                            <span>Güven Skoru: %{Math.round((detectionResult.metrics.loadDetectionScore || 0) * 100)}</span>
                            {detectionResult.boundingBoxes?.load && (
                              <span>Bölge: {Math.round(detectionResult.boundingBoxes.load.x)}, {Math.round(detectionResult.boundingBoxes.load.y)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="metrics-list">
                        <div className="metric-section">
                          <h5>Forklift Detayları</h5>
                          {detectionResult.metrics.forkliftDetails && (
                            <div className="metric-item">
                              <span className="metric-label">Aspect Ratio:</span>
                              <span className="metric-value">{detectionResult.metrics.forkliftDetails.aspectRatio?.toFixed(2)}</span>
                            </div>
                          )}
                        </div>

                        <div className="metric-section">
                          <h5>Çatal Detayları</h5>
                          {detectionResult.metrics.forkDetails && (
                            <>
                              <div className="metric-item">
                                <span className="metric-label">Dikey Kenar Oranı:</span>
                                <span className="metric-value">{detectionResult.metrics.forkDetails.verticalEdgeRatio?.toFixed(3)}</span>
                              </div>
                              <div className="metric-item">
                                <span className="metric-label">Ortalama Kontrast:</span>
                                <span className="metric-value">{detectionResult.metrics.forkDetails.avgContrast?.toFixed(1)}</span>
                              </div>
                              <div className="metric-item">
                                <span className="metric-label">Varyans:</span>
                                <span className="metric-value">{detectionResult.metrics.forkDetails.variance?.toFixed(0)}</span>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="metric-section">
                          <h5>Yük Detayları</h5>
                          {detectionResult.metrics.loadDetails && (
                            <>
                              <div className="metric-item">
                                <span className="metric-label">Parlaklık Farkı:</span>
                                <span className="metric-value">{detectionResult.metrics.loadDetails.brightnessDifference?.toFixed(1)}</span>
                              </div>
                              <div className="metric-item">
                                <span className="metric-label">Karanlık Piksel Oranı:</span>
                                <span className="metric-value">{(detectionResult.metrics.loadDetails.darkRatio * 100)?.toFixed(1)}%</span>
                              </div>
                              <div className="metric-item">
                                <span className="metric-label">Varyans:</span>
                                <span className="metric-value">{detectionResult.metrics.loadDetails.variance?.toFixed(0)}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
  )
}

export default ForkliftDetectionSystem

