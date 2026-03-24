/**
 * YOLO Detection Service Client
 * Python YOLO servisine istek gönderen Node.js client
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const YOLO_SERVICE_URL = process.env.YOLO_SERVICE_URL || 'http://localhost:5006';

class YOLOService {
  /**
   * YOLO servisinin çalışıp çalışmadığını kontrol et
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${YOLO_SERVICE_URL}/health`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.warn('YOLO servisi kullanılamıyor, klasik CV kullanılacak:', error.message);
      return null;
    }
  }

  /**
   * Görseli YOLO servisine gönder ve tespit yap
   */
  async detectForklift(imagePath) {
    try {
      // YOLO servisinin çalışıp çalışmadığını kontrol et
      const health = await this.checkHealth();
      if (!health || !health.model_loaded) {
        console.log('YOLO modeli yüklü değil, klasik CV kullanılacak');
        return null;
      }

      // FormData oluştur
      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));

      // YOLO servisine istek gönder
      const response = await axios.post(`${YOLO_SERVICE_URL}/detect`, formData, {
        headers: formData.getHeaders(),
        timeout: 30000 // 30 saniye
      });

      return response.data;
    } catch (error) {
      console.error('YOLO tespit hatası:', error.message);
      // Hata durumunda null döndür, klasik CV kullanılacak
      return null;
    }
  }

  /**
   * YOLO sonuçlarını backend formatına dönüştür
   */
  formatYOLOResult(yoloResult) {
    if (!yoloResult) return null;

    const detections = yoloResult.detections || {};
    
    return {
      durum: yoloResult.status === 'loaded' ? 'dolu' : 'bos',
      guven_skoru: yoloResult.confidence || 0,
      forklift_tespit: {
        isForklift: yoloResult.forklift_detected || false,
        forkliftScore: detections.forklift?.[0]?.confidence || 0,
        details: {
          bbox: detections.forklift?.[0]?.bbox || []
        }
      },
      cata_tespit: {
        forksDetected: yoloResult.fork_detected || false,
        forkDetectionScore: detections.fork?.[0]?.confidence || 0,
        forkRegion: detections.fork?.[0]?.bbox ? {
          x: detections.fork[0].bbox[0],
          y: detections.fork[0].bbox[1],
          width: detections.fork[0].bbox[2] - detections.fork[0].bbox[0],
          height: detections.fork[0].bbox[3] - detections.fork[0].bbox[1]
        } : null,
        details: {
          bbox: detections.fork?.[0]?.bbox || []
        }
      },
      yuk_tespit: {
        hasLoad: yoloResult.load_detected || false,
        loadDetectionScore: detections.load?.[0]?.confidence || 0,
        loadRegion: detections.load?.[0]?.bbox ? {
          x: detections.load[0].bbox[0],
          y: detections.load[0].bbox[1],
          width: detections.load[0].bbox[2] - detections.load[0].bbox[0],
          height: detections.load[0].bbox[3] - detections.load[0].bbox[1]
        } : null,
        details: {
          bbox: detections.load?.[0]?.bbox || []
        }
      },
      processed_image_base64: yoloResult.processed_image,
      analiz_sonucu: JSON.stringify({
        forkliftScore: detections.forklift?.[0]?.confidence || 0,
        forkDetectionScore: detections.fork?.[0]?.confidence || 0,
        loadDetectionScore: detections.load?.[0]?.confidence || 0,
        isFull: yoloResult.status === 'loaded',
        confidence: yoloResult.confidence || 0,
        method: yoloResult.method || 'yolo_iou',
        iou_value: yoloResult.iou_value || 0,
        iou_threshold: yoloResult.iou_threshold || 0.3,
        reason: yoloResult.reason || ''
      })
    };
  }
}

module.exports = new YOLOService();

