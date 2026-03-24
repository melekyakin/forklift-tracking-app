const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const Database = require('./database-pg');
const authRoutes = require('./routes/auth-pg');
const forkliftRoutes = require('./routes/forklift-pg');
const { ForkliftBildirim, Kullanici, Workstation } = require('./models-pg');
const { authenticateToken } = require('./middleware/auth');
const raporRoutes = require('./routes/rapor-pg');
const workstationRoutes = require('./routes/workstation-pg');
const alertRoutes = require('./routes/alert-pg');
const forkliftciRoutes = require('./routes/forkliftci-pg');
const forkliftciWorkstationRoutes = require('./routes/forkliftciWorkstation-pg');
const kullaniciRoutes = require('./routes/kullanici-pg');
const konumRoutes = require('./routes/konum-pg');
const forkliftGorselRoutes = require('./routes/forkliftGorsel-pg');
const operatorRoutes = require('./routes/operator-pg');
const darbeRoutes = require('./routes/darbe-pg');
const canbusRoutes = require('./routes/canbus-pg');
const hareketliVarlikRoutes = require('./routes/hareketliVarlik-pg');
const aiRoutes = require('./routes/ai');
const iotRoutes = require('./routes/iot');
const grafanaRoutes = require('./routes/grafana-pg');
const buttonRoutes = require('./routes/button-pg'); // Fiziksel butonlar için (PostgreSQL uyumlu)
const kasaIciSayisiRoutes = require('./routes/kasa-ici-sayisi-pg');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 5005;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://127.0.0.1:3000', 
    'http://0.0.0.0:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    // Mobil uygulama için - Expo Go ve React Native
    /^http:\/\/192\.168\.\d+\.\d+:\d+$/, // Local network IP'leri
    /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/, // Private network IP'leri (ESP32 için)
    /^http:\/\/10\.\d+\.\d+\.\d+$/, // ESP32 için port olmadan
    /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+$/, // Private network IP'leri
    'exp://localhost:19000', // Expo development
    'exp://192.168.1.100:19000' // Expo local network
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// WebSocket bağlantıları
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('Yeni WebSocket bağlantısı');
  clients.add(ws);

  ws.on('close', () => {
    console.log('WebSocket bağlantısı kapandı');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket hatası:', error);
  });
});

// WebSocket mesaj gönderme fonksiyonu
function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Global broadcast fonksiyonunu export et
global.broadcast = broadcast;

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Test endpoint - Kapatılmayı bekleyen işler (doğrudan server.js'de)
// Bu route'u forklift-pg.js'den önce ekliyoruz test için
app.get('/api/forklift/bildirimler/kapatilmayi-bekleyen-test', (req, res) => {
  console.log('✅ Test endpoint çağrıldı');
  res.json({ message: 'Test endpoint çalışıyor', route: '/api/forklift/bildirimler/kapatilmayi-bekleyen-test' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/forklift', forkliftRoutes);

// Kapatılmayı bekleyen işler endpoint'i (app.use'dan SONRA - override için)
app.get('/api/forklift/bildirimler/kapatilmayi-bekleyen', authenticateToken, async (req, res) => {
  console.log('📋 Kapatılmayı bekleyen işler endpoint\'i çağrıldı (server.js - override)');
  console.log('📋 User:', req.user);
  try {
    const { Op } = require('sequelize');
    const where = {
      durum: 'onaylandi',
      tamamlanma_tarihi: null
    };
    
    if (req.user.rol === 'forkliftoperator') {
      const forkliftciId = parseInt(req.user.id);
      where.forkliftci_id = forkliftciId;
    }
    
    const bildirimler = await ForkliftBildirim.findAll({
      where,
      include: [
        {
          model: Kullanici,
          as: 'forkliftci',
          attributes: ['id', 'ad_soyad', 'kullanici_adi']
        },
      ],
      order: [['onay_tarihi', 'ASC']]
    });
    
    const bildirimlerWithWorkstation = await Promise.all(bildirimler.map(async (bildirim) => {
      const plain = bildirim.get({ plain: true });
      let workstationAdi = null;
      let workstationNo = null;
      
      if (plain.mesaj) {
        const mesajMatch = plain.mesaj.match(/(.+?)\s+iş\s+istasyonu/i);
        if (mesajMatch && mesajMatch[1]) {
          workstationAdi = mesajMatch[1].trim();
          const workstation = await Workstation.findOne({
            where: { workstation_adi: workstationAdi }
          });
          if (workstation) {
            workstationNo = workstation.workstation_no;
          }
        }
      }
      
      return {
        ...plain,
        id: plain.id.toString(),
        forkliftci_id: plain.forkliftci_id ? plain.forkliftci_id.toString() : null,
        olusturma_tarihi: plain.olusturma_tarihi,
        tamamlanma_tarihi: plain.tamamlanma_tarihi || null,
        sure_saniye: plain.sure_saniye || null,
        onay_tarihi: plain.onay_tarihi || null,
        workstation_adi: workstationAdi,
        workstation_no: workstationNo
      };
    }));
    
    console.log(`📋 Kapatılmayı bekleyen işler:`, bildirimlerWithWorkstation.length);
    res.json(bildirimlerWithWorkstation);
  } catch (error) {
    console.error('Kapatılmayı bekleyen işler yükleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});
app.use('/api/rapor', raporRoutes);
app.use('/api/workstation', workstationRoutes);
app.use('/api/alert', alertRoutes);
app.use('/api/forkliftci', forkliftciRoutes);
app.use('/api/forkliftci', forkliftciWorkstationRoutes);
app.use('/api/kullanici', kullaniciRoutes);
app.use('/api/konum', konumRoutes);
app.use('/api/forklift/gorsel', forkliftGorselRoutes);
app.use('/api/operator', operatorRoutes);
app.use('/api/darbe', darbeRoutes);
app.use('/api/canbus', canbusRoutes);
app.use('/api/hareketli-varlik', hareketliVarlikRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/iot', iotRoutes);
app.use('/api/grafana', grafanaRoutes);
app.use('/api/button', buttonRoutes); // Fiziksel butonlar için route
app.use('/api/kasa-ici-sayisi', kasaIciSayisiRoutes);

// Static dosya servisi (yüklenen görseller için)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server çalışıyor' });
});

// Database başlatma
Database.init().then(() => {
  console.log('Veritabanı başlatıldı');
  
  server.listen(PORT, HOST, () => {
    console.log(`Server ${HOST}:${PORT} adresinde çalışıyor`);
  });
}).catch((err) => {
  console.error('Veritabanı hatası:', err);
});

module.exports = { app, server, broadcast };

