const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { ForkliftDurum, ForkliftciAktivite } = require('../models-pg');
const { authenticateToken } = require('../middleware/auth');
const yoloService = require('../services/yolo_service');

// Görsel yükleme için multer yapılandırması
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/forklift');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `forklift-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Sadece görsel dosyaları yüklenebilir (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// detectForklift ve analyzeForkliftImage fonksiyonları aynı kalacak (görsel işleme)
// ... (detectForklift ve analyzeForkliftImage fonksiyonları aynı - görsel işleme kodu değişmiyor)

/**
 * Forklift görseli yükle ve analiz et
 */
router.post('/yukle-ve-analiz-et', authenticateToken, upload.single('gorsel'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Görsel dosyası yüklenmedi' });
    }

    const forkliftciId = parseInt(req.user.id);
    const imagePath = req.file.path;

    // Önce YOLO servisini dene, yoksa klasik CV kullan
    let analizSonucu;
    const yoloResult = await yoloService.detectForklift(imagePath);
    
    if (yoloResult && yoloResult.success) {
      // YOLO sonucunu backend formatına dönüştür
      analizSonucu = yoloService.formatYOLOResult(yoloResult);
      console.log('YOLO tespit kullanıldı');
    } else {
      // Klasik CV kullan
      analizSonucu = await analyzeForkliftImage(imagePath);
      console.log('Klasik CV tespit kullanıldı');
    }

    // Veritabanına kaydet
    const forkliftDurum = await ForkliftDurum.create({
      forkliftci_id: forkliftciId,
      durum: analizSonucu.durum,
      gorsel_yolu: req.file.filename,
      analiz_sonucu: analizSonucu.analiz_sonucu,
      guven_skoru: analizSonucu.guven_skoru
    });

    // Aktivite kaydı oluştur
    await ForkliftciAktivite.create({
      forkliftci_id: forkliftciId,
      aktivite_tipi: 'forklift_durum_guncelleme',
      aciklama: `Forklift durumu güncellendi: ${analizSonucu.durum} (Güven: %${analizSonucu.guven_skoru * 100})`
    });

    // WebSocket ile güncelleme gönder
    if (global.broadcast) {
      global.broadcast({
        type: 'forklift_durum_guncellendi',
        data: {
          forkliftci_id: forkliftciId.toString(),
          durum: analizSonucu.durum,
          guven_skoru: analizSonucu.guven_skoru
        }
      });
    }

    res.json({
      success: true,
      durum: analizSonucu.durum,
      guven_skoru: analizSonucu.guven_skoru,
      gorsel_yolu: `/uploads/forklift/${req.file.filename}`,
      analiz_sonucu: JSON.parse(analizSonucu.analiz_sonucu),
      forklift_tespit: analizSonucu.forklift_tespit,
      cata_tespit: analizSonucu.cata_tespit,
      yuk_tespit: analizSonucu.yuk_tespit,
      mesaj: `Forklift ${analizSonucu.durum === 'dolu' ? 'dolu' : 'boş'} olarak tespit edildi (Güven: %${Math.round(analizSonucu.guven_skoru * 100)})`
    });
  } catch (error) {
    console.error('Görsel yükleme hatası:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * Forkliftçinin son durumunu getir
 */
router.get('/son-durum', authenticateToken, async (req, res) => {
  try {
    const forkliftciId = parseInt(req.user.id);

    const durum = await ForkliftDurum.findOne({
      where: { forkliftci_id: forkliftciId },
      order: [['olusturma_tarihi', 'DESC']]
    });

    if (!durum) {
      return res.status(404).json({ error: 'Durum kaydı bulunamadı' });
    }

    const plain = durum.get({ plain: true });
    res.json({
      ...plain,
      id: plain.id.toString(),
      forkliftci_id: plain.forkliftci_id.toString()
    });
  } catch (error) {
    console.error('Son durum hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Forkliftçinin durum geçmişini getir
 */
router.get('/durum-gecmis', authenticateToken, async (req, res) => {
  try {
    const forkliftciId = parseInt(req.user.id);
    const { limit = 20 } = req.query;

    const durumlar = await ForkliftDurum.findAll({
      where: { forkliftci_id: forkliftciId },
      order: [['olusturma_tarihi', 'DESC']],
      limit: parseInt(limit)
    });

    const formatted = durumlar.map(durum => {
      const plain = durum.get({ plain: true });
      return {
        ...plain,
        id: plain.id.toString(),
        forkliftci_id: plain.forkliftci_id.toString()
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Durum geçmişi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Forklift tespiti - Görselin forklift olup olmadığını kontrol eder
 */
async function detectForklift(imagePath) {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const { data, info } = await image
      .resize(400, 400, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const channels = info.channels;
    const totalPixels = width * height;

    // Forklift tespiti için göstergeler
    let forkliftScore = 0;
    const maxScore = 1.0;

    // 1. Görsel oranı kontrolü (Forklift genellikle dikey veya kare)
    const aspectRatio = width / height;
    if (aspectRatio >= 0.6 && aspectRatio <= 1.4) {
      forkliftScore += 0.15;
    }

    // 2. Dikey yapı tespiti
    const topRegion = Math.floor(height * 0.3);
    const bottomRegion = Math.floor(height * 0.7);
    const middleRegion = Math.floor(height * 0.5);

    let topBrightness = 0;
    let bottomBrightness = 0;
    let middleBrightness = 0;
    let topPixels = 0;
    let bottomPixels = 0;
    let middlePixels = 0;

    // 3. Çatal bölgesi tespiti
    const forkRegionY = Math.floor(height * 0.6);
    const forkRegionHeight = Math.floor(height * 0.4);
    const forkRegionX = Math.floor(width * 0.2);
    const forkRegionWidth = Math.floor(width * 0.6);

    let forkRegionPixels = 0;
    let forkRegionBrightness = 0;
    let forkVerticalLines = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1] || r;
        const b = data[idx + 2] || r;
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b);

        if (y < topRegion) {
          topBrightness += brightness;
          topPixels++;
        } else if (y > bottomRegion) {
          bottomBrightness += brightness;
          bottomPixels++;
        } else {
          middleBrightness += brightness;
          middlePixels++;
        }

        if (y >= forkRegionY && y < forkRegionY + forkRegionHeight &&
            x >= forkRegionX && x < forkRegionX + forkRegionWidth) {
          forkRegionPixels++;
          forkRegionBrightness += brightness;

          if (x > 0 && x < width - 1) {
            const leftBrightness = (0.299 * data[((y * width + (x - 1)) * channels)] + 
                                   0.587 * data[((y * width + (x - 1)) * channels) + 1] + 
                                   0.114 * data[((y * width + (x - 1)) * channels) + 2]);
            const rightBrightness = (0.299 * data[((y * width + (x + 1)) * channels)] + 
                                    0.587 * data[((y * width + (x + 1)) * channels) + 1] + 
                                    0.114 * data[((y * width + (x + 1)) * channels) + 2]);
            const contrast = Math.abs(brightness - leftBrightness) + Math.abs(brightness - rightBrightness);
            if (contrast > 30) {
              forkVerticalLines++;
            }
          }
        }
      }
    }

    const avgTopBrightness = topPixels > 0 ? topBrightness / topPixels : 0;
    const avgBottomBrightness = bottomPixels > 0 ? bottomBrightness / bottomPixels : 0;
    const avgMiddleBrightness = middlePixels > 0 ? middleBrightness / middlePixels : 0;
    const avgForkBrightness = forkRegionPixels > 0 ? forkRegionBrightness / forkRegionPixels : 0;

    const topBottomDifference = Math.abs(avgTopBrightness - avgBottomBrightness);
    if (topBottomDifference > 20) {
      forkliftScore += 0.2;
    }

    if (forkRegionPixels > totalPixels * 0.15) {
      forkliftScore += 0.15;
    }

    const forkVerticalLineRatio = forkVerticalLines / forkRegionPixels;
    if (forkVerticalLineRatio > 0.1) {
      forkliftScore += 0.2;
    }

    let industrialColors = 0;
    for (let i = 0; i < data.length; i += channels * 100) {
      const r = data[i];
      const g = data[i + 1] || r;
      const b = data[i + 2] || r;
      
      const grayVariance = Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
      if (grayVariance < 30) {
        industrialColors++;
      }
      
      if ((r > 200 && g > 150 && b < 100) || (r < 100 && g < 150 && b > 200)) {
        industrialColors++;
      }
    }
    
    const industrialColorRatio = industrialColors / (totalPixels / 100);
    if (industrialColorRatio > 0.3) {
      forkliftScore += 0.15;
    }

    const centerVerticalStructure = Math.abs(avgMiddleBrightness - avgForkBrightness);
    if (centerVerticalStructure > 15) {
      forkliftScore += 0.15;
    }

    const isForklift = forkliftScore >= 0.5;

    return {
      isForklift,
      forkliftScore: Math.round(forkliftScore * 100) / 100,
      details: {
        aspectRatio: Math.round(aspectRatio * 100) / 100,
        topBottomDifference: Math.round(topBottomDifference),
        forkRegionRatio: Math.round((forkRegionPixels / totalPixels) * 100) / 100,
        forkVerticalLineRatio: Math.round(forkVerticalLineRatio * 100) / 100,
        industrialColorRatio: Math.round(industrialColorRatio * 100) / 100
      }
    };
  } catch (error) {
    console.error('Forklift tespit hatası:', error);
    return {
      isForklift: false,
      forkliftScore: 0,
      error: error.message
    };
  }
}

/**
 * Çatalları tespit et - Forkliftin çatallarını (forks) bulur
 */
async function detectForks(imagePath) {
  try {
    const image = sharp(imagePath);
    const { data, info } = await image
      .resize(600, 600, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const channels = info.channels;

    // Çatal bölgesi - Çatallar genellikle görselin en alt kısmında, ortada, yatay metal çubuklar
    // Daha hassas bölge: görselin alt %20-40 arası, ortada
    const forkRegionY = Math.floor(height * 0.60); // Alt kısımdan başla (daha aşağı)
    const forkRegionHeight = Math.floor(height * 0.25); // Yüksekliğin %25'i (daha dar)
    const forkRegionX = Math.floor(width * 0.30); // Sol kenardan %30 (daha ortada)
    const forkRegionWidth = Math.floor(width * 0.40); // Genişliğin %40'ı (daha dar)

    let forkVerticalEdges = 0; // Dikey kenarlar (çatallar dikey çizgiler)
    let forkHorizontalEdges = 0; // Yatay kenarlar
    let forkRegionBrightness = 0;
    let forkRegionPixels = 0;
    let forkContrastSum = 0;
    const forkBrightnessValues = [];

    // Kenar tespiti için Sobel benzeri filtre
    for (let y = forkRegionY; y < forkRegionY + forkRegionHeight && y < height - 1; y++) {
      for (let x = forkRegionX; x < forkRegionX + forkRegionWidth && x < width - 1; x++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1] || r;
        const b = data[idx + 2] || r;
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
        
        forkBrightnessValues.push(brightness);
        forkRegionBrightness += brightness;
        forkRegionPixels++;

        // Dikey kenar tespiti (çatallar dikey çizgiler)
        const topIdx = ((y - 1) * width + x) * channels;
        const bottomIdx = ((y + 1) * width + x) * channels;
        const topBrightness = (0.299 * data[topIdx] + 0.587 * data[topIdx + 1] + 0.114 * data[topIdx + 2]);
        const bottomBrightness = (0.299 * data[bottomIdx] + 0.587 * data[bottomIdx + 1] + 0.114 * data[bottomIdx + 2]);
        const verticalGradient = Math.abs(brightness - topBrightness) + Math.abs(brightness - bottomBrightness);
        
        if (verticalGradient > 40) {
          forkVerticalEdges++;
        }

        // Yatay kenar tespiti
        const leftIdx = (y * width + (x - 1)) * channels;
        const rightIdx = (y * width + (x + 1)) * channels;
        const leftBrightness = (0.299 * data[leftIdx] + 0.587 * data[leftIdx + 1] + 0.114 * data[leftIdx + 2]);
        const rightBrightness = (0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2]);
        const horizontalGradient = Math.abs(brightness - leftBrightness) + Math.abs(brightness - rightBrightness);
        
        if (horizontalGradient > 30) {
          forkHorizontalEdges++;
        }

        forkContrastSum += verticalGradient + horizontalGradient;
      }
    }

    const avgForkBrightness = forkRegionPixels > 0 ? forkRegionBrightness / forkRegionPixels : 0;
    const forkVerticalEdgeRatio = forkRegionPixels > 0 ? forkVerticalEdges / forkRegionPixels : 0;
    const forkHorizontalEdgeRatio = forkRegionPixels > 0 ? forkHorizontalEdges / forkRegionPixels : 0;
    const avgForkContrast = forkRegionPixels > 0 ? forkContrastSum / forkRegionPixels : 0;

    // Varyans hesapla (çatallar varsa daha yüksek varyans olur)
    let forkVariance = 0;
    forkBrightnessValues.forEach(val => {
      forkVariance += Math.pow(val - avgForkBrightness, 2);
    });
    forkVariance = forkRegionPixels > 0 ? forkVariance / forkRegionPixels : 0;

    // Çatal tespit skoru - İyileştirilmiş algoritma
    let forkDetectionScore = 0;
    
    // 1. Dikey kenarlar çatalların göstergesi (çatallar dikey metal çubuklar)
    // Ama çatallar yatay uzandığı için yatay kenarlar da önemli
    if (forkVerticalEdgeRatio > 0.12) {
      forkDetectionScore += 0.3;
    } else if (forkVerticalEdgeRatio > 0.08) {
      forkDetectionScore += 0.2;
    } else if (forkVerticalEdgeRatio > 0.04) {
      forkDetectionScore += 0.1;
    }

    // 2. Yatay kenarlar (çatallar yatay metal çubuklar, yatay kenarlar önemli)
    if (forkHorizontalEdgeRatio > 0.15) {
      forkDetectionScore += 0.35; // Yatay kenarlar daha önemli
    } else if (forkHorizontalEdgeRatio > 0.10) {
      forkDetectionScore += 0.25;
    } else if (forkHorizontalEdgeRatio > 0.06) {
      forkDetectionScore += 0.15;
    }

    // 3. Yüksek kontrast çatalların göstergesi (metal yüzeyler yüksek kontrast)
    if (avgForkContrast > 55) {
      forkDetectionScore += 0.2;
    } else if (avgForkContrast > 40) {
      forkDetectionScore += 0.15;
    } else if (avgForkContrast > 25) {
      forkDetectionScore += 0.1;
    }

    // 4. Varyans (çatallar varsa daha yüksek varyans - metal yüzeyler)
    if (forkVariance > 700) {
      forkDetectionScore += 0.15;
    } else if (forkVariance > 500) {
      forkDetectionScore += 0.1;
    } else if (forkVariance > 300) {
      forkDetectionScore += 0.05;
    }

    // Eşik değeri - Biraz düşürüldü (çatallar tespit edilebilsin)
    const forksDetected = forkDetectionScore >= 0.45; // 0.5'ten 0.45'e düşürüldü

    return {
      forksDetected,
      forkDetectionScore: Math.round(forkDetectionScore * 100) / 100,
      forkRegion: {
        x: forkRegionX,
        y: forkRegionY,
        width: forkRegionWidth,
        height: forkRegionHeight
      },
      details: {
        avgBrightness: Math.round(avgForkBrightness),
        verticalEdgeRatio: Math.round(forkVerticalEdgeRatio * 100) / 100,
        horizontalEdgeRatio: Math.round(forkHorizontalEdgeRatio * 100) / 100,
        avgContrast: Math.round(avgForkContrast),
        variance: Math.round(forkVariance)
      }
    };
  } catch (error) {
    console.error('Çatal tespit hatası:', error);
    return {
      forksDetected: false,
      forkDetectionScore: 0,
      error: error.message
    };
  }
}

/**
 * Çatalların üzerinde yük var mı kontrol et
 */
async function detectLoadOnForks(imagePath, forkRegion) {
  try {
    const image = sharp(imagePath);
    const { data, info } = await image
      .resize(600, 600, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const channels = info.channels;

    // Çatal bölgesinin üstünde yük olup olmadığını kontrol et
    // Yük SADECE çatalların tam üstünde, çatallarla aynı genişlikte, çok dar bir bölge olmalı
    // Forklift mast'ını kapsamamalı - yük çatalların hemen üstünde, mast'tan ayrı
    const loadRegionY = Math.max(0, forkRegion.y - Math.floor(forkRegion.height * 0.2)); // Çatalların hemen üstü (daha yakın)
    const loadRegionHeight = Math.floor(forkRegion.height * 0.25); // Çok dar bölge (çatal yüksekliğinin %25'i)
    // Yük çatallarla tam aynı genişlikte olmalı
    const loadRegionX = forkRegion.x; // Çatallarla aynı x pozisyonu
    const loadRegionWidth = forkRegion.width; // Çatallarla aynı genişlik

    let loadRegionBrightness = 0;
    let loadRegionPixels = 0;
    let loadDarkPixels = 0; // Karanlık pikseller (yük genellikle karanlık)
    let loadColorDiversity = new Set();
    const loadBrightnessValues = [];

    for (let y = loadRegionY; y < loadRegionY + loadRegionHeight && y < height; y++) {
      for (let x = loadRegionX; x < loadRegionX + loadRegionWidth && x < width; x++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1] || r;
        const b = data[idx + 2] || r;
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
        
        loadBrightnessValues.push(brightness);
        loadRegionBrightness += brightness;
        loadRegionPixels++;

        if (brightness < 100) { // Karanlık piksel
          loadDarkPixels++;
        }

        // Renk çeşitliliği (yük varsa daha fazla renk olur)
        const colorKey = `${Math.floor(r / 32)}-${Math.floor(g / 32)}-${Math.floor(b / 32)}`;
        loadColorDiversity.add(colorKey);
      }
    }

    const avgLoadBrightness = loadRegionPixels > 0 ? loadRegionBrightness / loadRegionPixels : 0;
    const loadDarkRatio = loadRegionPixels > 0 ? loadDarkPixels / loadRegionPixels : 0;
    const loadColorCount = loadColorDiversity.size;

    // Varyans hesapla
    let loadVariance = 0;
    loadBrightnessValues.forEach(val => {
      loadVariance += Math.pow(val - avgLoadBrightness, 2);
    });
    loadVariance = loadRegionPixels > 0 ? loadVariance / loadRegionPixels : 0;

    // Çatal bölgesi ile karşılaştır (yük varsa çatal bölgesinden daha karanlık olur)
    let forkRegionBrightness = 0;
    let forkRegionPixels = 0;
    for (let y = forkRegion.y; y < forkRegion.y + forkRegion.height && y < height; y++) {
      for (let x = forkRegion.x; x < forkRegion.x + forkRegion.width && x < width; x++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1] || r;
        const b = data[idx + 2] || r;
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
        forkRegionBrightness += brightness;
        forkRegionPixels++;
      }
    }
    const avgForkBrightness = forkRegionPixels > 0 ? forkRegionBrightness / forkRegionPixels : 0;
    const brightnessDifference = avgForkBrightness - avgLoadBrightness; // Pozitif ise yük var (çatallar daha parlak)

    // Yük tespit skoru - Daha hassas algoritma
    let loadDetectionScore = 0;
    
    // 1. Çatal bölgesinden belirgin şekilde daha karanlık olmalı (yük varsa)
    // Bu en önemli kriter - yük genellikle çatallardan daha koyu
    // Ama forklift mast'ı da koyu olabilir, bu yüzden daha yüksek eşik kullan
    if (brightnessDifference > 50) {
      loadDetectionScore += 0.5; // Çok belirgin fark (yük var)
    } else if (brightnessDifference > 35) {
      loadDetectionScore += 0.35; // Belirgin fark
    } else if (brightnessDifference > 20) {
      loadDetectionScore += 0.2; // Orta fark
    } else if (brightnessDifference < 5) {
      // Eğer yük bölgesi çatallardan çok farklı değilse, muhtemelen yük yok (mast olabilir)
      loadDetectionScore -= 0.4; // Büyük ceza puanı
    } else if (brightnessDifference < -10) {
      // Eğer yük bölgesi çatallardan daha parlak ise, kesinlikle yük yok
      loadDetectionScore -= 0.5; // Çok büyük ceza puanı
    }

    // 2. Karanlık piksel oranı (yük genellikle koyu renkli)
    if (loadDarkRatio > 0.5) {
      loadDetectionScore += 0.25;
    } else if (loadDarkRatio > 0.35) {
      loadDetectionScore += 0.15;
    } else if (loadDarkRatio < 0.15) {
      // Çok parlak ise muhtemelen yük yok
      loadDetectionScore -= 0.2;
    }

    // 3. Yüksek varyans (yük varsa daha fazla detay/varyans)
    if (loadVariance > 1200) {
      loadDetectionScore += 0.15;
    } else if (loadVariance > 800) {
      loadDetectionScore += 0.1;
    } else if (loadVariance < 300) {
      // Çok düşük varyans = homojen bölge = muhtemelen arka plan
      loadDetectionScore -= 0.15;
    }

    // 4. Arka plan ile karşılaştır (yük bölgesinin yanındaki arka plan)
    // Yük varsa, arka plandan farklı olmalı
    let backgroundBrightness = 0;
    let backgroundPixels = 0;
    // Yük bölgesinin sağında veya solunda arka plan kontrol et
    const bgRegionX = loadRegionX + loadRegionWidth + 20; // Yük bölgesinin sağında
    const bgRegionY = loadRegionY;
    const bgRegionHeight = loadRegionHeight;
    const bgRegionWidth = Math.floor(width * 0.1); // Genişliğin %10'u
    
    for (let y = bgRegionY; y < bgRegionY + bgRegionHeight && y < height; y++) {
      for (let x = bgRegionX; x < bgRegionX + bgRegionWidth && x < width; x++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1] || r;
        const b = data[idx + 2] || r;
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
        backgroundBrightness += brightness;
        backgroundPixels++;
      }
    }
    
    const avgBackgroundBrightness = backgroundPixels > 0 ? backgroundBrightness / backgroundPixels : avgLoadBrightness;
    const loadBackgroundDiff = Math.abs(avgLoadBrightness - avgBackgroundBrightness);
    
    // Yük varsa arka plandan farklı olmalı
    if (loadBackgroundDiff > 30) {
      loadDetectionScore += 0.1;
    } else if (loadBackgroundDiff < 10) {
      // Arka planla çok benzer = muhtemelen yük yok
      loadDetectionScore -= 0.2;
    }

    // 5. Yük bölgesinin yüksekliği kontrolü
    // Yük genellikle çatalların üstünde düz bir yapıdır
    // Eğer bölge çok yüksekse, muhtemelen forklift mast'ıdır, yük değil
    const loadRegionAspectRatio = loadRegionHeight / loadRegionWidth;
    if (loadRegionAspectRatio > 0.8) {
      // Çok yüksek bölge = muhtemelen mast, yük değil
      loadDetectionScore -= 0.3;
    } else if (loadRegionAspectRatio < 0.3) {
      // Düz, yatay bölge = muhtemelen yük
      loadDetectionScore += 0.15;
    }

    // Skoru normalize et (0-1 arası)
    loadDetectionScore = Math.max(0, Math.min(1, loadDetectionScore));
    
    // Eşik değeri - Daha yüksek eşik (daha konservatif, yanlış pozitifleri azalt)
    const hasLoad = loadDetectionScore >= 0.60; // 0.55'ten 0.60'a çıkarıldı

    return {
      hasLoad,
      loadDetectionScore: Math.round(loadDetectionScore * 100) / 100,
      loadRegion: {
        x: loadRegionX,
        y: loadRegionY,
        width: loadRegionWidth,
        height: loadRegionHeight
      },
      details: {
        avgBrightness: Math.round(avgLoadBrightness),
        avgForkBrightness: Math.round(avgForkBrightness),
        brightnessDifference: Math.round(brightnessDifference),
        darkRatio: Math.round(loadDarkRatio * 100) / 100,
        variance: Math.round(loadVariance),
        colorCount: loadColorCount
      }
    };
  } catch (error) {
    console.error('Yük tespit hatası:', error);
    return {
      hasLoad: false,
      loadDetectionScore: 0,
      error: error.message
    };
  }
}

/**
 * Görsel analiz fonksiyonu - Önce çatalları tespit eder, sonra üzerinde yük var mı kontrol eder
 */
async function analyzeForkliftImage(imagePath) {
  try {
    // 1. Önce forklift olup olmadığını kontrol et
    const forkliftDetection = await detectForklift(imagePath);
    
    // Forklift tespit edilemese bile devam et (kullanıcıya sonuçları göster)
    // if (!forkliftDetection.isForklift) {
    //   throw new Error(
    //     `Görsel forklift olarak tespit edilemedi. ` +
    //     `Forklift skoru: %${Math.round(forkliftDetection.forkliftScore * 100)}. ` +
    //     `Lütfen forklift görseli yükleyin.`
    //   );
    // }

    // 2. Çatalları tespit et
    const forkDetection = await detectForks(imagePath);
    
    // Çatal tespit edilemese bile devam et (kullanıcıya sonuçları göster)
    // if (!forkDetection.forksDetected) {
    //   throw new Error(
    //     `Forklift çatalları tespit edilemedi. ` +
    //     `Çatal tespit skoru: %${Math.round(forkDetection.forkDetectionScore * 100)}. ` +
    //     `Lütfen forkliftin çatallarının görünür olduğu bir görsel yükleyin.`
    //   );
    // }

    // 3. Çatalların üzerinde yük var mı kontrol et
    // Eğer çatal tespit edilmediyse varsayılan bir bölge kullan
    const forkRegion = forkDetection.forkRegion || {
      x: 0,
      y: Math.floor(600 * 0.55),
      width: Math.floor(600 * 0.5),
      height: Math.floor(600 * 0.35)
    };
    const loadDetection = await detectLoadOnForks(imagePath, forkRegion);

    // 4. Sonuç belirleme
    const isFull = loadDetection.hasLoad;
    let confidence = 0.5;

    // Güven skorunu hesapla
    if (isFull) {
      // Yük var
      confidence = 0.5 + (loadDetection.loadDetectionScore * 0.4);
    } else {
      // Yük yok (boş)
      confidence = 0.5 + ((1 - loadDetection.loadDetectionScore) * 0.4);
    }

    // Çatal tespit skorunu da güven skoruna ekle (eğer çatal tespit edildiyse)
    if (forkDetection.forksDetected) {
      confidence = confidence * 0.7 + (forkDetection.forkDetectionScore * 0.3);
    } else {
      // Çatal tespit edilmediyse sadece yük tespit skorunu kullan
      confidence = confidence * 0.8;
    }

    confidence = Math.max(0.3, Math.min(0.95, confidence));

    return {
      durum: isFull ? 'dolu' : 'bos',
      guven_skoru: Math.round(confidence * 100) / 100,
      forklift_tespit: forkliftDetection,
      cata_tespit: forkDetection,
      yuk_tespit: loadDetection,
      analiz_sonucu: JSON.stringify({
        forkliftScore: forkliftDetection.forkliftScore,
        forkliftDetails: forkliftDetection.details,
        forkDetectionScore: forkDetection.forkDetectionScore,
        forkDetails: forkDetection.details,
        loadDetectionScore: loadDetection.loadDetectionScore,
        loadDetails: loadDetection.details,
        isFull: isFull,
        confidence: Math.round(confidence * 100) / 100
      })
    };
  } catch (error) {
    console.error('Görsel analiz hatası:', error);
    throw new Error('Görsel analiz edilemedi: ' + error.message);
  }
}

module.exports = router;

