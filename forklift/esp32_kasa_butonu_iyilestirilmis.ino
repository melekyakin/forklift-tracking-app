#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>

// ===============================
// WOKWI AYARLARI
// ===============================
const char* ssid     = "Wokwi-GUEST";
const char* password = "";

// ===============================
// API
// ===============================
// NOT: ngrok URL'sini güncelleyin! Her ngrok başlatıldığında URL değişir
// Wokwi için HTTP kullanın (HTTPS WiFiClientSecure sorunları olabilir)
// Gerçek ESP32 için HTTPS kullanabilirsiniz
const char* apiUrl =
  "http://perioecid-neal-friskily.ngrok-free.dev/api/button/press"; 
const char* apiKey        = "BUTTON_API_KEY_2024";
const char* workstationId = "1";

// HTTPS için root certificate (ngrok için gerekli değil ama ekleyebilirsiniz)
// const char* rootCACertificate = "...";

// ===============================
// PINLER
// ===============================
#define BTN_HAMMADDE 25  // Üstteki buton - Hammadde talebi
#define BTN_KASA     4   // Alttaki buton - Kasa doldu
#define LED_OK       2

// ===============================
// GLOBAL
// ===============================
bool buttonHammaddeLocked = false;
bool buttonKasaLocked = false;
unsigned long lastHammaddePress = 0;
unsigned long lastKasaPress = 0;
unsigned long lastWiFiCheck = 0;
const unsigned long wifiCheckInterval = 30000; // 30 saniyede bir WiFi kontrolü

// ===============================
// LED
// ===============================
void ledBlink(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_OK, HIGH);
    delay(delayMs);
    digitalWrite(LED_OK, LOW);
    delay(delayMs);
  }
}

// ===============================
// WiFi BAĞLAN
// ===============================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("📡 WiFi bağlanıyor");
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  const int maxAttempts = 20; // 10 saniye timeout

  while (WiFi.status() != WL_CONNECTED && attempts < maxAttempts) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Bağlandı");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("RSSI: ");
    Serial.println(WiFi.RSSI());
    ledBlink(2, 200); // Başarılı bağlantı için LED
  } else {
    Serial.println("\n❌ WiFi bağlantısı başarısız!");
    ledBlink(5, 100); // Hata için LED
  }
}

// ===============================
// POST GÖNDER
// ===============================
bool sendRequest(const char* buttonType) {
  // URL'den protokolü kontrol et
  bool useHTTPS = (String(apiUrl).indexOf("https://") >= 0);
  
  WiFiClient* client;
  WiFiClientSecure* secureClient;
  
  if (useHTTPS) {
    secureClient = new WiFiClientSecure();
    secureClient->setInsecure(); // ngrok için self-signed cert kabul et
    client = secureClient;
  } else {
    client = new WiFiClient();
  }
  
  HTTPClient http;
  http.setTimeout(20000); // 20 saniye timeout (ngrok için daha uzun)
  http.setReuse(false); // Her istek için yeni bağlantı

  Serial.print("🔗 Bağlantı kuruluyor: ");
  Serial.println(apiUrl);
  
  if (!http.begin(*client, apiUrl)) {
    Serial.println("❌ http.begin başarısız");
    if (useHTTPS) {
      delete secureClient;
    } else {
      delete client;
    }
    return false;
  }

  // ngrok için gerekli header'lar
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  http.addHeader("ngrok-skip-browser-warning", "true"); // ngrok free için
  http.addHeader("User-Agent", "ESP32-Forklift-Button/1.0");

  String postData =
    "api_key=" + String(apiKey) +
    "&workstation_id=" + String(workstationId) +
    "&button_type=" + String(buttonType);

  Serial.print("➡️ POST gönderiliyor: ");
  Serial.println(postData);

  int httpCode = http.POST(postData);
  Serial.print("🌐 HTTP Kod: ");
  Serial.println(httpCode);

  if (httpCode > 0) {
    String response = http.getString();
    
    // ngrok hata sayfası kontrolü
    if (response.indexOf("ERR_NGROK") > 0 || response.indexOf("ngrok") > 0 && response.indexOf("error") > 0) {
      Serial.println("❌ ngrok Hatası:");
      Serial.println("   Backend sunucusu çalışmıyor veya yanlış porta yönlendirilmiş");
      Serial.println("   Kontrol: ngrok'un localhost:5005'e yönlendirildiğinden emin olun");
      http.end();
      return false;
    }
    
    Serial.println("📥 Yanıt:");
    Serial.println(response);
    
    // Başarı kontrolü
    if (response.indexOf("\"success\":true") > 0 || response.indexOf("\"success\": true") > 0) {
      Serial.println("✅ İşlem başarılı!");
      
      // Kasa içi sayısı bilgisini göster (sadece kasa_doldu için)
      if (String(buttonType) == "kasa_doldu") {
        int kasaSayisiIndex = response.indexOf("\"kasa_ici_sayisi\":");
        if (kasaSayisiIndex > 0) {
          int startIndex = kasaSayisiIndex + 18;
          int endIndex = response.indexOf(",", startIndex);
          if (endIndex == -1) endIndex = response.indexOf("}", startIndex);
          String kasaSayisi = response.substring(startIndex, endIndex);
          Serial.print("📦 Kasa İçi Sayısı: ");
          Serial.println(kasaSayisi);
        }
      }
    } else {
      Serial.println("⚠️ Yanıt alındı ancak success=false");
    }
  } else {
    Serial.print("❌ POST Hatası: ");
    Serial.println(httpCode);
    Serial.print("Hata: ");
    Serial.println(http.errorToString(httpCode));
    
    // Özel hata mesajları
    if (httpCode == -1) {
      Serial.println("   ⚠️ Bağlantı kurulamadı - ngrok URL'sini kontrol edin");
    } else if (httpCode == -5) {
      Serial.println("   ⚠️ Bağlantı kesildi - ngrok veya backend çalışmıyor olabilir");
      Serial.println("   Kontrol: 1) Backend çalışıyor mu? (localhost:5005)");
      Serial.println("           2) ngrok doğru porta yönlendirilmiş mi? (ngrok http 5005)");
      Serial.println("           3) ngrok URL'si güncel mi?");
    }
  }

  http.end();
  
  // Client'ı temizle
  if (useHTTPS) {
    delete secureClient;
  } else {
    delete client;
  }
  
  return (httpCode >= 200 && httpCode < 300);
}

// ===============================
// RETRY
// ===============================
bool sendWithRetry(const char* buttonType, int retry = 3) {
  for (int i = 1; i <= retry; i++) {
    Serial.printf("➡️ Deneme %d/%d\n", i, retry);
    ledBlink(1, 100);

    if (sendRequest(buttonType)) {
      Serial.println("✅ Başarılı");
      digitalWrite(LED_OK, HIGH);
      delay(500);
      digitalWrite(LED_OK, LOW);
      return true;
    }
    
    if (i < retry) {
      delay(1500);
    }
  }

  Serial.println("❌ Tüm denemeler başarısız");
  ledBlink(5, 100);
  return false;
}

// ===============================
// SETUP
// ===============================
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(BTN_HAMMADDE, INPUT_PULLUP);
  pinMode(BTN_KASA, INPUT_PULLUP);
  pinMode(LED_OK, OUTPUT);
  digitalWrite(LED_OK, LOW);

  Serial.println("\n--- Wokwi ESP32 Button System ---");
  Serial.println("Uygulama: Forklift Kasa Takip Sistemi");
  Serial.println("Üst Buton (GPIO 25): Hammadde Talebi");
  Serial.println("Alt Buton (GPIO 4): Kasa Doldu");
  connectWiFi();
}

// ===============================
// LOOP
// ===============================
void loop() {
  // WiFi bağlantısını periyodik olarak kontrol et
  if (millis() - lastWiFiCheck > wifiCheckInterval) {
    lastWiFiCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("⚠️ WiFi bağlantısı kesildi, yeniden bağlanılıyor...");
      connectWiFi();
    }
  }

  // Hammadde talebi butonu (üstteki - GPIO 25)
  if (digitalRead(BTN_HAMMADDE) == LOW && !buttonHammaddeLocked) {
    buttonHammaddeLocked = true;
    lastHammaddePress = millis();

    Serial.println("🔘 Hammadde Talebi Butonu Basıldı");
    
    // WiFi kontrolü
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("❌ WiFi bağlantısı yok, bağlanılıyor...");
      connectWiFi();
      delay(1000);
      
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("❌ WiFi bağlantısı başarısız!");
        buttonHammaddeLocked = false;
        ledBlink(5, 100);
        return;
      }
    }
    
    // API isteği gönder
    sendWithRetry("hammadde_talebi");
  }

  // Kasa doldu butonu (alttaki - GPIO 4)
  if (digitalRead(BTN_KASA) == LOW && !buttonKasaLocked) {
    buttonKasaLocked = true;
    lastKasaPress = millis();

    Serial.println("🔘 Kasa Doldu Butonu Basıldı");
    
    // WiFi kontrolü
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("❌ WiFi bağlantısı yok, bağlanılıyor...");
      connectWiFi();
      delay(1000);
      
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("❌ WiFi bağlantısı başarısız!");
        buttonKasaLocked = false;
        ledBlink(5, 100);
        return;
      }
    }
    
    // API isteği gönder
    sendWithRetry("kasa_doldu");
  }

  // Butonlar bırakıldı mı kontrol et
  if (digitalRead(BTN_HAMMADDE) == HIGH && buttonHammaddeLocked) {
    if (millis() - lastHammaddePress > 300) {
      buttonHammaddeLocked = false;
    }
  }

  if (digitalRead(BTN_KASA) == HIGH && buttonKasaLocked) {
    if (millis() - lastKasaPress > 300) {
      buttonKasaLocked = false;
    }
  }

  delay(50);
}
