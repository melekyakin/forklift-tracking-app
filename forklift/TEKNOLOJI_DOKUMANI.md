# Forklift ve Kasa Takip Sistemi - Teknoloji Dokümantasyonu

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Frontend Teknolojileri](#frontend-teknolojileri)
3. [Backend Teknolojileri](#backend-teknolojileri)
4. [Veritabanı Teknolojileri](#veritabanı-teknolojileri)
5. [AI/ML Teknolojileri](#aiml-teknolojileri)
6. [IoT ve Sensör Teknolojileri](#iot-ve-sensör-teknolojileri)
7. [DevOps ve Altyapı](#devops-ve-altyapı)
8. [Güvenlik Teknolojileri](#güvenlik-teknolojileri)
9. [Diğer Araçlar ve Kütüphaneler](#diğer-araçlar-ve-kütüphaneler)
10. [Teknoloji Mimarisi](#teknoloji-mimarisi)

---

## Genel Bakış

Bu proje, modern web teknolojileri, yapay zeka algoritmaları ve IoT sensör entegrasyonu kullanarak forklift operasyonlarını ve kasa yönetimini optimize eden, gerçek zamanlı takip ve yönetim sistemidir. Sistem, full-stack bir mimari üzerine kurulmuştur ve mikroservis yaklaşımı ile geliştirilmiştir.

### Teknoloji Stack Özeti

- **Frontend**: React 18.2 + Vite 5.0
- **Backend**: Node.js + Express.js 4.18
- **Veritabanı**: PostgreSQL 15
- **AI/ML**: YOLOv8, PyTorch, OpenCV
- **Real-time**: WebSocket (ws)
- **Containerization**: Docker + Docker Compose
- **Monitoring**: Grafana 10.2.0

---

## Frontend Teknolojileri

### React 18.2
**Açıklama**: Modern, component-based UI framework  
**Kullanım Amacı**: 
- Kullanıcı arayüzü bileşenlerinin oluşturulması
- State yönetimi ve component lifecycle yönetimi
- Reaktif veri akışı ve UI güncellemeleri

**Özellikler**:
- Functional Components ve Hooks kullanımı
- Context API ile global state yönetimi
- Component-based mimari

### Vite 5.0
**Açıklama**: Next-generation frontend build tool  
**Kullanım Amacı**:
- Hızlı development server
- Optimized production builds
- Hot Module Replacement (HMR)

**Yapılandırma**:
- React plugin entegrasyonu
- Proxy yapılandırması (API istekleri için)
- Environment variable desteği

### Recharts 3.6.0
**Açıklama**: React için gelişmiş charting kütüphanesi  
**Kullanım Amacı**:
- Analytics dashboard'da grafik görselleştirmeleri
- Real-time veri görselleştirme
- İnteraktif chart'lar (Line, Bar, Pie, Area)

**Özellikler**:
- Responsive tasarım
- Customizable themes
- Animasyon desteği

### Axios 1.6.2
**Açıklama**: Promise-based HTTP client  
**Kullanım Amacı**:
- Backend API'ye HTTP istekleri
- Request/Response interceptors
- Error handling

### date-fns 4.1.0
**Açıklama**: Modern JavaScript date utility library  
**Kullanım Amacı**:
- Tarih formatlama ve parsing
- Tarih hesaplamaları
- Timezone yönetimi

### Lucide React 0.562.0
**Açıklama**: Modern icon library  
**Kullanım Amacı**:
- UI icon'ları
- Consistent icon set
- Tree-shakeable imports

### Progressive Web App (PWA)
**Özellikler**:
- Service Worker desteği (`sw.js`)
- Offline çalışma yeteneği
- Manifest dosyası (`manifest.json`)
- Push notification desteği

---

## Backend Teknolojileri

### Node.js 18
**Açıklama**: JavaScript runtime environment  
**Kullanım Amacı**:
- Server-side JavaScript execution
- Asenkron I/O işlemleri
- Event-driven mimari

### Express.js 4.18.2
**Açıklama**: Minimal ve esnek Node.js web framework  
**Kullanım Amacı**:
- RESTful API endpoint'leri
- Middleware yönetimi
- Route handling
- Request/Response processing

**Özellikler**:
- RESTful API tasarımı
- Middleware chain (CORS, body-parser, authentication)
- Static file serving

### Sequelize 6.37.7
**Açıklama**: Promise-based Node.js ORM  
**Kullanım Amacı**:
- PostgreSQL veritabanı işlemleri
- Model tanımlamaları
- Migration yönetimi
- Query building

**Özellikler**:
- Model associations (hasMany, belongsTo)
- Transaction desteği
- Query optimization
- Migration sistemi

### PostgreSQL Driver (pg 8.16.3)
**Açıklama**: PostgreSQL için Node.js client  
**Kullanım Amacı**:
- Veritabanı bağlantı yönetimi
- Raw SQL query execution
- Connection pooling

### WebSocket (ws 8.14.2)
**Açıklama**: WebSocket server implementation  
**Kullanım Amacı**:
- Real-time bildirimler
- Anlık veri güncellemeleri
- Client-server bidirectional communication

**Kullanım Senaryoları**:
- Forklift bildirimleri
- Kasa durum güncellemeleri
- Real-time dashboard updates

### Sharp 0.33.5
**Açıklama**: High-performance image processing library  
**Kullanım Amacı**:
- Görsel resize ve optimization
- Format dönüşümleri
- Thumbnail oluşturma

### Multer 1.4.5
**Açıklama**: File upload middleware  
**Kullanım Amacı**:
- Forklift görsel yükleme
- Multipart/form-data handling
- File storage yönetimi

### Body Parser 1.20.2
**Açıklama**: Request body parsing middleware  
**Kullanım Amacı**:
- JSON request parsing
- URL-encoded data parsing
- Request size limits

### CORS 2.8.5
**Açıklama**: Cross-Origin Resource Sharing middleware  
**Kullanım Amacı**:
- Cross-origin request handling
- CORS policy yönetimi
- Credential desteği

### Concurrently 8.2.2
**Açıklama**: Run multiple commands concurrently  
**Kullanım Amacı**:
- Development ortamında frontend ve backend'i birlikte çalıştırma
- Script orchestration

### Nodemon 3.0.1
**Açıklama**: Development server auto-reload  
**Kullanım Amacı**:
- Code değişikliklerinde otomatik restart
- Development workflow iyileştirme

---

## Veritabanı Teknolojileri

### PostgreSQL 15
**Açıklama**: Advanced open-source relational database  
**Kullanım Amacı**:
- İlişkisel veri saklama
- ACID compliance
- Complex query'ler
- Transaction yönetimi

**Özellikler**:
- ENUM type desteği
- JSON/JSONB data types
- Full-text search
- Foreign key constraints
- Index optimization

**Kullanılan Tablolar**:
- `kullanicilar` - Kullanıcı bilgileri
- `workstations` - İş istasyonları
- `forklift_bildirimler` - Bildirim kayıtları
- `hareket_kayitlari` - Hareket geçmişi
- `forkliftci_aktiviteler` - Forkliftçi aktiviteleri
- `canbus_veriler` - CAN Bus sensör verileri
- `darbe_kayitlari` - Darbe tespit kayıtları
- `hareketli_varliklar` - Hareketli varlık takibi
- Ve diğerleri...

### pg-hstore 2.3.4
**Açıklama**: PostgreSQL hstore data type desteği  
**Kullanım Amacı**: Key-value pair storage

---

## AI/ML Teknolojileri

### YOLOv8 (Ultralytics 8.1.0)
**Açıklama**: State-of-the-art object detection model  
**Kullanım Amacı**:
- Forklift tespiti
- Çatal (fork) tespiti
- Yük (load) tespiti
- Dolu/boş durum analizi

**Özellikler**:
- Real-time object detection
- High accuracy
- Custom model training desteği
- Multiple class detection

**Model Sınıfları**:
- `forklift` - Forklift gövdesi
- `fork` - Çatal (2 diş birlikte)
- `load` - Yük (palet, kutu, malzeme)

### PyTorch 2.0.0+
**Açıklama**: Deep learning framework  
**Kullanım Amacı**:
- YOLO model inference
- Model loading ve execution
- GPU acceleration desteği

### OpenCV 4.8.1.78
**Açıklama**: Computer vision library  
**Kullanım Amacı**:
- Görsel preprocessing
- Image manipulation
- Contour detection
- Color space conversion

**Kullanım Senaryoları**:
- YOLO öncesi görsel işleme
- Fallback detection (YOLO yoksa)
- Görsel analiz ve filtreleme

### NumPy 1.24.3
**Açıklama**: Numerical computing library  
**Kullanım Amacı**:
- Array operations
- Mathematical computations
- Data preprocessing

### Pillow 10.1.0
**Açıklama**: Python imaging library  
**Kullanım Amacı**:
- Image loading ve saving
- Format conversion
- Image manipulation

### Flask 3.0.0
**Açıklama**: Python web framework (AI servisi için)  
**Kullanım Amacı**:
- YOLO detection servisi
- RESTful API endpoint'leri
- Model inference endpoint'leri

**Endpoint'ler**:
- `/health` - Servis durumu
- `/detect` - Görsel tespit
- `/detect_batch` - Toplu tespit

### AI Servisleri (Custom)
**Zaman Serisi Analizi**:
- Kasa doluluk tahmini
- Geçmiş verilere dayalı ML tahminleri
- Trend analizi

**Anomali Tespiti**:
- Olağandışı durum tespiti
- Pattern recognition
- Alert generation

**Optimizasyon Algoritmaları**:
- İş akışı optimizasyonu
- Performans analizi
- Öneri sistemi

---

## IoT ve Sensör Teknolojileri

### CAN Bus Simülasyonu
**Açıklama**: Controller Area Network protokolü simülasyonu  
**Kullanım Amacı**:
- Forklift sensör verilerinin simülasyonu
- CAN mesaj formatı
- Real-time data streaming

### GPS/RTK Konum Takibi
**Açıklama**: Global Positioning System / Real-Time Kinematic  
**Kullanım Amacı**:
- Forklift konum takibi
- Yüksek doğruluklu konum verisi
- Geofencing

### IMU (Inertial Measurement Unit)
**Açıklama**: İvmeölçer ve jiroskop sensörleri  
**Kullanım Amacı**:
- Hareket tespiti
- Darbe algılama
- Eğim ölçümü

### Ağırlık Sensörü
**Açıklama**: Load cell sensör simülasyonu  
**Kullanım Amacı**:
- Yük ağırlığı ölçümü
- Kasa doluluk hesaplama

### Ultrasonik Mesafe Ölçümü
**Açıklama**: Ultrasonik sensör simülasyonu  
**Kullanım Amacı**:
- Mesafe ölçümü
- Kasa doluluk tespiti

### Sensor Fusion
**Açıklama**: Çoklu sensör verilerinin birleştirilmesi  
**Kullanım Amacı**:
- GPS + IMU fusion
- Kombine analiz
- Doğruluk artırma

### ESP32 Entegrasyonu
**Açıklama**: IoT mikrodenetleyici desteği  
**Kullanım Amacı**:
- Fiziksel buton entegrasyonu
- WiFi bağlantısı
- HTTP/HTTPS istekleri

---

## DevOps ve Altyapı

### Docker
**Açıklama**: Containerization platform  
**Kullanım Amacı**:
- Uygulama containerization
- Environment isolation
- Deployment kolaylığı

**Container'lar**:
- `forklift-postgres` - PostgreSQL veritabanı
- `forklift-backend` - Node.js backend
- `forklift-frontend` - React frontend
- `forklift-grafana` - Grafana monitoring

### Docker Compose
**Açıklama**: Multi-container Docker uygulamaları  
**Kullanım Amacı**:
- Servis orchestration
- Network yönetimi
- Volume yönetimi
- Dependency yönetimi

**Yapılandırma**:
- Service definitions
- Environment variables
- Port mappings
- Volume mounts

### Grafana 10.2.0
**Açıklama**: Analytics ve monitoring platform  
**Kullanım Amacı**:
- Real-time metrics visualization
- Dashboard oluşturma
- Alert yönetimi
- Data source entegrasyonu

**Özellikler**:
- JSON API datasource
- Custom dashboards
- Time series visualization
- Alert rules

**Dashboard'lar**:
- Forklift Yönetim Sistemi Dashboard
- Kasa Doluluk Ortalaması
- Bildirim İstatistikleri
- Workstation Aktivite
- Forkliftçi Performans

---

## Güvenlik Teknolojileri

### JSON Web Token (JWT) 9.0.2
**Açıklama**: Stateless authentication token  
**Kullanım Amacı**:
- User authentication
- Session yönetimi
- API authorization
- Token-based security

**Özellikler**:
- Access token
- Token expiration
- Secure token generation
- Token verification middleware

### bcryptjs 2.4.3
**Açıklama**: Password hashing library  
**Kullanım Amacı**:
- Şifre hashleme
- Salt generation
- Password verification
- Security best practices

**Özellikler**:
- Bcrypt algorithm
- Salt rounds (10)
- Secure password storage

### Role-Based Access Control (RBAC)
**Açıklama**: Rol tabanlı erişim kontrolü  
**Roller**:
- `admin` - Tam yetki
- `forkliftoperator` - Forklift operatörü
- `hatoperator` - Hat operatörü
- `yonetici` - Yönetici

**Özellikler**:
- Route-level authorization
- Permission-based access
- Role middleware

### CORS (Cross-Origin Resource Sharing)
**Açıklama**: Cross-origin request güvenliği  
**Yapılandırma**:
- Allowed origins
- Credential support
- Method restrictions
- Header whitelist

### SQL Injection Koruması
**Açıklama**: Sequelize ORM ile otomatik koruma  
**Özellikler**:
- Parameterized queries
- Input validation
- Type checking

---

## Diğer Araçlar ve Kütüphaneler

### docx 9.5.1
**Açıklama**: Word belgesi oluşturma kütüphanesi  
**Kullanım Amacı**: Rapor oluşturma

### md-to-pdf 5.2.5
**Açıklama**: Markdown to PDF converter  
**Kullanım Amacı**: Dokümantasyon PDF export

### Moment.js (Legacy)
**Açıklama**: Date manipulation (date-fns'e geçiş yapıldı)

---

## Teknoloji Mimarisi

### Sistem Mimarisi

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   React 18   │  │    Vite 5    │  │   Recharts    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/WebSocket
                            │
┌─────────────────────────────────────────────────────────────┐
│                        Backend Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Express.js  │  │  WebSocket    │  │   Sequelize   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ SQL
                            │
┌─────────────────────────────────────────────────────────────┐
│                      Database Layer                          │
│                    PostgreSQL 15                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        AI/ML Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   YOLOv8     │  │   PyTorch    │  │   OpenCV      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                        Flask Service                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      IoT Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   CAN Bus    │  │  GPS/RTK     │  │     IMU       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Weight     │  │ Ultrasonic   │  │   ESP32       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Veri Akışı

1. **Frontend → Backend**: HTTP REST API istekleri
2. **Backend → Database**: Sequelize ORM ile SQL sorguları
3. **Backend → AI Service**: HTTP istekleri (görsel analiz)
4. **Backend → Frontend**: WebSocket ile real-time güncellemeler
5. **IoT → Backend**: HTTP/WebSocket ile sensör verileri
6. **Backend → Grafana**: JSON API ile metrik verileri

### Deployment Mimarisi

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose                           │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Frontend   │  │   Backend    │  │  PostgreSQL  │     │
│  │  Container   │  │  Container   │  │  Container   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │   Grafana    │  │  AI Service  │                        │
│  │  Container   │  │  (Python)    │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Versiyon Bilgileri

### Frontend Dependencies
- React: ^18.2.0
- Vite: ^5.0.8
- Recharts: ^3.6.0
- Axios: ^1.6.2
- date-fns: ^4.1.0
- Lucide React: ^0.562.0

### Backend Dependencies
- Node.js: 18+
- Express: ^4.18.2
- Sequelize: ^6.37.7
- PostgreSQL Driver: ^8.16.3
- WebSocket: ^8.14.2
- Sharp: ^0.33.5
- JWT: ^9.0.2
- bcryptjs: ^2.4.3

### AI/ML Dependencies
- Flask: 3.0.0
- Ultralytics: 8.1.0
- PyTorch: >=2.0.0
- OpenCV: 4.8.1.78
- NumPy: 1.24.3
- Pillow: 10.1.0

### Infrastructure
- Docker: Latest
- Docker Compose: 3.8
- PostgreSQL: 15
- Grafana: 10.2.0

---

## Performans Metrikleri

- **API Response Time**: <200ms (ortalama)
- **WebSocket Latency**: <50ms
- **Image Analysis Time**: <2 saniye
- **AI Prediction Time**: <500ms
- **Database Query Time**: <100ms (indexed queries)

---

## Geliştirme Ortamı Gereksinimleri

### Minimum Gereksinimler
- Node.js: v18.0.0+
- npm: v9.0.0+
- Python: 3.8+
- Docker: 20.10+
- Docker Compose: 2.0+

### Önerilen Gereksinimler
- Node.js: v20.0.0+
- PostgreSQL: 15+
- RAM: 8GB+
- Disk: 20GB+ (model dosyaları için)

---

## Notlar

- Bu dokümantasyon, projenin mevcut teknoloji stack'ini yansıtmaktadır
- Versiyon numaraları `package.json` ve `requirements.txt` dosyalarından alınmıştır
- Bazı teknolojiler gelecekte güncellenebilir
- Production ortamında ek güvenlik önlemleri alınmalıdır

---

**Son Güncelleme**: 2026-01-08  
**Dokümantasyon Versiyonu**: 1.0
