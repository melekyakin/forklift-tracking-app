const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService-pg');
const { authenticateToken, authorize } = require('../middleware/auth');

// Kasa doluluk tahmini
router.get('/tahmin/kasa/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { saat } = req.query;
  const saatIleri = parseInt(saat) || 1;

  aiService.predictKasaDoluluk(id, saatIleri)
    .then(result => res.json(result))
    .catch(err => res.status(500).json({ error: err.message }));
});

// Anomali tespiti
router.get('/anomali/workstation/:id', authenticateToken, authorize('admin', 'yonetici'), (req, res) => {
  const { id } = req.params;
  const { limit } = req.query;

  aiService.detectAnomalies(id, parseInt(limit) || 10)
    .then(result => res.json(result))
    .catch(err => res.status(500).json({ error: err.message }));
});

// Optimizasyon önerileri
router.get('/optimizasyon/workstation/:id', authenticateToken, authorize('admin', 'yonetici'), (req, res) => {
  const { id } = req.params;

  aiService.getOptimizationSuggestions(id)
    .then(result => res.json(result))
    .catch(err => res.status(500).json({ error: err.message }));
});

// Forkliftçi performans analizi
router.get('/performans/forkliftci/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { periyot } = req.query;

  // Kullanıcı sadece kendi performansını görebilir (admin hariç)
  if (req.user.rol !== 'admin' && req.user.rol !== 'yonetici' && parseInt(id) !== req.user.id) {
    return res.status(403).json({ error: 'Yetkiniz yok' });
  }

  aiService.analyzeForkliftciPerformance(id, parseInt(periyot) || 30)
    .then(result => res.json(result))
    .catch(err => res.status(500).json({ error: err.message }));
});

module.exports = router;

