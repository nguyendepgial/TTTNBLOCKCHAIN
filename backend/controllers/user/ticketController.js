const pool = require('../../config/database');

// Lịch sử mua vé của người dùng
exports.getTicketHistory = async (req, res) => {
  const { user_id } = req.user; // Lấy user_id từ token đã xác thực

  const query = 'SELECT * FROM tickets WHERE owner_user_id = ?';

  try {
    const [tickets] = await pool.query(query, [user_id]);
    res.status(200).json(tickets);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi lấy lịch sử vé', error: err.message });
  }
};

// Chuyển nhượng vé
exports.transferTicket = async (req, res) => {
  const { ticket_id, to_user_id, transfer_tx_hash } = req.body;

  if (!ticket_id || !to_user_id || !transfer_tx_hash) {
    return res.status(400).json({ message: 'Cần cung cấp ticket_id, to_user_id và transfer_tx_hash' });
  }

  const query = 'UPDATE tickets SET owner_user_id = ?, status = "transferred" WHERE id = ?';

  try {
    const [result] = await pool.query(query, [to_user_id, ticket_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Vé không tìm thấy' });
    }

    // Lưu lịch sử chuyển nhượng
    const transferQuery = 'INSERT INTO ticket_transfers (ticket_id, from_user_id, to_user_id, transfer_tx_hash) VALUES (?, ?, ?, ?)';
    await pool.query(transferQuery, [ticket_id, req.user.id, to_user_id, transfer_tx_hash]);

    res.status(200).json({ message: 'Chuyển nhượng vé thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi chuyển nhượng vé', error: err.message });
  }
};