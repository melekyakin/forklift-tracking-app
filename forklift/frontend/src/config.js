// API ve WebSocket URL yapılandırması
// Environment variable'lardan al, yoksa varsayılan değerleri kullan
const getApiUrl = () => {
  // Vite'da environment variable'lar import.meta.env ile erişilir
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  // Telefondan erişim için: browser'ın hostname'ini kullan
  // Eğer localhost değilse (örneğin 192.168.1.106), o IP'yi kullan
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    // localhost veya 127.0.0.1 değilse, bu IP'yi kullan (mobil erişim)
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:5005`
    }
  }
  
  // Development modunda doğrudan backend URL'ini kullan
  // Vite proxy bazen sorun çıkarabiliyor, bu yüzden doğrudan bağlantı kullanıyoruz
  if (import.meta.env.DEV) {
    return 'http://localhost:5005'
  }
  // Production'da varsayılan URL
  return 'http://localhost:5005'
}

const getWsUrl = () => {
  // WebSocket için her zaman tam URL gerekli (proxy WebSocket'i desteklemez)
  let apiUrl = import.meta.env.VITE_API_URL
  
  if (!apiUrl && typeof window !== 'undefined') {
    const hostname = window.location.hostname
    // localhost veya 127.0.0.1 değilse, bu IP'yi kullan (mobil erişim)
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      apiUrl = `http://${hostname}:5005`
    } else {
      apiUrl = 'http://localhost:5005'
    }
  }
  
  if (!apiUrl) {
    apiUrl = 'http://localhost:5005'
  }
  
  // http:// veya https:// protokolünü ws:// veya wss:// ile değiştir
  return import.meta.env.VITE_WS_URL || apiUrl.replace(/^http/, 'ws')
}

export const API_URL = getApiUrl()
export const WS_URL = getWsUrl()

