const pool = require('../../config/database');

// Xem danh sách người dùng
exports.getUsers = async (req, res) => {
  const query = 'SELECT * FROM users'; // Lấy danh sách người dùng

  try {
    const [users] = await pool.query(query);
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách người dùng', error: err.message });
  }
};

// Cập nhật tài khoản người dùng
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { full_name, email, phone, status, role } = req.body;

  const query = 'UPDATE users SET full_name = ?, email = ?, phone = ?, status = ?, role = ? WHERE id = ?';

  try {
    const [result] = await pool.query(query, [
      full_name, email, phone, status || 'active', role || 'customer', id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Người dùng không tìm thấy' });
    }

    res.status(200).json({ message: 'Tài khoản người dùng đã được cập nhật' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi cập nhật người dùng', error: err.message });
  }
};