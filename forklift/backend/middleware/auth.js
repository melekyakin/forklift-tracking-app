const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'forklift-secret-key-change-in-production';

// Token doğrulama middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Erişim token\'ı bulunamadı' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Geçersiz token' });
    }
    req.user = user;
    next();
  });
}

// Rol bazlı yetkilendirme middleware
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Kimlik doğrulanmadı' });
    }

    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }

    next();
  };
}

// Workstation kontrolü - kullanıcının workstation'ına erişim kontrolü
function checkWorkstationAccess(req, res, next) {
  const workstationId = req.params.workstation_id || req.body.workstation_id;

  // Admin ve yönetici tüm workstation'lara erişebilir
  if (req.user.rol === 'admin' || req.user.rol === 'yonetici') {
    return next();
  }

  // Diğer kullanıcılar sadece kendi workstation'larına erişebilir
  if (req.user.workstation_id && workstationId) {

    const userWorkstationId = req.user.workstation_id.toString();
    const requestedWorkstationId = workstationId.toString();
    
    if (userWorkstationId !== requestedWorkstationId) {
      return res.status(403).json({ error: 'Bu workstation\'a erişim yetkiniz yok' });
    }
  }

  next();
}

module.exports = {
  authenticateToken,
  authorize,
  checkWorkstationAccess
};
