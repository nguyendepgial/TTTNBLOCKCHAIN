const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/database');

// Kiểm tra định dạng email và số điện thoại
function validateEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;  // Kiểm tra email phải có đuôi @gmail.com
  return emailRegex.test(email);
}

function validatePhoneNumber(phone) {
  return phone.length === 10 && /^[0-9]+$/.test(phone);  // Kiểm tra số điện thoại có 10 chữ số
}

// Đăng ký người dùng
const register = async (req, res) => {
  const { full_name, email, phone, password } = req.body;

  // Kiểm tra email và số điện thoại hợp lệ
  if (!validateEmail(email)) {
    return res.status(400).json({ message: 'Email phải có định dạng @gmail.com' });
  }

  if (!validatePhoneNumber(phone)) {
    return res.status(400).json({ message: 'Số điện thoại phải có 10 chữ số' });
  }

  // Kiểm tra trùng email hoặc số điện thoại
  const checkQuery = 'SELECT id FROM users WHERE email = ? OR phone = ?';
  try {
    const [existingUsers] = await pool.query(checkQuery, [email, phone]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Email hoặc số điện thoại đã tồn tại' });
    }

    // Mã hóa mật khẩu trước khi lưu vào DB
    const hashedPassword = await bcrypt.hash(password, 10);

    // Lưu người dùng mới vào cơ sở dữ liệu
    const query = 'INSERT INTO users (full_name, email, phone, password_hash, role, status) VALUES (?, ?, ?, ?, "customer", "active")';
    const [result] = await pool.query(query, [full_name, email, phone, hashedPassword]);

    return res.status(201).json({
      success: true,
      message: 'Đăng ký thành công',
      user: {
        id: result.insertId,
        full_name,
        email,
        phone: phone || null,
        role: 'customer'
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi đăng ký',
      error: err.message
    });
  }
};

// Đăng nhập người dùng
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu' });
  }

  const query = 'SELECT * FROM users WHERE email = ? LIMIT 1';
  try {
    const [users] = await pool.query(query, [email]);

    if (users.length === 0) {
      return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    const user = users[0];

    // Kiểm tra trạng thái tài khoản
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản đã bị khóa hoặc không hoạt động'
      });
    }

    // Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    // Tạo JWT token với thông tin người dùng
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }  // Token hết hạn sau 7 ngày
    );

    // Trả về thông tin người dùng và token
    return res.json({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi đăng nhập',
      error: err.message
    });
  }
};

module.exports = {
  register,
  login
};