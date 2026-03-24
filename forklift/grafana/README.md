# Grafana Dashboard Kurulum Rehberi

Bu rehber, Forklift Yönetim Sistemi için Grafana dashboard'unun kurulumunu açıklar.

## Gereksinimler

- Docker ve Docker Compose
- Backend sunucusunun çalışıyor olması (port 5005)

## Kurulum

### 1. Grafana'yı Başlat

```bash
cd forklift/grafana
docker-compose up -d
```

Bu komut Grafana'yı port 3001'de başlatacaktır.

### 2. Grafana'ya Giriş Yap

Tarayıcınızda şu adrese gidin:
```
http://localhost:3001
```

Varsayılan kullanıcı bilgileri:
- **Kullanıcı adı:** admin
- **Şifre:** admin

İlk girişte şifre değiştirmeniz istenecektir.

### 3. JSON Datasource Plugin Kurulumu

Grafana'da JSON datasource kullanmak için plugin kurmanız gerekebilir:

1. Grafana arayüzünde **Configuration** > **Plugins** menüsüne gidin
2. "JSON API" veya "Simple JSON Datasource" arayın
3. Plugin'i kurun ve etkinleştirin

Alternatif olarak, `marcusolsson-json-datasource` plugin'ini kullanabilirsiniz:

```bash
docker exec -it forklift-grafana grafana-cli plugins install marcusolsson-json-datasource
docker restart forklift-grafana
```

### 4. Datasource Yapılandırması

Datasource otomatik olarak yapılandırılmış olmalıdır. Kontrol etmek için:

1. **Configuration** > **Data Sources** menüsüne gidin
2. "Forklift API" datasource'unun olduğunu kontrol edin
3. URL'nin `http://host.docker.internal:5005` olduğundan emin olun

Eğer datasource yoksa, manuel olarak ekleyin:

1. **Add data source** butonuna tıklayın
2. **JSON API** veya **Simple JSON** seçin
3. Ayarları yapın:
   - **Name:** Forklift API
   - **URL:** http://host.docker.internal:5005
   - **Access:** Server (Default)

### 5. Dashboard'u İçe Aktar

Dashboard otomatik olarak yüklenmiş olmalıdır. Kontrol etmek için:

1. **Dashboards** > **Browse** menüsüne gidin
2. "Forklift Yönetim Sistemi Dashboard" adlı dashboard'u bulun

Eğer dashboard görünmüyorsa, manuel olarak içe aktarın:

1. **Dashboards** > **Import** menüsüne gidin
2. `dashboards/forklift-dashboard.json` dosyasını seçin
3. Datasource olarak "Forklift API" seçin
4. **Import** butonuna tıklayın

## Dashboard Panelleri

Dashboard şu panelleri içerir:

1. **Kasa Doluluk Ortalaması:** Tüm kasaların ortalama doluluk oranını gösterir
2. **Bildirim Sayısı:** Zaman içinde oluşturulan bildirim sayısını gösterir
3. **Bildirim Onay Oranı:** Bildirimlerin onaylanma oranını gösterir
4. **Kasa Hareket Sayısı:** Kasa adet değişikliklerinin sayısını gösterir
5. **Workstation Aktivite:** Her iş istasyonunun aktivite seviyesini gösterir
6. **Forkliftçi Performans:** Her forklift operatörünün performans skorunu gösterir

## API Endpoint'leri

Backend'de şu endpoint'ler Grafana için hazırlanmıştır:

- `GET /api/grafana/search` - Mevcut metrikleri listeler
- `GET /api/grafana/query` - Time series veri döndürür
- `GET /api/grafana/annotations` - Annotation'ları döndürür

## Sorun Giderme

### Grafana'ya erişilemiyor

- Docker container'ın çalıştığından emin olun: `docker ps`
- Port 3001'in kullanılabilir olduğundan emin olun

### Veri görünmüyor

- Backend sunucusunun çalıştığından emin olun
- Datasource URL'inin doğru olduğundan emin olun
- Backend loglarını kontrol edin

### Plugin bulunamıyor

- Grafana'yı yeniden başlatın: `docker restart forklift-grafana`
- Plugin'in doğru kurulduğundan emin olun

## Gelişmiş Yapılandırma

### Zaman Aralığı Ayarlama

Dashboard'da zaman aralığını değiştirmek için sağ üst köşedeki zaman seçicisini kullanın.

### Yeni Panel Ekleme

1. Dashboard'u düzenleme moduna alın
2. **Add panel** butonuna tıklayın
3. Metrik seçin (search endpoint'inden gelen metrikler)
4. Panel tipini seçin (Graph, Stat, Table, vb.)
5. Ayarları yapılandırın

## Durdurma

Grafana'yı durdurmak için:

```bash
cd forklift/grafana
docker-compose down
```

Verileri korumak için (volume'lar silinmez):

```bash
docker-compose stop
```

## Notlar

- Grafana verileri `/var/lib/grafana` dizininde saklar (Docker volume)
- Dashboard'lar `dashboards/` dizininde JSON formatında saklanır
- Datasource yapılandırmaları `provisioning/datasources/` dizininde saklanır

