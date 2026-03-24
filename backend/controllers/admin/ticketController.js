const pool = require('../../config/database');

// Cấp lại vé
exports.reissueTicket = async (req, res) => {
  const { ticket_id, new_ticket_code } = req.body;

  // Kiểm tra nếu ticket_id và new_ticket_code đã có
  if (!ticket_id || !new_ticket_code) {
    return res.status(400).json({ message: 'Cần cung cấp ticket_id và new_ticket_code' });
  }

  const query = 'UPDATE tickets SET ticket_code = ?, status = "reissued" WHERE id = ?';

  try {
    const [result] = await pool.query(query, [new_ticket_code, ticket_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Vé không tìm thấy' });
    }

    res.status(200).json({ message: 'Vé đã được cấp lại thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi cấp lại vé', error: err.message });
  }
};

// Thay đổi trạng thái vé
exports.updateTicketStatus = async (req, res) => {
  const { ticket_id, status } = req.body;

  // Kiểm tra trạng thái hợp lệ
  const validStatuses = ['active', 'used', 'transferred', 'reissued'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Trạng thái vé không hợp lệ' });
  }

  const query = 'UPDATE tickets SET status = ? WHERE id = ?';

  try {
    const [result] = await pool.query(query, [status, ticket_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Vé không tìm thấy' });
    }

    res.status(200).json({ message: 'Trạng thái vé đã được cập nhật' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái vé', error: err.message });
  }
};