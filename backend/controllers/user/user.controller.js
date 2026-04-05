const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/database');

// =========================
// Helpers
// =========================
function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(email) {
  return normalizeString(email).toLowerCase();
}

function normalizePhone(phone) {
  return typeof phone === 'string' ? phone.replace(/\s+/g, '') : '';
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePhoneNumber(phone) {
  return /^(0[0-9]{9})$/.test(phone);
}

function validatePassword(password) {
  // Ít nhất 8 ký tự, 1 chữ thường, 1 chữ hoa, 1 số, 1 ký tự đặc biệt
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_\-\\[\]/+=~`]).{8,64}$/;
  return passwordRegex.test(password);
}

function validateFullName(fullName) {
  return fullName.length >= 2 && fullName.length <= 100;
}

// =========================
// Register
// =========================
const register = async (req, res) => {
  try {
    let { full_name, email, phone, password, confirm_password } = req.body;

    full_name = normalizeString(full_name);
    email = normalizeEmail(email);
    phone = normalizePhone(phone);
    password = typeof password === 'string' ? password : '';
    confirm_password = typeof confirm_password === 'string' ? confirm_password : '';

    const errors = {};

    if (!full_name) {
      errors.full_name = 'Họ tên không được để trống';
    } else if (!validateFullName(full_name)) {
      errors.full_name = 'Họ tên phải từ 2 đến 100 ký tự';
    }

    if (!email) {
      errors.email = 'Email không được để trống';
    } else if (!validateEmail(email)) {
      errors.email = 'Email không đúng định dạng';
    }

    if (!phone) {
      errors.phone = 'Số điện thoại không được để trống';
    } else if (!validatePhoneNumber(phone)) {
      errors.phone = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0';
    }

    if (!password) {
      errors.password = 'Mật khẩu không được để trống';
    } else if (!validatePassword(password)) {
      errors.password =
        'Mật khẩu phải từ 8-64 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt';
    }

    if (!confirm_password) {
      errors.confirm_password = 'Vui lòng xác nhận mật khẩu';
    } else if (password !== confirm_password) {
      errors.confirm_password = 'Xác nhận mật khẩu không khớp';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu đăng ký không hợp lệ',
        errors
      });
    }

    // Kiểm tra trùng email
    const [existingEmail] = await pool.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email đã tồn tại',
        errors: {
          email: 'Email đã được sử dụng'
        }
      });
    }

    // Kiểm tra trùng số điện thoại
    const [existingPhone] = await pool.query(
      'SELECT id FROM users WHERE phone = ? LIMIT 1',
      [phone]
    );

    if (existingPhone.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Số điện thoại đã tồn tại',
        errors: {
          phone: 'Số điện thoại đã được sử dụng'
        }
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertQuery = `
      INSERT INTO users (full_name, email, phone, password_hash, role, status)
      VALUES (?, ?, ?, ?, 'customer', 'active')
    `;

    const [result] = await pool.query(insertQuery, [
      full_name,
      email,
      phone,
      hashedPassword
    ]);

    return res.status(201).json({
      success: true,
      message: 'Đăng ký thành công',
      data: {
        id: result.insertId,
        full_name,
        email,
        phone,
        role: 'customer',
        status: 'active'
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

// =========================
// Login
// =========================
const login = async (req, res) => {
  try {
    let { email, password } = req.body;

    email = normalizeEmail(email);
    password = typeof password === 'string' ? password : '';

    const errors = {};

    if (!email) {
      errors.email = 'Email không được để trống';
    } else if (!validateEmail(email)) {
      errors.email = 'Email không đúng định dạng';
    }

    if (!password) {
      errors.password = 'Mật khẩu không được để trống';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu đăng nhập không hợp lệ',
        errors
      });
    }

    const query = 'SELECT * FROM users WHERE email = ? LIMIT 1';
    const [users] = await pool.query(query, [email]);

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng'
      });
    }

    const user = users[0];

    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản chưa hoạt động'
      });
    }

    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản đã bị khóa'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng'
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'Thiếu cấu hình JWT_SECRET trong môi trường'
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        token,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status
        }
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

// =========================
// Email Verification
// =========================
const sendVerificationEmail = async (req, res) => {
  try {
    const userId = req.user.id;

    // Generate verification token (expires in 24 hours)
    const verificationToken = jwt.sign(
      { userId, type: 'email_verification' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // In a real implementation, you would send an email here
    // For now, we'll just return the token for testing
    console.log(`Verification token for user ${userId}: ${verificationToken}`);

    return res.status(200).json({
      success: true,
      message: 'Verification email sent (check console for token)',
      verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi email xác thực',
      error: err.message
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu token xác thực'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'email_verification') {
      return res.status(400).json({
        success: false,
        message: 'Token không hợp lệ'
      });
    }

    // Update user status
    const [result] = await pool.query(
      'UPDATE users SET status = ? WHERE id = ? AND status = ?',
      ['active', decoded.userId, 'pending_verification']
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tài khoản đã được xác thực hoặc không tồn tại'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Email đã được xác thực thành công'
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({
        success: false,
        message: 'Token đã hết hạn'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xác thực email',
      error: err.message
    });
  }
};

// =========================
// Password Reset
// =========================
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!validateEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Email không hợp lệ'
      });
    }

    // Check if user exists
    const [users] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND status = ? LIMIT 1',
      [normalizedEmail, 'active']
    );

    if (users.length === 0) {
      // Don't reveal if email exists or not for security
      return res.status(200).json({
        success: true,
        message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu'
      });
    }

    const userId = users[0].id;

    // Generate reset token (expires in 1 hour)
    const resetToken = jwt.sign(
      { userId, type: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // In a real implementation, send email with reset link
    console.log(`Password reset token for ${normalizedEmail}: ${resetToken}`);

    return res.status(200).json({
      success: true,
      message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu',
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xử lý yêu cầu đặt lại mật khẩu',
      error: err.message
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin cần thiết'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu xác nhận không khớp'
      });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'password_reset') {
      return res.status(400).json({
        success: false,
        message: 'Token không hợp lệ'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    const [result] = await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, decoded.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Mật khẩu đã được đặt lại thành công'
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({
        success: false,
        message: 'Token đã hết hạn'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Lỗi khi đặt lại mật khẩu',
      error: err.message
    });
  }
};

// =========================
// Profile Management
// =========================
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, phone, wallet_address } = req.body;

    // Validate input
    if (full_name && !validateFullName(full_name)) {
      return res.status(400).json({
        success: false,
        message: 'Tên đầy đủ phải từ 2-100 ký tự'
      });
    }

    if (phone && !validatePhoneNumber(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Số điện thoại không hợp lệ (10 chữ số, bắt đầu bằng 0)'
      });
    }

    // Check phone uniqueness if provided
    if (phone) {
      const normalizedPhone = normalizePhone(phone);
      const [existingUsers] = await pool.query(
        'SELECT id FROM users WHERE phone = ? AND id != ? LIMIT 1',
        [normalizedPhone, userId]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Số điện thoại đã được sử dụng'
        });
      }
    }

    // Update profile
    const updateFields = [];
    const updateValues = [];

    if (full_name) {
      updateFields.push('full_name = ?');
      updateValues.push(full_name);
    }

    if (phone) {
      updateFields.push('phone = ?');
      updateValues.push(normalizePhone(phone));
    }

    if (wallet_address !== undefined) {
      updateFields.push('wallet_address = ?');
      updateValues.push(wallet_address);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không có thông tin nào để cập nhật'
      });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(userId);

    const [result] = await pool.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }

    // Get updated user data
    const [users] = await pool.query(
      'SELECT id, full_name, email, phone, wallet_address, role, status, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin thành công',
      data: users[0]
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật thông tin',
      error: err.message
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin mật khẩu'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu xác nhận không khớp'
      });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt'
      });
    }

    // Get current user
    const [users] = await pool.query(
      'SELECT password FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu hiện tại không đúng'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await pool.query(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi đổi mật khẩu',
      error: err.message
    });
  }
};

module.exports = {
  register,
  login,
  sendVerificationEmail,
  verifyEmail,
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword
};