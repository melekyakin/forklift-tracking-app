import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Service Worker kaydı (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker kaydedildi:', registration.scope);
        // Service Worker güncellemesi için kontrol et
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Yeni Service Worker yüklendi, sayfayı yenile
              console.log('Yeni Service Worker yüklendi, sayfa yenileniyor...');
              window.location.reload();
            }
          });
        });
      })
      .catch((error) => {
        console.log('Service Worker kayıt hatası:', error);
      });
    
    // Service Worker güncellemesini kontrol et
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  });
}

