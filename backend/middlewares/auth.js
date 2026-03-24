const jwt = require('jsonwebtoken');

// Middleware xác thực token JWT
function verifyToken(req, res, next) {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(403).json({ message: 'Token không có, truy cập bị từ chối' });
  }

  const tokenWithoutBearer = token.startsWith('Bearer ') ? token.slice(7) : token;

  jwt.verify(tokenWithoutBearer, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Token không hợp lệ' });
    }
    req.user = decoded;  // Lưu thông tin người dùng vào req.user
    next();  // Tiếp tục xử lý request
  });
}

// Middleware kiểm tra quyền admin
function isAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Không có quyền truy cập' });
  }
  next();
}

module.exports = { verifyToken, isAdmin };