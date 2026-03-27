const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middlewares/auth');
const pool = require('../../config/database');

// Lấy danh sách vé mà người dùng đang sở hữu
const getMyTickets = async (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT 
      t.id,
      t.ticket_code,
      t.event_id,
      t.ticket_type_id,
      t.order_id,
      t.owner_user_id,
      t.owner_wallet_address,
      t.blockchain_ticket_id,
      t.contract_address,
      t.mint_tx_hash,
      t.qr_code,
      t.status,
      t.is_used,
      t.used_at,
      t.transferred_count,
      t.created_at,
      t.updated_at,
      e.title AS event_title,
      e.location,
      e.event_date,
      tt.name AS ticket_type_name,
      tt.price
    FROM tickets t
    INNER JOIN events e ON t.event_id = e.id
    INNER JOIN ticket_types tt ON t.ticket_type_id = tt.id
    WHERE t.owner_user_id = ?
    ORDER BY t.created_at DESC
  `;

  try {
    const [tickets] = await pool.query(query, [userId]);

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách vé thành công',
      data: tickets
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách vé',
      error: err.message
    });
  }
};

// Lấy lịch sử mua vé của người dùng theo đơn hàng
const getTicketHistory = async (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT
      o.id AS order_id,
      o.order_code,
      o.total_amount,
      o.payment_status,
      o.order_status,
      o.payment_method,
      o.payment_reference,
      o.notes,
      o.created_at AS order_created_at,
      oi.id AS order_item_id,
      oi.ticket_type_id,
      oi.quantity,
      oi.unit_price,
      oi.subtotal,
      tt.name AS ticket_type_name,
      tt.event_id,
      e.title AS event_title,
      e.location,
      e.event_date
    FROM orders o
    INNER JOIN order_items oi ON o.id = oi.order_id
    INNER JOIN ticket_types tt ON oi.ticket_type_id = tt.id
    INNER JOIN events e ON tt.event_id = e.id
    WHERE o.user_id = ?
    ORDER BY o.created_at DESC, oi.id DESC
  `;

  try {
    const [history] = await pool.query(query, [userId]);

    return res.status(200).json({
      success: true,
      message: 'Lấy lịch sử mua vé thành công',
      data: history
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy lịch sử mua vé',
      error: err.message
    });
  }
};

// Chuyển nhượng vé cho người dùng khác
const transferTicket = async (req, res) => {
  const fromUserId = req.user.id;
  const { ticket_id, to_user_id, transfer_tx_hash } = req.body;

  if (!ticket_id || !to_user_id) {
    return res.status(400).json({
      success: false,
      message: 'Cần cung cấp ticket_id và to_user_id'
    });
  }

  if (Number(fromUserId) === Number(to_user_id)) {
    return res.status(400).json({
      success: false,
      message: 'Không thể chuyển nhượng vé cho chính mình'
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Kiểm tra người nhận có tồn tại và đang hoạt động không
    const [toUsers] = await connection.query(
      'SELECT id FROM users WHERE id = ? AND status = "active" LIMIT 1',
      [to_user_id]
    );

    if (toUsers.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Người nhận không tồn tại hoặc không hoạt động'
      });
    }

    // 2. Kiểm tra vé có tồn tại và thuộc sở hữu của người đang đăng nhập không
    const [tickets] = await connection.query(
      `
      SELECT 
        t.*,
        tt.transferable
      FROM tickets t
      INNER JOIN ticket_types tt ON t.ticket_type_id = tt.id
      WHERE t.id = ? AND t.owner_user_id = ?
      LIMIT 1
      `,
      [ticket_id, fromUserId]
    );

    if (tickets.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Vé không tồn tại hoặc không thuộc sở hữu của bạn'
      });
    }

    const ticket = tickets[0];

    // 3. Kiểm tra trạng thái vé
    if (ticket.status !== 'active') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể chuyển nhượng vé đang hoạt động'
      });
    }

    if (ticket.is_used === 1) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Vé đã được sử dụng, không thể chuyển nhượng'
      });
    }

    if (Number(ticket.transferable) !== 1) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Loại vé này không cho phép chuyển nhượng'
      });
    }

    // 4. Lấy ví chính của người gửi và người nhận nếu có
    const [fromWalletRows] = await connection.query(
      'SELECT wallet_address FROM wallets WHERE user_id = ? AND is_primary = 1 LIMIT 1',
      [fromUserId]
    );

    const [toWalletRows] = await connection.query(
      'SELECT wallet_address FROM wallets WHERE user_id = ? AND is_primary = 1 LIMIT 1',
      [to_user_id]
    );

    const fromWalletAddress =
      fromWalletRows.length > 0 ? fromWalletRows[0].wallet_address : null;

    const toWalletAddress =
      toWalletRows.length > 0 ? toWalletRows[0].wallet_address : null;

    // 5. Cập nhật chủ sở hữu mới cho vé
    await connection.query(
      `
      UPDATE tickets
      SET 
        owner_user_id = ?,
        owner_wallet_address = ?,
        transferred_count = transferred_count + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [to_user_id, toWalletAddress, ticket_id]
    );

    // 6. Ghi lịch sử chuyển nhượng
    await connection.query(
      `
      INSERT INTO ticket_transfers
      (
        ticket_id,
        from_user_id,
        to_user_id,
        from_wallet_address,
        to_wallet_address,
        transfer_tx_hash,
        status,
        transferred_at,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, 'completed', NOW(), ?)
      `,
      [
        ticket_id,
        fromUserId,
        to_user_id,
        fromWalletAddress,
        toWalletAddress,
        transfer_tx_hash || null,
        'Chuyển nhượng vé bởi người dùng'
      ]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Chuyển nhượng vé thành công'
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }

    return res.status(500).json({
      success: false,
      message: 'Lỗi khi chuyển nhượng vé',
      error: err.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Route definitions for user ticket operations
router.get('/', verifyToken, getMyTickets);
router.get('/history', verifyToken, getTicketHistory);
router.post('/transfer', verifyToken, transferTicket);

module.exports = router;