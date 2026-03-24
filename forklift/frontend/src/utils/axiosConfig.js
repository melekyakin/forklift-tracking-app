import axios from 'axios'
import { API_URL } from '../config'

// Axios instance oluştur
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 saniye (10 saniyeden artırıldı)
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response) {
      // Server yanıt verdi ama hata kodu var
      console.error('API Error:', error.response.status, error.response.data)
    } else if (error.request) {
      // İstek gönderildi ama yanıt alınamadı - Backend çalışmıyor olabilir
      const apiUrl = apiClient.defaults.baseURL
      console.error('Network Error: Backend sunucusuna bağlanılamıyor.')
      console.error('API URL:', apiUrl)
      console.error('İstek detayları:', error.request)
      
      // Kullanıcıya daha anlaşılır hata mesajı
      error.userMessage = `Backend sunucusuna bağlanılamıyor. Lütfen sunucunun çalıştığından emin olun.\n\nSunucu Adresi: ${apiUrl}\n\nÇözüm önerileri:\n1. Backend sunucusunun çalıştığından emin olun\n2. Sunucu adresinin doğru olduğunu kontrol edin\n3. Firewall veya güvenlik duvarı ayarlarını kontrol edin`
      error.isConnectionError = true
    } else {
      // İstek hazırlanırken hata oluştu
      console.error('Error:', error.message)
      error.userMessage = `Bağlantı hatası: ${error.message}`
    }
    return Promise.reject(error)
  }
)

export default apiClient

