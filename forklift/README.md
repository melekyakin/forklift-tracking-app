# Forklift ve Kasa Takip Sistemi
## AI Destekli Endüstriyel Yönetim Platformu

**Bilgisayar Mühendisliği Bitirme Projesi**

Modern web teknolojileri, yapay zeka algoritmaları ve IoT sensör entegrasyonu kullanarak forklift operasyonlarını ve kasa yönetimini optimize eden, gerçek zamanlı takip ve yönetim sistemi.

## 🚀 Özellikler

### Temel Özellikler
- 📦 **Kasa Yönetimi**: Kasa ekleme, düzenleme, gerçek zamanlı takip
- ⚠️ **Otomatik Bildirimler**: Kasa %80 dolduğunda otomatik bildirim
- 🚜 **Forkliftçi Ekranı**: Tablet uyumlu bildirim onaylama/reddetme ekranı
- 📊 **Raporlama**: Hareket kayıtları ve istatistikler
- 🔔 **Real-time Güncellemeler**: WebSocket ile anlık bildirimler
- 📱 **PWA Desteği**: Offline çalışma ve push notifications

### 🤖 AI/ML Özellikleri
- **Tahminsel Analitik**: Zaman serisi analizi ile kasa doluluk tahmini
- **Anomali Tespiti**: Olağandışı durumları otomatik tespit
- **Optimizasyon Önerileri**: AI destekli işletme önerileri
- **Performans Analizi**: Forkliftçi performans değerlendirmesi
- **Görüntü Analizi**: AI destekli forklift durum tespiti (dolu/boş)

### 📈 Analytics Dashboard
- İnteraktif grafikler ve görselleştirmeler (Recharts)
- Gerçek zamanlı veri analizi
- KPI metrikleri ve trend analizleri
- AI tahminleri ve anomali raporları

### 🔌 IoT Entegrasyonu
- CAN Bus veri toplama simülasyonu
- Ağırlık sensörü entegrasyonu
- Ultrasonik mesafe ölçümü
- IMU (darbe tespiti)
- GPS/RTK konum takibi
- Kombine sensör analizi

### 👥 Kullanıcı Yönetimi
- Role-based access control (RBAC)
- Forkliftçi ekleme/çıkarma (Admin)
- Kullanıcı performans takibi
- Güvenli authentication (JWT)

## Kurulum

### Gereksinimler

- Node.js (v14 veya üzeri)
- npm veya yarn

### Adımlar

1. Projeyi klonlayın veya indirin

2. Tüm bağımlılıkları yükleyin:
```bash
npm run install-all
```

3. Uygulamayı başlatın:
```bash
npm run dev
```

Bu komut hem backend (port 5000) hem de frontend (port 3000) sunucularını başlatır.

## IP ve Port Yapılandırması

### Backend IP/Port Ayarları

Backend'in IP ve portunu değiştirmek için environment variable kullanın:

```bash
# Windows PowerShell
$env:PORT=5000
$env:HOST="0.0.0.0"
npm run server

# Linux/Mac
PORT=5000 HOST=0.0.0.0 npm run server
```

Veya `backend/.env` dosyası oluşturun:
```
PORT=5000
HOST=0.0.0.0
```

**Not:** `HOST=0.0.0.0` tüm ağ arayüzlerinde dinleme yapar (tüm IP'lerden erişilebilir). Sadece localhost'ta dinlemek için `HOST=127.0.0.1` kullanın.

### Frontend IP/Port Ayarları

Frontend'in backend'e bağlanacağı IP'yi değiştirmek için `frontend/.env` dosyası oluşturun:

```
VITE_API_URL=http://192.168.1.100:5000
VITE_WS_URL=ws://192.168.1.100:5000
VITE_PORT=3000
VITE_HOST=0.0.0.0
```

**Örnek Senaryolar:**

1. **Aynı bilgisayarda çalıştırma (localhost):**
   ```
   Backend: HOST=127.0.0.1 PORT=5000
   Frontend: VITE_API_URL=http://localhost:5000
   ```

2. **Ağ üzerinden erişim (örnek IP: 192.168.1.100):**
   ```
   Backend: HOST=0.0.0.0 PORT=5000
   Frontend: VITE_API_URL=http://192.168.1.100:5000
   ```

3. **Farklı portlar:**
   ```
   Backend: PORT=8080
   Frontend: VITE_API_URL=http://192.168.1.100:8080
   ```

**Önemli:** `.env` dosyasını değiştirdikten sonra frontend'i yeniden başlatmanız gerekir.

## Kullanım

1. **Kasalar Sekmesi**: 
   - Yeni kasa ekleyin
   - Kasa adetlerini güncelleyin
   - Kasaları görüntüleyin ve yönetin

2. **Forklift Ekranı Sekmesi**:
   - Bekleyen bildirimleri görüntüleyin
   - Bildirimleri onaylayın veya reddedin
   - Tablet üzerinden kullanım için optimize edilmiştir

3. **Raporlar Sekmesi**:
   - İstatistikleri görüntüleyin
   - Hareket kayıtlarını filtreleyin
   - Detaylı raporlar alın

## API Endpoints

### Kasa İşlemleri
- `GET /api/kasa` - Tüm kasaları listele
- `GET /api/kasa/:id` - Tek bir kasayı getir
- `POST /api/kasa` - Yeni kasa oluştur
- `PUT /api/kasa/:id/adet` - Kasa adetini güncelle
- `DELETE /api/kasa/:id` - Kasa sil

### Forklift İşlemleri
- `GET /api/forklift/bildirimler` - Tüm bildirimleri getir
- `GET /api/forklift/bildirimler/bekleyen` - Bekleyen bildirimleri getir
- `POST /api/forklift/bildirim/:id/onayla` - Bildirimi onayla
- `POST /api/forklift/bildirim/:id/reddet` - Bildirimi reddet

### Raporlar
- `GET /api/rapor/istatistikler` - İstatistikleri getir
- `GET /api/rapor/hareketler` - Hareket kayıtlarını getir
- `GET /api/rapor/kasa/:id` - Kasa bazlı rapor

## 🛠️ Teknolojiler

### Frontend
- **React 18.2** - Modern UI framework
- **Vite 5.0** - Hızlı build tool
- **Recharts** - Gelişmiş veri görselleştirme
- **WebSocket** - Gerçek zamanlı iletişim
- **PWA** - Progressive Web App özellikleri

### Backend
- **Node.js** - JavaScript runtime
- **Express.js 4.18** - Web framework
- **SQLite3** - Veritabanı
- **WebSocket (ws)** - Real-time communication
- **Sharp** - Görüntü işleme
- **JWT** - Authentication

### AI/ML
- **Zaman Serisi Analizi** - Tahminsel analitik
- **Anomali Tespiti** - Olağandışı durum tespiti
- **Optimizasyon Algoritmaları** - AI destekli öneriler
- **Görüntü İşleme** - Forklift durum analizi

### IoT
- **Sensör Simülasyonu** - CAN Bus, ağırlık, ultrasonik, IMU
- **Kombine Analiz** - Çoklu sensör verisi birleştirme

## 📚 Dokümantasyon

- **[TEZ_DOKUMANTASYON.md](./TEZ_DOKUMANTASYON.md)** - Detaylı tez dokümantasyonu
- **[MIMARI_DIYAGRAM.md](./MIMARI_DIYAGRAM.md)** - Sistem mimarisi diyagramları
- **[ALGORITMA_IYILESTIRME.md](./ALGORITMA_IYILESTIRME.md)** - AI algoritma açıklamaları

## 🔐 Güvenlik

- JWT tabanlı authentication
- Role-based access control (RBAC)
- Şifre hashleme (bcrypt)
- SQL injection koruması
- CORS yapılandırması

## 📊 Performans

- API yanıt süresi: <200ms (ortalama)
- WebSocket gecikme: <50ms
- Görüntü analiz süresi: <2 saniye
- AI tahmin süresi: <500ms

## 🎯 Kullanım Senaryoları

1. **Kasa Yönetimi**: Workstation bazlı kasa takibi ve yönetimi
2. **Forklift Operasyonları**: Bildirim onaylama/reddetme, görsel analiz
3. **Analytics**: AI destekli tahminler ve optimizasyon önerileri
4. **IoT Monitoring**: Sensör verileri ve kombine analiz
5. **Raporlama**: Detaylı istatistikler ve performans metrikleri

## 📝 Notlar

- Veritabanı otomatik olarak oluşturulur (`backend/database.sqlite`)
- WebSocket bağlantısı real-time bildirimler için kullanılır
- PWA özellikleri için HTTPS gereklidir (production)
- IoT simülasyonu test amaçlıdır, gerçek sensörler için adapte edilebilir

## 🔮 Gelecek Geliştirmeler

- TensorFlow.js entegrasyonu (eğitilmiş ML modeli)
- Blockchain tabanlı log sistemi
- Microservices mimarisi
- GraphQL API
- React Native mobile app

